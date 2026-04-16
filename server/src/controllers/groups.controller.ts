import { Response, NextFunction } from 'express';
import { AuthRequest, IGroup } from '../types';
import { Group } from '../models/Group';
import { Post } from '../models/Post';
import { Message } from '../models/Message';
import { ChatChannel } from '../models/ChatChannel';
import { User } from '../models/User';
import { GroupFile } from '../models/GroupFile';
import { createError } from '../middleware/errorHandler';
import { uploadToS3, resolveAvatarUrl, deleteFromS3 } from '../services/storage';
import { scanImageBuffer } from '../services/moderation';
import { containsProfanity } from '../utils/contentFilter';
import { Types } from 'mongoose';

// Resolve S3 avatar keys in a lean message array
const resolveMessageAvatarUrls = (msgs: Record<string, unknown>[]) =>
  msgs.map(m => {
    const msg = { ...m };
    if (msg.sender && typeof msg.sender === 'object') {
      const s = msg.sender as Record<string, unknown>;
      msg.sender = { ...s, avatar: resolveAvatarUrl(s.avatar as string | undefined) };
    }
    if (msg.replyTo && typeof msg.replyTo === 'object') {
      const rt = msg.replyTo as Record<string, unknown>;
      if (rt.sender && typeof rt.sender === 'object') {
        const rs = rt.sender as Record<string, unknown>;
        msg.replyTo = { ...rt, sender: { ...rs, avatar: resolveAvatarUrl(rs.avatar as string | undefined) } };
      }
    }
    return msg;
  });

// Resolve all image URLs in a group object returned from .lean()
const resolveGroupUrls = (group: Record<string, unknown>) => {
  const g = { ...group } as Record<string, unknown>;
  g.avatar = resolveAvatarUrl(g.avatar as string | undefined);
  g.coverImage = resolveAvatarUrl(g.coverImage as string | undefined);
  if (g.admin && typeof g.admin === 'object') {
    const a = g.admin as Record<string, unknown>;
    g.admin = { ...a, avatar: resolveAvatarUrl(a.avatar as string | undefined) };
  }
  if (Array.isArray(g.moderators)) {
    g.moderators = (g.moderators as Record<string, unknown>[]).map(m => ({
      ...m, avatar: resolveAvatarUrl(m.avatar as string | undefined),
    }));
  }
  if (Array.isArray(g.members)) {
    g.members = (g.members as Record<string, unknown>[]).map(m => {
      const u = m.user as Record<string, unknown> | undefined;
      return { ...m, user: u ? { ...u, avatar: resolveAvatarUrl(u.avatar as string | undefined) } : u };
    });
  }
  return g;
};

export const getGroups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20, category, search, lng, lat, radius = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = { isActive: true, type: { $ne: 'private' } };
    if (category) filter.category = category;

    if (search) {
      filter.$text = { $search: search as string };
    }

    if (lng && lat) {
      filter.location = {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius) * 1000,
        },
      };
    }

    const groups = await Group.find(filter)
      .sort({ memberCount: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('admin', 'name avatar')
      .lean();

    const total = await Group.countDocuments(filter);

    const resolved = (groups as unknown as Record<string, unknown>[]).map(resolveGroupUrls);
    res.json({ groups: resolved, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

export const createGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, type, category, tags, latitude, longitude, address, color, bannerPattern } = req.body;

    // NSFW / profanity check
    if (containsProfanity(name, description, category)) {
      return next(createError('Your group contains inappropriate content. Please revise and try again.', 400));
    }

    const groupData: Record<string, unknown> = {
      name,
      description,
      type: type || 'public',
      category,
      tags: tags || [],
      color: color || '#4F46E5',
      bannerPattern: bannerPattern || 'none',
      admin: req.userId,
      moderators: [req.userId],
      members: [{ user: req.userId, role: 'admin', joinedAt: new Date() }],
      memberCount: 1,
    };

    if (latitude && longitude) {
      groupData.location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
        address,
      };
    }

    const group = await Group.create(groupData);

    // Auto-create a default General Discussion channel (non-blocking)
    try {
      await ChatChannel.create({
        group: group._id,
        name: 'General Discussion',
        description: 'Main chat for all group members. Discuss ideas and ask questions.',
        icon: 'fas fa-users',
        color: '#4F46E5',
        type: 'public',
        createdBy: req.userId,
        isDefault: true,
      });
    } catch (channelErr) {
      console.error('Failed to create default channel:', channelErr);
    }

    await User.findByIdAndUpdate(req.userId, { $push: { groups: group._id } });

    res.status(201).json(group);
  } catch (err) {
    next(err);
  }
};

