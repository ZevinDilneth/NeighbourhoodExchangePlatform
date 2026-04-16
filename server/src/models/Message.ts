import mongoose, { Schema } from 'mongoose';
import { IMessage } from '../types';

const messageSchema = new Schema<IMessage>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    channel: { type: Schema.Types.ObjectId, ref: 'ChatChannel' },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, maxlength: 2000 },
    type: { type: String, enum: ['text', 'image', 'file'], default: 'text' },
    fileUrl: String,
    replyTo: { type: Schema.Types.ObjectId, ref: 'Message' },
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    isDeleted: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reports: [
      {
        reportedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

messageSchema.index({ group: 1, channel: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });

export const Message = mongoose.model<IMessage>('Message', messageSchema);
