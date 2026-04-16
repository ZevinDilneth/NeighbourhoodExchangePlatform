import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { Post } from '../models/Post';
import { Exchange } from '../models/Exchange';
import { Comment } from '../models/Comment';
import { onlineUsers } from '../services/onlineTracker';
import { createError } from '../middleware/errorHandler';
import { uploadToS3, resolveAvatarUrl } from '../services/storage';
import { scanImageBuffer, scanVideoBuffer } from '../services/moderation';
import { checkFields } from '../utils/contentFilter';

// ── Helper: attach signed avatar + videoIntro URLs to any plain user object ──
// Works with .lean() results (plain objects) and populated sub-docs alike.
const withSignedAvatar = <T extends { avatar?: string | null; videoIntro?: string | null }>(obj: T): T => ({
  ...obj,
  avatar: resolveAvatarUrl(obj.avatar) ?? obj.avatar,
  videoIntro: resolveAvatarUrl((obj as { videoIntro?: string | null }).videoIntro) ?? (obj as { videoIntro?: string | null }).videoIntro ?? null,
});

// ─────────────────────────────────────────────────────────────────────────────

export const getUserProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.params.id)
      .populate('groups', 'name avatar memberCount')
      .lean();

    if (!user) return next(createError('User not found', 404));

    res.json(withSignedAvatar(user));
  } catch (err) {
    next(err);
  }
};

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updates: Record<string, unknown> = {};

    // Content moderation — check all free-text profile fields
    if (checkFields(
      req.body.name,
      req.body.bio,
      req.body.skills as string[] | undefined,
      req.body.interests as string[] | undefined,
    )) {
      return next(createError('Your profile contains inappropriate content. Please revise and try again.', 400));
    }

    // Top-level scalar fields
    for (const field of ['name', 'bio', 'skills', 'interests'] as const) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    // Location — use dot-notation $set so Mongoose doesn't replace the whole
    // subdocument (avoids validator issues with required sub-fields like coordinates)
    if (req.body.location && typeof req.body.location === 'object') {
      const loc = req.body.location as Record<string, unknown>;
      const locFields = ['address', 'neighbourhood', 'city', 'postcode', 'country'] as const;
      for (const f of locFields) {
        if (loc[f] !== undefined) updates[`location.${f}`] = loc[f];
      }
      // Only update coordinates if the client sends a valid non-zero pair
      if (
        Array.isArray(loc.coordinates) &&
        loc.coordinates.length === 2 &&
        (loc.coordinates[0] !== 0 || loc.coordinates[1] !== 0)
      ) {
        updates['location.coordinates'] = loc.coordinates;
      }
    }

    const userDoc = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: false },
    ).lean();

    if (!userDoc) return next(createError('User not found', 404));

    res.json(withSignedAvatar(userDoc));
  } catch (err) {
    next(err);
  }
};

export const savePreferredTags = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { tags } = req.body;
    if (!Array.isArray(tags)) return next(createError('tags must be an array', 400));

    // Sanitise: lowercase, trim, max 50 chars, deduplicate, limit 30 tags
    const cleaned = [...new Set(
      tags.map((t: unknown) => String(t).trim().toLowerCase().slice(0, 50)).filter(Boolean)
    )].slice(0, 30);

    // Content moderation — reject tags with inappropriate terms
    if (checkFields(cleaned)) {
      return next(createError('One or more of your tags contain inappropriate content. Please revise and try again.', 400));
    }

    const userDoc = await User.findByIdAndUpdate(
      req.userId,
      { $set: { preferredTags: cleaned } },
      { new: true, runValidators: false },
    ).lean();

    if (!userDoc) return next(createError('User not found', 404));

    res.json({ preferredTags: (userDoc as Record<string, unknown>).preferredTags ?? [] });
  } catch (err) {
    next(err);
  }
};