export const getGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [group, postsCount, eventsCount, messagesCount] = await Promise.all([
      Group.findOne({ _id: req.params.id, isActive: true })
        .populate('admin', 'name avatar')
        .populate('moderators', 'name avatar')
        .populate('members.user', 'name avatar')
        .populate('bannedMembers.user', 'name avatar')
        .lean(),
      Post.countDocuments({ group: req.params.id }),
      Post.countDocuments({ group: req.params.id, type: 'event' }),
      Message.countDocuments({ group: req.params.id, isDeleted: false }),
    ]);

    if (!group) return next(createError('Group not found', 404));

    const resolved = resolveGroupUrls(group as unknown as Record<string, unknown>);
    res.json({ ...resolved, stats: { postsCount, eventsCount, messagesCount } });
  } catch (err) {
    next(err);
  }
};

export const joinGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });

    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some(
      (m) => m.user.toString() === req.userId
    );

    if (isMember) return next(createError('Already a member', 400));

    // Reject banned users
    const isBanned = group.bannedMembers?.some(
      (b) => b.user.toString() === req.userId
    );
    if (isBanned) return next(createError('You are banned from this group', 403));

    group.members.push({
      user: new Types.ObjectId(req.userId) as unknown as typeof group.members[0]['user'],
      role: 'member',
      joinedAt: new Date(),
    });
    group.memberCount += 1;
    await group.save();

    await User.findByIdAndUpdate(req.userId, { $push: { groups: group._id } });

    res.json({ message: 'Joined group successfully' });
  } catch (err) {
    next(err);
  }
};

export const leaveGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });

    if (!group) return next(createError('Group not found', 404));

    if (group.admin.toString() === req.userId) {
      return next(createError('Transfer ownership before leaving the group.', 400));
    }

    group.members = group.members.filter((m) => m.user.toString() !== req.userId);
    group.memberCount = Math.max(0, group.memberCount - 1);
    await group.save();

    await User.findByIdAndUpdate(req.userId, { $pull: { groups: group._id } });

    res.json({ message: 'Left group successfully' });
  } catch (err) {
    next(err);
  }
};

export const transferOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { newOwnerId } = req.body;
    if (!newOwnerId) return next(createError('newOwnerId is required', 400));

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    // Only the current admin can transfer
    if (group.admin.toString() !== req.userId) {
      return next(createError('Only the group owner can transfer ownership', 403));
    }

    const newOwnerObjectId = new Types.ObjectId(newOwnerId);

    // New owner must be a member
    const isMember = group.members.some((m) => m.user.equals(newOwnerObjectId));
    if (!isMember) return next(createError('New owner must be a member of the group', 400));

    // Cannot transfer to yourself
    if (newOwnerId === req.userId) {
      return next(createError('You are already the owner', 400));
    }

    // Update roles: new owner → admin, old admin → member
    group.members = group.members.map((m) => {
      if (m.user.equals(newOwnerObjectId)) return { ...m, role: 'admin' as const };
      if (m.user.toString() === req.userId)  return { ...m, role: 'member' as const };
      return m;
    });

    group.admin = newOwnerObjectId;

    // Remove old admin from moderators if present
    group.moderators = group.moderators.filter((mod) => mod.toString() !== req.userId);

    await group.save();
    res.json({ message: 'Ownership transferred successfully' });
  } catch (err) {
    next(err);
  }
};

export const getMyGroups = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const groups = await Group.find({
      'members.user': req.userId,
      isActive: true,
    })
      .populate('admin', 'name avatar')
      .sort({ updatedAt: -1 })
      .lean();

    res.json((groups as unknown as Record<string, unknown>[]).map(resolveGroupUrls));
  } catch (err) {
    next(err);
  }
};

export const updateGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    // Only the group admin (owner or co-admin member) may update group details
    const isAdmin =
      group.admin.toString() === req.userId ||
      group.members.some(
        m => m.user.toString() === req.userId && m.role === 'admin'
      );
    if (!isAdmin) return next(createError('Only group admins can update group settings', 403));

    const allowed = ['name', 'description', 'type', 'category', 'tags', 'rules', 'coverImage', 'color', 'bannerPattern'];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        (group as unknown as Record<string, unknown>)[field] = req.body[field];
      }
    }

    // Merge settings subdoc
    if (req.body.settings && typeof req.body.settings === 'object') {
      group.settings = { ...(group.settings ?? {}), ...req.body.settings } as IGroup['settings'];
    }

    await group.save();
    res.json(group);
  } catch (err) {
    next(err);
  }
};

