export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  videoIntro?: string;
  isVideoVerified?: boolean;
  phone?: string | null;
  isPhoneVerified?: boolean;
  bio?: string;
  location: {
    type: 'Point';
    coordinates: [number, number];
    address?: string;
    neighbourhood?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
  skills: { name: string; type: string; description: string; proficiency: string; availability: string; rate: string }[];
  interests: { name: string; category: string; description: string; level: string; willingToPay: string }[];
  ceuBalance?: number;
  rating: number;
  reviewCount: number;
  exchangeCount: number;
  trustScore: number;
  role: 'user' | 'admin' | 'moderator';
  isVerified: boolean;
  preferredTags?: string[];
  groups: Group[];
  mutedGroups?: string[];
  createdAt: string;
}

export interface Post {
  _id: string;
  author: Pick<User, '_id' | 'name' | 'avatar' | 'rating' | 'isVerified'>;
  type: 'skill' | 'tool' | 'event' | 'question' | 'general';
  title: string;
  content: string;
  images: string[];
  tags: string[];
  group?: Pick<Group, '_id' | 'name' | 'avatar'>;
  upvotes: string[];
  downvotes: string[];
  commentCount: number;
  bounty?: number;
  acceptedAnswerId?: string;
  acceptedAnswerAuthor?: string;
  createdAt: string;
  updatedAt: string;
  userVote?: 'up' | 'down' | null;
  // Extended fields
  duration?: string;
  groupSize?: number;
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
  eventCategory?: string;
  specifications?: { name: string; details: string[] }[];
  rsvps?: { user: Pick<User, '_id' | 'name' | 'avatar' | 'isVerified'>; status: 'going' | 'maybe' | 'not-going' }[];
  userRsvp?: 'going' | 'maybe' | 'not-going' | null;
}

