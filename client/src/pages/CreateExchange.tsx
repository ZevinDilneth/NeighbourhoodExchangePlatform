import React, { useState, useEffect, useCallback, useRef } from 'react';
import RichTextEditor from '../components/RichTextEditor';
import PublicPlacePicker from '../components/PublicPlacePicker';
import { Box, Typography, Alert, Dialog, DialogContent, IconButton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import VideoVerificationGate from '../components/VideoVerificationGate';
import PhoneVerificationGate from '../components/PhoneVerificationGate';
import EmailVerificationGate from '../components/EmailVerificationGate';
import api from '../services/api';
import { scanMedia } from '../utils/scanMedia';
import { useAuth } from '../context/AuthContext';
import { containsProfanity, PROFANITY_ERROR } from '../utils/contentFilter';

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

const STEPS = [
  { num: 1, label: 'Type & Skill',      icon: 'fa-star' },
  { num: 2, label: 'Exchange Location',  icon: 'fa-map-marker-alt' },
  { num: 3, label: 'Value & Schedule',  icon: 'fa-coins' },
  { num: 4, label: 'Review & Post',     icon: 'fa-clipboard-check' },
];

const EXCHANGE_TYPES = [
  { key: 'skill',   icon: 'fa-handshake', label: 'Skill-for-Skill', desc: 'Exchange one skill for another skill' },
  { key: 'service', icon: 'fa-link',      label: 'Hybrid',          desc: 'Mix of skills, tools, and CEUs' },
];

/** SRS §5.1 — must match server ceuCalculator.ts */
const PROFICIENCY_LEVELS = [
  { key: 'Beginner',     mult: 0.8,  label: 'Beginner'     },
  { key: 'Intermediate', mult: 1.0,  label: 'Intermediate' },
  { key: 'Expert',       mult: 1.5,  label: 'Expert'       },
];


const SESSION_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

interface CustomSession {
  id: string;
  date: string;
  timeStart: string;
  timeEnd: string;
}

/** Return session length in hours (minimum 0.5) from HH:MM strings */
const parseHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0.5, diff > 0 ? diff / 60 : 1);
};

/** Format "HH:MM" → "h:MM AM/PM" */
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const FALLBACK_TAGS = [
  'photography', 'cooking', 'gardening', 'coding', 'music', 'yoga',
  'carpentry', 'design', 'writing', 'tutoring', 'languages', 'fitness',
  'cycling', 'sewing', 'drawing', 'baking', 'painting', 'woodworking',
  'repairs', 'tech support', 'pet care', 'childcare', 'eldercare',
];

interface WantedSkill {
  name: string;
  description: string;
  proficiency: string;
  media: File[]; // images + videos
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Skill / Service CEU per session — SRS §5.1
 * CEU = Hours × SkillMultiplier × ProficiencyLevel
 * SkillMultiplier = Base(1.0) + rarityBonus + demandBonus
 */
const calcSkillCEU = (
  hours: number,
  sessions: number,
  profKey: string,
  rarityBonus = 0,
  demandBonus = 0,
): number => {
  const profLevel   = PROFICIENCY_LEVELS.find(p => p.key === profKey)?.mult ?? 1.0;
  const skillMult   = 1.0 + rarityBonus + demandBonus;
  const perSession  = Math.max(1, Math.round(hours * skillMult * profLevel));
  return perSession * Math.max(1, sessions);
};

/**
 * Tool Borrowing CEU — SRS §5.1
 * CEU = (MarketValue × 0.001 × Days) + RiskFactor
 */
const calcToolBorrowCEU = (marketValue: number, days: number, riskFactor = 0): number =>
  Math.max(1, Math.round(marketValue * 0.001 * days + riskFactor));

/**
 * Tool Gifting CEU — SRS §5.1
 * CEU = MarketValue × 1.2  (generosity bonus)
 */
const calcToolGiftCEU = (marketValue: number): number =>
  Math.max(1, Math.round(marketValue * 1.2));

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.5rem' }}>
    <i className={`fas ${icon}`} style={{ color: '#4F46E5', fontSize: '1.125rem' }} />
    <Typography sx={{ fontWeight: 600, fontSize: '1.25rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
      {children}
    </Typography>
  </Box>
);

const FormLabel: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
  <Box component="label" sx={{
    display: 'block', fontSize: '0.875rem', fontWeight: 500,
    color: '#1F2937', mb: '0.5rem', fontFamily: 'Inter,sans-serif',
    '&::after': required ? { content: '" *"', color: '#EF4444' } : {},
  }}>
    {children}
  </Box>
);

const FormHint: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.75rem', color: '#6B7280', mt: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
    <i className={`fas ${icon}`} style={{ fontSize: '0.65rem' }} />
    {children}
  </Box>
);

const FormSelect: React.FC<{
  value: string | number;
  onChange: (v: string) => void;
  children: React.ReactNode;
  fullWidth?: boolean;
}> = ({ value, onChange, children, fullWidth }) => (
  <Box
    component="select"
    value={value}
    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    sx={{
      width: fullWidth ? '100%' : 'auto',
      padding: '0.875rem 2.5rem 0.875rem 1rem',
      border: '1px solid #E5E7EB',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      color: '#1F2937',
      background: '#FFF url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236B7280\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E") no-repeat right 0.75rem center / 1.25rem',
      appearance: 'none',
      outline: 'none',
      fontFamily: 'Inter,sans-serif',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
      '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
    }}
  >
    {children}
  </Box>
);

const FormInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
}> = ({ value, onChange, placeholder, type = 'text', readOnly }) => (
  <Box
    component="input"
    type={type}
    value={value}
    readOnly={readOnly}
    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    placeholder={placeholder}
    sx={{
      width: '100%', padding: '0.875rem 1rem',
      border: '1px solid #E5E7EB', borderRadius: '0.5rem',
      fontSize: '0.875rem', color: '#1F2937', background: readOnly ? '#F9FAFB' : '#FFF',
      outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif',
      transition: 'border-color 0.2s',
      '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
      '&::placeholder': { color: '#9CA3AF' },
    }}
  />
);

const SkillContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{
    background: '#F9FAFB', borderRadius: '0.75rem',
    padding: '1.5rem', border: '1px solid #E5E7EB', mb: '1.5rem',
  }}>
    {children}
  </Box>
);

// ─── Main Component ───────────────────────────────────────────────────────────
interface TargetPost {
  _id: string;
  title: string;
  tags: string[];
  locationName?: string;
  isOnline?: boolean;
  onlineLink?: string;
  sessions?: number;
  timeStart?: string;
  timeEnd?: string;
  recurring?: string;
  startDate?: string;
  ceuRate?: number;
}

interface CreateExchangeProps {
  /** When true, renders inside a Dialog instead of a full page */
  modal?: boolean;
  open?: boolean;
  onClose?: () => void;
  /** The post being requested — pre-fills the wanted skill */
  targetPost?: TargetPost;
  /** Override the modal dialog title (defaults to "Request Skill Swap") */
  modalTitle?: string;
  /** Wanted skills from the source Start Exchange — user selects which one they're offering for */
  sourceWantedSkills?: { name: string; description: string; proficiency: string }[];
  /** ID of the Start Exchange being responded to — links the new exchange back */
  sourceExchangeId?: string;
  /**
   * When provided, pre-selects the wanted skill the user chose in ExchangeDetail
   * and hides the in-modal skill picker (it was already shown before opening the modal).
   */
  preSelectedSeekingSkill?: string;
  /**
   * Plain-text seeking value from the source Start Exchange.
   * Used as a fallback when sourceWantedSkills is empty — shows what the exchange creator is looking for.
   */
  sourceSeeking?: string;
  /**
   * The provider's offering title (e.g. "Photography Lessons").
   * Used as the responder's `seeking` field so the stored exchange correctly
   * reflects what the responder will receive from the provider.
   */
  sourceProviderOffering?: string;
  /** Per-skill image URL arrays — index matches sourceWantedSkills index */
  sourceWantedSkillImages?: string[][];
}

