import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { Post } from '../models/Post';
import { Comment } from '../models/Comment';
import { User } from '../models/User';
import { Exchange } from '../models/Exchange';
import { Group } from '../models/Group';
import { createError } from '../middleware/errorHandler';
import { getSignedUrl, resolveAvatarUrl, uploadToS3 } from '../services/storage';
import { scanImageBuffer } from '../services/moderation';
import { notifyInterestedUsersForPost } from '../services/interestEngine';

/** Upload files from memory to S3 and return keys (with NSFW scan) */
const uploadFilesToS3 = async (
  files: Express.Multer.File[],
  userId: string,
  prefix = 'post-images',
): Promise<string[]> => {
  const keys: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    // NSFW check for image uploads
    if (file.mimetype.startsWith('image/')) {
      const modResult = await scanImageBuffer(file.buffer);
      if (!modResult.safe) throw new Error(`Image rejected: ${modResult.reason}`);
    }
    const ext = file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const key = `${prefix}/${userId}-${Date.now()}-${i}.${ext}`;
    await uploadToS3(key, file.buffer, file.mimetype);
    keys.push(key);
  }
  return keys;
};

/** Sign all S3 keys in a post's images array + author avatar */
const signPostMedia = (post: Record<string, any>) => {
  if (post.images?.length) {
    post.images = post.images.map((img: string | null) =>
      img && !img.startsWith('http') ? getSignedUrl(img) : img
    );
  }
  if (post.author?.avatar) {
    post.author = { ...post.author, avatar: resolveAvatarUrl(post.author.avatar) };
  }
  return post;
};

// Returns all unique tags used across posts AND exchanges, sorted by frequency
export const getTags = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [postTags, exchangeTags] = await Promise.all([
      Post.aggregate([
        { $match: { isActive: true, 'tags.0': { $exists: true } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
      ]),
      Exchange.aggregate([
        { $match: { 'tags.0': { $exists: true } } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
      ]),
    ]);

    // Merge counts
    const merged = new Map<string, number>();
    for (const t of [...postTags, ...exchangeTags]) {
      merged.set(t._id as string, (merged.get(t._id as string) ?? 0) + (t.count as number));
    }

    const sorted = [...merged.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ label, count }));

    res.json(sorted);
  } catch (err) {
    next(err);
  }
};

export const getStats = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const [postsToday, exchangesToday, questionsToday, eventsToday] = await Promise.all([
      Post.countDocuments({ isActive: true, createdAt: { $gte: todayStart } }),
      Exchange.countDocuments({ createdAt: { $gte: todayStart } }),
      Post.countDocuments({ type: 'question', isActive: true, createdAt: { $gte: todayStart } }),
      Post.countDocuments({ type: 'event', isActive: true, createdAt: { $gte: todayStart } }),
    ]);
    res.json({ postsToday, exchangesToday, questionsToday, eventsToday });
  } catch (err) {
    next(err);
  }
};

export const getTrending = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const posts = await Post.aggregate([
      { $match: { isActive: true } },
      {
        $addFields: {
          upvoteCount: { $size: { $ifNull: ['$upvotes', []] } },
          downvoteCount: { $size: { $ifNull: ['$downvotes', []] } },
          // Trending score: upvotes weighted 3x, views 1x, comments 2x
          trendingScore: {
            $add: [
              { $multiply: [{ $size: { $ifNull: ['$upvotes', []] } }, 3] },
              { $ifNull: ['$viewCount', 0] },
              { $multiply: [{ $ifNull: ['$commentCount', 0] }, 2] },
            ],
          },
        },
      },
      { $sort: { trendingScore: -1, createdAt: -1 } },
      { $limit: 10 },
      { $project: { _id: 1, type: 1, title: 1, viewCount: 1, commentCount: 1, upvoteCount: 1, upvotes: 1, createdAt: 1, author: 1 } },
      { $lookup: { from: 'users', localField: 'author', foreignField: '_id', as: 'author' } },
      { $unwind: '$author' },
      { $project: { _id: 1, type: 1, title: 1, viewCount: 1, commentCount: 1, upvoteCount: 1, upvotes: 1, createdAt: 1, 'author._id': 1, 'author.name': 1, 'author.avatar': 1 } },
    ]);
    res.json(posts.map(signPostMedia));
  } catch (err) {
    next(err);
  }
};

