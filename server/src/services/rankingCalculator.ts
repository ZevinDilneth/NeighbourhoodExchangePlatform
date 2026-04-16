/**
 * Ranking Calculation Algorithm — SRS Section 5.6
 *
 * Overall Score = Σ(CategoryScore × CategoryWeight)
 *
 * Categories & weights:
 *   Skill Exchange      25%
 *   Tool Sharing        20%
 *   Q&A Participation   20%
 *   Community Building  15%
 *   Chain Success       10%
 *   Fairness History    10%
 *
 * Each category is scored 0–100 from four sub-dimensions:
 *   Quantity    (30%) — log-normalised volume
 *   Quality     (35%) — ratings / satisfaction / acceptance
 *   Consistency (20%) — activity spread over last 90 days
 *   Diversity   (15%) — breadth of engagement within the category
 */

import { Types } from 'mongoose';
import { Exchange } from '../models/Exchange';
import { Post }     from '../models/Post';
import { Chain }    from '../models/Chain';
import { User }     from '../models/User';
import { ICategoryBreakdown, RankingCategory, RankingTier, RankingTrend } from '../models/UserRanking';

// ─── Category weights ─────────────────────────────────────────────────────────

const WEIGHTS: Record<RankingCategory, number> = {
  skillExchange:     0.25,
  toolSharing:       0.20,
  qaParticipation:   0.20,
  communityBuilding: 0.15,
  chainSuccess:      0.10,
  fairnessHistory:   0.10,
};

// ─── Sub-dimension weights (same across all categories) ───────────────────────

const SUB_W = { quantity: 0.30, quality: 0.35, consistency: 0.20, diversity: 0.15 };

// ─── Normalisation helpers ────────────────────────────────────────────────────

/**
 * Logarithmic normalisation: maps 0 → 0, target → 100, with diminishing returns above target.
 * Prevents power-users from getting 10× advantage over moderately active members.
 *
 * @param value  raw count / metric value
 * @param target the "excellent" benchmark (maps to ≈ 100)
 */
function logNorm(value: number, target: number): number {
  if (value <= 0 || target <= 0) return 0;
  return Math.min(100, (Math.log(value + 1) / Math.log(target + 1)) * 100);
}

/**
 * Linear clamp: maps a raw 0–max value linearly to 0–100.
 * Used for scores already on a bounded scale (e.g. rating 1–5, fairness 0–1).
 */
