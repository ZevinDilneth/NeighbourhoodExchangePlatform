import mongoose, { Schema } from 'mongoose';
import { IComment } from '../types';

const commentSchema = new Schema<IComment>(
  {
    postId:   { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    author:   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content:  { type: String, required: true, trim: true, maxlength: 2000 },
    parentId: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
    images:   [{ type: String }],
    upvotes:  [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

commentSchema.index({ postId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>('Comment', commentSchema);
