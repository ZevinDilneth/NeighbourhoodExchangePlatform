import mongoose, { Schema, Document, Types } from 'mongoose';

export type NotificationType =
  | 'chain_proposed'
  | 'chain_accepted'
  | 'chain_declined'
  | 'chain_active'
  | 'exchange_message'
  | 'exchange_request'
  | 'exchange_accepted'
  | 'exchange_completed'
  | 'skill_swap_request'
  | 'interest_match'
  | 'general';

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'chain_proposed', 'chain_accepted', 'chain_declined', 'chain_active',
        'exchange_message', 'exchange_request', 'exchange_accepted',
        'exchange_completed', 'skill_swap_request', 'interest_match', 'general',
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    body:  { type: String, required: true, maxlength: 1000 },
    link:  { type: String },
    read:  { type: Boolean, default: false },
    data:  { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