export const getRecentActivity = async (
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [recentPosts, recentComments] = await Promise.all([
      Post.find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(8)
        .select('type title author createdAt')
        .populate('author', 'name avatar')
        .lean(),
      Comment.find({})
        .sort({ createdAt: -1 })
        .limit(8)
        .select('postId author content createdAt')
        .populate('author', 'name avatar')
        .lean(),
    ]);

    const postItems = recentPosts.map((p) => {
      const author = p.author as Record<string, unknown>;
      return {
        id: String(p._id),
        kind: 'post',
        postType: p.type,
        title: p.title,
        author: { ...author, avatar: resolveAvatarUrl(author?.avatar as string | undefined) },
        timestamp: (p as Record<string, unknown>).createdAt,
        url: p.type === 'question' ? `/questions/${String(p._id)}`
          : p.type === 'skill' ? `/skills/${String(p._id)}`
          : p.type === 'tool' ? `/tools/${String(p._id)}`
          : p.type === 'event' ? `/events/${String(p._id)}`
          : `/posts/${String(p._id)}`,
      };
    });

    const commentItems = recentComments.map((c) => {
      const author = c.author as Record<string, unknown>;
      return {
        id: String(c._id),
        kind: 'comment',
        preview: String(c.content).slice(0, 60),
        author: { ...author, avatar: resolveAvatarUrl(author?.avatar as string | undefined) },
        timestamp: (c as Record<string, unknown>).createdAt,
        postId: String(c.postId),
      };
    });

    const all = [...postItems, ...commentItems]
      .sort((a, b) => new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime())
      .slice(0, 12);

    res.json(all);
  } catch (err) {
    next(err);
  }
};