const CreateExchange: React.FC<CreateExchangeProps> = ({ modal, open, onClose, targetPost, modalTitle, sourceWantedSkills, sourceExchangeId, preSelectedSeekingSkill, sourceSeeking, sourceProviderOffering, sourceWantedSkillImages }) => {
  // CEU-payment mode: user pays CEU instead of offering a skill
  const isCeuMode = modalTitle === 'Exchange with CEU';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, updateUser, isVideoVerified, isPhoneVerified, isEmailVerified } = useAuth();

  const [step, setStep]       = useState(0); // 0-based
  const [error, setError]     = useState('');

  // When responding to a Start Exchange, track which wanted skill the user is offering for.
  // Priority: preSelectedSeekingSkill > single wantedSkill > sourceSeeking (plain-text fallback)
  const [selectedSeekingSkill, setSelectedSeekingSkill] = useState<string>(() =>
    preSelectedSeekingSkill
      ? preSelectedSeekingSkill
      : sourceWantedSkills && sourceWantedSkills.length === 1
        ? sourceWantedSkills[0].name
        : (sourceSeeking ?? '')
  );

  // Step 1 state
  const [exType,      setExType]      = useState<'skill'|'tool'|'service'>('skill');
  const [offerTitle,     setOfferTitle]     = useState<string>(() => {
    // When responding to a Start Exchange, pre-fill from the provider's wanted skill
    if (!sourceExchangeId) return '';
    if (preSelectedSeekingSkill) return preSelectedSeekingSkill;
    if (sourceWantedSkills && sourceWantedSkills.length === 1) return sourceWantedSkills[0].name;
    if (sourceWantedSkills && sourceWantedSkills.length > 1) return ''; // user must choose
    return sourceSeeking ?? '';
  });
  const [offerDesc, setOfferDesc] = useState<string>(() => {
    if (!sourceExchangeId || !sourceWantedSkills?.length) return '';
    const sk = preSelectedSeekingSkill
      ? sourceWantedSkills.find(s => s.name === preSelectedSeekingSkill)
      : sourceWantedSkills.length === 1 ? sourceWantedSkills[0] : null;
    return sk?.description || '';
  });
  const [offerMedia,     setOfferMedia]     = useState<File[]>([]);
  // URL previews of the provider's wanted-skill images (shown as reference; not re-uploaded)
  const [prefilledOfferImageUrls, setPrefilledOfferImageUrls] = useState<string[]>(() => {
    if (!sourceExchangeId || !sourceWantedSkillImages?.length) return [];
    const idx = preSelectedSeekingSkill && sourceWantedSkills
      ? sourceWantedSkills.findIndex(s => s.name === preSelectedSeekingSkill)
      : sourceWantedSkills?.length === 1 ? 0 : -1;
    return idx >= 0 ? (sourceWantedSkillImages[idx] ?? []) : [];
  });
  const [offeringPostId] = useState('');

  const [imageScanning, setImageScanning] = useState(false);
  const [imageScanError, setImageScanError] = useState('');
  const [proficiency, setProficiency] = useState<string>(() => {
    if (!sourceExchangeId || !sourceWantedSkills?.length) return 'Intermediate';
    const sk = preSelectedSeekingSkill
      ? sourceWantedSkills.find(s => s.name === preSelectedSeekingSkill)
      : sourceWantedSkills?.length === 1 ? sourceWantedSkills[0] : null;
    return sk?.proficiency || 'Intermediate';
  });
  // Profile-skill picker (modal skill-swap response only)
  // '' = custom/manual entry; set to skill name when user picks a profile skill
  const [selectedProfileSkill, setSelectedProfileSkill] = useState<string>('');
  const [wantedSkills, setWantedSkills] = useState<WantedSkill[]>([
    { name: '', description: '', proficiency: 'Intermediate', media: [] },
  ]);
  const [wantedScanningIdx, setWantedScanningIdx] = useState<number | null>(null);
  const [wantedScanError, setWantedScanError]     = useState('');
  const [terms, setTerms] = useState('');
  const [tagInput, setTagInput]         = useState('');
  const [tags, setTags]                 = useState<string[]>([]);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagHighlight, setTagHighlight]       = useState(-1);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  // Live tags from all posts + exchanges, merged with fallback list
  const { data: liveTags } = useQuery<{ label: string; count: number }[]>({
    queryKey: ['all-tags'],
    queryFn: () => api.get('/posts/tags').then(r => r.data),
    staleTime: 60_000,
  });
  const SUGGESTED_TAGS = React.useMemo(() => {
    const apiLabels = (liveTags ?? []).map(t => t.label);
    return [...new Set([...apiLabels, ...FALLBACK_TAGS])];
  }, [liveTags]);

  // Step 2 state
  const [locType,      setLocType]      = useState<'public'|'private'>('public');
  const [publicPlace,  setPublicPlace]  = useState('');
  const [privatePlace, setPrivatePlace] = useState('');
  const [onlineVideo,  setOnlineVideo]  = useState(false);
  const [onlineOnly,   setOnlineOnly]   = useState(false);
  const [secureOption, setSecureOption] = useState<'link'|'meetingPoint'|'coordinates'>('link');


  // Video link state
  const [videoLink,         setVideoLink]         = useState('');
  const [videoToken,        setVideoToken]        = useState('');
  const [videoCopied,       setVideoCopied]       = useState(false);
  const [videoGenerating,   setVideoGenerating]   = useState(false);
  const [videoRoomId,       setVideoRoomId]       = useState('');

  // Step 3 state — Schedule
  const [sessions,  setSessions]  = useState(2);
  const [startDate, setStartDate] = useState('');
  const [timeStart, setTimeStart] = useState('09:00');
  const [timeEnd,   setTimeEnd]   = useState('11:00');
  const [recurring, setRecurring] = useState('once');
  const [customSessions, setCustomSessions] = useState<CustomSession[]>([
    { id: '1', date: '', timeStart: '09:00', timeEnd: '11:00' },
  ]);

  // Step 3 state — CEU modifiers (skill/service)
  const [extraCeu, setExtraCeu] = useState(0);

  // Step 3 state — Tool CEU inputs (kept for Hybrid type)
  const [toolMarketValue, setToolMarketValue] = useState('');
  const [toolBorrowDays,  setToolBorrowDays]  = useState('1');
  const [toolRiskFactor,  setToolRiskFactor]  = useState('0');
  const [toolIsGift,      setToolIsGift]      = useState(false);

  // Step 1 state — Tool-for-Tool: tool the user wants in exchange
  const [wantedToolName,  setWantedToolName]  = useState('');
  const [wantedToolDesc,  setWantedToolDesc]  = useState('');
  const [wantedToolDays,  setWantedToolDays]  = useState('');
  const [wantedToolMode,      setWantedToolMode]      = useState<'borrow' | 'permanent'>('borrow');
  const [wantedToolCondition, setWantedToolCondition] = useState<'new' | 'like-new' | 'good' | 'fair' | 'any'>('any');
  const [wantedToolMedia, setWantedToolMedia] = useState<File[]>([]);
  const [toolMediaScanning, setToolMediaScanning] = useState(false);
  const [toolMediaScanError, setToolMediaScanError] = useState('');

  // Tool-for-Tool: condition of the offered tool + exchange mode
  const [offerToolCondition, setOfferToolCondition] = useState<'new' | 'like-new' | 'good' | 'fair'>('good');
  // 'lend' = temporary borrow, 'gift' = free gift, 'permanent' = full ownership swap
  const [toolExchangeMode, setToolExchangeMode] = useState<'lend' | 'gift' | 'permanent'>('lend');

  // Step 4 state
  const [visPublic,    setVisPublic]    = useState(true);
  const [visChat,      setVisChat]      = useState(true);
  const [visEmailNotif,setVisEmailNotif]= useState(false);


  // Auto-set today's date
  useEffect(() => {
    const d = new Date();
    const todayStr = d.toISOString().split('T')[0];
    setStartDate(todayStr);
    setCustomSessions([{ id: '1', date: todayStr, timeStart: '09:00', timeEnd: '11:00' }]);
  }, []);

  // When recurring changes, sync sessions count
  useEffect(() => {
    if (recurring === 'once') setSessions(1);
  }, [recurring]);

  // Custom session helpers
  const addCustomSession = () => {
    const d = new Date();
    setCustomSessions(prev => [...prev, {
      id: String(Date.now()),
      date: d.toISOString().split('T')[0],
      timeStart: '09:00',
      timeEnd: '11:00',
    }]);
  };
  const removeCustomSession = (id: string) => {
    setCustomSessions(prev => prev.filter(s => s.id !== id));
  };
  const updateCustomSession = (id: string, field: keyof CustomSession, value: string) => {
    setCustomSessions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // Computed hours from time pickers (for CEU calc)
  // ── CEU computation (mirrors server ceuCalculator.ts) ──────────────────────
  const sessionHours      = parseHours(timeStart, timeEnd);
  const effectiveSessions = recurring === 'custom' ? customSessions.length : sessions;

  const mv  = parseFloat(toolMarketValue) || 0;
  const bd  = parseInt(toolBorrowDays)    || 1;
  const rf  = parseFloat(toolRiskFactor)  || 0;

  const baseCeuValue: number =
    exType === 'tool'
      ? toolExchangeMode === 'lend'
        ? calcToolBorrowCEU(mv, bd, rf)
        : calcToolGiftCEU(mv)          // gift and permanent both use the generosity formula
      : exType === 'service'
        ? toolIsGift ? calcToolGiftCEU(mv) : calcToolBorrowCEU(mv, bd, rf)
        : calcSkillCEU(sessionHours, effectiveSessions, proficiency);

  // User may offer more than the calculated base — ceuValue is what gets submitted
  const ceuValue: number = baseCeuValue + extraCeu;

  // ── Pre-fill from target post when modal opens ──────────────────────────────
  useEffect(() => {
    if (!targetPost || !open) return;
    // Pre-fill the wanted skill from the post title
    const PROFICIENCY_TAGS = ['beginner', 'intermediate', 'expert'];
    const postProficiency = targetPost.tags.find(t => PROFICIENCY_TAGS.includes(t.toLowerCase()));
    setWantedSkills([{
      name: targetPost.title,
      description: '',
      proficiency: postProficiency
        ? postProficiency.charAt(0).toUpperCase() + postProficiency.slice(1).toLowerCase()
        : 'Intermediate',
      media: [],
    }]);
    // Pre-fill location from the post author's settings
    const locName = targetPost.locationName;
    if (targetPost.onlineLink) {
      // Author created a private meeting room — pre-fill and enable online mode
      setVideoLink(targetPost.onlineLink);
      setOnlineOnly(true);
      setOnlineVideo(true);
    } else if (targetPost.isOnline || locName === 'Online') {
      // Author enabled online mode but no room created yet — just enable toggle
      setOnlineOnly(true);
      setOnlineVideo(true);
    } else if (locName && locName !== '[Private Location — Secure Sharing Enabled]') {
      // Author chose a named public place — pre-fill it
      setLocType('public');
      setPublicPlace(locName);
    } else if (locName === '[Private Location — Secure Sharing Enabled]') {
      // Author chose private location — select private
      setLocType('private');
    }
    // If no location info at all — leave fields empty for the requester to fill

    // Pre-fill schedule from the post author's settings
    if (targetPost.recurring) setRecurring(targetPost.recurring);
    if (targetPost.sessions && targetPost.sessions > 0) setSessions(targetPost.sessions);
    if (targetPost.timeStart) setTimeStart(targetPost.timeStart);
    if (targetPost.timeEnd)   setTimeEnd(targetPost.timeEnd);
    if (targetPost.startDate) setStartDate(targetPost.startDate);

    // ── Auto-calculate CEU for "Exchange with CEU" mode ──────────────────────
    if (isCeuMode) {
      const postHours = targetPost.timeStart && targetPost.timeEnd
        ? parseHours(targetPost.timeStart, targetPost.timeEnd) : 1;
      const postSessions = targetPost.sessions && targetPost.sessions > 0 ? targetPost.sessions : 1;
      // Derive proficiency from the post's tags (e.g. "expert", "beginner")
      const PROF_TAGS = ['beginner', 'intermediate', 'expert'];
      const profTag = targetPost.tags.find(t => PROF_TAGS.includes(t.toLowerCase()));
      const postProf = profTag
        ? profTag.charAt(0).toUpperCase() + profTag.slice(1).toLowerCase()
        : 'Intermediate';
      // Use post's explicit ceuRate if set, otherwise run the formula
      const autoCeu = targetPost.ceuRate && targetPost.ceuRate > 0
        ? targetPost.ceuRate
        : calcSkillCEU(postHours, postSessions, postProf);
      setExtraCeu(autoCeu);
    }
  }, [targetPost, open, isCeuMode]);

  // ── Re-calculate CEU whenever schedule changes (CEU mode only) ──────────────
  useEffect(() => {
    if (!isCeuMode) return;
    const PROF_TAGS = ['beginner', 'intermediate', 'expert'];
    const profTag   = targetPost?.tags.find(t => PROF_TAGS.includes(t.toLowerCase()));
    const postProf  = profTag
      ? profTag.charAt(0).toUpperCase() + profTag.slice(1).toLowerCase()
      : 'Intermediate';
    if (targetPost?.ceuRate && targetPost.ceuRate > 0) {
      setExtraCeu(targetPost.ceuRate);
      return;
    }
    const calcCeu = calcSkillCEU(sessionHours, effectiveSessions, postProf);
    setExtraCeu(Math.max(1, calcCeu));
  }, [isCeuMode, sessionHours, effectiveSessions, targetPost]);

  // ── Validation per step ────────────────────────────────────────────────────
  const validateStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (isCeuMode) {
        // CEU amount is validated at Step 2 (after schedule is set)
      } else {
        if (!offerTitle.trim()) { setError('Please enter a name for the skill you\'re offering.'); return false; }
        if (!offerDesc.trim())  { setError('Please describe what you\'re offering.'); return false; }
        if (exType === 'tool') {
          if (!offerTitle.trim()) { setError('Please enter the name of the tool you\'re offering.'); return false; }
          if (!wantedToolName.trim()) { setError('Please enter the name of the tool you want in exchange.'); return false; }
          const allText = [offerTitle, offerDesc, wantedToolName, wantedToolDesc];
          if (containsProfanity(...allText)) { setError(PROFANITY_ERROR); return false; }
        } else {
          if (!targetPost && !modal && !wantedSkills[0]?.name.trim()) { setError('Please enter at least one skill you\'re looking for.'); return false; }
          if (modal && sourceWantedSkills && sourceWantedSkills.length > 1 && !selectedSeekingSkill) { setError('Please select which skill you are offering for.'); return false; }
          const allText = [offerTitle, offerDesc, ...wantedSkills.map(s => s.name), ...wantedSkills.map(s => s.description)];
          if (containsProfanity(...allText)) { setError(PROFANITY_ERROR); return false; }
        }
      }
    }
    if (step === 1) {
      if (onlineVideo || onlineOnly) {
        if (!videoLink) {
          setError('Please create your private meeting room before continuing — click the "Create private meeting room" button above.');
          return false;
        }
      } else {
        if (locType === 'public' && !publicPlace) { setError('Please select a public meeting place.'); return false; }
        if (locType === 'private' && !privatePlace) { setError('Please select a location on the map.'); return false; }
      }
    }
    if (step === 2) {
      if (isCeuMode) {
        if (extraCeu < 1) { setError('CEU value must be at least 1.'); return false; }
        if (extraCeu > (user?.ceuBalance ?? 0)) {
          setError(`Not enough CEU. This exchange requires ${extraCeu} CEU but your balance is ${user?.ceuBalance ?? 0}.`);
          return false;
        }
      }
      if (exType !== 'skill' && !isCeuMode && ceuValue > (user?.ceuBalance ?? 0)) {
        setError(`Not enough CEU. This exchange requires ${ceuValue} CEU but your balance is ${user?.ceuBalance ?? 0}.`);
        return false;
      }
    }
    return true;
  };

  const isAnyScanning = imageScanning || toolMediaScanning || wantedScanningIdx !== null;

  const goNext = () => {
    if (isAnyScanning) { setError('Please wait — media scan in progress.'); return; }
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, 3));
  };
  const goPrev = () => { setError(''); setStep(s => Math.max(s - 1, 0)); };

  // ── Submission ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: () => {
      // When responding to a Start Exchange, the responder seeks the provider's offering
      const seeking = exType === 'tool'
        ? wantedToolName.trim()
        : (sourceExchangeId && sourceProviderOffering)
          ? sourceProviderOffering
          : wantedSkills.filter(s => s.name.trim()).map(s => s.name).join(', ') || selectedSeekingSkill || '';
      const locationNote = (onlineVideo || onlineOnly)
        ? (videoLink ? `Online: ${videoLink}` : 'Online / Remote')
        : locType === 'public'
          ? publicPlace || 'Public location TBD'
          : privatePlace
            ? `[Private] ${privatePlace}`
            : '[Private Location — Secure Sharing Enabled]';
      const resolvedOfferTitle = isCeuMode ? 'CEU Payment' : offerTitle.trim();
      const payload: Record<string, unknown> = {
        ...(targetPost           ? { postId: targetPost._id }                  : {}),
        ...(offeringPostId       ? { offeringPostId }                         : {}),
        ...(sourceExchangeId     ? { sourceExchangeId }                       : {}),
        ...(selectedProfileSkill ? { offeringSkillName: selectedProfileSkill } : {}),
        // Which of the provider's wanted skills the responder is offering for —
        // server uses this to copy the right seekingImage slice into exchange.images
        ...(sourceExchangeId && selectedSeekingSkill ? { offeringForSkill: selectedSeekingSkill } : {}),
        type: exType,
        title: isCeuMode
          ? `${extraCeu} CEU ↔ ${targetPost?.title ?? seeking}`
          : `${resolvedOfferTitle} ↔ ${seeking}`,
        description: terms.trim() || (isCeuMode
          ? `Offering ${extraCeu} CEU for: ${targetPost?.title ?? seeking}`
          : `Exchange: ${offerTitle} for ${seeking}`),
        offering: isCeuMode
          ? `${extraCeu} CEU`
          : exType === 'tool'
            ? `${offerTitle} (Condition: ${offerToolCondition}) — ${offerDesc}`
            : `${offerTitle} (${proficiency}) — ${offerDesc.slice(0, 300)}`,
        // Store full rich description separately so it's not length-limited
        ...(!isCeuMode && exType !== 'tool' && offerDesc.trim()
          ? { offeringDescription: offerDesc }
          : {}),
        seeking: exType === 'tool'
          ? wantedToolMode === 'permanent'
            ? `Permanent exchange: ${wantedToolName}${wantedToolCondition !== 'any' ? ` (min condition: ${wantedToolCondition})` : ''}${wantedToolDesc ? ` — ${wantedToolDesc}` : ''}`
            : `Borrow: ${wantedToolName}${wantedToolCondition !== 'any' ? ` (min condition: ${wantedToolCondition})` : ''}${wantedToolDays ? ` for ${wantedToolDays} days` : ''}${wantedToolDesc ? ` — ${wantedToolDesc}` : ''}`
          : seeking,
        ceuValue: isCeuMode ? extraCeu : ceuValue,
        // CEU formula inputs — server re-computes the authoritative value
        hours:       (!isCeuMode && exType !== 'tool') ? sessionHours  : undefined,
        proficiency: (!isCeuMode && exType !== 'tool') ? proficiency.toLowerCase() : undefined,
        // Tool-specific structured fields (condition/value saved separately for display)
        toolCondition:      exType === 'tool' ? offerToolCondition : undefined,
        toolMarketValue:    exType === 'tool' && toolMarketValue   ? toolMarketValue : undefined,
        seekingCondition:   exType === 'tool' && wantedToolCondition !== 'any' ? wantedToolCondition : undefined,
        seekingDescription: exType === 'tool' && wantedToolDesc    ? wantedToolDesc  : undefined,
        wantedSkills: exType !== 'tool' ? JSON.stringify(wantedSkills.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), description: s.description.trim(), proficiency: s.proficiency, imageCount: s.media.length }))) : undefined,
        // Tool-specific (tool-for-tool and Hybrid)
        marketValue: (exType === 'tool' || exType === 'service') ? mv  : undefined,
        days:        (exType === 'tool' && toolExchangeMode === 'lend') || exType === 'service' ? bd : undefined,
        riskFactor:  (exType === 'tool' && toolExchangeMode === 'lend') || exType === 'service' ? rf : undefined,
        isGift:      exType === 'tool'
          ? toolExchangeMode !== 'lend'   // gift or permanent → use gift formula
          : exType === 'service' ? toolIsGift : undefined,
        tags: [
          ...tags,
          (onlineVideo || onlineOnly) ? 'online' : locType,
          proficiency.toLowerCase(),
          exType,
        ].filter(Boolean),
        scheduledDate: startDate || undefined,
        startDate:  startDate || undefined,
        timeStart:  timeStart || undefined,
        timeEnd:    timeEnd || undefined,
        recurring:  recurring || undefined,
        sessions:   effectiveSessions || undefined,
        locationName: locationNote,
        ...(( onlineVideo || onlineOnly) && videoLink ? { onlineLink: videoLink } : {}),
      };
      const offeringMedia = offerMedia;
      const seekingMedia = exType === 'tool'
        ? wantedToolMedia
        : wantedSkills.flatMap(ws => ws.media);
      if (offeringMedia.length > 0 || seekingMedia.length > 0) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined) fd.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
        });
        offeringMedia.forEach(file => fd.append('images', file));
        seekingMedia.forEach(file => fd.append('seekingMedia', file));
        return api.post('/exchanges', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return api.post('/exchanges', payload);
    },
    onSuccess: (res) => {
      if (res.data.newCeuBalance !== undefined) updateUser({ ceuBalance: res.data.newCeuBalance });
      queryClient.invalidateQueries({ queryKey: ['myExchanges'] });
      queryClient.invalidateQueries({ queryKey: ['feedExchanges'] });
      if (targetPost) queryClient.invalidateQueries({ queryKey: ['post-exchanges', targetPost._id] });
      if (modal && onClose) {
        onClose();
        navigate(`/exchanges/${res.data._id}`);
      } else {
        navigate(`/exchanges/${res.data._id}`);
      }
    },
    onError: (err: unknown) => {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to post — check your connection.');
    },
  });

  const handlePost = () => {
    if (!validateStep()) return;
    mutation.mutate();
  };

  // All exchange types require video verification
  const needsVerification = !isVideoVerified;

  // ─────────────────────────────────────────────────────────────────────────────
  const pageContent = (
    <Box sx={modal ? { p: { xs: '1rem', sm: '1.5rem 2rem' } } : undefined}>

      {/* ── Page Header — full page only ── */}
      {!modal && (
        <Box sx={{ mb: '2rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '0.5rem' }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '0.75rem', background: GRAD,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#FFF', fontSize: '1.25rem', flexShrink: 0,
            }}>
              <i className="fas fa-exchange-alt" />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '2rem', color: '#1F2937', lineHeight: 1.2 }}>
                Create New Exchange
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '1rem', mt: '0.25rem', maxWidth: 600 }}>
                Create a transparent exchange proposal. All negotiations will be public for community safety and learning.
              </Typography>
            </Box>
          </Box>
        </Box>
      )}


      {/* ── Email Verification Gate — required for all exchanges ── */}
      {!isEmailVerified && (
        <Box sx={{ mb: '1.5rem' }}>
          <EmailVerificationGate
            feature="Creating Exchanges"
            description="A verified email address is required before you can create an exchange. Check your inbox for a verification link."
          />
        </Box>
      )}

      {/* ── Phone Verification Gate — required for all exchanges, shown after email verified ── */}
      {isEmailVerified && !isPhoneVerified && (
        <Box sx={{ mb: '1.5rem' }}>
          <PhoneVerificationGate
            feature="Creating Exchanges"
            description="A verified mobile number is required before you can create an exchange. It keeps the community safe and takes less than a minute."
          />
        </Box>
      )}

      {/* ── Video Verification Gate — all exchange types require verification (shown after both verified) ── */}
      {isEmailVerified && isPhoneVerified && needsVerification && (
        <Box sx={{ mb: '1.5rem' }}>
          <VideoVerificationGate
            feature={
              exType === 'skill' ? 'Skill Exchange' :
              exType === 'tool'  ? 'Tool Exchange'  :
                                   'Hybrid Exchange'
            }
            description="Creating any exchange requires Video Verification. Recording a short video introduction proves you're a real person and keeps every member of this community safe."
          />
        </Box>
      )}

      {/* ── Wizard (only when both phone and video verified) ── */}
      {isPhoneVerified && !needsVerification && <>

      {/* ── Main Form Card ── */}
      <Box sx={{
        background: '#FFF', border: '1px solid #E5E7EB',
        borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        overflow: 'hidden',
      }}>

        {/* ── Step Indicator ── */}
        <Box sx={{
          display: 'flex', background: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: 2 },
        }}>
          {STEPS.map((s, idx) => {
            const isActive    = idx === step;
            const isCompleted = idx < step;
            return (
              <Box key={s.num} sx={{
                flex: '1 0 auto',
                padding: { xs: '1rem', sm: '1.5rem' },
                textAlign: 'center',
                cursor: isCompleted ? 'pointer' : 'default',
                background: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#4F46E5' : isCompleted ? '#10B981' : '#6B7280',
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.2s',
                position: 'relative',
                minWidth: 100,
                '&::after': isActive ? {
                  content: '""', position: 'absolute', bottom: 0, left: 0, right: 0,
                  height: 3, background: GRAD,
                } : {},
                '&:hover': isCompleted ? { background: '#F3F4F6' } : {},
              }}
              onClick={() => isCompleted && setStep(idx)}
              >
                {/* Circle */}
                <Box sx={{
                  width: 32, height: 32, borderRadius: '50%', mx: 'auto', mb: '0.5rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isActive ? GRAD : isCompleted ? '#10B981' : '#E5E7EB',
                  color: isActive || isCompleted ? '#FFF' : '#6B7280',
                  fontWeight: 700, fontSize: '0.875rem',
                }}>
                  {isCompleted ? <i className="fas fa-check" style={{ fontSize: '0.75rem' }} /> : s.num}
                </Box>
                <Box sx={{ fontSize: '0.8125rem', fontWeight: 'inherit', whiteSpace: 'nowrap' }}>
                  {s.num === 1 && exType === 'tool' ? 'Type & Tool' : s.label}
                </Box>
              </Box>
            );
          })}
        </Box>

        {/* ── Step Content ── */}
        <Box sx={{ padding: { xs: '1.5rem', sm: '2rem' } }}>

          {error && (
            <Alert severity="error" sx={{ mb: '1.5rem', borderRadius: '0.5rem' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* ══════════════ STEP 1: TYPE & SKILL ══════════════ */}
          {step === 0 && (
            <Box>
              {/* ── Source Exchange Skill Selector (responding to a Start Exchange) ── */}
              {/* ── Skill picker: shows when responding to a Start Exchange ────────── */}
              {modal && sourceExchangeId && ((sourceWantedSkills && sourceWantedSkills.length > 0) || !!sourceSeeking) && (
                <Box sx={{ mb: '1.5rem', p: '1.25rem', background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.75rem' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', mb: '0.75rem' }}>
                    <i className="fas fa-hand-pointer" style={{ color: '#4F46E5', marginRight: '0.5rem' }} />
                    {sourceWantedSkills && sourceWantedSkills.length > 1
                      ? 'Which skill are you offering for?'
                      : 'You are responding to this request:'}
                  </Typography>

                  {/* Case A: multiple structured wanted skills — radio buttons */}
                  {sourceWantedSkills && sourceWantedSkills.length > 1 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {sourceWantedSkills.map(sk => (
                        <Box
                          key={sk.name}
                          onClick={() => {
                            const skIdx = sourceWantedSkills!.indexOf(sk);
                            setSelectedSeekingSkill(sk.name);
                            setOfferTitle(sk.name);
                            setOfferDesc(sk.description || '');
                            setSelectedProfileSkill('');
                            if (sk.proficiency) setProficiency(sk.proficiency as 'Beginner' | 'Intermediate' | 'Expert');
                            setPrefilledOfferImageUrls(sourceWantedSkillImages?.[skIdx] ?? []);
                          }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: '0.625rem',
                            p: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'all 0.15s',
                            border: selectedSeekingSkill === sk.name ? '1.5px solid #4F46E5' : '1.5px solid #E5E7EB',
                            background: selectedSeekingSkill === sk.name ? 'rgba(79,70,229,0.06)' : '#fff',
                          }}
                        >
                          <Box sx={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${selectedSeekingSkill === sk.name ? '#4F46E5' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {selectedSeekingSkill === sk.name && <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5' }} />}
                          </Box>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{sk.name}</Typography>
                          {sk.proficiency && (
                            <Box sx={{ ml: 'auto', px: '0.5rem', py: '0.15rem', borderRadius: '0.375rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>{sk.proficiency}</Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    /* Case B: single structured skill OR plain-text seeking — read-only pill */
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', p: '0.625rem 1rem', background: '#fff', border: '1.5px solid #4F46E5', borderRadius: '0.5rem' }}>
                      <i className="fas fa-check-circle" style={{ color: '#4F46E5' }} />
                      <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                        {sourceWantedSkills && sourceWantedSkills.length === 1
                          ? sourceWantedSkills[0].name
                          : sourceSeeking}
                      </Typography>
                      {sourceWantedSkills && sourceWantedSkills.length === 1 && sourceWantedSkills[0].proficiency && (
                        <Box sx={{ ml: 'auto', px: '0.5rem', py: '0.15rem', borderRadius: '0.375rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                          {sourceWantedSkills[0].proficiency}
                        </Box>
                      )}
                    </Box>
                  )}
                </Box>
              )}

              {/* ── You will receive (provider's offering) ── */}
              {modal && sourceExchangeId && sourceProviderOffering && (
                <Box sx={{ mb: '1.25rem', p: '0.875rem 1rem', background: 'rgba(16,185,129,0.06)', border: '1.5px solid rgba(16,185,129,0.35)', borderRadius: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fas fa-arrow-down" style={{ color: '#fff', fontSize: '0.8rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Inter,sans-serif' }}>
                      You will receive
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                      {sourceProviderOffering}
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* ── CEU Mode: info card only — full calculation shown in Step 3 ── */}
              {isCeuMode && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', p: '1.25rem', mb: '1.5rem', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '0.75rem' }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: '0.625rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className="fas fa-coins" style={{ color: '#FFF', fontSize: '1rem' }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', mb: '0.25rem' }}>
                      Exchange with CEU
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#4B5563', fontFamily: 'Inter,sans-serif', lineHeight: 1.6 }}>
                      The CEU value will be <strong>automatically calculated</strong> from the session schedule you set in Step 3.
                      Set your hours and sessions there — the formula updates live.
                    </Typography>
                  </Box>
                </Box>
              )}
              {!isCeuMode ? (
              <>
              {/* ── Your Offering ── */}
              <SectionTitle icon={exType === 'tool' ? 'fa-tools' : 'fa-chalkboard-teacher'}>
                {exType === 'tool' ? 'Your Tool Offering' : 'Your Skill Offering'}
              </SectionTitle>
              <SkillContainer>
                {exType === 'tool' ? (
                  /* Tool-for-Tool: name + condition */
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', mb: '1rem' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <FormLabel required>Tool Name</FormLabel>
                      <FormInput value={offerTitle} onChange={setOfferTitle} placeholder="e.g. Power Drill, DSLR Camera, Circular Saw" />
                      <FormHint icon="fa-info-circle">Brand/model helps people find the right match</FormHint>
                    </Box>
                    <Box>
                      <FormLabel>Condition</FormLabel>
                      <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {([
                          { key: 'new',      label: 'New'       },
                          { key: 'like-new', label: 'Like New'  },
                          { key: 'good',     label: 'Good'      },
                          { key: 'fair',     label: 'Fair'      },
                        ] as { key: typeof offerToolCondition; label: string }[]).map(c => (
                          <Box key={c.key} component="button" type="button"
                            onClick={() => setOfferToolCondition(c.key)}
                            sx={{
                              padding: '0.5rem 1rem', border: '1px solid',
                              borderColor: offerToolCondition === c.key ? 'transparent' : '#E5E7EB',
                              borderRadius: '0.375rem', cursor: 'pointer',
                              background: offerToolCondition === c.key ? GRAD : '#FFF',
                              color: offerToolCondition === c.key ? '#FFF' : '#6B7280',
                              fontSize: '0.75rem', fontFamily: 'Inter,sans-serif',
                              fontWeight: offerToolCondition === c.key ? 600 : 400,
                              transition: 'all 0.2s',
                            }}>
                            {c.label}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                ) : (
                  /* Skill / Hybrid: name + proficiency */
                  <>
                  {/* ── Profile skill picker (only shown when responding to a Start Exchange) ── */}
                  {modal && sourceExchangeId && (
                    <Box sx={{ mb: '1.25rem', pb: '1.25rem', borderBottom: '1px solid #E5E7EB' }}>
                      <FormLabel>Which of your skills are you offering?</FormLabel>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', mt: '0.5rem' }}>
                        {(user?.skills ?? []).map((sk) => {
                          const isSelected = selectedProfileSkill === sk.name;
                          return (
                            <Box
                              key={sk.name}
                              onClick={() => {
                                if (isSelected) {
                                  // toggle off → custom
                                  setSelectedProfileSkill('');
                                } else {
                                  setSelectedProfileSkill(sk.name);
                                  setOfferTitle(sk.name);
                                  if (sk.description) setOfferDesc(sk.description);
                                  if (sk.proficiency && PROFICIENCY_LEVELS.some(p => p.key === sk.proficiency)) {
                                    setProficiency(sk.proficiency);
                                  }
                                }
                              }}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                p: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                                border: isSelected ? '1.5px solid #10B981' : '1.5px solid #E5E7EB',
                                background: isSelected ? 'rgba(16,185,129,0.06)' : '#fff',
                                transition: 'all 0.15s',
                                '&:hover': { borderColor: isSelected ? '#10B981' : '#9CA3AF' },
                              }}
                            >
                              {/* Radio circle */}
                              <Box sx={{
                                width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                                border: `2px solid ${isSelected ? '#10B981' : '#D1D5DB'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>
                                {isSelected && <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />}
                              </Box>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', lineHeight: 1.3 }}>
                                  {sk.name}
                                </Typography>
                                {sk.description && (
                                  <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '0.1rem',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sk.description}
                                  </Typography>
                                )}
                              </Box>
                              {sk.proficiency && (
                                <Box sx={{
                                  px: '0.5rem', py: '0.15rem', borderRadius: '0.375rem', flexShrink: 0,
                                  background: isSelected ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.1)',
                                  color: isSelected ? '#059669' : '#6B7280',
                                  fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif',
                                }}>
                                  {sk.proficiency}
                                </Box>
                              )}
                            </Box>
                          );
                        })}
                        {/* Empty-profile hint */}
                        {(!user?.skills || user.skills.length === 0) && (
                          <Box sx={{ px: '1rem', py: '0.5rem', fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                            <i className="fas fa-info-circle" style={{ marginRight: '0.375rem', color: '#9CA3AF' }} />
                            No skills on your profile yet — type one below or{' '}
                            <Box component="a" href="/profile/edit" target="_blank" sx={{ color: '#4F46E5', textDecoration: 'underline', cursor: 'pointer' }}>add skills to your profile</Box>.
                          </Box>
                        )}
                        {/* Custom skill option */}
                        <Box
                          onClick={() => {
                            setSelectedProfileSkill('');
                            setOfferTitle('');
                          }}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            p: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                            border: selectedProfileSkill === '' ? '1.5px solid #4F46E5' : '1.5px solid #E5E7EB',
                            background: selectedProfileSkill === '' ? 'rgba(79,70,229,0.05)' : '#fff',
                            transition: 'all 0.15s',
                            '&:hover': { borderColor: selectedProfileSkill === '' ? '#4F46E5' : '#9CA3AF' },
                          }}
                        >
                          <Box sx={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: `2px solid ${selectedProfileSkill === '' ? '#4F46E5' : '#D1D5DB'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {selectedProfileSkill === '' && <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5' }} />}
                          </Box>
                          <Box>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                              ✏️ Custom / Other skill
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              Type a skill not listed above
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', mb: '1rem' }}>
                    <Box sx={{ flex: 1, minWidth: 200 }}>
                      <FormLabel required>Skill / Service Name</FormLabel>
                      <FormInput value={offerTitle} onChange={v => { setOfferTitle(v); if (selectedProfileSkill) setSelectedProfileSkill(''); }} placeholder="e.g. Photography Lessons" />
                    </Box>
                    <Box>
                      <FormLabel>Proficiency Level</FormLabel>
                      <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {PROFICIENCY_LEVELS.map(p => (
                          <Box key={p.key} component="button" type="button"
                            onClick={() => setProficiency(p.key)}
                            sx={{
                              padding: '0.5rem 1rem', border: '1px solid',
                              borderColor: proficiency === p.key ? 'transparent' : '#E5E7EB',
                              borderRadius: '0.375rem', cursor: 'pointer',
                              background: proficiency === p.key ? GRAD : '#FFF',
                              color: proficiency === p.key ? '#FFF' : '#6B7280',
                              fontSize: '0.75rem', fontFamily: 'Inter,sans-serif',
                              fontWeight: proficiency === p.key ? 600 : 400,
                              transition: 'all 0.2s',
                            }}>
                            {p.key}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  </Box>
                  </>
                )}

                {/* Image upload */}
                {/* ── Provider's reference images (pre-filled from wanted skill) ── */}
                {prefilledOfferImageUrls.length > 0 && (
                  <Box sx={{ mb: '1rem', p: '0.75rem', background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.625rem' }}>
                    <Box sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                      <i className="fas fa-images" />
                      Provider's reference photos
                    </Box>
                    <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {prefilledOfferImageUrls.map((url, i) => (
                        <Box key={i} component="img" src={url}
                          sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                      ))}
                    </Box>
                    <Box sx={{ fontSize: '0.7rem', color: '#6B7280', mt: '0.4rem' }}>
                      Upload your own photos below to showcase your version of this skill.
                    </Box>
                  </Box>
                )}

                <Box sx={{ mb: '1rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <Box
                      component="label"
                      htmlFor="exchange-image-upload"
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        px: '0.875rem', py: '0.45rem', borderRadius: '0.375rem',
                        border: '1px dashed #4F46E5', cursor: imageScanning ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem', fontWeight: 500, color: '#4F46E5',
                        background: 'rgba(79,70,229,0.04)',
                        opacity: imageScanning ? 0.6 : 1,
                        '&:hover': { background: imageScanning ? undefined : 'rgba(79,70,229,0.08)' },
                      }}
                    >
                      <i className={`fas ${imageScanning ? 'fa-spinner fa-spin' : 'fa-photo-video'}`} style={{ fontSize: '0.875rem' }} />
                      {imageScanning ? 'Scanning…' : 'Add photos or videos'}
                      <input
                        id="exchange-image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-matroska,video/webm"
                        multiple
                        hidden
                        disabled={imageScanning}
                        onChange={async e => {
                          const files = Array.from(e.target.files || []);
                          e.target.value = '';
                          if (!files.length) return;
                          setImageScanError('');
                          const MAX_BYTES = 100 * 1024 * 1024;
                          for (const file of files) {
                            if (file.size > MAX_BYTES) {
                              setImageScanError(`File size exceeded. "${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — maximum allowed is 100 MB.`);
                              return;
                            }
                          }
                          setImageScanning(true);
                          const safe: File[] = [];
                          for (const file of files) {
                            const result = await scanMedia(file);
                            if (!result.safe) {
                              setImageScanError(`"${file.name}" contains NSFW material and was removed (${result.reason ?? 'explicit content'}).`);
                              setImageScanning(false);
                              return;
                            }
                            safe.push(file);
                          }
                          setImageScanning(false);
                          setOfferMedia(prev => [...prev, ...safe]);
                        }}
                      />
                    </Box>
                    {imageScanning && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                        <i className="fas fa-spinner fa-spin" style={{ color: '#4F46E5' }} />
                        Checking for NSFW content…
                      </Box>
                    )}
                  </Box>
                  {imageScanError && (
                    <Box sx={{ mt: '0.5rem', px: '0.75rem', py: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-ban" /> {imageScanError}
                    </Box>
                  )}
                  {offerMedia.length > 0 && (
                    <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                      {offerMedia.map((file, i) => {
                        const isVid = file.type.startsWith('video/');
                        return (
                          <Box key={i} sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                            {isVid ? (
                              <>
                                <Box component="video" src={URL.createObjectURL(file)}
                                  sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB', display: 'block' }} />
                                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.375rem', background: 'rgba(0,0,0,0.38)' }}>
                                  <i className="fas fa-play" style={{ color: '#FFF', fontSize: '1rem' }} />
                                </Box>
                              </>
                            ) : (
                              <Box component="img" src={URL.createObjectURL(file)}
                                sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                            )}
                            <Box component="button" type="button"
                              onClick={() => setOfferMedia(prev => prev.filter((_, idx) => idx !== i))}
                              sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0 }}>
                              <i className="fas fa-times" />
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>

                {/* Description — rich text editor */}
                <FormLabel required>Description</FormLabel>
                <RichTextEditor
                  value={offerDesc}
                  onChange={setOfferDesc}
                  placeholder={`Describe what you're offering...\n• DSLR camera basics\n• Composition techniques\n• Lighting fundamentals\n• Basic photo editing`}
                  minHeight={140}
                />
                <FormHint icon="fa-info-circle">
                  Use bullet points (start with •) to make your description clear. This will be visible to everyone.
                </FormHint>
              </SkillContainer>

              {/* ── Skill-for-Tool: Tool Wanted section ── */}
              {exType === 'tool' && (
                <Box sx={{ mb: '1rem' }}>
                  <SectionTitle icon="fa-tools">Tool Wanted in Exchange</SectionTitle>

                  <SkillContainer>
                    {/* Exchange type toggle — Borrow vs Permanent */}
                    <Box sx={{ mb: '1.25rem' }}>
                      <FormLabel>Exchange Type</FormLabel>
                      <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {([
                          { mode: 'borrow',    label: '🔧 Borrow',             desc: 'Temporary use' },
                          { mode: 'permanent', label: '🔄 Permanent Exchange',  desc: 'Full ownership transfer' },
                        ] as { mode: 'borrow' | 'permanent'; label: string; desc: string }[]).map(opt => (
                          <Box
                            key={opt.mode}
                            onClick={() => setWantedToolMode(opt.mode)}
                            sx={{
                              flex: 1, minWidth: 130, padding: '0.75rem 1rem',
                              borderRadius: '0.5rem', cursor: 'pointer',
                              border: '1px solid',
                              borderColor: wantedToolMode === opt.mode ? '#4F46E5' : '#E5E7EB',
                              background: wantedToolMode === opt.mode ? 'rgba(79,70,229,0.06)' : '#FFF',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: wantedToolMode === opt.mode ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif' }}>
                              {opt.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '0.125rem' }}>
                              {opt.desc}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </Box>

                    {/* Tool name + borrow duration */}
                    <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', mb: '1rem' }}>
                      <Box sx={{ flex: 2, minWidth: 200 }}>
                        <FormLabel required>Tool Name</FormLabel>
                        <FormInput value={wantedToolName} onChange={setWantedToolName} placeholder="e.g. Power Drill, DSLR Camera, Circular Saw" />
                        <FormHint icon="fa-info-circle">Be specific — brand/model helps find the right person</FormHint>
                      </Box>
                      {wantedToolMode === 'borrow' && (
                        <Box sx={{ flex: 1, minWidth: 120 }}>
                          <FormLabel>Borrow Duration (days)</FormLabel>
                          <FormInput value={wantedToolDays} onChange={setWantedToolDays} type="number" placeholder="e.g. 3" />
                        </Box>
                      )}
                    </Box>

                    {/* Condition */}
                    <Box sx={{ mb: '1rem' }}>
                      <FormLabel>Minimum Condition</FormLabel>
                      <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {([
                          { key: 'any',      label: 'Any'      },
                          { key: 'new',      label: 'New'      },
                          { key: 'like-new', label: 'Like New' },
                          { key: 'good',     label: 'Good'     },
                          { key: 'fair',     label: 'Fair'     },
                        ] as { key: typeof wantedToolCondition; label: string }[]).map(c => (
                          <Box key={c.key} component="button" type="button"
                            onClick={() => setWantedToolCondition(c.key)}
                            sx={{
                              padding: '0.5rem 1rem', border: '1px solid',
                              borderColor: wantedToolCondition === c.key ? 'transparent' : '#E5E7EB',
                              borderRadius: '0.375rem', cursor: 'pointer',
                              background: wantedToolCondition === c.key ? GRAD : '#FFF',
                              color: wantedToolCondition === c.key ? '#FFF' : '#6B7280',
                              fontSize: '0.75rem', fontFamily: 'Inter,sans-serif',
                              fontWeight: wantedToolCondition === c.key ? 600 : 400,
                              transition: 'all 0.2s',
                            }}>
                            {c.label}
                          </Box>
                        ))}
                      </Box>
                      <FormHint icon="fa-info-circle">Select the minimum condition you'll accept</FormHint>
                    </Box>

                    {/* Description */}
                    <FormLabel>Tool Description / Condition Preferences</FormLabel>
                    <RichTextEditor
                      value={wantedToolDesc}
                      onChange={setWantedToolDesc}
                      placeholder="Describe what you need the tool for, any condition requirements, accessories needed, etc."
                      minHeight={100}
                    />

                    {/* Media upload */}
                    <Box sx={{ mt: '1rem' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <Box
                          component="label"
                          htmlFor="wanted-tool-upload"
                          sx={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                            px: '0.875rem', py: '0.45rem', borderRadius: '0.375rem',
                            border: '1px dashed #4F46E5', cursor: toolMediaScanning ? 'not-allowed' : 'pointer',
                            fontSize: '0.875rem', fontWeight: 500, color: '#4F46E5',
                            background: 'rgba(79,70,229,0.04)', opacity: toolMediaScanning ? 0.6 : 1,
                            '&:hover': { background: toolMediaScanning ? undefined : 'rgba(79,70,229,0.08)' },
                          }}
                        >
                          <i className={`fas ${toolMediaScanning ? 'fa-spinner fa-spin' : 'fa-photo-video'}`} style={{ fontSize: '0.875rem' }} />
                          {toolMediaScanning ? 'Scanning…' : 'Add reference photos'}
                          <input
                            id="wanted-tool-upload"
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-matroska,video/webm,video/ogg"
                            multiple
                            hidden
                            disabled={toolMediaScanning}
                            onChange={async e => {
                              const files = Array.from(e.target.files || []);
                              e.target.value = '';
                              if (!files.length) return;
                              setToolMediaScanError('');
                              const MAX_BYTES = 100 * 1024 * 1024;
                              for (const file of files) {
                                if (file.size > MAX_BYTES) {
                                  setToolMediaScanError(`File size exceeded. "${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — maximum allowed is 100 MB.`);
                                  return;
                                }
                              }
                              setToolMediaScanning(true);
                              const safe: File[] = [];
                              for (const file of files) {
                                const result = await scanMedia(file);
                                if (!result.safe) {
                                  setToolMediaScanError(`"${file.name}" was flagged and removed.`);
                                  setToolMediaScanning(false);
                                  return;
                                }
                                safe.push(file);
                              }
                              setToolMediaScanning(false);
                              setWantedToolMedia(prev => [...prev, ...safe]);
                            }}
                          />
                        </Box>
                      </Box>
                      {toolMediaScanError && (
                        <Box sx={{ mt: '0.5rem', px: '0.75rem', py: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <i className="fas fa-ban" /> {toolMediaScanError}
                        </Box>
                      )}
                      {wantedToolMedia.length > 0 && (
                        <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                          {wantedToolMedia.map((file, i) => (
                            <Box key={i} sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                              <Box component="img" src={URL.createObjectURL(file)}
                                sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                              <Box component="button" type="button"
                                onClick={() => setWantedToolMedia(prev => prev.filter((_, idx) => idx !== i))}
                                sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0 }}>
                                <i className="fas fa-times" />
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </SkillContainer>
                </Box>
              )}

              {/* ── Skill-for-Skill / Hybrid: Skills Wanted section ── */}
              {exType !== 'tool' && !modal && <>
              <SectionTitle icon="fa-search">Skills Wanted in Exchange</SectionTitle>

              {wantedScanError && (
                <Box sx={{ mb: '1rem', px: '0.75rem', py: '0.5rem', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <i className="fas fa-ban" /> {wantedScanError}
                </Box>
              )}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem', mb: '1rem' }}>
                {wantedSkills.map((ws, idx) => {
                  const isScanning = wantedScanningIdx === idx;
                  const inputId = `wanted-image-upload-${idx}`;
                  return (
                    <SkillContainer key={idx}>
                      {/* Header row: title + remove button */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '1rem' }}>
                        <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Poppins,sans-serif' }}>
                          Wanted Skill {wantedSkills.length > 1 ? idx + 1 : ''}
                        </Typography>
                        {wantedSkills.length > 1 && (
                          <Box component="button" type="button"
                            onClick={() => setWantedSkills(prev => prev.filter((_, i) => i !== idx))}
                            sx={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.25rem', fontSize: '0.875rem' }}>
                            <i className="fas fa-times" /> Remove
                          </Box>
                        )}
                      </Box>

                      {/* Name + Proficiency */}
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', mb: '1rem' }}>
                        <Box sx={{ flex: 1, minWidth: 200 }}>
                          <FormLabel required={idx === 0}>Skill / Service Name</FormLabel>
                          <FormInput
                            value={ws.name}
                            onChange={(v) => setWantedSkills(prev => prev.map((s, i) => i === idx ? { ...s, name: v } : s))}
                            placeholder="e.g. Gardening & Plant Care"
                          />
                        </Box>
                        <Box>
                          <FormLabel>Proficiency Level</FormLabel>
                          <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {PROFICIENCY_LEVELS.map(p => (
                              <Box key={p.key} component="button" type="button"
                                onClick={() => setWantedSkills(prev => prev.map((s, i) => i === idx ? { ...s, proficiency: p.key } : s))}
                                sx={{
                                  padding: '0.5rem 1rem', border: '1px solid',
                                  borderColor: ws.proficiency === p.key ? 'transparent' : '#E5E7EB',
                                  borderRadius: '0.375rem', cursor: 'pointer',
                                  background: ws.proficiency === p.key ? GRAD : '#FFF',
                                  color: ws.proficiency === p.key ? '#FFF' : '#6B7280',
                                  fontSize: '0.75rem', fontFamily: 'Inter,sans-serif',
                                  fontWeight: ws.proficiency === p.key ? 600 : 400,
                                  transition: 'all 0.2s',
                                }}>
                                {p.key}
                              </Box>
                            ))}
                          </Box>
                        </Box>
                      </Box>

                      {/* Image upload */}
                      <Box sx={{ mb: '1rem' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                          <Box
                            component="label"
                            htmlFor={inputId}
                            sx={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              px: '0.875rem', py: '0.45rem', borderRadius: '0.375rem',
                              border: '1px dashed #4F46E5', cursor: isScanning ? 'not-allowed' : 'pointer',
                              fontSize: '0.875rem', fontWeight: 500, color: '#4F46E5',
                              background: 'rgba(79,70,229,0.04)', opacity: isScanning ? 0.6 : 1,
                              '&:hover': { background: isScanning ? undefined : 'rgba(79,70,229,0.08)' },
                            }}
                          >
                            <i className={`fas ${isScanning ? 'fa-spinner fa-spin' : 'fa-photo-video'}`} style={{ fontSize: '0.875rem' }} />
                            {isScanning ? 'Scanning…' : 'Add photos or videos'}
                            <input
                              id={inputId}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/x-matroska,video/webm"
                              multiple
                              hidden
                              disabled={isScanning}
                              onChange={async e => {
                                const files = Array.from(e.target.files || []);
                                e.target.value = '';
                                if (!files.length) return;
                                setWantedScanError('');
                                const MAX_BYTES = 100 * 1024 * 1024;
                                for (const file of files) {
                                  if (file.size > MAX_BYTES) {
                                    setWantedScanError(`File size exceeded. "${file.name}" is ${(file.size / 1024 / 1024).toFixed(0)} MB — maximum allowed is 100 MB.`);
                                    return;
                                  }
                                }
                                setWantedScanningIdx(idx);
                                const safe: File[] = [];
                                for (const file of files) {
                                  const result = await scanMedia(file);
                                  if (!result.safe) {
                                    setWantedScanError(`"${file.name}" contains NSFW material and was removed (${result.reason ?? 'explicit content'}).`);
                                    setWantedScanningIdx(null);
                                    return;
                                  }
                                  safe.push(file);
                                }
                                setWantedScanningIdx(null);
                                setWantedSkills(prev => prev.map((s, i) => i === idx ? { ...s, media: [...s.media, ...safe] } : s));
                              }}
                            />
                          </Box>
                          {isScanning && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                              <i className="fas fa-spinner fa-spin" style={{ color: '#4F46E5' }} />
                              Checking for NSFW content…
                            </Box>
                          )}
                        </Box>
                        {ws.media.length > 0 && (
                          <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.625rem' }}>
                            {ws.media.map((file, imgIdx) => {
                              const isVid = file.type.startsWith('video/');
                              return (
                                <Box key={imgIdx} sx={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                                  {isVid ? (
                                    <>
                                      <Box component="video" src={URL.createObjectURL(file)}
                                        sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB', display: 'block' }} />
                                      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '0.375rem', background: 'rgba(0,0,0,0.38)' }}>
                                        <i className="fas fa-play" style={{ color: '#FFF', fontSize: '1rem' }} />
                                      </Box>
                                    </>
                                  ) : (
                                    <Box component="img" src={URL.createObjectURL(file)}
                                      sx={{ width: 72, height: 72, borderRadius: '0.375rem', objectFit: 'cover', border: '1px solid #E5E7EB' }} />
                                  )}
                                  <Box component="button" type="button"
                                    onClick={() => setWantedSkills(prev => prev.map((s, i) => i === idx ? { ...s, media: s.media.filter((_, ii) => ii !== imgIdx) } : s))}
                                    sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0 }}>
                                    <i className="fas fa-times" />
                                  </Box>
                                </Box>
                              );
                            })}
                          </Box>
                        )}
                      </Box>

                      {/* Description — rich text editor */}
                      <FormLabel>Description (optional)</FormLabel>
                      <RichTextEditor
                        value={ws.description}
                        onChange={(v) => setWantedSkills(prev => prev.map((s, i) => i === idx ? { ...s, description: v } : s))}
                        placeholder="Describe what you're looking for…"
                        minHeight={100}
                      />
                    </SkillContainer>
                  );
                })}
              </Box>

              {/* Add wanted skill button */}
              <Box
                component="button" type="button"
                onClick={() => setWantedSkills(prev => [...prev, { name: '', description: '', proficiency: 'Intermediate', media: [] }])}
                sx={{
                  width: '100%', mb: '2rem', padding: '0.875rem',
                  border: '2px dashed #D1D5DB', borderRadius: '0.5rem',
                  background: 'transparent', color: '#6B7280',
                  fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontFamily: 'Inter,sans-serif',
                  '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: 'rgba(79,70,229,0.03)' },
                }}
              >
                <i className="fas fa-plus" /> Add Another Wanted Skill
              </Box>
              </>}

              {/* Public negotiation terms */}
              <Box sx={{ mb: '1.5rem' }}>
                <FormLabel>Public Negotiation Terms</FormLabel>
                <Box component="textarea" value={terms}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setTerms(e.target.value)}
                  placeholder="Outline any specific terms or conditions for this exchange. This will be publicly visible for community transparency."
                  rows={3}
                  sx={{
                    width: '100%', padding: '1rem', border: '1px solid #E5E7EB',
                    borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif',
                    fontSize: '0.875rem', color: '#1F2937', resize: 'vertical',
                    outline: 'none', boxSizing: 'border-box',
                    '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                    '&::placeholder': { color: '#9CA3AF' },
                  }}
                />
                <FormHint icon="fa-eye">These terms will be visible to the entire community</FormHint>
              </Box>

              {/* Tags */}
              {!modal && <Box sx={{ mb: '1rem' }} ref={tagContainerRef}>
                <FormLabel>Tags</FormLabel>

                {/* Input + dropdown wrapper */}
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                    <Box
                      component="input"
                      value={tagInput}
                      disabled={tags.length >= 8}
                      placeholder={tags.length >= 8 ? 'Max 8 tags reached' : 'Search or add a tag…'}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setTagInput(e.target.value);
                        setTagHighlight(-1);
                        setTagDropdownOpen(true);
                      }}
                      onFocus={() => setTagDropdownOpen(true)}
                      onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                        // Delay so clicking a dropdown item fires before blur closes it
                        if (!tagContainerRef.current?.contains(e.relatedTarget as Node)) {
                          setTimeout(() => setTagDropdownOpen(false), 150);
                        }
                      }}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        const query = tagInput.trim().toLowerCase();
                        const filtered = SUGGESTED_TAGS.filter(s =>
                          !tags.includes(s) && s.includes(query)
                        );
                        const showCustom = query && !SUGGESTED_TAGS.includes(query) && !tags.includes(query);
                        const items = showCustom ? [query, ...filtered] : filtered;

                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setTagHighlight(h => Math.min(h + 1, items.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setTagHighlight(h => Math.max(h - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const pick = tagHighlight >= 0 ? items[tagHighlight] : query;
                          if (pick && !tags.includes(pick) && tags.length < 8) {
                            setTags(t => [...t, pick]);
                            setTagInput('');
                            setTagDropdownOpen(false);
                            setTagHighlight(-1);
                          }
                        } else if (e.key === 'Escape') {
                          setTagDropdownOpen(false);
                        }
                      }}
                      sx={{
                        flex: 1, padding: '0.875rem 1rem', border: '1px solid #E5E7EB',
                        borderRadius: tagDropdownOpen ? '0.5rem 0.5rem 0 0' : '0.5rem',
                        fontSize: '0.875rem', fontFamily: 'Inter,sans-serif',
                        outline: 'none', boxSizing: 'border-box', color: '#1F2937',
                        transition: 'border-color 0.15s',
                        '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                        '&::placeholder': { color: '#9CA3AF' },
                        background: '#FFF',
                      }}
                    />
                  </Box>

                  {/* Dropdown */}
                  {tagDropdownOpen && tags.length < 8 && (() => {
                    const query = tagInput.trim().toLowerCase();
                    const filtered = SUGGESTED_TAGS.filter(s =>
                      !tags.includes(s) && (query === '' || s.includes(query))
                    );
                    const showCustom = query && !SUGGESTED_TAGS.includes(query) && !tags.includes(query);
                    const items: Array<{ label: string; isCustom: boolean }> = [
                      ...(showCustom ? [{ label: query, isCustom: true }] : []),
                      ...filtered.map(s => ({ label: s, isCustom: false })),
                    ];
                    if (!items.length) return null;
                    return (
                      <Box sx={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: '#FFF', border: '1px solid #4F46E5', borderTop: 'none',
                        borderRadius: '0 0 0.5rem 0.5rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: 220, overflowY: 'auto',
                      }}>
                        {items.map((item, i) => (
                          <Box
                            key={item.label}
                            onMouseDown={(e: React.MouseEvent) => {
                              e.preventDefault();
                              if (!tags.includes(item.label) && tags.length < 8) {
                                setTags(t => [...t, item.label]);
                                setTagInput('');
                                setTagDropdownOpen(false);
                                setTagHighlight(-1);
                              }
                            }}
                            onMouseEnter={() => setTagHighlight(i)}
                            sx={{
                              px: '1rem', py: '0.625rem',
                              cursor: 'pointer', fontSize: '0.875rem',
                              fontFamily: 'Inter,sans-serif',
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              background: tagHighlight === i ? '#EEF2FF' : 'transparent',
                              color: tagHighlight === i ? '#4F46E5' : '#1F2937',
                              transition: 'background 0.1s',
                              borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                            }}
                          >
                            {item.isCustom ? (
                              <>
                                <i className="fas fa-plus" style={{ fontSize: '0.7rem', color: '#10B981' }} />
                                <span>Add <strong>"{item.label}"</strong></span>
                              </>
                            ) : (
                              <>
                                <i className="fas fa-tag" style={{ fontSize: '0.7rem', color: '#6B7280' }} />
                                <span>#{item.label}</span>
                              </>
                            )}
                          </Box>
                        ))}
                      </Box>
                    );
                  })()}
                </Box>
                <FormHint icon="fa-info-circle">Type to search tags or add your own. Max 8 tags.</FormHint>

                {/* Selected tags */}
                {tags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', mt: '0.75rem' }}>
                    {tags.map(tag => (
                      <Box key={tag} sx={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        background: '#EEF2FF', color: '#4F46E5', borderRadius: '2rem',
                        padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontWeight: 600,
                        border: '1px solid #C7D2FE',
                      }}>
                        #{tag}
                        <Box component="button" type="button" onClick={() => setTags(t => t.filter(x => x !== tag))}
                          sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4F46E5', padding: 0, opacity: 0.7, '&:hover': { opacity: 1 } }}>
                          <i className="fas fa-times" style={{ fontSize: '0.65rem' }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>}
              </>) : null
              }
            </Box>
          )}

          {/* ══════════════ STEP 2: LOCATION ══════════════ */}
          {step === 1 && (
            <Box>
              <SectionTitle icon="fa-map-marker-alt">Exchange Location</SectionTitle>

              {/* Location type cards — hidden when online is enabled */}
              {!(onlineVideo || onlineOnly) && <Box sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: '1rem', mb: '1.5rem',
              }}>
                {[
                  { key: 'public',  icon: 'fa-store', label: 'Public Place',      desc: 'Meet at a cafe, library, community center, or other public location' },
                  { key: 'private', icon: 'fa-home',  label: 'Private Location',  desc: 'Home or private location (requires secure sharing)' },
                ].map(loc => {
                  const active = locType === loc.key;
                  return (
                    <Box key={loc.key} onClick={() => {
                        const next = loc.key as typeof locType;
                        setLocType(next);
                        // Clear the other picker's selection when switching
                        if (next === 'public') setPrivatePlace('');
                        else setPublicPlace('');
                      }} sx={{
                      padding: '1.5rem', cursor: 'pointer',
                      border: `2px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
                      borderRadius: '0.75rem',
                      background: active ? 'rgba(79,70,229,0.05)' : 'transparent',
                      transition: 'all 0.2s',
                      '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)' },
                    }}>
                      <Box sx={{ fontSize: '1.5rem', color: '#4F46E5', mb: '1rem' }}>
                        <i className={`fas ${loc.icon}`} />
                      </Box>
                      <Typography sx={{ fontWeight: 600, mb: '0.5rem', fontFamily: 'Inter,sans-serif', color: '#1F2937' }}>
                        {loc.label}
                      </Typography>
                      <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                        {loc.desc}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>}

              {/* Public place options — interactive map */}
              {!(onlineVideo || onlineOnly) && locType === 'public' && (
                <SkillContainer>
                  <FormLabel required>Public Place Selection</FormLabel>
                  <PublicPlacePicker
                    value={publicPlace}
                    onChange={setPublicPlace}
                    userCoordinates={
                      user?.location?.coordinates &&
                      user.location.coordinates[0] !== 0 &&
                      user.location.coordinates[1] !== 0
                        ? (user.location.coordinates as [number, number])
                        : undefined
                    }
                  />
                  <FormHint icon="fa-shield-alt">
                    Search or click a pin on the map — public locations are recommended for safety
                  </FormHint>
                </SkillContainer>
              )}

              {/* Private location options */}
              {!(onlineVideo || onlineOnly) && locType === 'private' && (
                <>
                  {/* Private place picker */}
                  <SkillContainer>
                    <FormLabel required>Location Selection</FormLabel>
                    <PublicPlacePicker
                      value={privatePlace}
                      onChange={setPrivatePlace}
                      userCoordinates={
                        user?.location?.coordinates &&
                        user.location.coordinates[0] !== 0 &&
                        user.location.coordinates[1] !== 0
                          ? (user.location.coordinates as [number, number])
                          : undefined
                      }
                    />
                    <FormHint icon="fa-lock">
                      Your exact location will only be shared securely after both parties confirm — the community sees a masked address
                    </FormHint>
                  </SkillContainer>

                  {/* Security warning */}
                  <Box sx={{
                    background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: '0.75rem', padding: '1.5rem', mb: '1.5rem',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '0.75rem' }}>
                      <i className="fas fa-exclamation-triangle" style={{ color: '#EF4444', fontSize: '1.25rem' }} />
                      <Typography sx={{ fontWeight: 600, color: '#EF4444', fontFamily: 'Poppins,sans-serif' }}>
                        Important Security Notice
                      </Typography>
                    </Box>
                    {[
                      'Your exact address will never be stored in chat logs',
                      'Location will be shared via one-time secure link only',
                      'Links expire automatically after the meeting time',
                      'All location access is logged for security monitoring',
                    ].map(item => (
                      <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.5rem' }}>
                        <i className="fas fa-check-circle" style={{ color: '#F59E0B', marginTop: 2, fontSize: '0.8rem', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>{item}</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              )}

              {/* Online option */}
              <Box sx={{ mt: '1.5rem' }}>
                {/* Toggle card */}
                <Box
                  onClick={() => {
                    const next = !(onlineVideo || onlineOnly);
                    setOnlineVideo(next);
                    setOnlineOnly(next);
                    if (!next) { setVideoLink(''); setVideoToken(''); setVideoCopied(false); }
                  }}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '1rem 1.25rem',
                    borderRadius: '0.75rem', cursor: 'pointer',
                    border: (onlineVideo || onlineOnly)
                      ? '1.5px solid rgba(79,70,229,0.35)'
                      : '1.5px solid #E5E7EB',
                    background: (onlineVideo || onlineOnly)
                      ? 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)'
                      : '#FAFAFA',
                    transition: 'all 0.2s',
                    userSelect: 'none',
                    '&:hover': {
                      borderColor: '#4F46E5',
                      background: 'linear-gradient(135deg, rgba(79,70,229,0.05) 0%, rgba(16,185,129,0.05) 100%)',
                    },
                  }}
                >
                  {/* Icon bubble */}
                  <Box sx={{
                    width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                    background: (onlineVideo || onlineOnly)
                      ? 'linear-gradient(135deg, #4F46E5, #10B981)'
                      : '#F3F4F6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background 0.2s',
                    boxShadow: (onlineVideo || onlineOnly) ? '0 3px 10px rgba(79,70,229,0.3)' : 'none',
                  }}>
                    <i className="fas fa-video" style={{
                      fontSize: '1rem',
                      color: (onlineVideo || onlineOnly) ? '#FFF' : '#9CA3AF',
                    }} />
                  </Box>

                  {/* Text */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: '0.9rem', fontWeight: 600,
                      color: (onlineVideo || onlineOnly) ? '#4F46E5' : '#374151',
                      fontFamily: 'Inter,sans-serif',
                      transition: 'color 0.2s',
                    }}>
                      This exchange can be done online
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                      {(onlineVideo || onlineOnly)
                        ? 'Video call enabled — create your meeting link below'
                        : 'Enable to offer a video call option to participants'}
                    </Typography>
                  </Box>

                  {/* iOS-style toggle */}
                  <Box sx={{
                    width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                    background: (onlineVideo || onlineOnly)
                      ? 'linear-gradient(135deg, #4F46E5, #10B981)'
                      : '#D1D5DB',
                    position: 'relative',
                    transition: 'background 0.25s',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.12)',
                  }}>
                    <Box sx={{
                      position: 'absolute',
                      top: 3, left: (onlineVideo || onlineOnly) ? 23 : 3,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#FFF',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
                      transition: 'left 0.22s cubic-bezier(0.4,0,0.2,1)',
                    }} />
                  </Box>
                </Box>

                {/* ── Video link creator ── */}
                {(onlineVideo || onlineOnly) && (
                  <Box sx={{
                    mt: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.75rem',
                    overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <Box sx={{
                      background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                      padding: '0.875rem 1.25rem',
                      display: 'flex', alignItems: 'center', gap: '0.625rem',
                    }}>
                      <i className="fas fa-video" style={{ color: '#FFF', fontSize: '0.9rem' }} />
                      <Typography sx={{ fontWeight: 600, color: '#FFF', fontSize: '0.9rem', fontFamily: 'Poppins,sans-serif' }}>
                        Video Meeting Link
                      </Typography>
                    </Box>

                    <Box sx={{ padding: '1.25rem', background: '#FAFAFA' }}>
                      {/* Provider toggle */}
                      <Box sx={{ display: 'flex', gap: '0.5rem', mb: '1rem' }}>
                        {([
                          { key: 'daily', icon: 'fa-video', label: 'Daily.co private room' },
                        ] as const).map(opt => {
                          const active = true;
                          return (
                            <Box
                              key={opt.key}
                              sx={{
                                flex: 1, padding: '0.625rem 0.75rem',
                                border: `1.5px solid ${active ? '#4F46E5' : '#E5E7EB'}`,
                                borderRadius: '0.5rem',
                                background: active ? 'rgba(79,70,229,0.06)' : '#FFF',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                transition: 'all 0.15s',
                                '&:hover': { borderColor: '#4F46E5' },
                              }}
                            >
                              <i className={`fas ${opt.icon}`} style={{ color: active ? '#4F46E5' : '#6B7280', fontSize: '0.8rem' }} />
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: active ? 600 : 400, color: active ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif' }}>
                                {opt.label}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>

                      {/* Daily.co private room generator */}
                      <Box>
                          {/* Host link banner OR admin info */}
                          {videoLink && targetPost?.onlineLink && videoLink === targetPost.onlineLink ? (
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.75rem', p: '0.625rem 0.875rem', background: 'rgba(16,185,129,0.06)', borderRadius: '0.5rem', border: '1px solid rgba(16,185,129,0.25)' }}>
                              <i className="fas fa-user-check" style={{ color: '#10B981', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '0.78rem', color: '#065F46', fontFamily: 'Inter,sans-serif' }}>
                                <strong>Host's meeting room</strong> — this link was created by the post author and will be used for your exchange session.
                              </Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.75rem', p: '0.625rem 0.875rem', background: 'rgba(79,70,229,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                              <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.75rem', marginTop: '2px', flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                                You are the <strong>admin</strong> — you can admit, mute, or remove participants. Meeting is <strong>recorded automatically</strong> and chat is saved.
                              </Typography>
                            </Box>
                          )}

                          {/* Required notice — hidden when host link is pre-filled */}
                          {!videoLink && !targetPost?.onlineLink && (
                            <Box sx={{
                              display: 'flex', alignItems: 'center', gap: '0.5rem',
                              mb: '0.875rem', padding: '0.625rem 0.875rem',
                              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
                              borderRadius: '0.5rem',
                            }}>
                              <i className="fas fa-exclamation-circle" style={{ color: '#EF4444', fontSize: '0.8rem', flexShrink: 0 }} />
                              <Typography sx={{ fontSize: '0.78rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                                <strong>Required:</strong> Create your private meeting room to continue to the next step.
                              </Typography>
                            </Box>
                          )}

                          {!videoLink && !targetPost?.onlineLink ? (
                            <Box
                              onClick={async () => {
                                if (videoGenerating) return;
                                setVideoGenerating(true);
                                try {
                                  const res = await import('../services/api').then(m => m.default.post<{
                                    roomId: string; token: string; url: string;
                                  }>('/meetings/create', { title: offerTitle || 'Exchange Meeting' }));
                                  setVideoRoomId(res.data.roomId);
                                  setVideoToken(res.data.token);
                                  // Copy link = Daily.co URL (works anywhere, no localhost)
                                  // Friends knock → creator admits from lobby
                                  setVideoLink(res.data.url.split('?')[0]); // bare Daily.co URL, no token
                                } catch (err) {
                                  // Daily.co room creation failed — show error
                                  console.error('[CreateExchange] Failed to create meeting room:', err);
                                  setError('Failed to create meeting room. Please check your connection and try again.');
                                } finally {
                                  setVideoGenerating(false);
                                }
                              }}
                              sx={{
                                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                                padding: '0.625rem 1.25rem',
                                background: videoGenerating ? '#E5E7EB' : GRAD, color: videoGenerating ? '#9CA3AF' : '#FFF',
                                borderRadius: '0.5rem', cursor: videoGenerating ? 'default' : 'pointer',
                                fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                                boxShadow: videoGenerating ? 'none' : '0 2px 8px rgba(79,70,229,0.3)',
                                transition: 'opacity 0.15s', '&:hover': { opacity: videoGenerating ? 1 : 0.88 },
                              }}
                            >
                              {videoGenerating
                                ? <><i className="fas fa-spinner fa-spin" /> Creating secure room…</>
                                : <><i className="fas fa-lock" /> Create private meeting room</>
                              }
                            </Box>
                          ) : (
                            <Box>
                              {/* Link display */}
                              <Box sx={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: '#FFF', border: '1px solid #E5E7EB',
                                borderRadius: '0.5rem', padding: '0.625rem 0.875rem',
                                mb: '0.625rem',
                              }}>
                                <i className="fas fa-video" style={{ color: '#10B981', fontSize: '0.8rem', flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1, wordBreak: 'break-all' }}>
                                  {videoLink}
                                </Typography>
                              </Box>

                              {/* Actions */}
                              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <Box
                                  onClick={() => {
                                    navigator.clipboard.writeText(videoLink);
                                    setVideoCopied(true);
                                    setTimeout(() => setVideoCopied(false), 2000);
                                  }}
                                  sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                    padding: '0.5rem 1rem',
                                    background: videoCopied ? 'rgba(16,185,129,0.1)' : 'rgba(79,70,229,0.08)',
                                    border: `1px solid ${videoCopied ? '#10B981' : '#4F46E5'}`,
                                    borderRadius: '0.375rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600,
                                    color: videoCopied ? '#10B981' : '#4F46E5',
                                    fontFamily: 'Inter,sans-serif', transition: 'all 0.15s',
                                  }}
                                >
                                  <i className={`fas ${videoCopied ? 'fa-check' : 'fa-copy'}`} />
                                  {videoCopied ? 'Copied!' : 'Copy link'}
                                </Box>

                                <Box
                                  onClick={() => { if (!videoRoomId) return; const dest = videoToken ? `/meeting/${videoRoomId}?token=${encodeURIComponent(videoToken)}` : videoLink; videoToken ? navigate(dest) : window.open(dest, '_blank'); }}
                                  sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(16,185,129,0.08)',
                                    border: '1px solid #10B981',
                                    borderRadius: '0.375rem', cursor: 'pointer',
                                    fontSize: '0.8rem', fontWeight: 600, color: '#10B981',
                                    fontFamily: 'Inter,sans-serif',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  <i className="fas fa-video" />
                                  Test room
                                </Box>

                                <Box
                                  onClick={() => { setVideoLink(''); setVideoToken(''); setVideoCopied(false); setVideoRoomId(''); }}
                                  sx={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                                    padding: '0.5rem 1rem',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '0.375rem', cursor: 'pointer',
                                    fontSize: '0.8rem', color: '#EF4444',
                                    fontFamily: 'Inter,sans-serif', transition: 'all 0.15s',
                                  }}
                                >
                                  <i className="fas fa-redo" />
                                  {targetPost?.onlineLink && videoLink === targetPost.onlineLink ? 'Use my own link instead' : 'Regenerate'}
                                </Box>
                              </Box>
                            </Box>
                          )}
                        </Box>

                      {/* Hint */}
                      <Box sx={{ mt: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.375rem' }}>
                        <i className="fas fa-info-circle" style={{ color: '#6B7280', fontSize: '0.7rem', marginTop: '2px', flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                          This link will be shared with matched participants only after both parties confirm the exchange.
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          )}

          {/* ══════════════ STEP 3: VALUE & SCHEDULE ══════════════ */}
          {step === 2 && (
            <Box>
              {/* CEU Calculator — only for tool/hybrid, not skill-for-skill */}
              {!modal && exType !== 'skill' && <><SectionTitle icon="fa-calculator">CEU Value Calculator</SectionTitle>

              <SkillContainer>

                {/* ── Tool-for-Tool / Hybrid: market value + mode inputs ── */}
                {(exType === 'tool' || exType === 'service') && (
                  <Box sx={{ mb: '1.5rem' }}>
                    {/* Mode toggle */}
                    <Box sx={{ display: 'flex', gap: '0.625rem', mb: '1.25rem', flexWrap: 'wrap' }}>
                      {exType === 'tool' ? (
                        // Tool-for-Tool: 3 modes
                        ([
                          { mode: 'lend',      label: '🔧 Lend Tool',       desc: 'Temporary borrow' },
                          { mode: 'permanent', label: '🔄 Permanent Swap',   desc: 'Full ownership transfer' },
                          { mode: 'gift',      label: '🎁 Gift Tool',        desc: 'Generous 1.2× bonus' },
                        ] as { mode: typeof toolExchangeMode; label: string; desc: string }[]).map(opt => (
                          <Box key={opt.mode}
                            onClick={() => setToolExchangeMode(opt.mode)}
                            sx={{
                              flex: 1, minWidth: 100, padding: '0.75rem 0.5rem',
                              borderRadius: '0.5rem', cursor: 'pointer',
                              border: '1px solid', textAlign: 'center',
                              borderColor: toolExchangeMode === opt.mode ? '#4F46E5' : '#E5E7EB',
                              background: toolExchangeMode === opt.mode ? 'rgba(79,70,229,0.06)' : '#FFF',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: toolExchangeMode === opt.mode ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif' }}>
                              {opt.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              {opt.desc}
                            </Typography>
                          </Box>
                        ))
                      ) : (
                        // Hybrid: 2 modes
                        ([
                          { gift: false, label: '🔧 Lend Tool',  desc: 'Borrow for a period' },
                          { gift: true,  label: '🎁 Gift Tool',  desc: 'Generous 1.2× bonus' },
                        ] as { gift: boolean; label: string; desc: string }[]).map(opt => (
                          <Box key={String(opt.gift)}
                            onClick={() => setToolIsGift(opt.gift)}
                            sx={{
                              flex: 1, padding: '0.75rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                              border: '1px solid', textAlign: 'center',
                              borderColor: toolIsGift === opt.gift ? '#4F46E5' : '#E5E7EB',
                              background: toolIsGift === opt.gift ? 'rgba(79,70,229,0.06)' : '#FFF',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: toolIsGift === opt.gift ? '#4F46E5' : '#374151', fontFamily: 'Inter,sans-serif' }}>
                              {opt.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                              {opt.desc}
                            </Typography>
                          </Box>
                        ))
                      )}
                    </Box>

                    {/* Determine if borrow days are shown */}
                    {(() => {
                      const isLend = exType === 'tool' ? toolExchangeMode === 'lend' : !toolIsGift;
                      return (
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: isLend ? '1fr 1fr 1fr' : '1fr' }, gap: '1rem' }}>
                          <Box>
                            <FormLabel required>Market Value (£)</FormLabel>
                            <FormInput value={toolMarketValue} onChange={setToolMarketValue} type="number" placeholder="e.g. 150" />
                            <FormHint icon="fa-info-circle">Estimated replacement cost of the tool</FormHint>
                          </Box>
                          {isLend && (
                            <>
                              <Box>
                                <FormLabel required>Borrow Days</FormLabel>
                                <FormInput value={toolBorrowDays} onChange={setToolBorrowDays} type="number" placeholder="e.g. 3" />
                              </Box>
                              <Box>
                                <FormLabel>Risk Factor (CEU)</FormLabel>
                                <FormInput value={toolRiskFactor} onChange={setToolRiskFactor} type="number" placeholder="e.g. 5" />
                                <FormHint icon="fa-exclamation-triangle">Extra CEU for fragile/high-value items</FormHint>
                              </Box>
                            </>
                          )}
                        </Box>
                      );
                    })()}

                    {/* Formula preview */}
                    <Box sx={{ mt: '1rem', padding: '0.625rem 0.875rem', background: 'rgba(79,70,229,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                      <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                        {exType === 'tool'
                          ? toolExchangeMode === 'lend'
                            ? `Formula: £${mv.toFixed(0)} × 0.001 × ${bd} days + ${rf} risk = ${calcToolBorrowCEU(mv, bd, rf)} CEU`
                            : toolExchangeMode === 'permanent'
                              ? `Formula: £${mv.toFixed(0)} × 1.2 (permanent ownership transfer)`
                              : `Formula: £${mv.toFixed(0)} × 1.2 (generosity bonus)`
                          : toolIsGift
                            ? `Formula: £${mv.toFixed(0)} × 1.2 (generosity bonus)`
                            : `Formula: £${mv.toFixed(0)} × 0.001 × ${bd} days + ${rf} risk = ${calcToolBorrowCEU(mv, bd, rf)} CEU`
                        }
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* ── Add extra CEU ── */}
                <Box sx={{
                  mt: '1rem',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                }}>
                  {/* Header */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: '1rem', py: '0.625rem',
                    background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className="fas fa-plus-circle" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', color: '#1F2937' }}>
                        Add extra CEU <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(optional)</span>
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                      Base: <strong>{baseCeuValue}</strong> + extra: <strong>{extraCeu}</strong>
                    </Typography>
                  </Box>

                  {/* Stepper row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', px: '1rem', py: '0.75rem' }}>
                    {/* Minus */}
                    <Box
                      component="button"
                      onClick={() => setExtraCeu(Math.max(0, extraCeu - 1))}
                      disabled={extraCeu === 0}
                      sx={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '1.5px solid #E5E7EB',
                        background: extraCeu === 0 ? '#F9FAFB' : '#FFF',
                        color: extraCeu === 0 ? '#D1D5DB' : '#4F46E5',
                        cursor: extraCeu === 0 ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.125rem', fontWeight: 700, flexShrink: 0,
                        transition: 'all 0.15s',
                        '&:hover': extraCeu > 0 ? { background: '#EEF2FF', borderColor: '#4F46E5' } : {},
                      }}
                    >
                      −
                    </Box>

                    {/* Direct number input */}
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                      <Box
                        component="input"
                        type="number"
                        min={0}
                        value={extraCeu === 0 ? '' : extraCeu}
                        placeholder="0"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const v = parseInt(e.target.value) || 0;
                          setExtraCeu(Math.max(0, v));
                        }}
                        sx={{
                          width: '100%', border: '1.5px solid #E5E7EB',
                          borderRadius: '0.5rem', textAlign: 'center',
                          py: '0.375rem', px: '0.5rem',
                          fontSize: '1.125rem', fontWeight: 700,
                          color: '#1F2937', fontFamily: 'Poppins,sans-serif',
                          outline: 'none',
                          '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                          '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { '-webkit-appearance': 'none' },
                        }}
                      />
                      <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.125rem' }}>
                        extra CEU you're adding
                      </Typography>
                    </Box>

                    {/* Plus */}
                    <Box
                      component="button"
                      onClick={() => setExtraCeu(extraCeu + 1)}
                      sx={{
                        width: 36, height: 36, borderRadius: '50%',
                        border: '1.5px solid #4F46E5',
                        background: '#EEF2FF', color: '#4F46E5',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.125rem', fontWeight: 700, flexShrink: 0,
                        transition: 'all 0.15s',
                        '&:hover': { background: '#4F46E5', color: '#FFF' },
                      }}
                    >
                      +
                    </Box>
                  </Box>

                  {/* Quick-add preset chips */}
                  <Box sx={{ display: 'flex', gap: '0.375rem', px: '1rem', pb: '0.875rem', flexWrap: 'wrap' }}>
                    {[0, 1, 2, 5, 10].map(preset => (
                      <Box
                        key={preset}
                        component="button"
                        onClick={() => setExtraCeu(preset)}
                        sx={{
                          background: extraCeu === preset ? '#4F46E5' : '#F3F4F6',
                          color:      extraCeu === preset ? '#FFF'    : '#6B7280',
                          border: 'none', borderRadius: '2rem',
                          px: '0.625rem', py: '0.2rem',
                          fontSize: '0.75rem', fontWeight: 600,
                          fontFamily: 'Inter,sans-serif', cursor: 'pointer',
                          transition: 'all 0.15s',
                          '&:hover': { background: extraCeu === preset ? '#4338CA' : '#E5E7EB' },
                        }}
                      >
                        {preset === 0 ? 'Base only' : `+${preset}`}
                      </Box>
                    ))}
                  </Box>
                </Box>

                {/* ── CEU total result ── */}
                <Box sx={{
                  background: GRAD, color: '#FFF', borderRadius: '0.75rem',
                  padding: '1.5rem', textAlign: 'center',
                  mt: '1rem',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', mb: '0.5rem' }}>
                    <i className="fas fa-coins" style={{ fontSize: '1.5rem' }} />
                    <Typography sx={{ fontSize: '2rem', fontWeight: 700, fontFamily: 'Poppins,sans-serif', color: '#FFF' }}>
                      {ceuValue} CEU
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', opacity: 0.9, color: '#FFF', fontFamily: 'Inter,sans-serif' }}>
                    {extraCeu > 0
                      ? `${baseCeuValue} calculated + ${extraCeu} extra you added`
                      : 'Estimated Exchange Value'}
                  </Typography>
                  <Typography sx={{ fontSize: '0.8rem', opacity: 0.8, color: '#FFF', mt: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
                    {exType === 'tool'
                      ? toolExchangeMode === 'lend'
                        ? `Tool Lending: (£${mv} × 0.001 × ${bd}d) + ${rf} risk`
                        : toolExchangeMode === 'permanent'
                          ? `Permanent Swap: £${mv} × 1.2 ownership bonus`
                          : `Tool Gift: £${mv} × 1.2 generosity bonus`
                      : exType === 'service'
                        ? toolIsGift
                          ? `Tool Gifting: £${mv} × 1.2 generosity bonus`
                          : `Tool Borrowing: (£${mv} × 0.001 × ${bd}d) + ${rf} risk`
                        : `Skill: ${proficiency} × ${sessionHours.toFixed(1).replace(/\.0$/, '')}h × ${effectiveSessions} sessions`
                    }
                  </Typography>
                </Box>

                {/* Balance check */}
                <Box sx={{
                  mt: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1rem',
                  background: ceuValue > (user?.ceuBalance ?? 0) ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                  border: `1px solid ${ceuValue > (user?.ceuBalance ?? 0) ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                  borderRadius: '0.5rem',
                }}>
                  <i className="fas fa-coins" style={{ color: ceuValue > (user?.ceuBalance ?? 0) ? '#EF4444' : '#10B981', fontSize: '0.9rem' }} />
                  <Typography sx={{ fontSize: '0.875rem', fontFamily: 'Inter,sans-serif',
                    color: ceuValue > (user?.ceuBalance ?? 0) ? '#EF4444' : '#10B981', fontWeight: 600 }}>
                    Your balance: {(user?.ceuBalance ?? 0).toLocaleString()} CEU
                    {ceuValue > (user?.ceuBalance ?? 0) ? ` — you need ${ceuValue - (user?.ceuBalance ?? 0)} more CEU` : ` — sufficient ✓`}
                  </Typography>
                </Box>
              </SkillContainer></>}

              {/* Schedule Builder */}
              <SectionTitle icon="fa-calendar-alt">Exchange Schedule</SectionTitle>
              <SkillContainer>

                {/* Date + Time row (hidden for custom schedule) */}
                {recurring !== 'custom' && (
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' },
                    gap: '1rem', mb: '1.5rem',
                  }}>
                    <Box>
                      <FormLabel required>Start Date</FormLabel>
                      <FormInput value={startDate} onChange={setStartDate} type="date" />
                    </Box>
                    <Box>
                      <FormLabel required>From</FormLabel>
                      <FormInput value={timeStart} onChange={setTimeStart} type="time" />
                    </Box>
                    <Box>
                      <FormLabel required>To</FormLabel>
                      <FormInput value={timeEnd} onChange={setTimeEnd} type="time" />
                    </Box>
                  </Box>
                )}

                {/* Recurring options */}
                <FormLabel>Recurring Schedule</FormLabel>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '1.5rem' }}>
                  {[
                    { key: 'once',     label: 'One-time session',           icon: 'fa-calendar-day' },
                    { key: 'weekly',   label: 'Weekly (every week)',         icon: 'fa-redo' },
                    { key: 'biweekly', label: 'Bi-weekly (every 2 weeks)',   icon: 'fa-history' },
                    { key: 'custom',   label: 'Custom schedule',             icon: 'fa-sliders-h' },
                  ].map(opt => (
                    <Box key={opt.key}
                      onClick={() => setRecurring(opt.key)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                        padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid',
                        borderColor: recurring === opt.key ? '#4F46E5' : '#E5E7EB',
                        background: recurring === opt.key ? 'rgba(79,70,229,0.05)' : '#FFF',
                        transition: 'all 0.15s',
                      }}
                    >
                      <i className={`fas ${opt.icon}`} style={{ color: recurring === opt.key ? '#4F46E5' : '#9CA3AF', fontSize: '0.875rem', width: 16 }} />
                      <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', fontWeight: recurring === opt.key ? 600 : 400 }}>
                        {opt.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Number of Sessions — only for weekly / biweekly */}
                {(recurring === 'weekly' || recurring === 'biweekly') && (
                  <Box sx={{ mb: '1.5rem' }}>
                    <FormLabel>Number of Sessions</FormLabel>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => setSessions(s => Math.max(1, s - 1))}
                        style={{ width: 36, height: 36, borderRadius: '0.5rem', border: '1px solid #E5E7EB', background: '#FFF', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', lineHeight: 1 }}
                      >−</button>
                      <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', minWidth: 32, textAlign: 'center' }}>
                        {sessions}
                      </Typography>
                      <button
                        type="button"
                        onClick={() => setSessions(s => Math.min(12, s + 1))}
                        style={{ width: 36, height: 36, borderRadius: '0.5rem', border: '1px solid #E5E7EB', background: '#FFF', fontSize: '1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280', lineHeight: 1 }}
                      >+</button>
                      <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                        session{sessions !== 1 ? 's' : ''} · {recurring === 'weekly' ? `${sessions} week${sessions !== 1 ? 's' : ''}` : `${sessions * 2} weeks`} total
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Custom schedule rows */}
                {recurring === 'custom' && (
                  <Box sx={{ mb: '1.5rem' }}>
                    <FormLabel>Custom Sessions</FormLabel>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {customSessions.map((cs, idx) => (
                        <Box key={cs.id} sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr auto' },
                          gap: '0.625rem', alignItems: 'end',
                          padding: '0.875rem 1rem', background: '#FFF',
                          borderRadius: '0.5rem', border: '1px solid #E5E7EB',
                        }}>
                          <Box>
                            <FormLabel>Session {idx + 1} Date</FormLabel>
                            <FormInput
                              value={cs.date}
                              onChange={v => updateCustomSession(cs.id, 'date', v)}
                              type="date"
                            />
                          </Box>
                          <Box>
                            <FormLabel>From</FormLabel>
                            <FormInput
                              value={cs.timeStart}
                              onChange={v => updateCustomSession(cs.id, 'timeStart', v)}
                              type="time"
                            />
                          </Box>
                          <Box>
                            <FormLabel>To</FormLabel>
                            <FormInput
                              value={cs.timeEnd}
                              onChange={v => updateCustomSession(cs.id, 'timeEnd', v)}
                              type="time"
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'flex-end', pb: '2px' }}>
                            <button
                              type="button"
                              onClick={() => removeCustomSession(cs.id)}
                              disabled={customSessions.length === 1}
                              style={{
                                width: 36, height: 44, border: 'none', background: customSessions.length === 1 ? '#F3F4F6' : '#FEE2E2',
                                borderRadius: '0.5rem', cursor: customSessions.length === 1 ? 'not-allowed' : 'pointer',
                                color: customSessions.length === 1 ? '#D1D5DB' : '#EF4444', fontSize: '0.875rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            ><i className="fas fa-times" /></button>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    <button
                      type="button"
                      onClick={addCustomSession}
                      style={{
                        marginTop: '0.75rem', padding: '0.625rem 1.25rem',
                        border: '1px dashed #4F46E5', borderRadius: '0.5rem',
                        background: 'rgba(79,70,229,0.04)', color: '#4F46E5',
                        fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        fontFamily: 'Inter,sans-serif',
                      }}
                    >
                      <i className="fas fa-plus" />
                      Add Session
                    </button>
                  </Box>
                )}

                {/* Scheduled Sessions preview */}
                {(recurring !== 'custom' ? startDate : customSessions.some(s => s.date)) && (
                  <Box>
                    <FormLabel>Scheduled Sessions</FormLabel>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      {recurring === 'custom'
                        ? customSessions.map((cs, i) => {
                            const h = parseHours(cs.timeStart, cs.timeEnd);
                            const dateStr = cs.date
                              ? new Date(cs.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })
                              : 'Date TBD';
                            return (
                              <Box key={cs.id} sx={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem 1rem', background: '#FFF',
                                borderRadius: '0.5rem', border: '1px solid #E5E7EB',
                              }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                                    Session {i + 1}: {dateStr}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                                    {fmt12(cs.timeStart)} – {fmt12(cs.timeEnd)} · {(onlineVideo || onlineOnly) ? 'Online' : locType === 'public' ? publicPlace || 'Location TBD' : privatePlace || 'Private location'}
                                  </Typography>
                                </Box>
                                <Box sx={{ padding: '0.25rem 0.625rem', background: 'rgba(79,70,229,0.1)', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {h.toFixed(1).replace(/\.0$/, '')}h
                                </Box>
                              </Box>
                            );
                          })
                        : Array.from({ length: recurring === 'once' ? 1 : sessions }).map((_, i) => {
                            const d = new Date(startDate + 'T00:00:00');
                            if (recurring === 'weekly')   d.setDate(d.getDate() + i * 7);
                            if (recurring === 'biweekly') d.setDate(d.getDate() + i * 14);
                            const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });
                            return (
                              <Box key={i} sx={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '0.75rem 1rem', background: '#FFF',
                                borderRadius: '0.5rem', border: '1px solid #E5E7EB',
                              }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                                    Session {i + 1}: {dateStr}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                                    {fmt12(timeStart)} – {fmt12(timeEnd)} · {(onlineVideo || onlineOnly) ? 'Online' : locType === 'public' ? publicPlace || 'Location TBD' : privatePlace || 'Private location'}
                                  </Typography>
                                </Box>
                                <Box sx={{ padding: '0.25rem 0.625rem', background: 'rgba(79,70,229,0.1)', borderRadius: '0.375rem', fontSize: '0.75rem', color: '#4F46E5', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {sessionHours.toFixed(1).replace(/\.0$/, '')}h
                                </Box>
                              </Box>
                            );
                          })
                      }
                    </Box>
                  </Box>
                )}
              </SkillContainer>

              {/* ── CEU mode: live calculation after schedule is set ── */}
              {isCeuMode && (() => {
                const PROF_TAGS  = ['beginner', 'intermediate', 'expert'];
                const profTag    = targetPost?.tags.find(t => PROF_TAGS.includes(t.toLowerCase()));
                const postProf   = profTag
                  ? profTag.charAt(0).toUpperCase() + profTag.slice(1).toLowerCase()
                  : 'Intermediate';
                const profLevel  = PROFICIENCY_LEVELS.find(p => p.key === postProf)?.mult ?? 1.0;
                const skillMult  = 1.0;
                const perSession = Math.max(1, Math.round(sessionHours * skillMult * profLevel));
                const calcCeu    = targetPost?.ceuRate && targetPost.ceuRate > 0
                  ? targetPost.ceuRate
                  : perSession * Math.max(1, effectiveSessions);
                const usedRate   = !!(targetPost?.ceuRate && targetPost.ceuRate > 0);
                const rows = usedRate ? [] : [
                  { icon: 'fa-clock',         label: 'Session length',         value: `${sessionHours.toFixed(1).replace(/\.0$/, '')}h`,          note: `${fmt12(timeStart)} – ${fmt12(timeEnd)}` },
                  { icon: 'fa-star',          label: 'Skill multiplier',       value: `×${skillMult.toFixed(1)}`,                                  note: 'Base rate' },
                  { icon: 'fa-user-graduate', label: `Proficiency (${postProf})`, value: `×${profLevel.toFixed(1)}`,                               note: postProf === 'Expert' ? 'Expert +50%' : postProf === 'Beginner' ? 'Beginner −20%' : 'Standard' },
                  { icon: 'fa-coins',         label: 'CEU per session',        value: `${perSession} CEU`,                                         note: `${sessionHours.toFixed(1).replace(/\.0$/, '')} × ${skillMult.toFixed(1)} × ${profLevel.toFixed(1)} = ${perSession}` },
                  { icon: 'fa-layer-group',   label: 'Sessions',               value: `×${effectiveSessions}`,                                     note: `${effectiveSessions} session${effectiveSessions !== 1 ? 's' : ''}` },
                ];
                return (
                  <>
                  <SectionTitle icon="fa-coins">Exchange with CEU</SectionTitle>
                  <SkillContainer>
                    {/* Formula breakdown */}
                    <Box sx={{ mb: '1.25rem', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                      <Box sx={{ px: '1rem', py: '0.625rem', background: 'rgba(79,70,229,0.06)', borderBottom: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.78rem' }} />
                          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                            CEU calculated from provider's details
                          </Typography>
                        </Box>
                        <Box sx={{ fontSize: '0.68rem', color: '#10B981', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className="fas fa-sync-alt" style={{ fontSize: '0.6rem' }} />
                          Live
                        </Box>
                      </Box>
                      <Box sx={{ px: '1rem', pt: '0.75rem', pb: '0.625rem', background: '#FAFAFA' }}>
                        {usedRate ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', py: '0.375rem' }}>
                            <i className="fas fa-tag" style={{ color: '#10B981', fontSize: '0.7rem' }} />
                            <Typography sx={{ fontSize: '0.8rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
                              Provider set a fixed rate: <strong style={{ color: '#4F46E5' }}>{targetPost?.ceuRate} CEU</strong>
                            </Typography>
                          </Box>
                        ) : rows.map((row, i) => (
                          <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '0.35rem', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <i className={`fas ${row.icon}`} style={{ color: '#9CA3AF', fontSize: '0.65rem', width: 12 }} />
                              <Box>
                                <Typography sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{row.label}</Typography>
                                <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>{row.note}</Typography>
                              </Box>
                            </Box>
                            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap' }}>{row.value}</Typography>
                          </Box>
                        ))}
                        <Box sx={{ mt: '0.5rem', pt: '0.5rem', borderTop: '2px solid rgba(79,70,229,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Calculated total</Typography>
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.3rem', borderRadius: '2rem', background: GRAD, color: '#FFF', fontSize: '0.9rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>
                            <i className="fas fa-coins" style={{ fontSize: '0.75rem' }} /> {calcCeu} CEU
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Adjust stepper */}
                    {(() => {
                      const fairRatio   = calcCeu > 0 ? extraCeu / calcCeu : 1;
                      const isFair      = fairRatio >= 1.0;
                      const isSlightLow = fairRatio >= 0.8 && fairRatio < 1.0;
                      const isUnfair    = fairRatio < 0.8;
                      const stepperBorderColor = isUnfair ? '#EF4444' : isSlightLow ? '#F59E0B' : '#4F46E5';
                      const stepperBg          = isUnfair ? '#FEF2F2' : isSlightLow ? '#FFFBEB' : '#EEF2FF';
                      const inputColor         = isUnfair ? '#DC2626' : isSlightLow ? '#D97706' : '#4F46E5';
                      return (
                        <>
                        <Box sx={{ border: `1px solid ${isUnfair ? '#FECACA' : isSlightLow ? '#FDE68A' : '#E5E7EB'}`, borderRadius: '0.75rem', overflow: 'hidden', mb: '0.75rem' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '1rem', py: '0.625rem', background: '#F9FAFB', borderBottom: `1px solid ${isUnfair ? '#FECACA' : isSlightLow ? '#FDE68A' : '#E5E7EB'}` }}>
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', color: '#1F2937' }}>Adjust CEU if needed</Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Balance: <strong>{user?.ceuBalance ?? 0} CEU</strong></Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', px: '1rem', py: '0.75rem' }}>
                            <Box component="button" type="button" onClick={() => setExtraCeu(Math.max(1, extraCeu - 1))}
                              sx={{ width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${stepperBorderColor}`, background: '#FFF', color: inputColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', '&:hover': { background: stepperBg, borderColor: stepperBorderColor } }}>−</Box>
                            <Box sx={{ flex: 1, textAlign: 'center' }}>
                              <Box component="input" type="number" min={1} value={extraCeu}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setExtraCeu(Math.max(1, parseInt(e.target.value) || 1))}
                                sx={{ width: '100%', border: `1.5px solid ${stepperBorderColor}`, borderRadius: '0.5rem', textAlign: 'center', py: '0.375rem', px: '0.5rem', fontSize: '1.25rem', fontWeight: 700, color: inputColor, fontFamily: 'Poppins,sans-serif', outline: 'none', background: stepperBg, '&:focus': { boxShadow: `0 0 0 3px ${isUnfair ? 'rgba(239,68,68,0.12)' : isSlightLow ? 'rgba(245,158,11,0.12)' : 'rgba(79,70,229,0.1)'}` }, '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': { '-webkit-appearance': 'none' } }} />
                              <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.125rem' }}>CEU you will pay</Typography>
                            </Box>
                            <Box component="button" type="button" onClick={() => setExtraCeu(extraCeu + 1)}
                              sx={{ width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${stepperBorderColor}`, background: stepperBg, color: inputColor, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.125rem', fontWeight: 700, flexShrink: 0, transition: 'all 0.15s', '&:hover': { background: stepperBorderColor, color: '#FFF' } }}>+</Box>
                          </Box>
                        </Box>

                        {/* Fairness warning strip */}
                        {!isFair && (
                          <Box sx={{ mb: '1rem', px: '0.875rem', py: '0.625rem', borderRadius: '0.625rem', border: `1px solid ${isUnfair ? '#FECACA' : '#FDE68A'}`, background: isUnfair ? '#FEF2F2' : '#FFFBEB', display: 'flex', alignItems: 'flex-start', gap: '0.625rem' }}>
                            <i className={`fas ${isUnfair ? 'fa-times-circle' : 'fa-exclamation-triangle'}`} style={{ color: isUnfair ? '#EF4444' : '#F59E0B', fontSize: '0.875rem', marginTop: '0.125rem', flexShrink: 0 }} />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: isUnfair ? '#DC2626' : '#D97706', fontFamily: 'Inter,sans-serif', mb: '0.125rem' }}>
                                {isUnfair ? 'Unfair exchange' : 'Slightly below fair value'}
                              </Typography>
                              <Typography sx={{ fontSize: '0.75rem', color: isUnfair ? '#B91C1C' : '#B45309', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                                {isUnfair
                                  ? <>The calculated fair value is <strong>{calcCeu} CEU</strong>. Your offer of {extraCeu} CEU is significantly lower — the provider may decline.</>
                                  : <>The calculated fair value is <strong>{calcCeu} CEU</strong>. You're offering {calcCeu - extraCeu} CEU less than recommended.</>}
                              </Typography>
                            </Box>
                            <Box component="button" type="button" onClick={() => setExtraCeu(calcCeu)}
                              sx={{ flexShrink: 0, px: '0.625rem', py: '0.3rem', borderRadius: '0.375rem', border: `1px solid ${isUnfair ? '#FECACA' : '#FDE68A'}`, background: '#FFF', color: isUnfair ? '#DC2626' : '#D97706', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { background: isUnfair ? '#FEE2E2' : '#FEF3C7' } }}>
                              Use {calcCeu} CEU
                            </Box>
                          </Box>
                        )}

                        {/* Pay banner */}
                        <Box sx={{ background: isFair ? GRAD : isSlightLow ? 'linear-gradient(135deg,#F59E0B,#FBBF24)' : 'linear-gradient(135deg,#EF4444,#F87171)', color: '#FFF', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <i className="fas fa-coins" style={{ fontSize: '1.25rem' }} />
                            <Box sx={{ fontFamily: 'Poppins,sans-serif' }}>
                              <Box sx={{ fontSize: '0.78rem', opacity: 0.85 }}>You will pay</Box>
                              <Box sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 }}>{extraCeu} CEU</Box>
                            </Box>
                          </Box>
                          <Box sx={{ fontSize: '0.78rem', textAlign: 'right', fontFamily: 'Inter,sans-serif' }}>
                            {extraCeu > (user?.ceuBalance ?? 0) ? (
                              <><span style={{ opacity: 0.9 }}>⚠️ Insufficient balance</span><br /><strong>Need {extraCeu - (user?.ceuBalance ?? 0)} more CEU</strong></>
                            ) : isFair ? (
                              <><i className="fas fa-check-circle" style={{ marginRight: '0.25rem' }} />Fair exchange<br /><strong style={{ opacity: 0.85 }}>Balance: {(user?.ceuBalance ?? 0).toLocaleString()} CEU</strong></>
                            ) : isSlightLow ? (
                              <><i className="fas fa-exclamation-triangle" style={{ marginRight: '0.25rem' }} />Slightly low<br /><strong>Fair value: {calcCeu} CEU</strong></>
                            ) : (
                              <><i className="fas fa-times-circle" style={{ marginRight: '0.25rem' }} />Unfair offer<br /><strong>Fair value: {calcCeu} CEU</strong></>
                            )}
                          </Box>
                        </Box>
                        </>
                      );
                    })()}
                  </SkillContainer>
                  </>
                );
              })()}
            </Box>
          )}

          {/* ══════════════ STEP 4: REVIEW & POST ══════════════ */}
          {step === 3 && (
            <Box>
              <SectionTitle icon="fa-clipboard-check">Review & Confirmation</SectionTitle>

              {/* Summary */}
              <SkillContainer>
                <Typography sx={{ fontWeight: 600, color: '#4F46E5', mb: '1rem', fontFamily: 'Poppins,sans-serif', fontSize: '1rem' }}>
                  Exchange Summary
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.5rem', mb: '1.5rem' }}>
                  {[
                    {
                      label: 'Exchange Type',
                      value: EXCHANGE_TYPES.find(t => t.key === exType)?.label || exType,
                    },
                    ...(!modal && exType !== 'skill' ? [{
                      label: 'CEU Value',
                      value: `${ceuValue} CEU each`,
                      highlight: true,
                    }] : []),
                    {
                      label: 'Your Offering',
                      value: `${offerTitle} (${proficiency})`,
                    },
                    {
                      label: 'Skills Wanted',
                      value: wantedSkills.filter(s => s.name.trim()).map(s => s.name).join(', ') || '—',
                    },
                    {
                      label: 'Exchange Location & Schedule',
                      value: `${(onlineVideo || onlineOnly) ? 'Online meeting' : locType === 'public' ? publicPlace || 'Public place TBD' : privatePlace || 'Private location'} · ${
                        recurring === 'custom'
                          ? `${customSessions.length} custom session${customSessions.length !== 1 ? 's' : ''}`
                          : `${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date TBD'} · ${effectiveSessions} session${effectiveSessions !== 1 ? 's' : ''}`
                      } · ${fmt12(timeStart)} – ${fmt12(timeEnd)}`,
                    },
                    {
                      label: 'Public Terms',
                      value: terms.trim() || 'No specific terms',
                      italic: true,
                    },
                  ].map(item => (
                    <Box key={item.label}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase',
                        letterSpacing: '0.05em', fontWeight: 600, mb: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{
                        fontSize: '0.875rem', color: item.highlight ? '#4F46E5' : '#1F2937',
                        fontWeight: item.highlight ? 700 : 500,
                        fontStyle: item.italic ? 'italic' : 'normal',
                        fontFamily: 'Inter,sans-serif', lineHeight: 1.5,
                      }}>
                        {item.value}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                {/* Description preview */}
                {offerDesc.trim() && (
                  <Box sx={{ pt: '1rem', borderTop: '1px solid #E5E7EB' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase',
                      letterSpacing: '0.05em', fontWeight: 600, mb: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                      Offering Description
                    </Typography>
                    <Box sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: 'Inter,sans-serif',
                      lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                      {offerDesc}
                    </Box>
                  </Box>
                )}
              </SkillContainer>


              {/* CEU deduction warning — hidden for skill-swap and skill-for-skill */}
              {!modal && exType !== 'skill' && (
                <Box sx={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '1rem', background: 'rgba(79,70,229,0.06)',
                  border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.5rem', mb: '1rem',
                }}>
                  <i className="fas fa-info-circle" style={{ color: '#4F46E5', fontSize: '1rem', flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                    <strong>{ceuValue} CEU</strong> will be deducted from your balance when this exchange is posted.
                    Your current balance is <strong>{(user?.ceuBalance ?? 0).toLocaleString()} CEU</strong>.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── Form Actions ── */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: { xs: '1.25rem 1.5rem', sm: '1.5rem 2rem' },
          borderTop: '1px solid #E5E7EB', background: '#F9FAFB',
          flexWrap: 'wrap', gap: '0.75rem',
        }}>
          {/* Left: Previous */}
          <Box>
            {step > 0 && (
              <Box component="button" type="button" onClick={goPrev} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.5rem',
                background: 'transparent', color: '#1F2937',
                border: '1px solid #E5E7EB', fontSize: '0.875rem', fontWeight: 500,
                cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5', color: '#4F46E5' },
              }}>
                <i className="fas fa-arrow-left" /> Previous
              </Box>
            )}
          </Box>

          {/* Right: Save Draft + Next/Post */}
          <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Box component="button" type="button" onClick={() => navigate('/my-exchanges')} sx={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.875rem 2rem', borderRadius: '0.5rem',
              background: '#FFF', color: '#4F46E5',
              border: '1px solid #E5E7EB', fontSize: '0.875rem', fontWeight: 500,
              cursor: 'pointer', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
              '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5' },
            }}>
              <i className="fas fa-save" /> Save Draft
            </Box>

            {step < 3 ? (
              <Box component="button" type="button" onClick={goNext} disabled={isAnyScanning} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.5rem',
                background: isAnyScanning ? '#D1D5DB' : GRAD, color: '#FFF', border: 'none',
                fontSize: '0.875rem', fontWeight: 500, cursor: isAnyScanning ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                '&:hover': isAnyScanning ? {} : { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
              }}>
                {isAnyScanning
                  ? <><i className="fas fa-spinner fa-spin" /> Scanning media…</>
                  : <>Next Step <i className="fas fa-arrow-right" /></>}
              </Box>
            ) : (
              <Box component="button" type="button" onClick={handlePost} disabled={mutation.isPending || isAnyScanning} sx={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.875rem 2rem', borderRadius: '0.5rem',
                background: GRAD, color: '#FFF', border: 'none',
                fontSize: '0.875rem', fontWeight: 600, cursor: (mutation.isPending || isAnyScanning) ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter,sans-serif', transition: 'all 0.2s',
                opacity: (mutation.isPending || isAnyScanning) ? 0.7 : 1,
                '&:hover': !(mutation.isPending || isAnyScanning) ? { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' } : {},
              }}>
                {mutation.isPending
                  ? <><i className="fas fa-spinner fa-spin" /> Posting…</>
                  : isAnyScanning
                  ? <><i className="fas fa-spinner fa-spin" /> Scanning media…</>
                  : <><i className="fas fa-paper-plane" /> Post Exchange</>
                }
              </Box>
            )}
          </Box>
        </Box>
      </Box>
      </>}
    </Box>
  );

  if (modal) {
    return (
      <Dialog
        open={open ?? false}
        onClose={onClose}
        fullWidth
        maxWidth="lg"
        scroll="paper"
        PaperProps={{ sx: { borderRadius: '1rem', maxHeight: '92vh' } }}
      >
        {/* Close button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '1.5rem', pt: '1rem', pb: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Box sx={{ width: 36, height: 36, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '1rem' }}>
              <i className="fas fa-exchange-alt" />
            </Box>
            <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '1.25rem', color: '#1F2937' }}>
              {modalTitle ?? 'Request Skill Swap'}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: '#6B7280' }}>
            <i className="fas fa-times" style={{ fontSize: '1rem' }} />
          </IconButton>
        </Box>
        <DialogContent sx={{ pt: '0.5rem' }}>
          {pageContent}
        </DialogContent>
      </Dialog>
    );
  }

  return <Layout>{pageContent}</Layout>;
};

export default CreateExchange;
