import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser } from '../types';

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    avatar: { type: String },
    videoIntro: { type: String }, // S3 key for identity verification video
    bio: { type: String, maxlength: 1000 }, // ~100 words ≈ up to 700 chars, 1000 gives headroom
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true, default: [0, 0] },
      address: String,
      neighbourhood: String,
      city: String,
      postcode: String,
      country: String,
    },
    skills: [{
      name:         { type: String, trim: true, required: true },
      type:         { type: String, enum: ['Teaching', 'Exchange', 'Both', 'Other'], default: 'Teaching' },
      description:  { type: String, trim: true, default: '' },
      proficiency:  { type: String, enum: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], default: 'Intermediate' },
      availability: { type: String, trim: true, default: 'Flexible' },
      rate:         { type: String, trim: true, default: '' },
    }],
    interests: [{
      name:         { type: String, trim: true, required: true },
      category:     { type: String, trim: true, default: 'Other' },
      description:  { type: String, trim: true, default: '' },
      level:        { type: String, enum: ['Beginner', 'Intermediate', 'Advanced'], default: 'Beginner' },
      willingToPay: { type: String, trim: true, default: '' },
    }],
    ceuBalance: { type: Number, default: 100 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    exchangeCount: { type: Number, default: 0 },
    trustScore: { type: Number, default: 0 },
    role: { type: String, enum: ['user', 'admin', 'moderator'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    isVideoVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    phone: { type: String, default: null },
    isPhoneVerified: { type: Boolean, default: false },
    phoneVerificationCode: { type: String, select: false },
    phoneVerificationExpires: { type: Date, select: false },
    pendingPhone: { type: String, select: false },
    pendingPhoneCode: { type: String, select: false },
    pendingPhoneExpires: { type: Date, select: false },
    groupInvitations: [{
      group: { type: Schema.Types.ObjectId, ref: 'Group' },
      invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
      createdAt: { type: Date, default: Date.now },
    }],
    preferredTags: [{ type: String, trim: true }],
    groups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    mutedGroups: [{ type: Schema.Types.ObjectId, ref: 'Group' }],
    refreshTokens: [{ type: String }],
    verificationToken: { type: String },
    verificationTokenExpires: { type: Date },
    passwordResetToken: { type: String },
    passwordResetExpires: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ location: '2dsphere' });
userSchema.index({ email: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Strip sensitive fields from all JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    delete ret.refreshTokens;
    delete ret.verificationToken;
    delete ret.verificationTokenExpires;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.phoneVerificationCode;
    delete ret.phoneVerificationExpires;
    delete ret.pendingPhoneCode;
    delete ret.pendingPhoneExpires;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
