import mongoose, { Schema } from 'mongoose';
import { IGroup } from '../types';

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 1000 },
    avatar: String,
    coverImage: String,
    color: { type: String, default: '#4F46E5' },
    bannerPattern: { type: String, default: 'none' },
    type: { type: String, enum: ['public', 'private', 'restricted'], default: 'public' },
    category: { type: String, required: true },
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    moderators: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: ['admin', 'moderator', 'member'], default: 'member' },
        joinedAt: { type: Date, default: Date.now },
        permissions: {
          canPost:        { type: Boolean, default: true },
          canComment:     { type: Boolean, default: true },
          canUploadFiles: { type: Boolean, default: true },
          canInvite:      { type: Boolean, default: false },
          isMuted:        { type: Boolean, default: false },
          mutedUntil:     { type: Date,    default: null },
        },
      },
    ],
    memberCount: { type: Number, default: 0 },
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: { type: [Number] },
      address: String,
    },
    tags: [{ type: String, trim: true, lowercase: true }],
    rules: [{ type: String, trim: true }],
    bannedMembers: [
      {
        user:     { type: Schema.Types.ObjectId, ref: 'User', required: true },
        bannedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        reason:   { type: String, default: '' },
        bannedAt: { type: Date, default: Date.now },
        unbanRequest: {
          status:      { type: String, enum: ['pending', 'approved', 'denied'], default: null },
          reason:      { type: String, default: '' },
          requestedAt: { type: Date, default: null },
        },
      },
    ],
    isActive: { type: Boolean, default: true },
    settings: {
      // Privacy
      requireJoinApproval:  { type: Boolean, default: false },
      requirePostApproval:  { type: Boolean, default: false },
      allowMemberPosts:     { type: Boolean, default: true },
      // Moderation
      filterSpam:           { type: Boolean, default: true },
      filterLinks:          { type: Boolean, default: false },
      filterKeywords:       { type: Boolean, default: false },
      bannedKeywords:       [{ type: String, trim: true, lowercase: true }],
      reportThreshold:      { type: Number, default: 3 },
      // Features
      featureEvents:        { type: Boolean, default: true },
      featureResources:     { type: Boolean, default: true },
      featurePolls:         { type: Boolean, default: true },
      featureAnalytics:     { type: Boolean, default: false },
      featureBadges:        { type: Boolean, default: false },
      // Membership
      allowMemberInvites:   { type: Boolean, default: true },
      autoApproveInvites:   { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

groupSchema.index({ location: '2dsphere' });
groupSchema.index({ name: 'text', description: 'text' });
groupSchema.index({ category: 1 });
groupSchema.index({ type: 1 });

export const Group = mongoose.model<IGroup>('Group', groupSchema);