export const getGroupMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to view messages', 403));

    const messages = await Message.find({ group: req.params.id, isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sender', 'name avatar isVerified')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar isVerified' } })
      .lean();

    res.json(resolveMessageAvatarUrls(messages.reverse() as unknown as Record<string, unknown>[]));
  } catch (err) {
    next(err);
  }
};

/* ── Cover image upload ──────────────────────────────────────────────────── */

export const updateGroupCover = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, admin: req.userId });
    if (!group) return next(createError('Group not found or not authorized', 404));
    if (!req.file) return next(createError('No image provided', 400));

    const modResult = await scanImageBuffer(req.file.buffer);
    if (!modResult.safe) return next(createError(`Image rejected: ${modResult.reason}`, 400));

    const key = `group-covers/${group._id}-${Date.now()}.jpg`;
    await uploadToS3(key, req.file.buffer, req.file.mimetype);
    group.coverImage = key;
    await group.save();

    res.json({ coverImage: resolveAvatarUrl(key) });
  } catch (err) {
    next(err);
  }
};

/* ── Avatar upload ───────────────────────────────────────────────────────── */

export const updateGroupAvatar = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, admin: req.userId });
    if (!group) return next(createError('Group not found or not authorized', 404));
    if (!req.file) return next(createError('No image provided', 400));

    const modResult = await scanImageBuffer(req.file.buffer);
    if (!modResult.safe) return next(createError(`Image rejected: ${modResult.reason}`, 400));

    const key = `group-avatars/${group._id}-${Date.now()}.jpg`;
    await uploadToS3(key, req.file.buffer, req.file.mimetype);
    group.avatar = key;
    await group.save();

    res.json({ avatar: resolveAvatarUrl(key) });
  } catch (err) {
    next(err);
  }
};

/* ── Invite members ──────────────────────────────────────────────────────── */

export const inviteToGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userIds } = req.body as { userIds: string[] };
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return next(createError('No user IDs provided', 400));
    }

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const inviterMember = group.members.find((m) => m.user.toString() === req.userId);
    const isAdminOrOwner = group.admin.toString() === req.userId || inviterMember?.role === 'admin' || inviterMember?.role === 'moderator';
    if (!inviterMember && !isAdminOrOwner) return next(createError('Not authorized', 403));
    // Regular members need canInvite permission
    if (inviterMember && inviterMember.role === 'member') {
      const canInvite = inviterMember.permissions?.canInvite ?? false;
      if (!canInvite) return next(createError('You do not have permission to invite others', 403));
    }

    for (const userId of userIds) {
      const invitee = await User.findById(userId);
      if (!invitee) continue;

      const alreadyMember = group.members.some((m) => m.user.toString() === userId);
      const alreadyInvited = invitee.groupInvitations?.some(
        (inv) => inv.group.toString() === req.params.id && inv.status === 'pending'
      );
      if (alreadyMember || alreadyInvited) continue;

      await User.findByIdAndUpdate(userId, {
        $push: {
          groupInvitations: {
            group: group._id,
            invitedBy: new Types.ObjectId(req.userId),
            status: 'pending',
            createdAt: new Date(),
          },
        },
      });
    }

    res.json({ message: 'Invitations sent' });
  } catch (err) {
    next(err);
  }
};

/* ── Get my pending invitations ──────────────────────────────────────────── */

export const getMyInvitations = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate('groupInvitations.group', 'name avatar memberCount type color')
      .populate('groupInvitations.invitedBy', 'name avatar')
      .lean();

    if (!user) return next(createError('User not found', 404));

    const pending = (user.groupInvitations || []).filter(
      (inv) => inv.status === 'pending'
    );

    res.json(pending);
  } catch (err) {
    next(err);
  }
};

/* ── Accept invitation ───────────────────────────────────────────────────── */

export const acceptInvitation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const user = await User.findById(req.userId);
    if (!user) return next(createError('User not found', 404));

    const invitation = user.groupInvitations?.find(
      (inv) => inv.group.toString() === groupId && inv.status === 'pending'
    );
    if (!invitation) return next(createError('Invitation not found', 404));

    const group = await Group.findOne({ _id: groupId, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) {
      group.members.push({
        user: new Types.ObjectId(req.userId) as unknown as typeof group.members[0]['user'],
        role: 'member',
        joinedAt: new Date(),
      });
      group.memberCount += 1;
      await group.save();
      await User.findByIdAndUpdate(req.userId, { $push: { groups: group._id } });
    }

    await User.updateOne(
      { _id: req.userId, 'groupInvitations.group': groupId },
      { $set: { 'groupInvitations.$.status': 'accepted' } }
    );

    res.json({ message: 'Invitation accepted', groupId });
  } catch (err) {
    next(err);
  }
};

