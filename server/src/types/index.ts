import { Request } from 'express';
import { Document, Types } from 'mongoose';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  avatar?: string;
  videoIntro?: string;
  phone?: string | null;
  isPhoneVerified?: boolean;
  phoneVerificationCode?: string;
  phoneVerificationExpires?: Date;
  pendingPhone?: string;
  pendingPhoneCode?: string;
  pendingPhoneExpires?: Date;
  bio?: string;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
    address?: string;
    neighbourhood?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  skills: { name: string; type: string; description: string; proficiency: string; availability: string; rate: string }[];
  interests: { name: string; category: string; description: string; level: string; willingToPay: string }[];
  ceuBalance: number;
  rating: number;
  reviewCount: number;
  exchangeCount: number;
  trustScore: number;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  isVideoVerified: boolean;
  isActive: boolean;
  suspendedUntil?: Date | null;
  blockedUsers: Types.ObjectId[];
  notifications: {
    exchangeRequests: boolean;
    messages: boolean;
    groupActivity: boolean;
    newFollowers: boolean;
    marketingEmails: boolean;
    newsletter: boolean;
  };
  preferences: {
    profileVisibility: 'public' | 'community' | 'private';
    showOnlineStatus: boolean;
    allowExchangeRequests: boolean;
  };
  preferredTags: string[];
  groupInvitations: IGroupInvitation[];
  groups: Types.ObjectId[];
  mutedGroups: Types.ObjectId[];
  refreshTokens: string[];
  verificationToken?: string;
  verificationTokenExpires?: Date;
  pendingEmail?: string;
  emailChangeCode?: string;
  emailChangeExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  author: Types.ObjectId;
  content: string;
  parentId?: Types.ObjectId;
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  type: 'skill' | 'tool' | 'event' | 'question' | 'general';
  title: string;
  content: string;
  images: string[];
  tags: string[];
  group?: Types.ObjectId;
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  upvotes: Types.ObjectId[];
  downvotes: Types.ObjectId[];
  commentCount: number;
  isActive: boolean;
  bounty: number;
  acceptedAnswerId?: Types.ObjectId;
  acceptedAnswerAuthor?: Types.ObjectId;
  // Extended session/exchange details
  duration?: string;
  groupSize?: number;
  eventCategory?: string;
  requirements?: string[];
  languages?: string[];
  locationName?: string;
  isOnline?: boolean;
  onlineLink?: string;
  sessions?: number;
  timeStart?: string;
  timeEnd?: string;
  recurring?: 'once' | 'weekly' | 'biweekly' | 'custom';
  startDate?: string;
  ceuRate?: number;
  condition?: 'New' | 'Excellent' | 'Good' | 'Fair';
  marketValue?: number;
  specifications?: { name: string; details: string[] }[];
  rsvps?: { user: Types.ObjectId; status: 'going' | 'maybe' | 'not-going' }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IExchangeApplication {
  _id: Types.ObjectId;
  applicant: Types.ObjectId;
  type: 'ceu' | 'skill';
  ceuOffer?: number;
  skillOffer?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
}

export interface IExchange extends Document {
  _id: Types.ObjectId;
  requester: Types.ObjectId;
  provider?: Types.ObjectId;
  postId?: Types.ObjectId;
  type: 'skill' | 'tool' | 'service';
  title: string;
  description: string;
  offering: string;
  seeking: string;
  status: 'open' | 'pending' | 'active' | 'completed' | 'cancelled';
  scheduledDate?: Date;
  completedDate?: Date;
  startDate?: string;
  timeStart?: string;
  timeEnd?: string;
  recurring?: 'once' | 'weekly' | 'biweekly' | 'custom';
  sessions?: number;
  ceuValue: number;
  /** CEU value offered by the provider when responding (Party B). Defaults to ceuValue. */
  providerCeuValue?: number;
  images: string[];
  /** Images copied from the linked post (what the requester is seeking) */
  seekingImages?: string[];
  /** Description copied from the linked post */
  seekingDescription?: string;
  /** The requester's own skill post used as the offering source */
  offeringPostId?: Types.ObjectId;
  tags: string[];
  location?: {
    type: 'Point';
    coordinates: [number, number];
  };
  messages: {
    sender: Types.ObjectId;
    content: string;
    timestamp: Date;
  }[];
  locationName?: string;
  onlineLink?: string;
  toolCondition?: string;
  toolMarketValue?: number;
  toolSpecs?: { name: string; details: string[] }[];
  seekingCondition?: string;
  seekingMarketValue?: number;
  seekingSpecs?: { name: string; details: string[] }[];
  /** CEU held as borrow deposit — refunded when the tool is returned */
  depositAmount?: number;
  applications: IExchangeApplication[];
  requesterRating?: number;
  providerRating?: number;
  fairnessScore?: number | null;
  fairnessLabel?: 'fair' | 'needs_adjustment' | 'unfair' | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fairnessSuggestions?: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupInvitation {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  invitedBy: Types.ObjectId;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
}

export interface IGroup extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  avatar?: string;
  coverImage?: string;
  color?: string;
  bannerPattern?: string;
  type: 'public' | 'private' | 'restricted';
  category: string;
  admin: Types.ObjectId;
  moderators: Types.ObjectId[];
  members: {
    user: Types.ObjectId;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: Date;
    permissions?: {
      canPost: boolean;
      canComment: boolean;
      canUploadFiles: boolean;
      canInvite: boolean;
      isMuted: boolean;
      mutedUntil?: Date | null;
    };
  }[];
  memberCount: number;
  location?: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
  };
  tags: string[];
  rules: string[];
  bannedMembers: {
    user: Types.ObjectId;
    bannedBy: Types.ObjectId;
    reason: string;
    bannedAt: Date;
    unbanRequest?: {
      status: 'pending' | 'approved' | 'denied' | null;
      reason: string;
      requestedAt: Date | null;
    };
  }[];
  isActive: boolean;
  settings?: {
    requireJoinApproval: boolean;
    requirePostApproval: boolean;
    allowMemberPosts: boolean;
    filterSpam: boolean;
    filterLinks: boolean;
    filterKeywords: boolean;
    bannedKeywords: string[];
    reportThreshold: number;
    featureEvents: boolean;
    featureResources: boolean;
    featurePolls: boolean;
    featureAnalytics: boolean;
    featureBadges: boolean;
    allowMemberInvites: boolean;
    autoApproveInvites: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  channel?: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  replyTo?: Types.ObjectId;
  reactions: {
    emoji: string;
    users: Types.ObjectId[];
  }[];
  isDeleted: boolean;
  pinned?: boolean;
  pinnedBy?: Types.ObjectId;
  reports?: { reportedBy: Types.ObjectId; reason: string; createdAt: Date }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IChatChannel extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  name: string;
  description: string;
  icon: string;
  iconImage?: string;
  color: string;
  type: 'public' | 'private';
  createdBy: Types.ObjectId;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGroupFile extends Document {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  uploader: Types.ObjectId;
  name: string;
  url: string;
  key: string;
  size: number;
  mimeType: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'program' | 'other';
  createdAt: Date;
  updatedAt: Date;
}

export type TokenPayload = {
  userId: string;
  role: string;
};
