import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Message } from '../models/Message';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { TokenPayload } from '../types';
import { Types } from 'mongoose';
import { containsProfanity } from '../utils/contentFilter';
import { onlineUsers } from '../services/onlineTracker';
import { resolveAvatarUrl } from '../services/storage';

interface AuthSocket extends Socket {
  userId?: string;
}

export const setupSocket = (io: Server): void => {
  // Auth middleware for socket connections
  io.use((socket: AuthSocket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload;
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthSocket) => {
    const userId = socket.userId as string;

    // Join personal room for direct notifications
    socket.join(`user:${userId}`);

    // Track online presence
    const prevCount = onlineUsers.get(userId) ?? 0;
    onlineUsers.set(userId, prevCount + 1);
    if (prevCount === 0) {
      // First connection — tell everyone this user just came online
      io.emit('user-online', userId);
    }

    // Let the connecting client know who is currently online
    socket.emit('online-users', Array.from(onlineUsers.keys()));

    User.findById(userId).select('name email').lean().then((u) => {
      const label = u ? `${(u as any).name} <${(u as any).email}>` : userId;
      console.log(`🔌 Connected:    ${label}`);
    });

    // Join group chat rooms
    socket.on('join-group', async (groupId: string) => {
      try {
        const group = await Group.findOne({
          _id: groupId,
          'members.user': userId,
          isActive: true,
        });

        if (group) {
          socket.join(`group:${groupId}`);
          socket.emit('joined-group', { groupId });
        } else {
          socket.emit('error', { message: 'Not a member of this group' });
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to join group' });
      }
    });

    // Leave group room
    socket.on('leave-group', (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    // Join / leave a channel room
    socket.on('join-channel', (channelId: string) => {
      socket.join(`channel:${channelId}`);
    });
    socket.on('leave-channel', (channelId: string) => {
      socket.leave(`channel:${channelId}`);
    });

    // Send group message
    socket.on(
      'send-message',
      async (data: { groupId: string; channelId?: string; content: string; type?: string; replyTo?: string }) => {
        try {
          const { groupId, channelId, content, type = 'text', replyTo } = data;

          const group = await Group.findOne({
            _id: groupId,
            'members.user': userId,
            isActive: true,
          });

          if (!group) {
            socket.emit('error', { message: 'Not authorized to send messages here' });
            return;
          }

          // Check mute / timeout permission
          const memberEntry = group.members.find((m) => m.user.toString() === userId);
          const perms = memberEntry?.permissions as Record<string, unknown> | undefined;
          if (perms) {
            const isMuted = perms.isMuted as boolean;
            const mutedUntil = perms.mutedUntil as Date | null | undefined;
            if (isMuted) {
              if (!mutedUntil || new Date(mutedUntil) > new Date()) {
                const msg = mutedUntil
                  ? `You are timed out until ${new Date(mutedUntil).toLocaleString()}`
                  : 'You have been muted in this group';
                socket.emit('error', { message: msg });
                return;
              }
              // Mute expired — auto-clear it
              if (memberEntry) {
                (memberEntry.permissions as Record<string, unknown>).isMuted = false;
                (memberEntry.permissions as Record<string, unknown>).mutedUntil = null;
                await group.save();
              }
            }
          }

          // Phone verification required to send messages
          const sender = await User.findById(userId).select('isPhoneVerified').lean();
          if (!(sender as Record<string, unknown>)?.isPhoneVerified) {
            socket.emit('error', { message: 'PHONE_VERIFICATION_REQUIRED' });
            return;
          }

          // Content moderation
          if (containsProfanity(content)) {
            socket.emit('error', { message: 'Your message contains inappropriate content. Please revise and try again.' });
            return;
          }

          const message = await Message.create({
            group: groupId,
            channel: channelId ? new Types.ObjectId(channelId) : undefined,
            sender: new Types.ObjectId(userId),
            content,
            type,
            replyTo: replyTo ? new Types.ObjectId(replyTo) : undefined,
          });

          await message.populate('sender', 'name avatar isVerified');
          if (message.replyTo) {
            await message.populate({ path: 'replyTo', populate: { path: 'sender', select: 'name avatar isVerified' } });
          }

          // Resolve S3 avatar URLs before broadcasting
          const msgObj = message.toObject() as Record<string, unknown>;
          const msgSender = msgObj.sender as Record<string, unknown>;
          if (msgSender) msgSender.avatar = resolveAvatarUrl(msgSender.avatar as string | undefined);
          if (msgObj.replyTo && typeof msgObj.replyTo === 'object') {
            const rt = msgObj.replyTo as Record<string, unknown>;
            const rtSender = rt.sender as Record<string, unknown> | undefined;
            if (rtSender) rtSender.avatar = resolveAvatarUrl(rtSender.avatar as string | undefined);
          }

          // Broadcast to the channel room if specified, otherwise group room
          const room = channelId ? `channel:${channelId}` : `group:${groupId}`;
          io.to(room).emit('new-message', msgObj);
        } catch (err) {
          socket.emit('error', { message: 'Failed to send message' });
        }
      }
    );

    // Join / leave a post room (for live comment updates)
    socket.on('join-post', (postId: string) => {
      socket.join(`post:${postId}`);
    });
    socket.on('leave-post', (postId: string) => {
      socket.leave(`post:${postId}`);
    });

    // Join / leave an exchange room (for real-time messages)
    socket.on('join-exchange', (exchangeId: string) => {
      socket.join(`exchange:${exchangeId}`);
    });
    socket.on('leave-exchange', (exchangeId: string) => {
      socket.leave(`exchange:${exchangeId}`);
    });

    // Typing indicator
    socket.on('typing', (data: { groupId: string; channelId?: string; isTyping: boolean }) => {
      const room = data.channelId ? `channel:${data.channelId}` : `group:${data.groupId}`;
      socket.to(room).emit('user-typing', {
        userId,
        isTyping: data.isTyping,
      });
    });

    // Add reaction to message
    socket.on('add-reaction', async (data: { messageId: string; emoji: string }) => {
      try {
        const message = await Message.findById(data.messageId);
        if (!message) return;

        const reactionIdx = message.reactions.findIndex((r) => r.emoji === data.emoji);

        if (reactionIdx > -1) {
          const userIdx = message.reactions[reactionIdx].users.findIndex(
            (u) => u.toString() === userId
          );

          if (userIdx > -1) {
            message.reactions[reactionIdx].users.splice(userIdx, 1);
            if (message.reactions[reactionIdx].users.length === 0) {
              message.reactions.splice(reactionIdx, 1);
            }
          } else {
            message.reactions[reactionIdx].users.push(
              new Types.ObjectId(userId) as unknown as typeof message.reactions[0]['users'][0]
            );
          }
        } else {
          message.reactions.push({
            emoji: data.emoji,
            users: [new Types.ObjectId(userId) as unknown as typeof message.reactions[0]['users'][0]],
          });
        }

        await message.save();

        io.to(`group:${message.group.toString()}`).emit('reaction-updated', {
          messageId: data.messageId,
          reactions: message.reactions,
        });
      } catch (err) {
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('disconnect', (reason: string) => {
      const count = (onlineUsers.get(userId) ?? 1) - 1;
      if (count <= 0) {
        onlineUsers.delete(userId);
        io.emit('user-offline', userId);
      } else {
        onlineUsers.set(userId, count);
      }
      User.findById(userId).select('name email').lean().then((u) => {
        const label = u ? `${(u as any).name} <${(u as any).email}>` : userId;
        console.log(`🔌 Disconnected: ${label} — ${reason}`);
      });
    });
  });
};
