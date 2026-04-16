import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Skeleton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  CircularProgress,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Autocomplete,
  Snackbar,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { User, Post, Exchange } from '../types';
import VideoIntroModal from '../components/VideoIntroModal';

// ─── Gradient pool for tool cards ─────────────────────────────────────────────
const TOOL_GRADIENTS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1.25rem', textAlign: 'center' }}>
    <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins, sans-serif', lineHeight: 1.2, mb: '0.25rem' }}>
      {value}
    </Typography>
    <Typography sx={{ fontSize: '0.875rem', color: '#6B7280' }}>{label}</Typography>
  </Box>
);

const Section: React.FC<{ icon: string; title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, action, children }) => (
  <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.5rem', mb: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '1.5rem', pb: '0.75rem', borderBottom: '2px solid #F9FAFB' }}>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 600, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Poppins, sans-serif' }}>
        <i className={`fas ${icon}`} style={{ color: '#4F46E5' }} />
        {title}
      </Typography>
      {action && <Box sx={{ display: 'flex', gap: '0.5rem' }}>{action}</Box>}
    </Box>
    {children}
  </Box>
);

// ─── Inline edit modals ────────────────────────────────────────────────────────

const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const AVAILABILITY_OPTIONS = ['Flexible', 'Weekdays', 'Weekends', 'Evenings', 'Mornings', 'Anytime', 'By Appointment'];
const SKILL_TYPES = ['Teaching', 'Exchange', 'Both', 'Other'];
const INTEREST_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const INTEREST_CATEGORIES = ['Music', 'Gardening', 'Cooking', 'Art', 'Technology', 'Fitness', 'Languages', 'Photography', 'Crafts', 'Sports', 'Other'];

const SKILL_SUGGESTIONS = [
  'Guitar', 'Piano', 'Drums', 'Violin', 'Singing', 'Music Production',
  'Web Development', 'Python', 'JavaScript', 'Data Analysis', 'UI/UX Design', 'Graphic Design',
  'Photography', 'Video Editing', 'Drawing', 'Painting', 'Sculpture',
  'Cooking', 'Baking', 'Meal Prep', 'Gardening', 'Beekeeping', 'Composting',
  'Yoga', 'Pilates', 'Personal Training', 'Meditation', 'Martial Arts',
  'Carpentry', 'Plumbing', 'Electrical Work', 'Welding', 'Knitting', 'Sewing',
  'Spanish', 'French', 'Mandarin', 'Arabic', 'Sign Language',
  'Tutoring', 'Math', 'Science', 'History', 'Creative Writing',
  'First Aid', 'Dog Training', 'Child Care', 'Elder Care', 'Massage Therapy',
];

const INTEREST_SUGGESTIONS = [
  'Guitar', 'Piano', 'Drums', 'Violin', 'Singing', 'Music Production',
  'Web Development', 'Python', 'JavaScript', 'Data Analysis', 'UI/UX Design', 'Graphic Design',
  'Photography', 'Video Editing', 'Drawing', 'Painting', 'Pottery',
  'Cooking', 'Baking', 'Meal Prep', 'Gardening', 'Beekeeping', 'Composting',
  'Yoga', 'Pilates', 'Personal Training', 'Meditation', 'Martial Arts',
  'Carpentry', 'Plumbing', 'Electrical Work', 'Knitting', 'Sewing', 'Embroidery',
  'Spanish', 'French', 'Mandarin', 'Arabic', 'Sign Language',
  'Tutoring', 'Math', 'Science', 'History', 'Creative Writing',
  'First Aid', 'Dog Training', 'Child Care', 'Massage Therapy',
];

type SkillEntry = { name: string; type: string; description: string; proficiency: string; availability: string; rate: string };
type InterestEntry = { name: string; category: string; description: string; level: string; willingToPay: string };

const inputSx = { '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.8125rem' } };

