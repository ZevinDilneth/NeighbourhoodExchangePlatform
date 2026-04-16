/**
 * Weighted Ranking Algorithm — SRS Section 5.4
 *
 * OverallScore = Σ(CategoryScore × CategoryWeight)
 *
 * Categories & Weights:
 *   Skill Exchange   25%  — completed skill exchanges + ratings received
 *   Tool Sharing     20%  — completed tool exchanges
 *   Q&A              20%  — upvotes received on question/answer posts
 *   Community        15%  — group memberships + posts created
 *   Chain Exchange   10%  — circular exchanges (reserved; 0 until implemented)
 *   Fairness         10%  — average fairness score across all exchanges
 *
 * Output: trustScore (0–100) stored on User document
 */

import { Exchange } from '../models/Exchange';
import { Post } from '../models/Post';
import { User } from '../models/User';

interface CategoryScores {
  skillExchange: number;
  toolSharing: number;
  qa: number;
  community: number;
  chainExchange: number;
  fairness: number;
}

const WEIGHTS: Record<keyof CategoryScores, number> = {
  skillExchange: 0.25,
  toolSharing:   0.20,
  qa:            0.20,
  community:     0.15,
  chainExchange: 0.10,
  fairness:      0.10,
};

/** Clamp a value to the 0–100 range */
const cap = (n: number): number => Math.min(100, Math.max(0, n));

/**
 * Recalculate and persist the trustScore for a given user.
 * Should be called after:
 *   - An exchange is completed
 *   - A post receives an upvote
 *   - A user joins/leaves a group
 */
export async function updateUserRanking(userId: string): Promise<void> {
  const [completedExchanges, allPosts, user] = await Promise.all([
    Exchange.find({
      $or: [{ requester: userId }, { provider: userId }],
      status: 'completed',
    }).lean(),
    Post.find({ author: userId, isActive: true }).lean(),
    User.findById(userId).select('groups').lean(),
  ]);

  if (!user) return;

  // ── 1. Skill Exchange (25%) ─────────────────────────────────────────────
  // 10 pts per completed skill exchange + up to 10 pts for each 5-star rating
  const skillExchanges = completedExchanges.filter((e) => e.type === 'skill');
  const skillExchangeScore = cap(
    skillExchanges.reduce((sum, e) => {
      const myRating =
        e.requester.toString() === userId ? e.providerRating : e.requesterRating;
      return sum + 10 + (myRating ? (myRating / 5) * 10 : 0);
    }, 0),
  );

  // ── 2. Tool Sharing (20%) ───────────────────────────────────────────────
  // 12 pts per completed tool exchange (caps at 100 after ~8 exchanges)
  const toolExchanges = completedExchanges.filter((e) => e.type === 'tool');
  const toolSharingScore = cap(toolExchanges.length * 12);

  // ── 3. Q&A (20%) ────────────────────────────────────────────────────────
  // 5 pts per upvote received on question-type posts
  const qaPosts = allPosts.filter((p) => p.type === 'question');
  const totalQAUpvotes = qaPosts.reduce((sum, p) => sum + p.upvotes.length, 0);
  const qaScore = cap(totalQAUpvotes * 5);

  // ── 4. Community (15%) ──────────────────────────────────────────────────
  // 5 pts per group membership + 2 pts per post authored
  const groupCount = Array.isArray((user as Record<string, unknown>).groups)
    ? ((user as Record<string, unknown>).groups as unknown[]).length
    : 0;
  const communityScore = cap(groupCount * 5 + allPosts.length * 2);

  // ── 5. Chain Exchange (10%) ─────────────────────────────────────────────
  // Not yet implemented — contributes 0 until chain exchange is built
  const chainExchangeScore = 0;

  // ── 6. Fairness (10%) ───────────────────────────────────────────────────
  // Average fairness score (0–1) across all completed exchanges × 100
  const fairnessValues = completedExchanges
    .filter((e) => typeof (e as Record<string, unknown>).fairnessScore === 'number')
    .map((e) => (e as Record<string, unknown>).fairnessScore as number);

  const avgFairness =
    fairnessValues.length > 0
      ? fairnessValues.reduce((a, b) => a + b, 0) / fairnessValues.length
      : 0.5; // neutral default for users with no exchanges yet

  const fairnessScore = cap(Math.round(avgFairness * 100));

  // ── Overall ─────────────────────────────────────────────────────────────
  const scores: CategoryScores = {
    skillExchange: skillExchangeScore,
    toolSharing:   toolSharingScore,
    qa:            qaScore,
    community:     communityScore,
    chainExchange: chainExchangeScore,
    fairness:      fairnessScore,
  };

  const overallScore = Math.round(
    (Object.keys(WEIGHTS) as Array<keyof CategoryScores>).reduce(
      (total, key) => total + scores[key] * WEIGHTS[key],
      0,
    ),
  );

  await User.findByIdAndUpdate(userId, { trustScore: overallScore });
}