export interface Comment {
  _id: string;
  postId: string;
  author: Pick<User, '_id' | 'name' | 'avatar' | 'isVerified'>;
  content: string;
  parentId?: string | null;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export type FairnessLabel = 'fair' | 'needs_adjustment' | 'unfair';

export interface FairnessSuggestion {
  party: 'A' | 'B' | 'both';
  action: string;
  detail: string;
  ceuImpact: number;
}

export interface FairnessResult {
  score: number;
  label: FairnessLabel;
  description: string;
  emoji: string;
  adjustmentNeeded: number;
  targetCEU: { A: number; B: number };
  suggestions: FairnessSuggestion[];
}

export interface ExchangeApplication {
  _id: string;
  applicant: Pick<User, '_id' | 'name' | 'avatar' | 'rating' | 'isVerified'>;
  type: 'ceu' | 'skill';
  ceuOffer?: number;
  skillOffer?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

export interface Exchange {
  _id: string;
  requester: Pick<User, '_id' | 'name' | 'avatar' | 'rating' | 'isVerified'>;
  provider?: Pick<User, '_id' | 'name' | 'avatar' | 'rating' | 'isVerified'>;
  type: 'skill' | 'tool' | 'service';
  title: string;
  description: string;
  offering: string;
  seeking: string;
  status: 'open' | 'pending' | 'active' | 'completed' | 'cancelled';
  scheduledDate?: string;
  completedDate?: string;
  startDate?: string;
  timeStart?: string;
  timeEnd?: string;
  recurring?: 'once' | 'weekly' | 'biweekly' | 'custom';
  sessions?: number;
  ceuValue: number;
  providerCeuValue?: number;
  images: string[];
  seekingImages: string[];
  seekingDescription?: string;
  locationName?: string;
  onlineLink?: string;
  toolCondition?: string;
  toolMarketValue?: number;
  toolSpecs?: { name: string; details: string[] }[];
  seekingCondition?: string;
  seekingMarketValue?: number;
  seekingSpecs?: { name: string; details: string[] }[];
  location?: { type: 'Point'; coordinates: [number, number] };
  tags: string[];
  messages: ExchangeMessage[];
  applications?: ExchangeApplication[];
  fairnessScore?: number | null;
  fairnessLabel?: FairnessLabel | null;
  fairnessSuggestions?: FairnessSuggestion[];
  requesterRating?: number;   // rating submitted BY the requester (for the provider)
  providerRating?: number;    // rating submitted BY the provider (for the requester)
  createdAt: string;
  updatedAt: string;
}

export interface ExchangeMessage {
  _id?: string;
  sender: string;
  content: string;
  timestamp: string;
  parentId?: string | null;
}

export interface Group {
  _id: string;
  name: string;
  description: string;
  avatar?: string;
  coverImage?: string;
  color?: string;
  bannerPattern?: string;
  type: 'public' | 'private' | 'restricted';
  category: string;
  admin: Pick<User, '_id' | 'name' | 'avatar'>;
  moderators: Pick<User, '_id' | 'name' | 'avatar'>[];
  members: {
    user: Pick<User, '_id' | 'name' | 'avatar'>;
    role: 'admin' | 'moderator' | 'member';
    joinedAt: string;
    permissions?: {
      canPost: boolean;
      canComment: boolean;
      canUploadFiles: boolean;
      canInvite: boolean;
      isMuted: boolean;
      mutedUntil?: string | null;
    };
  }[];
  memberCount: number;
  tags: string[];
  rules: string[];
  bannedMembers?: {
    _id: string;
    user: Pick<User, '_id' | 'name' | 'avatar'>;
    bannedBy: Pick<User, '_id' | 'name' | 'avatar'>;
    reason?: string;
    bannedAt: string;
    unbanRequest?: {
      status: 'pending' | 'approved' | 'denied' | null;
      reason?: string;
      requestedAt?: string;
    };
  }[];
  stats?: { postsCount: number; eventsCount: number; messagesCount: number };
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
  createdAt: string;
}

export interface GroupInvitation {
  _id: string;
  group: Pick<Group, '_id' | 'name' | 'avatar' | 'memberCount' | 'type' | 'color'>;
  invitedBy: Pick<User, '_id' | 'name' | 'avatar'>;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface ChatChannel {
  _id: string;
  group: string;
  name: string;
  description: string;
  icon: string;
  iconImage?: string;
  color: string;
  type: 'public' | 'private';
  createdBy: Pick<User, '_id' | 'name' | 'avatar'>;
  isDefault: boolean;
  messageCount: number;
  lastMessage?: { content: string; createdAt: string; sender: { name: string } };
  createdAt: string;
}

export interface Message {
  _id: string;
  group: string;
  channel?: string;
  sender: Pick<User, '_id' | 'name' | 'avatar' | 'isVerified'>;
  content: string;
  type: 'text' | 'image' | 'file';
  fileUrl?: string;
  replyTo?: Message;
  reactions: { emoji: string; users: string[] }[];
  createdAt: string;
}

// ─── Chain Discovery types ─────────────────────────────────────────────────────

export interface ChainEdgeData {
  from: string;
  to: string;
  skillName: string;
  compatibilityScore: number;
  estimatedCEU: number;
}

export interface ChainAcceptance {
  user: string;
  accepted: boolean | null;
  respondedAt?: string;
}

export interface ChainParticipantDetail {
  _id: string;
  name: string;
  avatar?: string;
  trustScore: number;
}

export interface Chain {
  _id: string;
  participants: string[];
  participantDetails?: ChainParticipantDetail[];
  edges: ChainEdgeData[];
  status: 'proposed' | 'active' | 'completed' | 'declined' | 'expired';
  fairnessScore: number;
  successProbability: number;
  acceptances: ChainAcceptance[];
  completedEdgesCount: number;
  city?: string;
  neighbourhood?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Ranking types ─────────────────────────────────────────────────────────────

export type RankingTier     = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
export type RankingTrend    = 'rising' | 'stable' | 'falling';
export type RankingCategory =
  | 'skillExchange'
  | 'toolSharing'
  | 'qaParticipation'
  | 'communityBuilding'
  | 'chainSuccess'
  | 'fairnessHistory';

export interface CategoryBreakdown {
  score:       number;   // 0–100
  quantity:    number;
  quality:     number;
  consistency: number;
  diversity:   number;
}

export interface UserRanking {
  _id: string;
  user: Pick<User, '_id' | 'name' | 'avatar' | 'trustScore' | 'location'>;
  overallScore: number;
  rank: number;
  tier: RankingTier;
  trend: RankingTrend;
  previousScore: number;
  streakDays: number;
  categories: Record<RankingCategory, CategoryBreakdown>;
  lastCalculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface TierThreshold {
  min: number; max: number; label: string; emoji: string;
}

export interface CategoryMeta {
  label: string; weight: number; icon: string; description: string;
}

export interface RankingMeta {
  TIER_THRESHOLDS: Record<RankingTier, TierThreshold>;
  CATEGORY_META:   Record<RankingCategory, CategoryMeta>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Pick<User, '_id' | 'name' | 'email' | 'avatar' | 'role' | 'location' | 'ceuBalance'>;
}