export const updateVideoIntro = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Route uses .fields() so files arrive in req.files, not req.file
    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const videoFile = files?.['video']?.[0];

    console.log('[VideoUpload] files received:', Object.keys(files ?? {}));
    console.log('[VideoUpload] videoFile:', videoFile ? `${videoFile.originalname} ${(videoFile.size/1024/1024).toFixed(1)}MB mime=${videoFile.mimetype}` : 'MISSING');
    console.log('[VideoUpload] body:', req.body);

    if (!videoFile) return next(createError('No video file uploaded', 400));

    // PC file uploads (source=upload) are restricted to the admin account only
    const source = (req.body as Record<string, string>)?.source;
    console.log('[VideoUpload] source:', source);
    if (source === 'upload') {
      const uploader = await User.findById(req.userId).select('email').lean();
      const uploaderEmail = (uploader as Record<string, unknown>)?.email;
      console.log('[VideoUpload] uploader email:', uploaderEmail);
      if (uploaderEmail !== 'zevindilneth@gmail.com') {
        return next(createError('Uploading video files from PC is not available yet.', 403));
      }
    }

    // ── Full frame-by-frame NSFW scan using ffmpeg + ML model ────────────
    console.log('[VideoUpload] Starting NSFW scan…');
    const modResult = await scanVideoBuffer(videoFile.buffer);
    console.log('[VideoUpload] NSFW scan result:', modResult);
    if (!modResult.safe) {
      return next(createError(
        `This video contains NSFW material and cannot be uploaded (${modResult.reason ?? 'explicit content'}).`,
        422,
      ));
    }

    const ext = videoFile.mimetype.includes('mp4') ? 'mp4' : videoFile.mimetype.includes('ogg') ? 'ogv' : 'webm';
    const key = `video-intros/${req.userId}-${Date.now()}.${ext}`;

    await uploadToS3(key, videoFile.buffer, videoFile.mimetype);
    await User.findByIdAndUpdate(req.userId, { videoIntro: key });

    const signedUrl = resolveAvatarUrl(key) as string;
    res.json({ videoIntro: signedUrl });
  } catch (err) {
    next(err);
  }
};

export const removeVideoIntro = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, { $unset: { videoIntro: '' } });
    res.json({ message: 'Video introduction removed' });
  } catch (err) {
    next(err);
  }
};

export const updateAvatar = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) return next(createError('No file uploaded', 400));

    // ── NSFW scan — check buffer before touching S3 ───────────────────────
    const modResult = await scanImageBuffer(req.file.buffer);
    if (!modResult.safe) {
      return next(createError(
        `This image contains NSFW material and cannot be uploaded (${modResult.reason ?? 'explicit content'}).`,
        422,
      ));
    }

    const ext = req.file.mimetype.split('/')[1] ?? 'jpg';
    const key = `avatars/${req.userId}-${Date.now()}.${ext}`;

    // Upload to S3 — store just the key (not the full URL) so we can
    // generate fresh signed URLs on every read, regardless of bucket ACL settings.
    await uploadToS3(key, req.file.buffer, req.file.mimetype);

    await User.findByIdAndUpdate(req.userId, { avatar: key });

    // Return a signed URL so the client can display the avatar immediately
    const signedUrl = resolveAvatarUrl(key) as string;
    res.json({ avatar: signedUrl });
  } catch (err) {
    next(err);
  }
};

export const getNearbyUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { lng, lat, radius = 10 } = req.query;

    if (!lng || !lat) return next(createError('Coordinates required', 400));

    const users = await User.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius) * 1000,
        },
      },
      _id: { $ne: req.userId },
      isActive: true,
    })
      .select('name avatar bio skills rating exchangeCount location')
      .lean();

    res.json(users.map(withSignedAvatar));
  } catch (err) {
    next(err);
  }
};