function linNorm(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

/**
 * Consistency score: what fraction of weekly buckets (in the last 90 days)
 * had at least one activity?
 *
 * @param dates  timestamps of activities for this category
 * @param days   lookback window (default 90)
 * @param buckets number of time-slots within the window (default 13 ≈ 1 per week)
 */
function consistencyScore(dates: Date[], days = 90, buckets = 13): number {
  if (dates.length === 0) return 0;
  const now        = Date.now();
  const cutoff     = now - days  * 86_400_000;
  const bucketSize = (days / buckets) * 86_400_000;
  const active     = new Set<number>();

  for (const d of dates) {
    const ts = d.getTime();
    if (ts >= cutoff) active.add(Math.floor((ts - cutoff) / bucketSize));
  }

  return (active.size / buckets) * 100;
}

/**
 * Composite category score from the four sub-dimensions.
 */
function catScore(
  quantity: number,
  quality: number,
  consistency: number,
  diversity: number,
): number {
  return (
    quantity    * SUB_W.quantity    +
    quality     * SUB_W.quality     +
    consistency * SUB_W.consistency +
    diversity   * SUB_W.diversity
  );
}

/** Round to 2 decimal places */
const r2 = (n: number) => Math.round(n * 100) / 100;

// ─── Category algorithms ──────────────────────────────────────────────────────

/**
 * SKILL EXCHANGE (25%)
 *
 * Quantity    : completed skill exchanges (target = 20)
 * Quality     : avg rating received from exchange partners (1–5 → 0–100)
 * Consistency : weekly activity spread over last 90 days
 * Diversity   : distinct skills offered (target = 5)
 */
async function calcSkillExchange(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  const exchanges = await Exchange.find({
    type:   'skill',
    status: 'completed',
    $or: [{ requester: oid }, { provider: oid }],
  }).select('requester provider requesterRating providerRating offering createdAt').lean();

  // Quantity
  const quantity = r2(logNorm(exchanges.length, 20));

  // Quality — collect ratings where *this* user was rated
  const ratings: number[] = [];
  for (const ex of exchanges) {
    if (ex.provider?.toString() === uid && ex.requesterRating != null)
      ratings.push(ex.requesterRating);
    if (ex.requester?.toString() === uid && ex.providerRating != null)
      ratings.push(ex.providerRating);
  }
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 3; // default to midpoint if no ratings yet
  const quality = r2(linNorm(avgRating, 1, 5));

  // Consistency — completedDate proxied by updatedAt
  const consistency = r2(
    consistencyScore(exchanges.map(ex => new Date((ex as { updatedAt: Date }).updatedAt))),
  );

  // Diversity — unique offering keywords (first word as category proxy)
  const uniqueOfferings = new Set(
    exchanges.map(ex => ex.offering?.toLowerCase().split(' ')[0] ?? '').filter(Boolean),
  );
  const diversity = r2(logNorm(uniqueOfferings.size, 5));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

/**
 * TOOL SHARING (20%)
 *
 * Quantity    : completed tool exchanges (borrow + gift; target = 15)
 * Quality     : avg rating received
 * Consistency : weekly spread over 90 days
 * Diversity   : distinct tools + bonus for both lending and gifting (target = 4)
 */
async function calcToolSharing(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  const exchanges = await Exchange.find({
    type:   'tool',
    status: 'completed',
    $or: [{ requester: oid }, { provider: oid }],
  }).select('requester provider requesterRating providerRating offering tags createdAt').lean();

  const quantity = r2(logNorm(exchanges.length, 15));

  const ratings: number[] = [];
  for (const ex of exchanges) {
    if (ex.provider?.toString() === uid && ex.requesterRating != null)
      ratings.push(ex.requesterRating);
    if (ex.requester?.toString() === uid && ex.providerRating != null)
      ratings.push(ex.providerRating);
  }
  const avgRating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 3;
  const quality = r2(linNorm(avgRating, 1, 5));

  const consistency = r2(
    consistencyScore(exchanges.map(ex => new Date((ex as { updatedAt: Date }).updatedAt))),
  );

  // Diversity: distinct tool names offered + bonus for mixing borrow/gift via tags
  const toolNames = new Set(
    exchanges.map(ex => ex.offering?.toLowerCase().split(' ').slice(0, 2).join('-') ?? '').filter(Boolean),
  );
  const hasGift  = exchanges.some(ex => ex.tags?.includes('gift'));
  const hasLend  = exchanges.some(ex => !ex.tags?.includes('gift'));
  const diversityRaw = toolNames.size + (hasGift && hasLend ? 1 : 0);
  const diversity = r2(logNorm(diversityRaw, 4));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

/**
 * Q&A PARTICIPATION (20%)
 *
 * Quantity    : total posts authored across all types (target = 30)
 * Quality     : upvotes received + accepted-answer bonus (×5) (target = 50)
 * Consistency : weekly posting spread
 * Diversity   : distinct post types + distinct tags (target = 8)
 */
async function calcQAParticipation(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  const posts = await Post.find({ author: oid, isActive: true })
    .select('type upvotes tags createdAt acceptedAnswerAuthor')
    .lean();

  const quantity = r2(logNorm(posts.length, 30));

  // Quality: total upvotes received + 5 per accepted answer
  const totalUpvotes = posts.reduce((s, p) => s + (p.upvotes?.length ?? 0), 0);
  const acceptedAnswers = posts.filter(
    p => p.acceptedAnswerAuthor?.toString() === uid,
  ).length;
  const qualityRaw = totalUpvotes + acceptedAnswers * 5;
  const quality = r2(logNorm(qualityRaw, 50));

  const consistency = r2(
    consistencyScore(posts.map(p => new Date(p.createdAt as Date))),
  );

  // Diversity: distinct post types + distinct tag stems
  const postTypes = new Set(posts.map(p => p.type));
  const allTags   = new Set(posts.flatMap(p => p.tags ?? []));
  const diversityRaw = postTypes.size + allTags.size;
  const diversity = r2(logNorm(diversityRaw, 8));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

/**
 * COMMUNITY BUILDING (15%)
 *
 * Quantity    : groups joined + events posted (target = 10)
 * Quality     : upvotes on event/general posts (community engagement received)
 * Consistency : event/general post spread over 90 days
 * Diversity   : number of distinct groups + distinct event tags (target = 5)
 */
async function calcCommunityBuilding(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  // Fetch user's group count
  const userDoc = await User.findById(oid).select('groups').lean();
  const groupCount = userDoc?.groups?.length ?? 0;

  // Community posts: events + general
  const communityPosts = await Post.find({
    author:   oid,
    isActive: true,
    type:     { $in: ['event', 'general'] },
  }).select('upvotes tags createdAt').lean();

  const quantity = r2(logNorm(groupCount + communityPosts.length, 10));

  // Quality: upvotes on community posts
  const communityUpvotes = communityPosts.reduce((s, p) => s + (p.upvotes?.length ?? 0), 0);
  const quality = r2(logNorm(communityUpvotes, 30));

  const consistency = r2(
    consistencyScore(communityPosts.map(p => new Date(p.createdAt as Date))),
  );

  // Diversity: distinct event tags
  const eventTags = new Set(communityPosts.flatMap(p => p.tags ?? []));
  const diversityRaw = groupCount + eventTags.size;
  const diversity = r2(logNorm(diversityRaw, 5));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

/**
 * CHAIN SUCCESS (10%)
 *
 * Quantity    : chains user has been in (active + completed; target = 5)
 * Quality     : personal chain completion rate (0–100 %)
 * Consistency : chain activity spread over 90 days
 * Diversity   : distinct chain lengths (3-way, 4-way, etc.; target = 3)
 */
async function calcChainSuccess(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  const chains = await Chain.find({
    participants: oid,
    status: { $in: ['active', 'completed', 'declined', 'expired'] },
  }).select('participants status edges completedEdgesCount createdAt').lean();

  const participated = chains.length;
  const completed    = chains.filter(c => c.status === 'completed').length;

  const quantity = r2(logNorm(participated, 5));

  // Quality: completion rate
  const completionRate = participated > 0 ? (completed / participated) * 100 : 0;
  const quality = r2(completionRate);

  const consistency = r2(
    consistencyScore(chains.map(c => new Date((c as { createdAt: Date }).createdAt))),
  );

  // Diversity: distinct ring sizes
  const chainLengths = new Set(chains.map(c => c.participants?.length ?? 0));
  const diversity = r2(logNorm(chainLengths.size, 3));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

/**
 * FAIRNESS HISTORY (10%)
 *
 * Quantity    : exchanges that have a fairnessScore (target = 15)
 * Quality     : average fairnessScore (0–1 → 0–100)
 * Consistency : fairness maintained over time (recent vs older)
 * Diversity   : maintaining fairness across skill AND tool exchange types
 */
async function calcFairnessHistory(uid: string): Promise<ICategoryBreakdown> {
  const oid = new Types.ObjectId(uid);

  const exchanges = await Exchange.find({
    $or: [{ requester: oid }, { provider: oid }],
    fairnessScore: { $ne: null },
  }).select('type fairnessScore createdAt').lean();

  const quantity = r2(logNorm(exchanges.length, 15));

  // Quality: average fairness score
  const avgFairness = exchanges.length
    ? exchanges.reduce((s, ex) => s + (ex.fairnessScore ?? 0), 0) / exchanges.length
    : 0;
  const quality = r2(avgFairness * 100);

  // Consistency: check recent 45 days vs older
  const cutoff      = Date.now() - 45 * 86_400_000;
  const recentFair  = exchanges.filter(ex => new Date(ex.createdAt as Date).getTime() >= cutoff);
  const recentAvg   = recentFair.length
    ? recentFair.reduce((s, ex) => s + (ex.fairnessScore ?? 0), 0) / recentFair.length
    : avgFairness;
  // Consistency = how close recent behaviour is to long-term average (no degradation)
  const consistencyRaw = exchanges.length > 0
    ? Math.max(0, 1 - Math.abs(recentAvg - avgFairness)) * 100
    : 0;
  const consistency = r2(consistencyRaw);

  // Diversity: fair across both skill and tool exchange types
  const hasSkill = exchanges.some(ex => ex.type === 'skill');
  const hasTool  = exchanges.some(ex => ex.type === 'tool');
  const typeCount = (hasSkill ? 1 : 0) + (hasTool ? 1 : 0);
  const diversity = r2(logNorm(typeCount, 2));

  const score = r2(catScore(quantity, quality, consistency, diversity));
  return { score, quantity, quality, consistency, diversity };
}

// ─── Tier + trend helpers ─────────────────────────────────────────────────────

function scoreTier(overall: number): RankingTier {
  if (overall >= 85) return 'diamond';
  if (overall >= 70) return 'platinum';
  if (overall >= 55) return 'gold';
  if (overall >= 40) return 'silver';
  return 'bronze';
}

function scoreTrend(current: number, previous: number): RankingTrend {
  const delta = current - previous;
  if (delta >  1.5) return 'rising';
  if (delta < -1.5) return 'falling';
  return 'stable';
}

// ─── Streak calculation ───────────────────────────────────────────────────────

/**
 * Count consecutive days (ending today) with at least one activity.
 * Activities = posts, exchanges (created or updated), or chain responses.
 */
async function calcStreak(uid: string): Promise<number> {
  const oid = new Types.ObjectId(uid);

  // Gather all relevant activity timestamps
  const [posts, exchanges, chains] = await Promise.all([
    Post.find({ author: oid }).select('createdAt').lean(),
    Exchange.find({ $or: [{ requester: oid }, { provider: oid }] }).select('createdAt').lean(),
    Chain.find({
      participants: oid,
      'acceptances.user': oid,
      'acceptances.accepted': { $ne: null },
    }).select('acceptances').lean(),
  ]);

  const dates = new Set<string>();

  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  for (const p of posts)     dates.add(toDateStr(new Date(p.createdAt as Date)));
  for (const ex of exchanges) dates.add(toDateStr(new Date(ex.createdAt as Date)));
  for (const ch of chains) {
    const a = ch.acceptances?.find((a: { user: { toString: () => string }; respondedAt?: Date }) => a.user.toString() === uid && a.respondedAt);
    if (a?.respondedAt) dates.add(toDateStr(new Date(a.respondedAt)));
  }

  let streak = 0;
  const today = new Date();
  while (true) {
    const d = new Date(today);
    d.setDate(d.getDate() - streak);
    if (!dates.has(toDateStr(d))) break;
    streak++;
  }
  return streak;
}

// ─── Main exported function ───────────────────────────────────────────────────

export interface RankingResult {
  overallScore: number;
  tier: RankingTier;
  trend: RankingTrend;
  streakDays: number;
  categories: Record<RankingCategory, ICategoryBreakdown>;
}

/**
 * Calculate the full ranking result for a single user.
 * All 6 category queries run concurrently.
 *
 * @param userId        - MongoDB user ID string
 * @param previousScore - stored score from last calculation (for trend)
 */
export async function calculateRanking(
  userId: string,
  previousScore = 0,
): Promise<RankingResult> {
  // Run all 6 categories + streak concurrently
  const [
    skillExchange,
    toolSharing,
    qaParticipation,
    communityBuilding,
    chainSuccess,
    fairnessHistory,
    streakDays,
  ] = await Promise.all([
    calcSkillExchange(userId),
    calcToolSharing(userId),
    calcQAParticipation(userId),
    calcCommunityBuilding(userId),
    calcChainSuccess(userId),
    calcFairnessHistory(userId),
    calcStreak(userId),
  ]);

  const categories: Record<RankingCategory, ICategoryBreakdown> = {
    skillExchange,
    toolSharing,
    qaParticipation,
    communityBuilding,
    chainSuccess,
    fairnessHistory,
  };

  // Weighted sum
  const overallScore = r2(
    Object.entries(WEIGHTS).reduce(
      (sum, [cat, w]) => sum + categories[cat as RankingCategory].score * w,
      0,
    ),
  );

  const tier    = scoreTier(overallScore);
  const trend   = scoreTrend(overallScore, previousScore);

  return { overallScore, tier, trend, streakDays, categories };
}

/** Calculate rankings for a batch of users (used in bulk recalculation). */
export async function calculateRankingBatch(
  userIds: string[],
  previousScoreMap: Map<string, number>,
): Promise<Map<string, RankingResult>> {
  const results = new Map<string, RankingResult>();

  // Process in batches of 20 to avoid overloading DB
  const BATCH = 20;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const chunk = userIds.slice(i, i + BATCH);
    await Promise.all(
      chunk.map(async uid => {
        const prev = previousScoreMap.get(uid) ?? 0;
        const result = await calculateRanking(uid, prev);
        results.set(uid, result);
      }),
    );
  }

  return results;
}

/** Determine the platform-wide tier thresholds for display */
export const TIER_THRESHOLDS: Record<RankingTier, { min: number; max: number; label: string; emoji: string }> = {
  diamond:  { min: 85,  max: 100, label: 'Diamond',  emoji: '💎' },
  platinum: { min: 70,  max: 84,  label: 'Platinum', emoji: '🥇' },
  gold:     { min: 55,  max: 69,  label: 'Gold',     emoji: '⭐' },
  silver:   { min: 40,  max: 54,  label: 'Silver',   emoji: '🥈' },
  bronze:   { min: 0,   max: 39,  label: 'Bronze',   emoji: '🥉' },
};

export const CATEGORY_META: Record<RankingCategory, { label: string; weight: number; icon: string; description: string }> = {
  skillExchange:     { label: 'Skill Exchange',      weight: 0.25, icon: 'fa-graduation-cap', description: 'Completed skill & service exchanges, ratings received, and variety of skills offered.' },
  toolSharing:       { label: 'Tool Sharing',        weight: 0.20, icon: 'fa-tools',          description: 'Tools lent and gifted, partner satisfaction ratings, lending frequency.' },
  qaParticipation:   { label: 'Q&A Participation',   weight: 0.20, icon: 'fa-question-circle', description: 'Posts authored, upvotes received, accepted answers, and topic breadth.' },
  communityBuilding: { label: 'Community Building',  weight: 0.15, icon: 'fa-users',          description: 'Groups joined, events organised, and community engagement generated.' },
  chainSuccess:      { label: 'Chain Success',       weight: 0.10, icon: 'fa-link',           description: 'Multi-user circular exchanges joined and completed.' },
  fairnessHistory:   { label: 'Fairness History',    weight: 0.10, icon: 'fa-balance-scale',  description: 'Average CEU fairness score maintained across all exchanges.' },
};
