/**
 * UserRanking — persisted result of the Ranking Calculation Algorithm.
 *
 * Recalculated:
 *   • On-demand (user or admin trigger via POST /api/rankings/recalculate)
 *   • Nightly (scheduled job calls POST /api/rankings/recalculate-all)
 *
 * A TTL index is NOT used — stale rankings are kept for trend comparison.
 * Rankings older than 7 days are overwritten on next recalculation.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RankingTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type RankingTrend = 'rising' | 'stable' | 'falling';
export type RankingCategory =
  | 'skillExchange'
  | 'toolSharing'
  | 'qaParticipation'
  | 'communityBuilding'
  | 'chainSuccess'
  | 'fairnessHistory';

/** 0–100 breakdown of a single category's sub-scores */
export interface ICategoryBreakdown {
  /** Weighted composite for this category (0–100) */
  score: number;
  /** Volume of participation: log-normalised to 0–100 */
  quantity: number;
  /** Ratings / satisfaction / acceptance rate: 0–100 */
  quality: number;
  /** Long-term engagement over last 90 days: 0–100 */
  consistency: number;
  /** Range of activities within the category: 0–100 */
  diversity: number;
}

export interface IUserRanking extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;

  /** Weighted sum across all 6 categories (0–100, 2dp) */
  overallScore: number;
  /** Platform-wide rank: 1 = highest scorer */
  rank: number;
  /** Tier label derived from overallScore */
  tier: RankingTier;

  /** Per-category breakdown */
  categories: Record<RankingCategory, ICategoryBreakdown>;

  /** Whether the user's score improved / held / dropped vs the previous snapshot */
  trend: RankingTrend;
  /** overallScore at last calculation (for trend comparison) */
  previousScore: number;
  /** Consecutive days the user has had ≥1 platform activity */
  streakDays: number;

  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schema ───────────────────────────────────────────────────────────────

const breakdownSchema = new Schema<ICategoryBreakdown>(
  {
    score:       { type: Number, min: 0, max: 100, default: 0 },
    quantity:    { type: Number, min: 0, max: 100, default: 0 },
    quality:     { type: Number, min: 0, max: 100, default: 0 },
    consistency: { type: Number, min: 0, max: 100, default: 0 },
    diversity:   { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

// ─── Main schema ──────────────────────────────────────────────────────────────

const userRankingSchema = new Schema<IUserRanking>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    overallScore:  { type: Number, min: 0, max: 100, default: 0 },
    rank:          { type: Number, default: 0 },
    tier:          { type: String, enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'], default: 'bronze' },

    categories: {
      skillExchange:     { type: breakdownSchema, default: () => ({}) },
      toolSharing:       { type: breakdownSchema, default: () => ({}) },
      qaParticipation:   { type: breakdownSchema, default: () => ({}) },
      communityBuilding: { type: breakdownSchema, default: () => ({}) },
      chainSuccess:      { type: breakdownSchema, default: () => ({}) },
      fairnessHistory:   { type: breakdownSchema, default: () => ({}) },
    },

    trend:         { type: String, enum: ['rising', 'stable', 'falling'], default: 'stable' },
    previousScore: { type: Number, default: 0 },
    streakDays:    { type: Number, default: 0 },

    lastCalculatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

userRankingSchema.index({ overallScore: -1 });
userRankingSchema.index({ rank: 1 });
userRankingSchema.index({ tier: 1, overallScore: -1 });
userRankingSchema.index({ 'categories.skillExchange.score':     -1 });
userRankingSchema.index({ 'categories.toolSharing.score':       -1 });
userRankingSchema.index({ 'categories.qaParticipation.score':   -1 });
userRankingSchema.index({ 'categories.communityBuilding.score': -1 });
userRankingSchema.index({ 'categories.chainSuccess.score':      -1 });
userRankingSchema.index({ 'categories.fairnessHistory.score':   -1 });

export const UserRanking = mongoose.model<IUserRanking>('UserRanking', userRankingSchema);