/* ── Decline invitation ──────────────────────────────────────────────────── */

export const declineInvitation = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { groupId } = req.params;
    const result = await User.updateOne(
      { _id: req.userId, 'groupInvitations.group': groupId, 'groupInvitations.status': 'pending' },
      { $set: { 'groupInvitations.$.status': 'declined' } }
    );
    if (result.matchedCount === 0) return next(createError('Invitation not found', 404));
    res.json({ message: 'Invitation declined' });
  } catch (err) {
    next(err);
  }
};

/* ── Search users (for inviting) ─────────────────────────────────────────── */

export const toggleGroupNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError('User not found', 404));

    const groupId = new Types.ObjectId(req.params.id);
    const isMuted = user.mutedGroups.some((g) => g.equals(groupId));

    if (isMuted) {
      user.mutedGroups = user.mutedGroups.filter((g) => !g.equals(groupId));
    } else {
      user.mutedGroups.push(groupId);
    }

    await user.save();
    res.json({ muted: !isMuted });
  } catch (err) {
    next(err);
  }
};

export const searchUsersForInvite = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { q, groupId } = req.query as { q: string; groupId?: string };
    if (!q || q.trim().length < 2) { res.json([]); return; }

    const filter: Record<string, unknown> = {
      _id: { $ne: req.userId },
      isActive: true,
      $or: [
        { name: { $regex: q.trim(), $options: 'i' } },
        { email: { $regex: q.trim(), $options: 'i' } },
      ],
    };

    // Exclude existing members if groupId is given
    if (groupId) {
      const group = await Group.findById(groupId).lean();
      if (group) {
        const memberIds = group.members.map((m) => m.user.toString());
        filter._id = { $ne: req.userId, $nin: memberIds };
      }
    }

    const users = await User.find(filter)
      .select('name avatar bio location.city location.neighbourhood')
      .limit(20)
      .lean();

    res.json(users);
  } catch (err) {
    next(err);
  }
};

/* ── Chat Channels ─────────────────────────────────────────────────────── */

export const getGroupChannels = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to view channels', 403));

    const channels = await ChatChannel.find({ group: req.params.id, isActive: true })
      .sort({ isDefault: -1, createdAt: 1 })
      .populate('createdBy', 'name avatar')
      .lean();

    // Attach message count + latest message per channel
    const enriched = await Promise.all(
      channels.map(async (ch) => {
        const [messageCount, lastMessage] = await Promise.all([
          Message.countDocuments({ group: req.params.id, channel: ch._id, isDeleted: false }),
          Message.findOne({ group: req.params.id, channel: ch._id, isDeleted: false })
            .sort({ createdAt: -1 })
            .select('content createdAt sender')
            .populate('sender', 'name')
            .lean(),
        ]);
        const resolved = { ...ch, messageCount, lastMessage };
        if (resolved.iconImage) resolved.iconImage = resolveAvatarUrl(resolved.iconImage);
        return resolved;
      })
    );

    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

export const createChannel = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, description, icon, color, type } = req.body;
    if (!name?.trim()) return next(createError('Channel name is required', 400));

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to create channels', 403));

    if (containsProfanity(name) || containsProfanity(description || '')) {
      return next(createError('Channel name or description contains inappropriate content', 400));
    }

    let iconImageKey: string | undefined;
    if (req.file) {
      const modResult = await scanImageBuffer(req.file.buffer);
      if (!modResult.safe) return next(createError(`Image rejected: ${modResult.reason}`, 400));

      const key = `channels/${req.params.id}/${Date.now()}-${req.file.originalname}`;
      await uploadToS3(key, req.file.buffer, req.file.mimetype);
      iconImageKey = key;
    }

    const channel = await ChatChannel.create({
      group: req.params.id,
      name: name.trim(),
      description: description?.trim() || '',
      icon: icon || 'fas fa-comments',
      iconImage: iconImageKey,
      color: color || '#4F46E5',
      type: type || 'public',
      createdBy: req.userId,
    });

    const populated = await channel.populate('createdBy', 'name avatar');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

