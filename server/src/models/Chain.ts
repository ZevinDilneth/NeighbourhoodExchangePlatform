import mongoose, { Schema, Document, Types } from 'mongoose';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface IChainEdge {
  from: Types.ObjectId;
  to: Types.ObjectId;
  /** The skill / tool the 'from' user will provide to the 'to' user */
  skillName: string;
  /** Jaccard-based compatibility score between the two users (0–1) */
  compatibilityScore: number;
  /** Estimated CEU for this leg of the chain */
  estimatedCEU: number;
}

export interface IChainAcceptance {
  user: Types.ObjectId;
  /** null = pending decision, true = accepted, false = declined */
  accepted: boolean | null;
  respondedAt?: Date;
}

export interface IChain extends Document {
  _id: Types.ObjectId;
  /** Ordered list of user IDs forming the ring: [A, B, C] means A→B→C→A */
  participants: Types.ObjectId[];
  edges: IChainEdge[];
  status: 'proposed' | 'active' | 'completed' | 'declined' | 'expired';
  /** Chain-level fairness score: min(edge CEUs) / max(edge CEUs), range 0–1 */
  fairnessScore: number;
  /** Geometric mean of participant trust scores (0–1) */
  successProbability: number;
  /** One entry per participant; tracks who has responded */
  acceptances: IChainAcceptance[];
  /** How many edges have been fulfilled (for algorithm improvement tracking) */
  completedEdgesCount: number;
  /** Location scoping — city where the chain was discovered */
  city?: string;
  neighbourhood?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const chainEdgeSchema = new Schema<IChainEdge>(
  {
    from:               { type: Schema.Types.ObjectId, ref: 'User', required: true },
    to:                 { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillName:          { type: String, required: true },
    compatibilityScore: { type: Number, min: 0, max: 1, default: 0 },
    estimatedCEU:       { type: Number, min: 0, default: 1 },
  },
  { _id: false },
);

const chainAcceptanceSchema = new Schema<IChainAcceptance>(
  {
    user:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accepted:    { type: Boolean, default: null },
    respondedAt: Date,
  },
  { _id: false },
);

const chainSchema = new Schema<IChain>(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    edges:        [chainEdgeSchema],
    status: {
      type:    String,
      enum:    ['proposed', 'active', 'completed', 'declined', 'expired'],
      default: 'proposed',
    },
    fairnessScore:       { type: Number, min: 0, max: 1, default: 0 },
    successProbability:  { type: Number, min: 0, max: 1, default: 0 },
    acceptances:         [chainAcceptanceSchema],
    completedEdgesCount: { type: Number, default: 0 },
    city:                { type: String },
    neighbourhood:       { type: String },
    expiresAt: {
      type:    Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  },
  { timestamps: true },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
chainSchema.index({ participants: 1 });
chainSchema.index({ status: 1, createdAt: -1 });
chainSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL: auto-delete expired chains

export const Chain = mongoose.model<IChain>('Chain', chainSchema);