export const getFeed = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { page = 1, limit = 20, type, lng, lat, radius = 10, sort = 'new', q, group } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter: Record<string, unknown> = { isActive: true };
    if (type) filter.type = type;
    if (group) filter.group = group;

    // Full-text search: match title (regex) OR tags (exact token)
    if (q && typeof q === 'string' && q.trim()) {
      const term = q.trim();
      filter.$or = [
        { title: { $regex: term, $options: 'i' } },
        { tags:  { $elemMatch: { $regex: term, $options: 'i' } } },
        { content: { $regex: term, $options: 'i' } },
      ];
    }

    // Geospatial filter — look up nearby authors then filter posts by author
    if (lng && lat) {
      const nearbyAuthorIds = await User.find({
        location: {
          $geoWithin: {
            $centerSphere: [[Number(lng), Number(lat)], Number(radius) / 6378.1],
          },
        },
        isActive: true,
      }).select('_id').lean();
      filter.author = { $in: nearbyAuthorIds.map((u) => u._id) };
    }

    // Sort strategy
    const sortMap: Record<string, Record<string, number>> = {
      hot: { requestCount: -1, createdAt: -1 },    // most requested via exchanges
      top: { viewCount: -1, commentCount: -1 },    // most visited
      new: { createdAt: -1 },                      // newest first
    };
    const sortQuery = sortMap[sort as string] ?? sortMap.new;

    const rawPosts = await Post.find(filter)
      .sort(sortQuery)
      .skip(skip)
      .limit(Number(limit))
      .populate('author', 'name avatar rating isVerified')
      .populate('group', 'name avatar')
      .lean();

    const total = await Post.countDocuments(filter);

    // Attach the authenticated user's vote status to each post
    const userId = req.userId;
    const posts = rawPosts.map((post) => {
      let userVote: 'up' | 'down' | null = null;
      if (userId) {
        if (post.upvotes.some((id) => id.toString() === userId)) userVote = 'up';
        else if (post.downvotes.some((id) => id.toString() === userId)) userVote = 'down';
      }
      return signPostMedia({ ...post, userVote });
    });

    res.json({ posts, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

export const createPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      type, title, content, tags, group, latitude, longitude,
      duration, groupSize, requirements, languages, locationName,
      isOnline, onlineLink, sessions, timeStart, timeEnd,
      recurring, startDate, ceuRate, condition, marketValue,
      specifications, bounty,
      // event-specific
      eventCategory, eventCapacity,
    } = req.body;

    // If posting to a group, check canPost permission
    if (group) {
      const grp = await Group.findOne({ _id: group, isActive: true });
      if (grp) {
        const m = grp.members.find((mem) => mem.user.toString() === req.userId);
        if (m && m.role === 'member' && m.permissions?.canPost === false) {
          return next(createError('You do not have permission to post in this group', 403));
        }
        if (!m && grp.admin.toString() !== req.userId) {
          return next(createError('You must be a member of the group to post', 403));
        }
      }
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const images = files.length > 0 ? await uploadFilesToS3(files, req.userId!) : [];

    const postData: Record<string, unknown> = {
      author: req.userId,
      type,
      title,
      content,
      tags: tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [],
      group: group || undefined,
      images,
      duration: duration || undefined,
      groupSize: eventCapacity ? Number(eventCapacity) : groupSize ? Number(groupSize) : undefined,
      eventCategory: eventCategory || undefined,
      requirements: requirements ? (Array.isArray(requirements) ? requirements : JSON.parse(requirements)) : undefined,
      languages: languages ? (Array.isArray(languages) ? languages : JSON.parse(languages)) : undefined,
      locationName: locationName || undefined,
      isOnline: isOnline === 'true' || isOnline === true || undefined,
      onlineLink: onlineLink || undefined,
      sessions: sessions ? Number(sessions) : undefined,
      timeStart: timeStart || undefined,
      timeEnd: timeEnd || undefined,
      recurring: recurring || undefined,
      startDate: startDate || undefined,
      ceuRate: ceuRate ? Number(ceuRate) : undefined,
      condition: condition || undefined,
      marketValue: marketValue ? Number(marketValue) : undefined,
      specifications: specifications
        ? (Array.isArray(specifications) ? specifications : JSON.parse(specifications))
        : undefined,
      bounty: bounty ? Number(bounty) : 0,
    };

    if (latitude && longitude) {
      postData.location = {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)],
      };
    }

    const post = await Post.create(postData);
    const populated = await post.populate('author', 'name avatar rating isVerified');

    // Fire-and-forget: notify users whose interest vector matches this post
    const authorName = (populated.author as Record<string, any>)?.name ?? 'Someone';
    const parsedTags = Array.isArray(postData.tags) ? postData.tags as string[] : [];
    notifyInterestedUsersForPost(
      String(post._id),
      req.userId!,
      authorName,
      String(postData.type ?? ''),
      String(postData.title ?? ''),
      String(postData.content ?? ''),
      parsedTags,
    );

    res.status(201).json(signPostMedia(populated.toObject()));
  } catch (err) {
    next(err);
  }
};

export const getPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const post = await Post.findOneAndUpdate(
      { _id: req.params.id, isActive: true },
      { $inc: { viewCount: 1 } },
      { new: true }
    )
      .populate('author', 'name avatar rating bio isVerified')
      .populate('group', 'name avatar')
      .populate('rsvps.user', 'name avatar isVerified')
      .lean();

    if (!post) return next(createError('Post not found', 404));

    const userId = req.userId;
    let userVote: 'up' | 'down' | null = null;
    let userRsvp: 'going' | 'maybe' | 'not-going' | null = null;

    if (userId) {
      if (post.upvotes.some((id) => id.toString() === userId)) userVote = 'up';
      else if (post.downvotes.some((id) => id.toString() === userId)) userVote = 'down';

      const myRsvp = (post.rsvps ?? []).find(
        (r) => r.user && r.user.toString() === userId
      );
      userRsvp = myRsvp ? myRsvp.status : null;
    }

    res.json(signPostMedia({ ...post, userVote, userRsvp }));
  } catch (err) {
    next(err);
  }
};