export const deleteChannel = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const channel = await ChatChannel.findOne({ _id: req.params.channelId, group: req.params.id });
    if (!channel) return next(createError('Channel not found', 404));
    if (channel.isDefault) return next(createError('Cannot delete the default channel', 400));

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const member = group.members.find((m) => m.user.toString() === req.userId);
    const isAdmin = member?.role === 'admin' || member?.role === 'moderator';
    const isCreator = channel.createdBy.toString() === req.userId;

    if (!isAdmin && !isCreator) return next(createError('Not authorized to delete this channel', 403));

    channel.isActive = false;
    await channel.save();
    res.json({ message: 'Channel deleted' });
  } catch (err) {
    next(err);
  }
};

/* ── Upload file to S3 for chat ──────────────────────────────────────────── */

const PROGRAM_EXTS = new Set([
  'exe','msi','dmg','app','deb','rpm','apk','ipa',
  'sh','bat','cmd','ps1','jar','bin','run',
]);

function resolveFileCategory(
  mimeType: string,
  filename = '',
): 'image' | 'video' | 'audio' | 'document' | 'program' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') ||
    mimeType.includes('spreadsheet') || mimeType.includes('presentation') ||
    mimeType.startsWith('text/') || mimeType.includes('powerpoint') || mimeType.includes('excel') ||
    mimeType.includes('opendocument')
  ) return 'document';
  if (
    mimeType.includes('x-msdownload') || mimeType.includes('x-executable') ||
    mimeType.includes('x-msi') || mimeType.includes('x-sh') ||
    mimeType.includes('vnd.debian') || mimeType.includes('x-rpm') ||
    mimeType.includes('java-archive')
  ) return 'program';
  // Fallback: check file extension for known executable types
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (PROGRAM_EXTS.has(ext)) return 'program';
  return 'other';
}

export const uploadGroupFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const uploaderMember = group.members.find((m) => m.user.toString() === req.userId);
    if (!uploaderMember) return next(createError('Must be a member to upload files', 403));
    if (uploaderMember.role === 'member') {
      const canUpload = uploaderMember.permissions?.canUploadFiles ?? true;
      if (!canUpload) return next(createError('You do not have permission to upload files', 403));
    }

    if (!req.file) return next(createError('No file provided', 400));
    if (req.file.size > 50 * 1024 * 1024) return next(createError('File must be under 50 MB', 400));

    if (req.file.mimetype.startsWith('image/')) {
      const modResult = await scanImageBuffer(req.file.buffer);
      if (!modResult.safe) return next(createError(`Image rejected: ${modResult.reason}`, 400));
    }

    const ext = req.file.originalname.split('.').pop() || 'bin';
    const key = `group-files/${req.params.id}/${req.userId}-${Date.now()}.${ext}`;
    await uploadToS3(key, req.file.buffer, req.file.mimetype);
    const url = resolveAvatarUrl(key) as string;

    const category = resolveFileCategory(req.file.mimetype, req.file.originalname);
    const fileDoc = await GroupFile.create({
      group: req.params.id,
      uploader: req.userId,
      name: req.file.originalname,
      url,
      key,
      size: req.file.size,
      mimeType: req.file.mimetype,
      category,
    });

    const populated = await GroupFile.findById(fileDoc._id).populate('uploader', 'name avatar');
    const result = populated!.toObject() as Record<string, unknown>;
    if (result.uploader && typeof result.uploader === 'object') {
      const u = result.uploader as Record<string, unknown>;
      result.uploader = { ...u, avatar: resolveAvatarUrl(u.avatar as string | undefined) };
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getGroupFiles = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to view files', 403));

    const { category, search } = req.query as { category?: string; search?: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: Record<string, any> = { group: req.params.id };
    if (category && category !== 'all') filter.category = category;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const files = await GroupFile.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('uploader', 'name avatar')
      .lean();

    const resolved = files.map(f => {
      const file = { ...f } as Record<string, unknown>;
      file.url = resolveAvatarUrl(f.key as string) as string;
      if (file.uploader && typeof file.uploader === 'object') {
        const u = file.uploader as Record<string, unknown>;
        file.uploader = { ...u, avatar: resolveAvatarUrl(u.avatar as string | undefined) };
      }
      return file;
    });

    res.json(resolved);
  } catch (err) {
    next(err);
  }
};

