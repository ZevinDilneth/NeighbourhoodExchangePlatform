import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IChainMember {
  exchange:    Types.ObjectId;
  user:        Types.ObjectId;
  offering:    string;   // snapshot label  e.g. "Gardening"
  seeking:     string;   // snapshot label  e.g. "Guitar"
  status:      'pending' | 'accepted' | 'declined';
  respondedAt?: Date;
}

export interface ISkillChain extends Document {
  _id:     Types.ObjectId;
  members: IChainMember[];
  /** overall chain status */
  status:  'proposed' | 'active' | 'declined' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

const chainMemberSchema = new Schema<IChainMember>(
  {
    exchange:    { type: Schema.Types.ObjectId, ref: 'Exchange', required: true },
    user:        { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    offering:    { type: String, required: true },
    seeking:     { type: String, required: true },
    status:      { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
    respondedAt: { type: Date },
  },
  { _id: false },
);

const skillChainSchema = new Schema<ISkillChain>(
  {
    members: { type: [chainMemberSchema], required: true },
    status: {
      type:    String,
      enum:    ['proposed', 'active', 'declined', 'expired'],
      default: 'proposed',
    },
  },
  { timestamps: true },
);

// Quick look-up: find all chains a specific exchange is part of
skillChainSchema.index({ 'members.exchange': 1 });
skillChainSchema.index({ 'members.user':     1 });
skillChainSchema.index({ status: 1, createdAt: -1 });

export const SkillChain = mongoose.model<ISkillChain>('SkillChain', skillChainSchema);