export const editPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const post = await Post.findOne({ _id: req.params.id, isActive: true });
    if (!post) return next(createError('Post not found', 404));

    // Only the author or admin may edit
    if (post.author.toString() !== req.userId && req.userRole !== 'admin') {
      return next(createError('Not authorized', 403));
    }

    const allowedFields = [
      'title', 'content', 'tags', 'duration', 'groupSize', 'eventCategory',
      'requirements', 'languages', 'locationName', 'isOnline', 'onlineLink',
      'sessions', 'timeStart', 'timeEnd', 'recurring', 'startDate', 'ceuRate',
      'condition', 'marketValue', 'specifications', 'bounty',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (post as any)[field] = req.body[field];
      }
    }

    // Handle eventCapacity → groupSize alias
    if (req.body.eventCapacity !== undefined) {
      post.groupSize = req.body.eventCapacity ? Number(req.body.eventCapacity) : undefined;
    }

    // New images if uploaded
    const editFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (editFiles.length > 0) {
      post.images = await uploadFilesToS3(editFiles, req.userId!);
    }

    // Location
    const { latitude, longitude } = req.body;
    if (latitude && longitude) {
      post.location = { type: 'Point', coordinates: [Number(longitude), Number(latitude)] };
    }

    await post.save();
    const populated = await post.populate('author', 'name avatar rating isVerified');
    res.json(signPostMedia(populated.toObject()));
  } catch (err) {
    next(err);
  }
};

export const votePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { vote } = req.body; // 'up' | 'down' | null
    const userId = req.userId as string;
    const post = await Post.findById(req.params.id);

    if (!post || !post.isActive) return next(createError('Post not found', 404));

    const upIdx = post.upvotes.findIndex((id) => id.toString() === userId);
    const downIdx = post.downvotes.findIndex((id) => id.toString() === userId);

    // Remove existing votes
    if (upIdx > -1) post.upvotes.splice(upIdx, 1);
    if (downIdx > -1) post.downvotes.splice(downIdx, 1);

    if (vote === 'up') post.upvotes.push(userId as unknown as (typeof post.upvotes)[0]);
    if (vote === 'down') post.downvotes.push(userId as unknown as (typeof post.downvotes)[0]);

    await post.save();

    res.json({
      upvotes: post.upvotes.length,
      downvotes: post.downvotes.length,
      userVote: vote || null,
    });
  } catch (err) {
    next(err);
  }
};

export const deletePost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const post = await Post.findOne({ _id: req.params.id });
    if (!post) return next(createError('Post not found', 404));

    if (post.author.toString() !== req.userId && req.userRole !== 'admin') {
      return next(createError('Not authorized', 403));
    }

    post.isActive = false;
    await post.save();

    res.json({ message: 'Post deleted' });
  } catch (err) {
    next(err);
  }
};

export const rsvpPost = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.body; // 'going' | 'maybe' | 'not-going' | null
    const userId = req.userId as string;

    const post = await Post.findOne({ _id: req.params.id, isActive: true, type: { $in: ['event', 'gift'] } });
    if (!post) return next(createError('Post not found', 404));

    if (!post.rsvps) post.rsvps = [];

    const idx = post.rsvps.findIndex((r) => r.user.toString() === userId);

    if (!status || status === null) {
      // Remove RSVP
      if (idx > -1) post.rsvps.splice(idx, 1);
    } else {
      if (idx > -1) {
        post.rsvps[idx].status = status;
      } else {
        post.rsvps.push({ user: userId as unknown as (typeof post.rsvps)[0]['user'], status });
      }
    }

    await post.save();

    const updated = await Post.findById(post._id)
      .populate('rsvps.user', 'name avatar isVerified')
      .lean();

    res.json({
      rsvps: updated?.rsvps ?? [],
      userRsvp: status || null,
    });
  } catch (err) {
    next(err);
  }
};