export const deleteGroupFile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const file = await GroupFile.findOne({ _id: req.params.fileId, group: req.params.id });
    if (!file) return next(createError('File not found', 404));

    const isAdmin = group.admin.toString() === req.userId ||
      group.moderators.some((m) => m.toString() === req.userId);
    const isUploader = file.uploader.toString() === req.userId;
    if (!isUploader && !isAdmin) return next(createError('Not authorised to delete this file', 403));

    await deleteFromS3(file.key);
    await GroupFile.deleteOne({ _id: file._id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

/* ── Pin / unpin a message ────────────────────────────────────────────────── */

export const pinMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    // Only admin or moderators can pin
    const isLeader = group.admin.toString() === req.userId ||
      group.moderators.some((m) => m.toString() === req.userId);
    if (!isLeader) return next(createError('Only group leaders can pin messages', 403));

    const message = await Message.findOne({ _id: req.params.msgId, group: req.params.id });
    if (!message) return next(createError('Message not found', 404));

    const newPinned = !message.pinned;
    await Message.findByIdAndUpdate(req.params.msgId, {
      pinned: newPinned,
      pinnedBy: newPinned ? req.userId : undefined,
    });

    res.json({ pinned: newPinned });
  } catch (err) {
    next(err);
  }
};

/* ── Report a message ────────────────────────────────────────────────────── */

export const reportMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { reason } = req.body as { reason: string };
    if (!reason?.trim()) return next(createError('Reason is required', 400));

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to report messages', 403));

    const message = await Message.findOne({ _id: req.params.msgId, group: req.params.id });
    if (!message) return next(createError('Message not found', 404));

    // Prevent duplicate reports from same user
    const alreadyReported = (message.reports ?? []).some(
      (r) => r.reportedBy.toString() === req.userId
    );
    if (alreadyReported) return next(createError('You have already reported this message', 400));

    await Message.findByIdAndUpdate(req.params.msgId, {
      $push: { reports: { reportedBy: req.userId, reason: reason.trim() } },
    });

    res.json({ message: 'Message reported successfully' });
  } catch (err) {
    next(err);
  }
};

/* ── Award CEU credits ───────────────────────────────────────────────────── */

export const awardCeuCredits = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { amount = 5, note } = req.body as { amount?: number; note?: string };

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    // Only admin or moderators can award CEU
    const isLeader = group.admin.toString() === req.userId ||
      group.moderators.some((m) => m.toString() === req.userId);
    if (!isLeader) return next(createError('Only group leaders can award CEU credits', 403));

    const message = await Message.findOne({ _id: req.params.msgId, group: req.params.id })
      .populate('sender', 'name');
    if (!message) return next(createError('Message not found', 404));

    // Award credits to sender
    const creditsToAward = Math.min(Math.max(Number(amount), 1), 50); // cap 1–50
    await User.findByIdAndUpdate(message.sender, {
      $inc: { ceuBalance: creditsToAward },
    });

    res.json({
      message: `Awarded ${creditsToAward} CEU credits`,
      recipientId: message.sender,
      amount: creditsToAward,
      note,
    });
  } catch (err) {
    next(err);
  }
};

/* ── Get pinned messages ─────────────────────────────────────────────────── */

export const getPinnedMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member', 403));

    const pinned = await Message.find({ group: req.params.id, pinned: true, isDeleted: false })
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('sender', 'name avatar')
      .lean();

    res.json(pinned);
  } catch (err) {
    next(err);
  }
};

/* ── Change member role + permissions ────────────────────────────────────── */

export const changeMemberRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { role, permissions } = req.body as {
      role?: 'admin' | 'moderator' | 'member';
      permissions?: {
        canPost?: boolean;
        canComment?: boolean;
        canUploadFiles?: boolean;
        canInvite?: boolean;
        isMuted?: boolean;
        mutedUntil?: string | null;
      };
    };

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const actingMember = group.members.find((m) => m.user.toString() === req.userId);
    const isActualAdmin = group.admin.toString() === req.userId || actingMember?.role === 'admin';
    const isActingModerator = !isActualAdmin && actingMember?.role === 'moderator';

    if (!isActualAdmin && !isActingModerator) return next(createError('Not authorized', 403));

    const memberIndex = group.members.findIndex((m) => m.user.toString() === userId);
    if (memberIndex === -1) return next(createError('Member not found', 404));

    const targetRole = group.members[memberIndex].role;

    // Protect the group owner (the group.admin field) — co-admins can be changed
    const isTargetOwner = group.admin.toString() === userId;
    if (isTargetOwner) return next(createError('Cannot modify the group owner', 403));

    // Moderators cannot touch other moderators or change roles
    if (isActingModerator && targetRole === 'moderator') {
      return next(createError('Moderators cannot modify other moderators', 403));
    }
    if (isActingModerator && role) {
      return next(createError('Moderators cannot change member roles', 403));
    }

    if (role && isActualAdmin) group.members[memberIndex].role = role;

    if (permissions) {
      const p = group.members[memberIndex].permissions ?? {
        canPost: true, canComment: true, canUploadFiles: true,
        canInvite: false, isMuted: false, mutedUntil: null,
      };
      if (permissions.canPost       !== undefined) p.canPost       = permissions.canPost;
      if (permissions.canComment    !== undefined) p.canComment    = permissions.canComment;
      if (permissions.canUploadFiles !== undefined) p.canUploadFiles = permissions.canUploadFiles;
      if (permissions.canInvite     !== undefined) p.canInvite     = permissions.canInvite;
      if (permissions.isMuted       !== undefined) p.isMuted       = permissions.isMuted;
      if (permissions.mutedUntil    !== undefined) p.mutedUntil    = permissions.mutedUntil ? new Date(permissions.mutedUntil) : null;
      group.members[memberIndex].permissions = p;
    }

    await group.save();
    res.json({ message: 'Member updated', member: group.members[memberIndex] });
  } catch (err) {
    next(err);
  }
};

