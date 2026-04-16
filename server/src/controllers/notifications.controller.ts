import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Notification } from '../models/Notification';
import { Exchange } from '../models/Exchange';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { createError } from '../middleware/errorHandler';
import { resolveAvatarUrl } from '../services/storage';

/** GET /api/notifications */
export const getNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const page  = Math.max(parseInt(req.query.page  as string) || 1,  1);
    const skip  = (page - 1) * limit;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: req.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ recipient: req.userId, read: false }),
    ]);

    res.json({ notifications, unreadCount, page, limit });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/:id/read */
export const markRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.userId },
      { read: true },
      { new: true },
    );
    if (!notif) return next(createError('Notification not found', 404));
    res.json(notif);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/notifications/read-all */
export const markAllRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await Notification.updateMany({ recipient: req.userId, read: false }, { read: true });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── Inbox helpers ──────────────────────────────────────────────────────────────

function postRoute(type: string, id: string): string {
  const map: Record<string, string> = {
    skill: 'skills', tool: 'tools', event: 'events', question: 'questions',
  };
  return `/${map[type] ?? 'posts'}/${id}`;
}

interface InboxItem {
  _id: string;
  type: 'exchange_msg' | 'post_comment' | 'post_reply';
  postType: string | null;
  postTitle: string;
  body: string;
  sender: { _id: string; name: string; avatar?: string };
  link: string;
  createdAt: string;
}

/** GET /api/notifications/inbox — unified messages feed for the nav messages dropdown */
export const getInbox = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.userId!;

    // ── 1. Exchange private messages (sender !== current user) ───────────────
    const myExchanges = await Exchange.find({
      $or: [{ requester: userId }, { provider: userId }],
      'messages.0': { $exists: true },
    })
      .select('_id title messages requester provider')
      .populate('requester provider', 'name avatar')
      .lean() as Record<string, any>[];

    const exchangeItems: InboxItem[] = [];
    for (const ex of myExchanges) {
      const msgs: any[] = (ex.messages as any[]) ?? [];
      for (const msg of msgs) {
        if (String(msg.sender) === userId) continue;
        const reqObj  = ex.requester  as Record<string, any> | null;
        const provObj = ex.provider   as Record<string, any> | null;
        const senderObj =
          reqObj && String(reqObj._id) === String(msg.sender) ? reqObj : provObj;
        exchangeItems.push({
          _id: `emsg_${ex._id}_${new Date(msg.timestamp).getTime()}`,
          type: 'exchange_msg',
          postType: null,
          postTitle: (ex.title as string) ?? 'Exchange',
          body: msg.content as string,
          sender: {
            _id:    String(senderObj?._id   ?? msg.sender),
            name:   (senderObj?.name  as string) ?? 'User',
            avatar: resolveAvatarUrl(senderObj?.avatar as string | undefined) ?? undefined,
          },
          link: `/exchanges/${ex._id}`,
          createdAt: msg.timestamp as string,
        });
      }
    }

    // ── 2. Comments on user's posts (commenter !== user) ────────────────────
    const myPosts = await Post.find({ author: userId, isActive: true })
      .select('_id type title')
      .lean() as Record<string, any>[];

    const postMap = new Map<string, { type: string; title: string }>(
      myPosts.map((p: any) => [String(p._id), { type: p.type as string, title: p.title as string }]),
    );
    const myPostIds = myPosts.map((p: any) => p._id);

    const postComments = await Comment.find({
      postId: { $in: myPostIds },
      author: { $ne: userId },
      parentId: null,
    })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate('author', 'name avatar')
      .lean() as Record<string, any>[];

    const postCommentItems: InboxItem[] = postComments.map((c: any) => {
      const post = postMap.get(String(c.postId));
      return {
        _id: String(c._id),
        type: 'post_comment',
        postType: post?.type ?? null,
        postTitle: post?.title ?? '',
        body: c.content as string,
        sender: {
          _id:    String((c.author as any)?._id ?? ''),
          name:   (c.author as any)?.name as string ?? 'User',
          avatar: resolveAvatarUrl((c.author as any)?.avatar) ?? undefined,
        },
        link: postRoute(post?.type ?? 'general', String(c.postId)),
        createdAt: (c.createdAt as Date).toISOString(),
      };
    });

    // ── 3. Replies to user's comments (replier !== user) ────────────────────
    const myCommentIds = (
      await Comment.find({ author: userId }).select('_id').lean() as Record<string, any>[]
    ).map((c: any) => c._id);

    const replies = myCommentIds.length
      ? await Comment.find({
          parentId: { $in: myCommentIds },
          author: { $ne: userId },
        })
          .sort({ createdAt: -1 })
          .limit(60)
          .populate('author', 'name avatar')
          .lean() as Record<string, any>[]
      : [];

    // Fetch posts for replies
    const replyPostIds = [...new Set(replies.map((c: any) => String(c.postId)).filter(Boolean))];
    const replyPostDocs = replyPostIds.length
      ? await Post.find({ _id: { $in: replyPostIds } }).select('_id type title').lean() as Record<string, any>[]
      : [];
    const replyPostMap = new Map<string, { type: string; title: string }>(
      replyPostDocs.map((p: any) => [String(p._id), { type: p.type as string, title: p.title as string }]),
    );

    const replyItems: InboxItem[] = replies.map((c: any) => {
      const post = replyPostMap.get(String(c.postId));
      return {
        _id: String(c._id),
        type: 'post_reply',
        postType: post?.type ?? null,
        postTitle: post?.title ?? '',
        body: c.content as string,
        sender: {
          _id:    String((c.author as any)?._id ?? ''),
          name:   (c.author as any)?.name as string ?? 'User',
          avatar: resolveAvatarUrl((c.author as any)?.avatar) ?? undefined,
        },
        link: postRoute(post?.type ?? 'general', String(c.postId)),
        createdAt: (c.createdAt as Date).toISOString(),
      };
    });

    // ── Merge, dedup by _id, sort newest-first ───────────────────────────────
    const seen  = new Set<string>();
    const items = [...exchangeItems, ...postCommentItems, ...replyItems]
      .filter(item => { if (seen.has(item._id)) return false; seen.add(item._id); return true; })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 100);

    res.json({ items });
  } catch (err) {
    next(err);
  }
};
