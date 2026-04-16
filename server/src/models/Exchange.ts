import mongoose, { Schema } from 'mongoose';
import { IExchange } from '../types';

const exchangeSchema = new Schema<IExchange>(
  {
    requester: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    provider: { type: Schema.Types.ObjectId, ref: 'User' },
    /** The post this exchange was requested from (optional) */
    postId: { type: Schema.Types.ObjectId, ref: 'Post' },
    /** The source Start Exchange this response was created from (optional) */
    sourceExchangeId: { type: Schema.Types.ObjectId, ref: 'Exchange' },
    /** The requester's own skill post linked as the offering (optional) */
    offeringPostId: { type: Schema.Types.ObjectId, ref: 'Post' },
    type: { type: String, enum: ['skill', 'tool', 'service'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 2000 },
    offering: { type: String, required: true, maxlength: 2000 },
    /** Standalone rich description of what the requester is offering (plain-text markdown) */
    offeringDescription: { type: String, trim: true, maxlength: 5000 },
    seeking: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ['open', 'pending', 'active', 'completed', 'cancelled'],
      default: 'open',
    },
    scheduledDate: Date,
    completedDate: Date,
    // ── Schedule fields (mirrors Post schedule) ────────────────────────────
    startDate:  { type: String, trim: true },
    timeStart:  { type: String, trim: true },
    timeEnd:    { type: String, trim: true },
    recurring:  { type: String, enum: ['once', 'weekly', 'biweekly', 'custom'], default: 'once' },
    sessions:   { type: Number, min: 1 },
    /** CEU value posted by the requester (Party A) */
    ceuValue: { type: Number, default: 1, min: 0 },
    /** CEU value offered by the provider when they respond (Party B). Defaults to ceuValue if not supplied. */
    providerCeuValue: { type: Number, min: 0 },
    images: [{ type: String }],
    /** Images for the skill/item being sought (copied from the linked post when postId is set) */
    seekingImages: [{ type: String }],
    /** Description of the sought skill (copied from the linked post when postId is set) */
    seekingDescription: { type: String, trim: true },
    /** Human-readable location name entered by the requester (e.g. "Starbucks on Main St") */
    locationName: { type: String, trim: true },
    /** Video call link for online exchanges */
    onlineLink: { type: String, trim: true },
    tags: [{ type: String, trim: true, lowercase: true }],
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    /** ── Tool-exchange fields (requester's offered tool) ──────────────── */
    toolCondition:   { type: String, trim: true },
    toolMarketValue: { type: Number, min: 0 },
    toolSpecs: [{ name: { type: String, trim: true }, details: [{ type: String, trim: true }] }],
    /** ── Seeking-tool metadata (copied from linked post) ──────────────── */
    seekingCondition:   { type: String, trim: true },
    seekingMarketValue: { type: Number, min: 0 },
    seekingSpecs: [{ name: { type: String, trim: true }, details: [{ type: String, trim: true }] }],
    /** ── Borrow deposit (CEU held as collateral, refunded on return) ─── */
    depositAmount: { type: Number, min: 0, default: 0 },

    messages: [
      {
        sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        parentId: { type: Schema.Types.ObjectId, default: null },
      },
    ],
    applications: [
      {
        applicant:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
        type:       { type: String, enum: ['ceu', 'skill'], required: true },
        ceuOffer:   { type: Number, min: 0 },
        skillOffer: { type: String, trim: true, maxlength: 500 },
        status:     { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
        createdAt:  { type: Date, default: Date.now },
      },
    ],
    requesterRating: { type: Number, min: 1, max: 5 },
    providerRating: { type: Number, min: 1, max: 5 },
    fairnessScore: { type: Number, min: 0, max: 1, default: null },
    fairnessLabel: {
      type: String,
      enum: ['fair', 'needs_adjustment', 'unfair', null],
      default: null,
    },
    /** Serialised FairnessSuggestion[] — stored so the UI can show them without re-computing */
    fairnessSuggestions: { type: Schema.Types.Mixed, default: [] },
    /** Wanted skills for skill/service exchanges — [{name, description, proficiency}] */
    wantedSkills: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

exchangeSchema.index({ location: '2dsphere' });
exchangeSchema.index({ requester: 1, createdAt: -1 });
exchangeSchema.index({ status: 1, createdAt: -1 });
exchangeSchema.index({ type: 1, status: 1 });

export const Exchange = mongoose.model<IExchange>('Exchange', exchangeSchema);