/* ── Remove a member ─────────────────────────────────────────────────────── */

export const removeMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const actingMember = group.members.find((m) => m.user.toString() === req.userId);
    const isActualAdmin = group.admin.toString() === req.userId || actingMember?.role === 'admin';
    const isActingModerator = !isActualAdmin && actingMember?.role === 'moderator';

    if (!isActualAdmin && !isActingModerator) return next(createError('Not authorized', 403));

    // Prevent removing the owner
    if (group.admin.toString() === userId) {
      return next(createError('Cannot remove the group owner', 403));
    }

    // Moderators can only remove regular members
    if (isActingModerator) {
      const target = group.members.find((m) => m.user.toString() === userId);
      if (!target || target.role !== 'member') {
        return next(createError('Moderators can only remove regular members', 403));
      }
    }

    const before = group.members.length;
    group.members = group.members.filter((m) => m.user.toString() !== userId);
    if (group.members.length === before) return next(createError('Member not found', 404));

    group.memberCount = Math.max(0, group.memberCount - 1);
    await group.save();

    res.json({ message: 'Member removed' });
  } catch (err) {
    next(err);
  }
};

export const getChannelMessages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const isMember = group.members.some((m) => m.user.toString() === req.userId);
    if (!isMember) return next(createError('Must be a member to view messages', 403));

    const messages = await Message.find({
      group: req.params.id,
      channel: req.params.channelId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('sender', 'name avatar isVerified')
      .populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar isVerified' } })
      .lean();

    res.json(resolveMessageAvatarUrls(messages.reverse() as unknown as Record<string, unknown>[]));
  } catch (err) {
    next(err);
  }
};

/* ── Ban a member ────────────────────────────────────────────────────────── */

export const banMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { reason = '' } = req.body as { reason?: string };

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const actingMember = group.members.find((m) => m.user.toString() === req.userId);
    const isActualAdmin = group.admin.toString() === req.userId || actingMember?.role === 'admin';
    const isActingModerator = !isActualAdmin && actingMember?.role === 'moderator';

    if (!isActualAdmin && !isActingModerator) return next(createError('Not authorized', 403));

    if (group.admin.toString() === userId) return next(createError('Cannot ban the group owner', 403));

    if (isActingModerator) {
      const target = group.members.find((m) => m.user.toString() === userId);
      if (!target || target.role !== 'member') {
        return next(createError('Moderators can only ban regular members', 403));
      }
    }

    const alreadyBanned = group.bannedMembers?.some((b) => b.user.toString() === userId);
    if (alreadyBanned) return next(createError('User is already banned', 400));

    const wasMember = group.members.some((m) => m.user.toString() === userId);
    if (wasMember) {
      group.members = group.members.filter((m) => m.user.toString() !== userId);
      group.memberCount = Math.max(0, group.memberCount - 1);
    }

    if (!group.bannedMembers) (group as unknown as Record<string, unknown>).bannedMembers = [];
    group.bannedMembers.push({
      user: new Types.ObjectId(userId) as unknown as typeof group.bannedMembers[0]['user'],
      bannedBy: new Types.ObjectId(req.userId) as unknown as typeof group.bannedMembers[0]['bannedBy'],
      reason,
      bannedAt: new Date(),
    });

    await group.save();
    if (wasMember) await User.findByIdAndUpdate(userId, { $pull: { groups: group._id } });

    res.json({ message: 'User banned from group' });
  } catch (err) {
    next(err);
  }
};

