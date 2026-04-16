import mongoose, { Schema } from 'mongoose';
import { IGroupFile } from '../types';

const groupFileSchema = new Schema<IGroupFile>(
  {
    group:    { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    uploader: { type: Schema.Types.ObjectId, ref: 'User',  required: true },
    name:     { type: String, required: true },
    url:      { type: String, required: true },
    key:      { type: String, required: true },
    size:     { type: Number, required: true },
    mimeType: { type: String, required: true },
    category: {
      type: String,
      enum: ['image', 'video', 'audio', 'document', 'program', 'other'],
      required: true,
    },
  },
  { timestamps: true }
);

groupFileSchema.index({ group: 1, createdAt: -1 });
groupFileSchema.index({ group: 1, category: 1 });

export const GroupFile = mongoose.model<IGroupFile>('GroupFile', groupFileSchema);
