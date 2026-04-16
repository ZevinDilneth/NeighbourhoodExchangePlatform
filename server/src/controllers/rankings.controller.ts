import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { UserRanking } from '../models/UserRanking';
import { User }        from '../models/User';
import { createError } from '../middleware/errorHandler';
import {
  calculateRanking,
  calculateRankingBatch,
  TIER_THRESHOLDS,
  CATEGORY_META,
} from '../services/rankingCalculator';
import { RankingCategory } from '../models/UserRanking';
import { resolveAvatarUrl } from '../services/storage';

const resolveRankingAvatar = (r: Record<string, any>) =>
  r?.user?.avatar ? { ...r, user: { ...r.user, avatar: resolveAvatarUrl(r.user.avatar) } } : r;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_CATEGORIES: RankingCategory[] = [
  'skillExchange', 'toolSharing', 'qaParticipation',
  'communityBuilding', 'chainSuccess', 'fairnessHistory',
];

/**
 * After updating scores, recompute platform-wide rank numbers in a single bulk write.
 * Rank 1 = highest overall score.
 */
async function refreshRanks(): Promise<void> {
  const rankings = await UserRanking.find()
    .sort({ overallScore: -1 })
    .select('_id')
    .lean();

  const ops = rankings.map((r, idx) => ({
    updateOne: {
      filter: { _id: r._id },
      update: { $set: { rank: idx + 1 } },
    },
  }));

  if (ops.length > 0) await UserRanking.bulkWrite(ops);
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/rankings/leaderboard
 *
 * Query params:
 *   limit    (default 50, max 100)
 *   offset   (default 0)
 *   category (optional) — sort by a specific category score instead of overall
 *   tier     (optional) — filter by tier: diamond|platinum|gold|silver|bronze
 */
export const getLeaderboard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const limit    = Math.min(100, Number(req.query.limit)  || 50);
    const offset   = Math.max(0,   Number(req.query.offset) || 0);
    const tier     = req.query.tier     as string | undefined;
    const category = req.query.category as RankingCategory | undefined;

    // Build sort key
    const sortField = category && VALID_CATEGORIES.includes(category)
      ? `categories.${category}.score`
      : 'overallScore';

    const filter: Record<string, unknown> = {};
    if (tier && Object.keys(TIER_THRESHOLDS).includes(tier)) filter.tier = tier;

    const [rankings, total] = await Promise.all([
      UserRanking.find(filter)
        .sort({ [sortField]: -1 })
        .skip(offset)
        .limit(limit)
        .populate('user', 'name avatar trustScore location')
        .lean(),
      UserRanking.countDocuments(filter),
    ]);

    res.json({
      rankings: rankings.map(resolveRankingAvatar),
      total,
      limit,
      offset,
      sortedBy: category ?? 'overall',
      meta: { TIER_THRESHOLDS, CATEGORY_META },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rankings/me
 *
 * Returns the current user's full ranking breakdown.
 * Triggers a fresh calculation if the stored result is > 24 hours old.
 */
export const getMyRanking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.userId!;

    let ranking = await UserRanking.findOne({ user: userId })
      .populate('user', 'name avatar trustScore location')
      .lean();

    // Auto-refresh if stale (> 24 h)
    const staleMs = 24 * 60 * 60 * 1000;
    const isStale = !ranking || Date.now() - new Date(ranking.lastCalculatedAt).getTime() > staleMs;

    if (isStale) {
      const previousScore = ranking?.overallScore ?? 0;
      const result        = await calculateRanking(userId, previousScore);

      ranking = await UserRanking.findOneAndUpdate(
        { user: userId },
        {
          $set: {
            overallScore:      result.overallScore,
            tier:              result.tier,
            trend:             result.trend,
            streakDays:        result.streakDays,
            categories:        result.categories,
            previousScore,
            lastCalculatedAt:  new Date(),
          },
        },
        { upsert: true, new: true },
      ).populate('user', 'name avatar trustScore location').lean();

      // Update ranks asynchronously (don't block response)
      refreshRanks().catch(console.error);
    }

    res.json({ ranking: resolveRankingAvatar(ranking as Record<string, any>), meta: { TIER_THRESHOLDS, CATEGORY_META } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rankings/user/:id
 *
 * Public ranking for any user (summary only — no streak, no category detail).
 */
export const getUserRanking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ranking = await UserRanking.findOne({ user: req.params.id })
      .select('user overallScore rank tier trend categories lastCalculatedAt')
      .populate('user', 'name avatar trustScore location')
      .lean();

    if (!ranking) {
      res.json({ ranking: null, meta: { TIER_THRESHOLDS, CATEGORY_META } });
      return;
    }

    res.json({ ranking: resolveRankingAvatar(ranking as Record<string, any>), meta: { TIER_THRESHOLDS, CATEGORY_META } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rankings/recalculate
 *
 * Recalculate ranking for the requesting user immediately.
 * Rate-limited to once per 10 minutes client-side (enforced in route middleware).
 */
export const recalculateMyRanking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.userId!;

    const existing = await UserRanking.findOne({ user: userId }).select('overallScore').lean();
    const previousScore = existing?.overallScore ?? 0;

    const result = await calculateRanking(userId, previousScore);

    const updated = await UserRanking.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          overallScore:     result.overallScore,
          tier:             result.tier,
          trend:            result.trend,
          streakDays:       result.streakDays,
          categories:       result.categories,
          previousScore,
          lastCalculatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).populate('user', 'name avatar trustScore location').lean();

    // Re-rank asynchronously
    refreshRanks().catch(console.error);

    res.json({ ranking: resolveRankingAvatar(updated as Record<string, any>), meta: { TIER_THRESHOLDS, CATEGORY_META } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/rankings/recalculate-all  (admin only)
 *
 * Bulk recalculation for every active user.
 * Runs in batches of 20 to avoid DB overload.
 * Intended to be called from a nightly scheduled job.
 */
export const recalculateAll = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.userRole !== 'admin') return next(createError('Admin only', 403));

    const users = await User.find({ isActive: true }).select('_id').lean();
    const userIds = users.map(u => u._id.toString());

    // Load previous scores for trend comparison
    const existingRankings = await UserRanking.find({ user: { $in: userIds } })
      .select('user overallScore')
      .lean();

    const previousScoreMap = new Map<string, number>(
      existingRankings.map(r => [r.user.toString(), r.overallScore]),
    );

    const results = await calculateRankingBatch(userIds, previousScoreMap);

    // Bulk upsert
    const ops = [...results.entries()].map(([uid, result]) => ({
      updateOne: {
        filter: { user: uid },
        update: {
          $set: {
            overallScore:     result.overallScore,
            tier:             result.tier,
            trend:            result.trend,
            streakDays:       result.streakDays,
            categories:       result.categories,
            previousScore:    previousScoreMap.get(uid) ?? 0,
            lastCalculatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await UserRanking.bulkWrite(ops);
    await refreshRanks();

    res.json({ recalculated: userIds.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/rankings/stats  (admin only)
 *
 * Platform-wide ranking statistics: tier distribution, average scores, etc.
 */
export const getRankingStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (req.userRole !== 'admin') return next(createError('Admin only', 403));

    const [tierCounts, avgAgg] = await Promise.all([
      UserRanking.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      UserRanking.aggregate([
        {
          $group: {
            _id: null,
            avgOverall:           { $avg: '$overallScore' },
            avgSkillExchange:     { $avg: '$categories.skillExchange.score' },
            avgToolSharing:       { $avg: '$categories.toolSharing.score' },
            avgQA:                { $avg: '$categories.qaParticipation.score' },
            avgCommunity:         { $avg: '$categories.communityBuilding.score' },
            avgChain:             { $avg: '$categories.chainSuccess.score' },
            avgFairness:          { $avg: '$categories.fairnessHistory.score' },
            avgStreak:            { $avg: '$streakDays' },
            rising:               { $sum: { $cond: [{ $eq: ['$trend', 'rising'] },   1, 0] } },
            stable:               { $sum: { $cond: [{ $eq: ['$trend', 'stable'] },   1, 0] } },
            falling:              { $sum: { $cond: [{ $eq: ['$trend', 'falling'] },  1, 0] } },
          },
        },
      ]),
    ]);

    const tiers = Object.fromEntries(
      tierCounts.map(t => [t._id, t.count]),
    );

    res.json({ tiers, averages: avgAgg[0] ?? {} });
  } catch (err) {
    next(err);
  }
};