export const getUserPosts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const posts = await Post.find({ author: req.params.id, isActive: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('author', 'name avatar')
      .lean();

    const total = await Post.countDocuments({ author: req.params.id, isActive: true });

    res.json({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

export const getUserExchanges = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = {
      $or: [{ requester: req.params.id }, { provider: req.params.id }],
    };
    if (status) filter.status = status;

    const exchanges = await Exchange.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('requester provider', 'name avatar rating')
      .lean();

    const total = await Exchange.countDocuments(filter);

    res.json({
      exchanges,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

export const getOnlineUsers = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const onlineIds = Array.from(onlineUsers.keys());
    if (onlineIds.length === 0) {
      res.json([]);
      return;
    }
    const users = await User.find({ _id: { $in: onlineIds }, isActive: true })
      .select('name avatar isVerified')
      .limit(20)
      .lean();
    res.json(users.map(withSignedAvatar));
  } catch (err) {
    next(err);
  }
};

export const getInbox = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId!;

    // User's posts — needed to find comments on them
    const userPosts = await Post.find({ author: userId, isActive: true })
      .select('_id type title')
      .lean();
    const userPostIds = userPosts.map((p) => p._id);
    const postMap = new Map(userPosts.map((p) => [String(p._id), p as { _id: unknown; type: string; title: string }]));

    // User's own comment IDs — to find replies to them
    const userCommentIds = await Comment.find({ author: userId }).distinct('_id');

    // Comments on user's posts OR replies to user's comments, NOT by the user
    const comments = await Comment.find({
      $or: [
        { postId: { $in: userPostIds } },
        { parentId: { $in: userCommentIds } },
      ],
      author: { $ne: userId },
    })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Exchanges where user is a participant
    const exchanges = await Exchange.find({
      $or: [{ requester: userId }, { provider: userId }],
    })
      .select('_id title messages')
      .populate('messages.sender', 'name avatar')
      .lean();

    // Exchange messages not sent by the user
    const exchangeItems: Record<string, unknown>[] = [];
    for (const ex of exchanges) {
      for (const msg of ex.messages ?? []) {
        const sender = msg.sender as { _id?: unknown; name?: string; avatar?: string } | null;
        const senderId = String(sender?._id ?? msg.sender);
        if (senderId !== String(userId)) {
          exchangeItems.push({
            id: String(msg._id ?? `${String(ex._id)}_${String(msg.timestamp)}`),
            type: 'exchange_message',
            author: sender
              ? { _id: sender._id, name: sender.name, avatar: resolveAvatarUrl(sender.avatar) ?? sender.avatar }
              : null,
            preview: String(msg.content).slice(0, 120),
            timestamp: msg.timestamp,
            exchangeId: String(ex._id),
            exchangeTitle: ex.title,
          });
        }
      }
    }

    // Format comment items
    const commentItems: Record<string, unknown>[] = comments.map((c) => {
      const post = postMap.get(String(c.postId));
      let type = 'post_comment';
      if (post?.type === 'question') type = 'answer';
      else if (post?.type === 'tool') type = 'tool_discussion';
      else if (post?.type === 'event') type = 'event_discussion';
      else if (post?.type === 'skill') type = 'skill_discussion';

      const author = c.author as { _id?: unknown; name?: string; avatar?: string } | null;
      return {
        id: String(c._id),
        type,
        author: author
          ? { _id: author._id, name: author.name, avatar: resolveAvatarUrl(author.avatar) ?? author.avatar }
          : null,
        preview: String(c.content).slice(0, 120),
        timestamp: (c as Record<string, unknown>).createdAt,
        postId: String(c.postId),
        postType: post?.type,
        postTitle: post?.title,
      };
    });

    // Combine and sort newest first
    const all = [...commentItems, ...exchangeItems].sort(
      (a, b) =>
        new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
    );

    res.json(all);
  } catch (err) {
    next(err);
  }
};

export const getExpertsByTags = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tags = String(req.query.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    if (tags.length === 0) {
      res.json([]);
      return;
    }

    // Case-insensitive tag matching across skills, interests, and preferredTags
    const tagRegexes = tags.map((t) => new RegExp(`^${t}$`, 'i'));

    const users = await User.find({
      isActive: true,
      $or: [
        { 'skills.name': { $in: tagRegexes } },
        { 'interests.name': { $in: tagRegexes } },
        { preferredTags: { $in: tags } },
      ],
    })
      .select('name avatar rating trustScore skills location isVerified')
      .sort({ rating: -1, trustScore: -1 })
      .limit(5)
      .lean();

    res.json(users.map(withSignedAvatar));
  } catch (err) {
    next(err);
  }
};