const SkillsEditModal: React.FC<{
  open: boolean;
  initialSkills: SkillEntry[];
  onClose: () => void;
  onSave: (skills: SkillEntry[]) => Promise<void>;
}> = ({ open, initialSkills, onClose, onSave }) => {
  const [skills, setSkills] = useState<SkillEntry[]>(initialSkills);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { if (open) { setSkills(initialSkills); setSearchValue(''); setHighlightedIdx(null); } }, [open]);

  // All options: user's own skills first (always shown), then global suggestions
  const allOptions = Array.from(new Set([...skills.map(s => s.name), ...SKILL_SUGGESTIONS]));

  const handleSelect = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const existing = skills.findIndex(s => s.name.toLowerCase() === n.toLowerCase());
    if (existing !== -1) {
      // Highlight and scroll to the existing card
      setHighlightedIdx(existing);
      setSearchValue('');
      setTimeout(() => {
        cardRefs.current[existing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedIdx(null), 2000);
      }, 50);
    } else {
      // Add as new card
      setSkills(prev => [...prev, { name: n, type: 'Teaching', description: '', proficiency: 'Intermediate', availability: 'Flexible', rate: '' }]);
      setSearchValue('');
      setTimeout(() => {
        setHighlightedIdx(skills.length);
        cardRefs.current[skills.length]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedIdx(null), 2000);
      }, 50);
    }
  };

  const update = (i: number, patch: Partial<SkillEntry>) =>
    setSkills(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const remove = (i: number) => { setSkills(prev => prev.filter((_, idx) => idx !== i)); setHighlightedIdx(null); };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(skills); onClose(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '0.75rem' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
        Edit Skills Offered
        <IconButton size="small" onClick={onClose}><i className="fas fa-times" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: '1rem', pt: '1rem' }}>
        {/* Search bar — finds existing or adds new */}
        <Autocomplete
          freeSolo
          options={allOptions}
          inputValue={searchValue}
          onInputChange={(_, v) => setSearchValue(v)}
          onChange={(_, v) => { if (v) handleSelect(v as string); }}
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="Search your skills or add a new one…" sx={inputSx}
              onKeyDown={e => { if (e.key === 'Enter' && searchValue.trim()) { e.preventDefault(); handleSelect(searchValue); } }}
              InputProps={{ ...params.InputProps, startAdornment: <i className="fas fa-search" style={{ color: '#9CA3AF', marginRight: 6, fontSize: '0.8rem' }} /> }}
            />
          )}
        />

        {/* Skill cards */}
        {skills.map((skill, i) => (
          <Box key={i} ref={(el: HTMLDivElement | null) => { cardRefs.current[i] = el; }}
            sx={{ background: highlightedIdx === i ? '#EEF2FF' : '#F9FAFB', border: `1px solid ${highlightedIdx === i ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', p: '1rem', position: 'relative', transition: 'all 0.3s' }}>
            <IconButton size="small" onClick={() => remove(i)}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#9CA3AF', '&:hover': { color: '#EF4444', background: '#FEF2F2' } }}>
              <i className="fas fa-times" style={{ fontSize: '0.75rem' }} />
            </IconButton>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', mb: '0.75rem', pr: '2rem' }}>{skill.name}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '0.625rem' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={skill.type || 'Teaching'} onChange={e => update(i, { type: e.target.value })} sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                  {SKILL_TYPES.map(t => <MenuItem key={t} value={t} sx={{ fontSize: '0.8125rem' }}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" fullWidth label="CEU Rate" placeholder="e.g. 25/hr"
                value={skill.rate} onChange={e => update(i, { rate: e.target.value })} sx={inputSx} />
            </Box>
            <TextField size="small" fullWidth label="Description" placeholder="What will you teach?"
              value={skill.description} onChange={e => update(i, { description: e.target.value })} sx={{ ...inputSx, mb: '0.625rem' }} />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Proficiency</InputLabel>
                <Select label="Proficiency" value={skill.proficiency || 'Intermediate'} onChange={e => update(i, { proficiency: e.target.value })} sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                  {PROFICIENCY_LEVELS.map(l => <MenuItem key={l} value={l} sx={{ fontSize: '0.8125rem' }}>{l}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Availability</InputLabel>
                <Select label="Availability" value={skill.availability || 'Flexible'} onChange={e => update(i, { availability: e.target.value })} sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                  {AVAILABILITY_OPTIONS.map(a => <MenuItem key={a} value={a} sx={{ fontSize: '0.8125rem' }}>{a}</MenuItem>)}
                </Select>
              </FormControl>
            </Box>
          </Box>
        ))}
        {skills.length === 0 && (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', py: '1rem' }}>No skills yet. Search above to add one.</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: '1.5rem', py: '1rem' }}>
        <Button onClick={onClose} sx={{ color: '#6B7280', textTransform: 'none' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          sx={{ background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff', borderRadius: '0.5rem', textTransform: 'none', fontWeight: 600 }}>
          {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const InterestsEditModal: React.FC<{
  open: boolean;
  initialInterests: InterestEntry[];
  onClose: () => void;
  onSave: (interests: InterestEntry[]) => Promise<void>;
}> = ({ open, initialInterests, onClose, onSave }) => {
  const [interests, setInterests] = useState<InterestEntry[]>(initialInterests);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { if (open) { setInterests(initialInterests); setSearchValue(''); setHighlightedIdx(null); } }, [open]);

  const allOptions = Array.from(new Set([...interests.map(e => e.name), ...INTEREST_SUGGESTIONS]));

  const handleSelect = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const existing = interests.findIndex(e => e.name.toLowerCase() === n.toLowerCase());
    if (existing !== -1) {
      setHighlightedIdx(existing);
      setSearchValue('');
      setTimeout(() => {
        cardRefs.current[existing]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedIdx(null), 2000);
      }, 50);
    } else {
      setInterests(prev => [...prev, { name: n, category: 'Other', description: '', level: 'Beginner', willingToPay: '' }]);
      setSearchValue('');
      setTimeout(() => {
        setHighlightedIdx(interests.length);
        cardRefs.current[interests.length]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedIdx(null), 2000);
      }, 50);
    }
  };

  const update = (i: number, patch: Partial<InterestEntry>) =>
    setInterests(prev => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));

  const remove = (i: number) => { setInterests(prev => prev.filter((_, idx) => idx !== i)); setHighlightedIdx(null); };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(interests); onClose(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '0.75rem' } }}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, fontFamily: 'Poppins, sans-serif', fontWeight: 700 }}>
        Edit Skills I Want to Learn
        <IconButton size="small" onClick={onClose}><i className="fas fa-times" /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: '1rem', pt: '1rem' }}>
        <Autocomplete
          freeSolo
          options={allOptions}
          inputValue={searchValue}
          onInputChange={(_, v) => setSearchValue(v)}
          onChange={(_, v) => { if (v) handleSelect(v as string); }}
          renderInput={(params) => (
            <TextField {...params} size="small" placeholder="Search your interests or add a new one…" sx={inputSx}
              onKeyDown={e => { if (e.key === 'Enter' && searchValue.trim()) { e.preventDefault(); handleSelect(searchValue); } }}
              InputProps={{ ...params.InputProps, startAdornment: <i className="fas fa-search" style={{ color: '#9CA3AF', marginRight: 6, fontSize: '0.8rem' }} /> }}
            />
          )}
        />

        {interests.map((entry, i) => (
          <Box key={i} ref={(el: HTMLDivElement | null) => { cardRefs.current[i] = el; }}
            sx={{ background: highlightedIdx === i ? '#ECFDF5' : '#F9FAFB', border: `1px solid ${highlightedIdx === i ? '#10B981' : '#E5E7EB'}`, borderRadius: '0.5rem', p: '1rem', position: 'relative', transition: 'all 0.3s' }}>
            <IconButton size="small" onClick={() => remove(i)}
              sx={{ position: 'absolute', top: 8, right: 8, color: '#9CA3AF', '&:hover': { color: '#EF4444', background: '#FEF2F2' } }}>
              <i className="fas fa-times" style={{ fontSize: '0.75rem' }} />
            </IconButton>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', mb: '0.75rem', pr: '2rem' }}>{entry.name}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '0.625rem' }}>
              <FormControl size="small" fullWidth>
                <InputLabel>Category</InputLabel>
                <Select label="Category" value={entry.category || 'Other'} onChange={e => update(i, { category: e.target.value })} sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                  {INTEREST_CATEGORIES.map(c => <MenuItem key={c} value={c} sx={{ fontSize: '0.8125rem' }}>{c}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" fullWidth label="Willing to pay" placeholder="e.g. 20/hr"
                value={entry.willingToPay} onChange={e => update(i, { willingToPay: e.target.value })} sx={inputSx} />
            </Box>
            <TextField size="small" fullWidth label="What do you want to learn?" placeholder="e.g. Basic chords…"
              value={entry.description} onChange={e => update(i, { description: e.target.value })} sx={{ ...inputSx, mb: '0.625rem' }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Your Level</InputLabel>
              <Select label="Your Level" value={entry.level || 'Beginner'} onChange={e => update(i, { level: e.target.value })} sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                {INTEREST_LEVELS.map(l => <MenuItem key={l} value={l} sx={{ fontSize: '0.8125rem' }}>{l}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        ))}
        {interests.length === 0 && (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', py: '1rem' }}>Nothing yet. Search above to add one.</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: '1.5rem', py: '1rem' }}>
        <Button onClick={onClose} sx={{ color: '#6B7280', textTransform: 'none' }}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving} variant="contained"
          sx={{ background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff', borderRadius: '0.5rem', textTransform: 'none', fontWeight: 600 }}>
          {saving ? <CircularProgress size={16} color="inherit" /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const SectionIconBtn: React.FC<{ icon: string; onClick?: () => void }> = ({ icon, onClick }) => (
  <Box component="button" onClick={onClick} sx={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', p: '0.5rem', borderRadius: '0.375rem', fontSize: '0.875rem', transition: 'all 0.2s', '&:hover': { color: '#4F46E5', background: '#F3F4F6' } }}>
    <i className={`fas ${icon}`} />
  </Box>
);

const RankingCard: React.FC<{ icon: string; title: string; tier: string; progress: number; sub: string }> = ({ icon, title, tier, progress, sub }) => (
  <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1.25rem', textAlign: 'center', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)' } }}>
    <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', mx: 'auto', mb: '1rem' }}>
      <i className={`fas ${icon}`} />
    </Box>
    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.5rem' }}>{title}</Typography>
    <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, color: '#4F46E5', mb: '0.5rem' }}>{tier}</Typography>
    <LinearProgress variant="determinate" value={progress} sx={{ height: 4, borderRadius: 2, background: '#E5E7EB', '& .MuiLinearProgress-bar': { background: 'linear-gradient(135deg, #4F46E5, #10B981)', borderRadius: 2 } }} />
    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: '0.5rem' }}>{sub}</Typography>
  </Box>
);

const BadgeCard: React.FC<{ icon: string; name: string; desc: string }> = ({ icon, name, desc }) => (
  <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)' } }}>
    <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', mx: 'auto', mb: '0.75rem' }}>
      <i className={`fas ${icon}`} />
    </Box>
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1F2937', mb: '0.25rem' }}>{name}</Typography>
    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{desc}</Typography>
  </Box>
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Compute tier label + progress % for a numeric value against thresholds */
const getTier = (count: number, silver: number, gold: number): { tier: string; progress: number } => {
  if (count >= gold)   return { tier: 'Gold Tier',   progress: 100 };
  if (count >= silver) return { tier: 'Silver Tier', progress: Math.round((count / gold) * 100) };
  return { tier: 'Bronze Tier', progress: Math.round((count / silver) * 100) };
};

// ─── Main component ────────────────────────────────────────────────────────────

const MyProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [savedVideoUrl, setSavedVideoUrl]   = useState<string | null>(null);
  const [skillsModalOpen, setSkillsModalOpen]       = useState(false);
  const [interestsModalOpen, setInterestsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShareProfile = () => {
    const url = `${window.location.origin}/profile/${profile?._id}`;
    if (navigator.share) {
      navigator.share({ title: `${profile?.name}'s Profile`, url }).catch(() => {});
      return;
    }
    // Show toast immediately, then attempt copy
    setCopied(true);
    navigator.clipboard?.writeText(url).catch(() => {
      try {
        const el = document.createElement('textarea');
        el.value = url; el.style.position = 'fixed'; el.style.opacity = '0';
        document.body.appendChild(el); el.focus(); el.select();
        document.execCommand('copy'); document.body.removeChild(el);
      } catch (_) { /* silent */ }
    });
  };

  const saveSection = async (patch: Record<string, unknown>) => {
    await api.put('/users/me', patch);
    queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
  };

  const profileId = (!id || id === 'me') ? currentUser?._id : id;
  const isOwnProfile = !id || id === 'me' || id === currentUser?._id;

  // ── Data fetching ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery<User>({
    queryKey: ['profile', profileId],
    queryFn: () => api.get(`/users/${profileId}`).then((r) => r.data),
    enabled: !!profileId,
  });

  const { data: postsData } = useQuery<{ posts: Post[] }>({
    queryKey: ['userPosts', profileId],
    queryFn: () => api.get(`/users/${profileId}/posts`).then((r) => r.data),
    enabled: !!profileId,
  });

  const { data: exchangesData } = useQuery<{ exchanges: Exchange[] }>({
    queryKey: ['userExchanges', profileId],
    queryFn: () => api.get(`/users/${profileId}/exchanges`).then((r) => r.data),
    enabled: !!profileId,
  });

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (profileLoading || !profile) {
    return (
      <Layout>
        <Box sx={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '2rem', mb: '1.5rem' }}>
          <Box sx={{ display: 'flex', gap: '1.5rem', mb: '2rem' }}>
            <Skeleton variant="circular" width={120} height={120} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="40%" height={40} />
              <Skeleton variant="text" width="25%" height={24} sx={{ mt: 1 }} />
              <Skeleton variant="text" width="60%" height={24} sx={{ mt: 1 }} />
            </Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: '1rem' }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={80} />)}
          </Box>
        </Box>
        {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={200} sx={{ mb: '1.5rem', borderRadius: '0.75rem' }} />)}
      </Layout>
    );
  }

  // ── Derived data ─────────────────────────────────────────────────────────────
  const skillPosts       = postsData?.posts?.filter((p) => p.type === 'skill') ?? [];
  const toolPosts        = postsData?.posts?.filter((p) => p.type === 'tool' || p.type === 'gift') ?? [];
  const eventPosts       = postsData?.posts?.filter((p) => p.type === 'event') ?? [];
  const allPosts         = postsData?.posts ?? [];
  const allExchanges     = exchangesData?.exchanges ?? [];
  const completedExchanges = allExchanges.filter((e) => e.status === 'completed');
  const hasLocation      = profile.location?.city || profile.location?.neighbourhood;

  // Exchanges started by this user — for "Skills I Want to Learn"
  const seekingExchanges = allExchanges.filter(
    (ex) => (ex.requester as unknown as User)?._id === profileId,
  );

  const memberSince = profile.createdAt
    ? format(new Date(profile.createdAt as unknown as string), 'MMMM yyyy')
    : null;

  // ── Ranking data — only show cards with actual data ───────────────────────────
  const rankingCards: Array<{ icon: string; title: string; tier: string; progress: number; sub: string }> = [];

  if (profile.exchangeCount > 0) {
    const r = getTier(profile.exchangeCount, 10, 20);
    rankingCards.push({ icon: 'fa-medal', title: 'Overall Rank', tier: r.tier, progress: r.progress, sub: `${profile.exchangeCount} exchanges completed` });
  }
  if (profile.skills.length > 0) {
    const r = getTier(profile.skills.length, 3, 5);
    rankingCards.push({ icon: 'fa-chalkboard-teacher', title: 'Skill Teacher', tier: r.tier, progress: r.progress, sub: `${profile.skills.length} skill${profile.skills.length !== 1 ? 's' : ''} listed` });
  }
  if (toolPosts.length > 0) {
    const r = getTier(toolPosts.length, 2, 5);
    rankingCards.push({ icon: 'fa-tools', title: 'Tool Lender', tier: r.tier, progress: r.progress, sub: `${toolPosts.length} tools listed` });
  }
  if (profile.trustScore > 0) {
    const r = getTier(profile.trustScore, 50, 80);
    rankingCards.push({ icon: 'fa-comments', title: 'Q&A Contributor', tier: r.tier, progress: r.progress, sub: `${profile.trustScore}% trust score` });
  }

  // ── Earned badges ─────────────────────────────────────────────────────────────
  const earnedBadges: Array<{ icon: string; name: string; desc: string }> = [];
  if (profile.isVerified)              earnedBadges.push({ icon: 'fa-check-circle',   name: 'Verified User',    desc: 'Email verified' });
  if (profile.exchangeCount >= 1)      earnedBadges.push({ icon: 'fa-handshake',      name: 'First Exchange',   desc: 'Completed 1st exchange' });
  if (profile.exchangeCount >= 10)     earnedBadges.push({ icon: 'fa-star',           name: 'Community Star',   desc: '10+ exchanges' });
  if (profile.skills.length >= 3)      earnedBadges.push({ icon: 'fa-graduation-cap', name: 'Skill Expert',     desc: '3+ skills listed' });
  if (toolPosts.length >= 1)           earnedBadges.push({ icon: 'fa-tools',          name: 'Tool Sharer',      desc: 'Listed a tool' });
  if (profile.trustScore >= 80)        earnedBadges.push({ icon: 'fa-shield-alt',     name: 'Trusted Member',   desc: '80%+ trust score' });

  // ── Recent Activity timeline ─────────────────────────────────────────────────
  type ActivityItem = {
    id: string;
    icon: string;
    title: string;
    description: string;
    date: Date;
  };

  const activityItems: ActivityItem[] = [
    ...allExchanges.slice(0, 10).map((ex) => {
      const other = (ex.requester as unknown as User)?._id === profileId
        ? (ex.provider as unknown as User)?.name ?? 'someone'
        : (ex.requester as unknown as User)?.name ?? 'someone';
      const statusLabel = ex.status === 'completed' ? 'Completed exchange' : ex.status === 'active' ? 'Exchange in progress' : 'Exchange requested';
      const icon = ex.status === 'completed' ? 'fa-exchange-alt' : ex.status === 'active' ? 'fa-check' : 'fa-paper-plane';
      return {
        id: `ex-${ex._id}`,
        icon,
        title: statusLabel,
        description: `${ex.title ?? 'Exchange'} with ${other}.`,
        date: new Date(ex.updatedAt as unknown as string ?? ex.createdAt as unknown as string),
      };
    }),
    ...allPosts.slice(0, 10).map((post) => {
      const typeLabels: Record<string, string> = { skill: 'Posted a skill', tool: 'Listed a tool', event: 'Created an event', question: 'Posted a question', offer: 'Posted an offer' };
      const typeIcons: Record<string, string>  = { skill: 'fa-graduation-cap', tool: 'fa-tools', event: 'fa-calendar', question: 'fa-question-circle', offer: 'fa-tag' };
      return {
        id: `post-${post._id}`,
        icon: typeIcons[post.type] ?? 'fa-file-alt',
        title: typeLabels[post.type] ?? 'New post',
        description: post.title,
        date: new Date(post.createdAt as unknown as string),
      };
    }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);

  // ── CEU transaction list — all exchanges, with direction ─────────────────────
  const ceuTransactions = allExchanges.map((ex) => {
    const isRequester = (ex.requester as unknown as User)?._id === profileId;
    const other = isRequester
      ? (ex.provider as unknown as User)?.name ?? 'Neighbour'
      : (ex.requester as unknown as User)?.name ?? 'Neighbour';
    const ceu = isRequester ? (ex.ceuValue ?? 0) : (ex.providerCeuValue ?? ex.ceuValue ?? 0);
    // Requester spends CEU; provider earns CEU (on completion)
    const isEarned = !isRequester && ex.status === 'completed';
    const isSpent  =  isRequester && ex.status === 'completed';
    const positive = isEarned;
    const icon = ex.title?.toLowerCase().includes('tool') ? 'fa-tools' : 'fa-exchange-alt';
    return {
      id: ex._id,
      exchangeId: ex._id,
      icon,
      title: ex.title ?? 'Exchange',
      partner: other,
      status: ex.status,
      time: formatDistanceToNow(
        new Date((ex.updatedAt ?? ex.createdAt) as unknown as string),
        { addSuffix: true },
      ),
      amount: isEarned ? `+${ceu} CEU` : isSpent ? `-${ceu} CEU` : `${ceu} CEU`,
      positive,
    };
  });

  // ── Button styles ─────────────────────────────────────────────────────────────
  const gradientBtn = {
    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.875rem',
    px: '1.5rem',
    py: '0.75rem',
    borderRadius: '0.5rem',
    textTransform: 'none' as const,
    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  };
  const outlinedBtn = {
    background: '#F9FAFB',
    color: '#1F2937',
    fontWeight: 500,
    fontSize: '0.875rem',
    px: '1.5rem',
    py: '0.75rem',
    borderRadius: '0.5rem',
    textTransform: 'none' as const,
    border: '1px solid #E5E7EB',
    '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5' },
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
    <Layout>

      {/* ═══════════════════════════════════════════════
          PROFILE HEADER CARD
      ═══════════════════════════════════════════════ */}
      <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '2rem', mb: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
        {/* Top row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '2rem', flexWrap: 'wrap', gap: 2 }}>

          {/* Avatar + details */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem' }}>
            {/* Avatar */}
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <Box sx={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '4px solid #FFFFFF', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '3rem', fontWeight: 700 }}>
                    {profile.name.charAt(0).toUpperCase()}
                  </Box>
                )}
              </Box>
              {isOwnProfile && (
                <Box onClick={() => navigate('/profile/edit')} sx={{ position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: '50%', background: '#4F46E5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', fontSize: '0.75rem', transition: 'background 0.2s', '&:hover': { background: '#4338CA' } }}>
                  <i className="fas fa-camera" />
                </Box>
              )}
            </Box>

            {/* Name + badges + meta */}
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937', mb: '0.5rem', fontFamily: 'Poppins, sans-serif', lineHeight: 1.2 }}>
                {profile.name}
              </Typography>

              {/* Inline badges */}
              <Box sx={{ display: 'flex', gap: '0.5rem', mb: '1rem', flexWrap: 'wrap' }}>
                {profile.isVerified && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', px: '0.75rem', py: '0.375rem', borderRadius: '2rem', background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.2)', fontSize: '0.75rem', fontWeight: 500 }}>
                    <i className="fas fa-check-circle" style={{ fontSize: '0.875rem' }} /> Verified User
                  </Box>
                )}
                {profile.exchangeCount >= 10 && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', px: '0.75rem', py: '0.375rem', borderRadius: '2rem', background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.75rem', fontWeight: 500 }}>
                    <i className="fas fa-star" style={{ fontSize: '0.875rem' }} /> Active Member
                  </Box>
                )}
                {profile.skills.length >= 3 && (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', px: '0.75rem', py: '0.375rem', borderRadius: '2rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', border: '1px solid rgba(79,70,229,0.2)', fontSize: '0.75rem', fontWeight: 500 }}>
                    <i className="fas fa-graduation-cap" style={{ fontSize: '0.875rem' }} /> Skill Expert
                  </Box>
                )}
              </Box>

              {/* Meta row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                {memberSince && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#4F46E5' }} />
                    <span>Member since {memberSince}</span>
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6B7280' }}>
                  <i className="fas fa-shield-alt" style={{ color: '#4F46E5' }} />
                  <span>Trust score: {profile.trustScore}%</span>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {isOwnProfile ? (
              <>
                <Button onClick={() => navigate('/profile/edit')} sx={gradientBtn}>
                  <i className="fas fa-edit" style={{ marginRight: '0.5rem' }} /> Edit Profile
                </Button>
                <Button onClick={handleShareProfile} sx={outlinedBtn}>
                  <i className="fas fa-share-alt" style={{ marginRight: '0.5rem' }} /> Share Profile
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => navigate('/exchanges/create')} sx={gradientBtn}>
                  <i className="fas fa-exchange-alt" style={{ marginRight: '0.5rem' }} /> Request Exchange
                </Button>
                <Button sx={outlinedBtn}>
                  <i className="fas fa-comment-alt" style={{ marginRight: '0.5rem' }} /> Message
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* Stat cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: '1rem' }}>
          <StatCard value={`${(profile.ceuBalance ?? 0).toLocaleString()} CEU`} label="CEU Balance" />
          <StatCard value={profile.exchangeCount ?? 0} label="Completed Exchanges" />
          <StatCard value={profile.skills.length} label="Skills Offered" />
          <StatCard value={toolPosts.length} label="Tools Available" />
        </Box>
      </Box>

      {/* ═══════════════════════════════════════════════
          BIO & INTRODUCTION
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-user-circle"
        title="Bio & Introduction"
        action={isOwnProfile ? <SectionIconBtn icon="fa-edit" onClick={() => navigate('/profile/edit')} /> : undefined}
      >
        {/* Bio text */}
        {profile.bio ? (
          <Typography sx={{ lineHeight: 1.8, color: '#1F2937' }}>{profile.bio}</Typography>
        ) : (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No bio yet.{isOwnProfile ? ' Add one from your Edit Profile page.' : ''}
          </Typography>
        )}

        {/* ── Video Introduction ── */}
        {(savedVideoUrl || profile.videoIntro) ? (
          /* Completed video — shown directly under bio */
          <Box sx={{ mt: '1.5rem', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #E5E7EB', background: '#000', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            {/* Label bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '1rem', py: '0.625rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))', borderBottom: '1px solid #E5E7EB' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Box sx={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="fas fa-video" style={{ color: '#fff', fontSize: '0.75rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.2 }}>Video Introduction</Typography>
                  <Typography sx={{ fontSize: '0.6875rem', color: '#6B7280' }}>Identity verified · recorded by {profile.name.split(' ')[0]}</Typography>
                </Box>
              </Box>
              {isOwnProfile && (
                <Button onClick={() => setVideoModalOpen(true)} size="small"
                  sx={{ color: '#6B7280', textTransform: 'none', fontSize: '0.75rem', borderRadius: '0.375rem', px: '0.625rem', py: '0.25rem', border: '1px solid #E5E7EB', '&:hover': { color: '#4F46E5', borderColor: '#4F46E5', background: '#F5F3FF' } }}>
                  <i className="fas fa-redo" style={{ marginRight: '0.3rem', fontSize: '0.6875rem' }} /> Re-record
                </Button>
              )}
            </Box>
            {/* Video player */}
            <video
              src={savedVideoUrl ?? profile.videoIntro}
              controls
              playsInline
              controlsList="nodownload noremoteplayback"
              disablePictureInPicture
              onContextMenu={(e) => e.preventDefault()}
              style={{ width: '100%', maxHeight: 340, display: 'block', objectFit: 'cover' }}
            />
          </Box>
        ) : isOwnProfile ? (
          /* No video yet — compact prompt for own profile */
          <Box
            onClick={() => setVideoModalOpen(true)}
            sx={{ mt: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem', p: '0.875rem 1rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.04), rgba(16,185,129,0.04))', border: '1.5px dashed #C7D2FE', borderRadius: '0.625rem', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', background: 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(16,185,129,0.08))' } }}
          >
            <Box sx={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(79,70,229,0.12),rgba(16,185,129,0.12))', border: '1.5px dashed #C7D2FE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-video" style={{ color: '#4F46E5', fontSize: '1.125rem' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>Add a Video Introduction</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>Record a short intro — share your name, skills, and what you're looking for</Typography>
            </Box>
            <Box sx={{ ml: 'auto', flexShrink: 0 }}>
              <i className="fas fa-chevron-right" style={{ color: '#9CA3AF', fontSize: '0.875rem' }} />
            </Box>
          </Box>
        ) : null}
      </Section>

      {/* ═══════════════════════════════════════════════
          YOUR INTERESTS & TAGS
      ═══════════════════════════════════════════════ */}
      {((profile.preferredTags ?? []).length > 0 || isOwnProfile) && (
        <Section
          icon="fa-tags"
          title="Your Interests & Tags"
          action={isOwnProfile ? <SectionIconBtn icon="fa-edit" onClick={() => navigate('/profile/edit')} /> : undefined}
        >
          {(profile.preferredTags ?? []).length === 0 ? (
            <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
              No tags yet.{isOwnProfile ? ' Add some from Edit Profile.' : ''}
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(profile.preferredTags ?? []).map((tag) => (
                <Box
                  key={tag}
                  sx={{ display: 'inline-flex', alignItems: 'center', px: '0.875rem', py: '0.375rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.08), rgba(16,185,129,0.08))', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 500, color: '#4F46E5' }}
                >
                  # {tag}
                </Box>
              ))}
            </Box>
          )}
        </Section>
      )}

      {/* ═══════════════════════════════════════════════
          SKILLS OFFERED
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-chalkboard-teacher"
        title="Skills Offered"
        action={isOwnProfile ? (
          <SectionIconBtn icon="fa-plus" onClick={() => navigate('/create?type=skill')} />
        ) : undefined}
      >
        {skillPosts.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No skill posts yet.{isOwnProfile ? ' Share a skill via Create Post.' : ''}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 400, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {skillPosts.map((skill, idx) => (
              <Box key={skill._id} onClick={() => navigate(`/skills/${skill._id}`)}
                sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                {/* Colour band */}
                <Box sx={{ height: 6, background: `linear-gradient(90deg, #4F46E5, #10B981)` }} />
                <Box sx={{ p: '1rem' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '0.5rem' }}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }}>{skill.title}</Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', px: '0.45rem', py: '0.2rem', background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff', fontSize: '0.7rem', fontWeight: 600, borderRadius: '0.3rem', ml: '0.5rem', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      <i className="fas fa-chalkboard-teacher" style={{ fontSize: '0.6rem' }} /> Skill
                    </Box>
                  </Box>
                  {skill.content && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: '0.75rem' }}>
                      {skill.content}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                      {formatDistanceToNow(new Date(skill.createdAt as unknown as string), { addSuffix: true })}
                    </Typography>
                    {skill.ceuRate && (
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5' }}>
                        <i className="fas fa-coins" style={{ marginRight: 3 }} />{skill.ceuRate} CEU
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
          </Box>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          SKILLS I WANT TO LEARN
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-lightbulb"
        title="Skills I Want to Learn"
        action={isOwnProfile ? (
          <SectionIconBtn icon="fa-plus" onClick={() => navigate('/exchanges/create')} />
        ) : undefined}
      >
        {seekingExchanges.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No exchange requests yet.{isOwnProfile ? ' Start an exchange to show what you want to learn.' : ''}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 450, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
            {seekingExchanges.map((ex) => {
              const statusColors: Record<string, string> = { open: '#10B981', active: '#4F46E5', completed: '#6B7280', cancelled: '#EF4444', pending: '#F59E0B' };
              const color = statusColors[ex.status] ?? '#6B7280';
              return (
                <Box key={ex._id} onClick={() => navigate(`/exchanges/${ex._id}`)}
                  sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '0.5rem' }}>
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }}>
                      {ex.seeking || ex.title}
                    </Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', px: '0.45rem', py: '0.2rem', background: color + '20', color, fontSize: '0.7rem', fontWeight: 600, borderRadius: '0.3rem', ml: '0.5rem', flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                      {ex.status}
                    </Box>
                  </Box>
                  {ex.seekingDescription && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: '0.75rem' }}>
                      {ex.seekingDescription}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: '0.5rem' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                      {formatDistanceToNow(new Date((ex.updatedAt ?? ex.createdAt) as unknown as string), { addSuffix: true })}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5' }}>
                      <i className="fas fa-coins" style={{ marginRight: 3 }} />{ex.ceuValue} CEU
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
          </Box>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          TOOLS AVAILABLE
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-tools"
        title="Tools & Gifts"
        action={isOwnProfile ? (
          <>
            <SectionIconBtn icon="fa-plus" onClick={() => navigate('/create?type=tool')} title="List Tool" />
            <SectionIconBtn icon="fa-gift" onClick={() => navigate('/create?type=gift')} title="Gift Item" />
          </>
        ) : undefined}
      >
        {toolPosts.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No tools or gifts listed yet.{isOwnProfile ? ' Use Create Post to list one.' : ''}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 700, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {toolPosts.map((tool, idx) => {
                const isGift = tool.type === 'gift';
                return (
                  <Box key={tool._id} onClick={() => navigate(`/tools/${tool._id}`)} sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                    <Box sx={{ height: 130, background: TOOL_GRADIENTS[idx % TOOL_GRADIENTS.length], position: 'relative' }}>
                      {tool.images?.[0] ? (
                        <img src={tool.images[0]} alt={tool.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={`fas ${isGift ? 'fa-gift' : 'fa-tools'}`} style={{ fontSize: '2rem', color: 'rgba(255,255,255,0.6)' }} />
                        </Box>
                      )}
                      <Box sx={{ position: 'absolute', top: '0.625rem', right: '0.625rem', px: '0.5rem', py: '0.2rem', background: isGift ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.9)', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 600, color: isGift ? '#fff' : '#10B981' }}>
                        {isGift ? '🎁 Free Gift' : 'Available'}
                      </Box>
                    </Box>
                    <Box sx={{ p: '1rem' }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', mb: '0.375rem' }}>{tool.title}</Typography>
                      {tool.content && (
                        <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', mb: '0.75rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {tool.content}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
                        {formatDistanceToNow(new Date(tool.createdAt as unknown as string), { addSuffix: true })}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          EVENTS CREATED
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-calendar-alt"
        title="Events Created"
        action={isOwnProfile ? (
          <SectionIconBtn icon="fa-plus" onClick={() => navigate('/create?type=event')} />
        ) : undefined}
      >
        {eventPosts.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No events created yet.{isOwnProfile ? ' Create an event via Create Post.' : ''}
          </Typography>
        ) : (
          <Box sx={{ maxHeight: 420, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              {eventPosts.map((ev) => (
                <Box key={ev._id} onClick={() => navigate(`/events/${ev._id}`)}
                  sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#059669', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', mb: '0.5rem' }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: '0.375rem', background: 'linear-gradient(135deg,#059669,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fas fa-calendar-alt" style={{ color: '#fff', fontSize: '0.875rem' }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }} noWrap>{ev.title}</Typography>
                      {ev.startDate && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#059669', fontWeight: 500, mt: '0.125rem' }}>
                          <i className="fas fa-clock" style={{ marginRight: 3 }} />
                          {format(new Date(ev.startDate as unknown as string), 'dd MMM yyyy')}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  {ev.content && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: '0.5rem' }}>
                      {ev.content}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>
                    Created {formatDistanceToNow(new Date(ev.createdAt as unknown as string), { addSuffix: true })}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          CEU BALANCE & HISTORY
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-coins"
        title="CEU Balance & History"
        action={
          <>
            <SectionIconBtn icon="fa-exchange-alt" />
            <SectionIconBtn icon="fa-history" />
          </>
        }
      >
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: '1.5rem', minWidth: 0 }}>
          {/* Balance card */}
          <Box sx={{ background: 'linear-gradient(135deg, #4F46E5, #10B981)', borderRadius: '0.75rem', p: { xs: '1.25rem', sm: '2rem' }, color: '#fff', textAlign: 'center', minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.875rem', opacity: 0.9, mb: '0.5rem' }}>Current Balance</Typography>
            <Typography sx={{ fontSize: '2.5rem', fontWeight: 700, mb: '1.5rem', fontFamily: 'Poppins, sans-serif' }}>{(profile.ceuBalance ?? 0).toLocaleString()} CEU</Typography>
            <Box sx={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button size="small" sx={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.5rem', textTransform: 'none', fontSize: '0.8125rem', '&:hover': { background: 'rgba(255,255,255,0.3)' } }}>
                <i className="fas fa-arrow-down" style={{ marginRight: '0.375rem' }} /> Add CEU
              </Button>
              <Button size="small" sx={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '0.5rem', textTransform: 'none', fontSize: '0.8125rem', '&:hover': { background: 'rgba(255,255,255,0.3)' } }}>
                <i className="fas fa-gift" style={{ marginRight: '0.375rem' }} /> Send Gift
              </Button>
            </Box>
          </Box>

          {/* Transaction history */}
          <Box sx={{ background: '#F9FAFB', borderRadius: '0.5rem', p: '1.5rem' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', mb: '1rem' }}>Recent Transactions</Typography>
            {ceuTransactions.length === 0 ? (
              <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
                No exchanges yet — complete exchanges to earn CEU.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 222, overflowY: 'auto', '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
                {ceuTransactions.map((tx) => (
                  <Box key={tx.id} onClick={() => navigate(`/exchanges/${tx.exchangeId}`)}
                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: '0.75rem', borderBottom: '1px solid #E5E7EB', cursor: 'pointer', transition: 'background 0.15s', '&:last-child': { borderBottom: 'none' }, '&:hover': { background: '#F3F4F6' } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: tx.positive ? '#D1FAE5' : tx.status === 'completed' ? '#FEE2E2' : '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tx.positive ? '#10B981' : tx.status === 'completed' ? '#EF4444' : '#4F46E5', flexShrink: 0 }}>
                        <i className={`fas ${tx.icon}`} style={{ fontSize: '0.875rem' }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }} noWrap>{tx.title}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>with {tx.partner} · {tx.time}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0, ml: '0.75rem' }}>
                      <Typography sx={{ fontWeight: 700, color: tx.positive ? '#10B981' : tx.status === 'completed' ? '#EF4444' : '#6B7280', fontSize: '0.9rem' }}>
                        {tx.amount}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{tx.status}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Section>

      {/* ═══════════════════════════════════════════════
          RANKING & BADGES
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-trophy"
        title="Ranking & Badges"
        action={<SectionIconBtn icon="fa-chart-line" />}
      >
        {/* Rankings grid — only show earned rankings */}
        {rankingCards.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem', mb: '2rem' }}>
            No rankings earned yet — complete exchanges, list skills and tools to earn ranks.
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', mb: '2rem' }}>
            {rankingCards.map((card) => (
              <RankingCard key={card.title} icon={card.icon} title={card.title} tier={card.tier} progress={card.progress} sub={card.sub} />
            ))}
          </Box>
        )}

        {/* Badges earned */}
        <Box>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1rem' }}>
            <i className="fas fa-award" style={{ color: '#4F46E5' }} /> Badges Earned
          </Typography>
          {earnedBadges.length === 0 ? (
            <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.875rem' }}>
              No badges yet — complete exchanges and build your profile to earn them!
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' }}>
              {earnedBadges.map((b) => (
                <BadgeCard key={b.name} icon={b.icon} name={b.name} desc={b.desc} />
              ))}
            </Box>
          )}
        </Box>
      </Section>

      {/* ═══════════════════════════════════════════════
          REVIEWS RECEIVED
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-star"
        title="Reviews Received"
        action={completedExchanges.length > 0 ? (
          <>
            <SectionIconBtn icon="fa-filter" />
            <SectionIconBtn icon="fa-sort" />
          </>
        ) : undefined}
      >
        {completedExchanges.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No reviews yet — complete exchanges to receive feedback from your neighbours.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {completedExchanges.slice(0, 5).map((exchange) => {
              const other = (exchange.requester as unknown as User)?._id === profileId
                ? exchange.provider as unknown as User
                : exchange.requester as unknown as User;
              const otherName = (other as User)?.name ?? 'Neighbour';
              return (
                <Box key={exchange._id} sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1.25rem', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: '1rem' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '0.875rem', flexShrink: 0 }}>
                        {otherName.charAt(0).toUpperCase()}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>{otherName}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{exchange.title ?? 'Exchange'}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: '0.125rem' }}>
                      {[1,2,3,4,5].map((s) => (
                        <i key={s} className="fas fa-star" style={{ color: '#FFD700', fontSize: '0.875rem' }} />
                      ))}
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', lineHeight: 1.6 }}>
                    Exchange completed successfully.
                  </Typography>
                  {exchange.updatedAt && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: '0.75rem' }}>
                      {formatDistanceToNow(new Date(exchange.updatedAt as unknown as string), { addSuffix: true })}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Section>

      {/* ═══════════════════════════════════════════════
          RECENT ACTIVITY (TIMELINE)
      ═══════════════════════════════════════════════ */}
      <Section
        icon="fa-history"
        title="Recent Activity"
        action={<SectionIconBtn icon="fa-expand" />}
      >
        {activityItems.length === 0 ? (
          <Typography sx={{ color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.9375rem' }}>
            No activity yet — start exchanging skills and posting to see your activity here.
          </Typography>
        ) : (
          <Box sx={{ position: 'relative', pl: '2rem' }}>
            {/* Vertical line */}
            <Box sx={{ position: 'absolute', left: '0.75rem', top: 0, bottom: 0, width: '2px', background: '#E5E7EB' }} />

            {activityItems.map((item, idx) => (
              <Box key={item.id} sx={{ position: 'relative', mb: idx < activityItems.length - 1 ? '1.5rem' : 0 }}>
                {/* Dot */}
                <Box sx={{ position: 'absolute', left: '-1.75rem', top: '0.125rem', width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', border: '3px solid #fff', boxShadow: '0 0 0 2px #E5E7EB' }} />

                {/* Content card */}
                <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5' } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '0.5rem' }}>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className={`fas ${item.icon}`} style={{ color: '#4F46E5' }} />
                      {item.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', flexShrink: 0, ml: 1 }}>
                      {formatDistanceToNow(item.date, { addSuffix: true })}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                    {item.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Section>

    </Layout>

    {/* Video intro recording modal */}
    {isOwnProfile && (
      <VideoIntroModal
        open={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        userName={profile.name}
        userSkills={profile.skills}
        userInterests={profile.interests}
        onSaved={(url) => {
          setSavedVideoUrl(url);
          queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
        }}
      />
    )}

    {/* Skills Offered edit modal */}
    <SkillsEditModal
      open={skillsModalOpen}
      initialSkills={(profile?.skills ?? []) as SkillEntry[]}
      onClose={() => setSkillsModalOpen(false)}
      onSave={(skills) => saveSection({ skills })}
    />

    {/* Skills I Want to Learn edit modal */}
    <InterestsEditModal
      open={interestsModalOpen}
      initialInterests={(profile?.interests ?? []) as InterestEntry[]}
      onClose={() => setInterestsModalOpen(false)}
      onSave={(interests) => saveSection({ interests })}
    />
    <Snackbar
      open={copied}
      onClose={() => setCopied(false)}
      message="Profile link copied to clipboard!"
      autoHideDuration={3000}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    />
    </>
  );
};

export default MyProfile;
