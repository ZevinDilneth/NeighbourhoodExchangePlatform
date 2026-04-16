import mongoose, { Schema } from 'mongoose';
import { IPost } from '../types';

const postSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['skill', 'tool', 'event', 'question', 'general', 'gift'],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 5000 },
    images: [{ type: String }],
    tags: [{ type: String, trim: true, lowercase: true }],
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
    },
    upvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    commentCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    requestCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    bounty: { type: Number, default: 0 },
    acceptedAnswerId: { type: Schema.Types.ObjectId },
    acceptedAnswerAuthor: { type: Schema.Types.ObjectId, ref: 'User' },
    // Extended fields
    duration: { type: String },
    groupSize: { type: Number, min: 1 },
    eventCategory: { type: String, trim: true },
    requirements: [{ type: String }],
    languages: [{ type: String }],
    locationName: { type: String, trim: true },
    isOnline: { type: Boolean },
    onlineLink: { type: String },
    sessions: { type: Number, min: 1 },
    timeStart: { type: String },
    timeEnd: { type: String },
    recurring: { type: String, enum: ['once', 'weekly', 'biweekly', 'custom'] },
    startDate: { type: String },
    ceuRate: { type: Number, min: 0 },
    condition: { type: String, enum: ['New', 'Excellent', 'Good', 'Fair'] },
    marketValue: { type: Number, min: 0 },
    specifications: [
      {
        name: { type: String, required: true },
        details: [{ type: String }],
      },
    ],
    rsvps: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['going', 'maybe', 'not-going'], required: true },
      },
    ],
  },
  { timestamps: true }
);

postSchema.index({ location: '2dsphere' });
postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ group: 1, createdAt: -1 });
postSchema.index({ type: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ viewCount: -1 });
postSchema.index({ commentCount: -1 });
postSchema.index({ requestCount: -1 });

export const Post = mongoose.model<IPost>('Post', postSchema);