/* ── Unban a member ──────────────────────────────────────────────────────── */

export const unbanMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const actingMember = group.members.find((m) => m.user.toString() === req.userId);
    const isActualAdmin = group.admin.toString() === req.userId || actingMember?.role === 'admin';
    const isActingModerator = !isActualAdmin && actingMember?.role === 'moderator';

    if (!isActualAdmin && !isActingModerator) return next(createError('Not authorized', 403));

    const banIndex = group.bannedMembers?.findIndex((b) => b.user.toString() === userId) ?? -1;
    if (banIndex === -1) return next(createError('User is not banned', 404));

    group.bannedMembers.splice(banIndex, 1);
    await group.save();

    res.json({ message: 'User unbanned' });
  } catch (err) {
    next(err);
  }
};

/* ── Request unban (by banned user) ─────────────────────────────────────── */

export const requestUnban = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id: groupId } = req.params;
    const { reason = '' } = req.body as { reason?: string };

    const group = await Group.findOne({ _id: groupId, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const banEntry = group.bannedMembers?.find((b) => b.user.toString() === req.userId);
    if (!banEntry) return next(createError('You are not banned from this group', 400));

    const existingRequest = (banEntry.unbanRequest as Record<string, unknown> | undefined);
    if (existingRequest?.status === 'pending') {
      return next(createError('You already have a pending unban request', 400));
    }

    (banEntry.unbanRequest as unknown as Record<string, unknown>) = {
      status: 'pending',
      reason,
      requestedAt: new Date(),
    };

    await group.save();
    res.json({ message: 'Unban request submitted' });
  } catch (err) {
    next(err);
  }
};

/* ── Get banned members list (mod/admin) ─────────────────────────────────── */

export const getBanRequests = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true })
      .populate('bannedMembers.user', 'name avatar')
      .populate('bannedMembers.bannedBy', 'name avatar')
      .lean();

    if (!group) return next(createError('Group not found', 404));

    const g = group as unknown as Record<string, unknown>;
    const memberList = (g.members as { user: Record<string, unknown>; role: string }[]) ?? [];
    const actingMember = memberList.find(
      (m) => String((m.user as Record<string, unknown>)?._id ?? m.user) === req.userId
    );
    const isLeader =
      String((g.admin as Record<string, unknown>)?._id ?? g.admin) === req.userId ||
      actingMember?.role === 'admin' ||
      actingMember?.role === 'moderator';

    if (!isLeader) return next(createError('Not authorized', 403));

    const banned = (g.bannedMembers as Record<string, unknown>[]) ?? [];
    res.json({ bannedMembers: banned });
  } catch (err) {
    next(err);
  }
};

/* ── Resolve ban request ─────────────────────────────────────────────────── */

export const resolveBanRequest = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId } = req.params;
    const { action } = req.body as { action: 'approved' | 'denied' };

    if (!['approved', 'denied'].includes(action)) {
      return next(createError('action must be approved or denied', 400));
    }

    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    const actingMember = group.members.find((m) => m.user.toString() === req.userId);
    const isActualAdmin = group.admin.toString() === req.userId || actingMember?.role === 'admin';
    const isActingModerator = !isActualAdmin && actingMember?.role === 'moderator';

    if (!isActualAdmin && !isActingModerator) return next(createError('Not authorized', 403));

    const banEntry = group.bannedMembers?.find((b) => b.user.toString() === userId);
    if (!banEntry) return next(createError('No ban record found', 404));

    if ((banEntry.unbanRequest as unknown as Record<string, unknown>)?.status !== 'pending') {
      return next(createError('No pending unban request', 400));
    }

    (banEntry.unbanRequest as unknown as Record<string, unknown>).status = action;

    if (action === 'approved') {
      group.bannedMembers = group.bannedMembers.filter((b) => b.user.toString() !== userId);
    }

    await group.save();
    res.json({ message: action === 'approved' ? 'User unbanned' : 'Unban request denied' });
  } catch (err) {
    next(err);
  }
};

/* ── Delete group ─────────────────────────────────────────────────────────── */

export const deleteGroup = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const group = await Group.findOne({ _id: req.params.id, isActive: true });
    if (!group) return next(createError('Group not found', 404));

    // Only the owner (group.admin) can delete
    if (group.admin.toString() !== req.userId) {
      return next(createError('Only the group owner can delete this group', 403));
    }

    group.isActive = false;
    await group.save();

    res.json({ message: 'Group deleted successfully' });
  } catch (err) {
    next(err);
  }
};