export const getComments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const comments = await Comment.find({ postId: req.params.id })
      .sort({ createdAt: 1 })
      .populate('author', 'name avatar isVerified')
      .lean();

    const userId = req.userId;
    const resolved = comments.map((c) => {
      const author = c.author as unknown as Record<string, unknown>;
      const images = ((c.images ?? []) as string[]).map((img) =>
        img && !img.startsWith('http') ? getSignedUrl(img) : img
      ).filter(Boolean);
      const upvoteIds = (c.upvotes ?? []) as unknown as { toString(): string }[];
      return {
        ...c,
        images,
        upvotes: upvoteIds.length,
        userVoted: userId ? upvoteIds.some((id) => id.toString() === userId) : false,
        author: { ...author, avatar: resolveAvatarUrl(author?.avatar as string | undefined) },
      };
    });
    res.json(resolved);
  } catch (err) {
    next(err);
  }
};

export const addComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { content, parentId } = req.body;

    const post = await Post.findOne({ _id: req.params.id, isActive: true });
    if (!post) return next(createError('Post not found', 404));

    // If the post belongs to a group, check canComment permission
    if (post.group) {
      const grp = await Group.findOne({ _id: post.group, isActive: true });
      if (grp) {
        const m = grp.members.find((mem) => mem.user.toString() === req.userId);
        if (m && m.role === 'member' && m.permissions?.canComment === false) {
          return next(createError('You do not have permission to comment in this group', 403));
        }
      }
    }

    const commentFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
    const images = commentFiles.length > 0 ? await uploadFilesToS3(commentFiles, req.userId!, 'comment-images') : [];

    const comment = await Comment.create({
      postId: req.params.id,
      author: req.userId,
      content,
      parentId: parentId || null,
      images,
    });

    // Increment comment count
    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: 1 } });

    const populated = await comment.populate('author', 'name avatar isVerified');
    const obj = populated.toObject() as Record<string, any>;
    if (obj.author?.avatar) obj.author.avatar = resolveAvatarUrl(obj.author.avatar);
    res.status(201).json(obj);
  } catch (err) {
    next(err);
  }
};

export const voteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.params;
    const userId = req.userId!;
    const comment = await Comment.findById(commentId);
    if (!comment) return next(createError('Comment not found', 404));

    const alreadyVoted = comment.upvotes.some((id) => id.toString() === userId);
    if (alreadyVoted) {
      comment.upvotes = comment.upvotes.filter((id) => id.toString() !== userId) as typeof comment.upvotes;
    } else {
      comment.upvotes.push(userId as unknown as import('mongoose').Types.ObjectId);
    }
    await comment.save();
    res.json({ upvotes: comment.upvotes.length, userVoted: !alreadyVoted });
  } catch (err) {
    next(err);
  }
};

export const deleteComment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return next(createError('Comment not found', 404));

    if (comment.author.toString() !== req.userId && req.userRole !== 'admin') {
      return next(createError('Not authorized', 403));
    }

    await comment.deleteOne();

    // Decrement comment count
    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentCount: -1 } });

    res.json({ message: 'Comment deleted' });
  } catch (err) {
    next(err);
  }
};

export const acceptAnswer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { commentId } = req.body;
    const post = await Post.findOne({
      _id: req.params.questionId,
      type: 'question',
      author: req.userId,
      isActive: true,
    });

    if (!post) return next(createError('Question not found or not authorized', 404));

    if (post.acceptedAnswerId) {
      return next(createError('This question already has an accepted answer', 409));
    }

    const answer = await Comment.findById(commentId);
    if (!answer || answer.postId.toString() !== post._id.toString()) {
      return next(createError('Answer not found', 404));
    }

    // Transfer bounty CEU: deduct from question author, award to answerer
    if (post.bounty && post.bounty > 0) {
      await Promise.all([
        User.findByIdAndUpdate(post.author, { $inc: { ceuBalance: -post.bounty } }),
        User.findByIdAndUpdate(answer.author, { $inc: { ceuBalance: post.bounty } }),
      ]);
    }

    post.acceptedAnswerId = answer._id;
    post.acceptedAnswerAuthor = answer.author;
    await post.save();

    res.json({ acceptedAnswerId: answer._id });
  } catch (err) {
    next(err);
  }
};
