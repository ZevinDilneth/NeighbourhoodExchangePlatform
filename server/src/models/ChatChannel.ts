import mongoose, { Schema } from 'mongoose';
import { IChatChannel } from '../types';

const chatChannelSchema = new Schema<IChatChannel>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, default: '', maxlength: 500 },
    icon: { type: String, default: 'fas fa-comments' },
    iconImage: { type: String },
    color: { type: String, default: '#4F46E5' },
    type: { type: String, enum: ['public', 'private'], default: 'public' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

chatChannelSchema.index({ group: 1, isActive: 1, createdAt: -1 });

export const ChatChannel = mongoose.model<IChatChannel>('ChatChannel', chatChannelSchema);
