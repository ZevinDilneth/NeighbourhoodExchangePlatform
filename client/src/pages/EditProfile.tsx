import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Chip,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Layout from '../components/layout/Layout';
import { checkFields, PROFANITY_ERROR } from '../utils/contentFilter';
import { scanMedia } from '../utils/scanMedia';
import VideoIntroModal from '../components/VideoIntroModal';
import OnlineAvatar from '../components/OnlineAvatar';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SkillEntry {
  name: string;
  type: string;
  description: string;
  proficiency: string;
  availability: string;
  rate: string;
}

interface InterestEntry {
  name: string;
  category: string;
  description: string;
  level: string;
  willingToPay: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const PROFICIENCY_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];
const AVAILABILITY_OPTIONS = ['Flexible', 'Weekdays', 'Weekends', 'Evenings', 'Mornings', 'Anytime', 'By Appointment'];
const INTEREST_LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const SKILL_TYPES = ['Teaching', 'Exchange', 'Both', 'Other'];
const INTEREST_CATEGORIES = ['Music', 'Gardening', 'Cooking', 'Art', 'Technology', 'Fitness', 'Languages', 'Photography', 'Crafts', 'Sports', 'Other'];

const SKILL_SUGGESTIONS = [
  'Cooking', 'Gardening', 'Photography', 'Coding', 'Music', 'Yoga',
  'Woodworking', 'Sewing', 'Drawing', 'Languages', 'Tutoring', 'Cycling',
  'Carpentry', 'Plumbing', 'Design', 'Writing', 'Baking', 'Painting',
];

const LEARN_SUGGESTIONS = [
  'DIY', 'Sustainability', 'Books', 'Film', 'Hiking', 'Board Games',
  'Community Events', 'Cooking', 'Fitness', 'Technology', 'Art', 'Travel',
  'Pottery', 'Meditation', 'Guitar', 'Spanish', 'Swimming', 'Knitting',
];

// ─── Validators ──────────────────────────────────────────────────────────────
// ─── Design tokens ───────────────────────────────────────────────────────────
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

// ─── Popular tag catalogue (curated) ─────────────────────────────────────────
const POPULAR_TAGS: { label: string; icon: string }[] = [
  { label: 'cooking',       icon: '🍳' },
  { label: 'gardening',     icon: '🌱' },
  { label: 'photography',   icon: '📷' },
  { label: 'coding',        icon: '💻' },
  { label: 'music',         icon: '🎵' },
  { label: 'yoga',          icon: '🧘' },
  { label: 'woodworking',   icon: '🪚' },
  { label: 'sewing',        icon: '🧵' },
  { label: 'drawing',       icon: '✏️' },
  { label: 'languages',     icon: '🌐' },
  { label: 'tutoring',      icon: '📚' },
  { label: 'cycling',       icon: '🚴' },
  { label: 'carpentry',     icon: '🔨' },
  { label: 'plumbing',      icon: '🔧' },
  { label: 'design',        icon: '🎨' },
  { label: 'writing',       icon: '✍️' },
  { label: 'baking',        icon: '🧁' },
  { label: 'painting',      icon: '🖌️' },
  { label: 'fitness',       icon: '💪' },
  { label: 'meditation',    icon: '🧠' },
  { label: 'diy',           icon: '🛠️' },
  { label: 'sustainability', icon: '♻️' },
  { label: 'hiking',        icon: '🥾' },
  { label: 'board games',   icon: '🎲' },
  { label: 'pottery',       icon: '🏺' },
  { label: 'swimming',      icon: '🏊' },
  { label: 'knitting',      icon: '🧶' },
  { label: 'film',          icon: '🎬' },
  { label: 'technology',    icon: '⚙️' },
  { label: 'events',        icon: '🎉' },
];

// ─── Section card ────────────────────────────────────────────────────────────
const SectionCard: React.FC<{ icon: string; title: string; subtitle?: string; children: React.ReactNode }> = ({
  icon, title, subtitle, children,
}) => (
  <Box sx={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #E5E7EB', overflow: 'hidden', mb: '1.25rem' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', p: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6' }}>
      <Box sx={{ width: 38, height: 38, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fas ${icon}`} style={{ color: '#fff', fontSize: '1rem' }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 700, fontFamily: 'Poppins, sans-serif', fontSize: '0.9375rem', color: '#1F2937' }}>{title}</Typography>
        {subtitle && <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mt: '0.125rem' }}>{subtitle}</Typography>}
      </Box>
    </Box>
    <Box sx={{ p: '1.5rem' }}>{children}</Box>
  </Box>
);

// ─── Skill card (editable) ───────────────────────────────────────────────────
const SkillCard: React.FC<{
  skill: SkillEntry;
  index: number;
  badge?: { label: string; color: string; bg: string };
  onRemove: () => void;
  onChange: (updated: SkillEntry) => void;
}> = ({ skill, badge, onRemove, onChange }) => (
  <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.625rem', p: '1rem', position: 'relative', '&:hover': { borderColor: '#C7D2FE' } }}>
    {/* Remove button */}
    <IconButton
      size="small"
      onClick={onRemove}
      sx={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: '#9CA3AF', '&:hover': { color: '#EF4444', background: '#FEF2F2' } }}
    >
      <i className="fas fa-times" style={{ fontSize: '0.75rem' }} />
    </IconButton>

    {/* Name + type badge row */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.875rem', pr: '1.75rem' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', flex: 1 }}>{skill.name}</Typography>
    </Box>

    {/* Type + CEU Rate */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '0.625rem' }}>
      <FormControl size="small" fullWidth>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>Type</InputLabel>
        <Select label="Type" value={skill.type || 'Teaching'}
          onChange={(e) => onChange({ ...skill, type: e.target.value })}
          sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          {SKILL_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ fontSize: '0.8125rem' }}>{t}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" fullWidth label="CEU Rate" placeholder="e.g. 25/hr"
        value={skill.rate || ''}
        onChange={(e) => onChange({ ...skill, rate: e.target.value })}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.8125rem' } }}
        InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
      />
    </Box>

    {/* Description */}
    <TextField size="small" fullWidth label="Description" placeholder="e.g. Learn portrait composition and lighting techniques"
      value={skill.description || ''}
      onChange={(e) => onChange({ ...skill, description: e.target.value })}
      sx={{ mb: '0.625rem', '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.8125rem' } }}
      InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
    />

    {/* Proficiency + Availability */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem' }}>
      <FormControl size="small" fullWidth>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>Proficiency</InputLabel>
        <Select label="Proficiency" value={skill.proficiency || 'Intermediate'}
          onChange={(e) => onChange({ ...skill, proficiency: e.target.value })}
          sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          {PROFICIENCY_LEVELS.map((l) => <MenuItem key={l} value={l} sx={{ fontSize: '0.8125rem' }}>{l}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" fullWidth>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>Availability</InputLabel>
        <Select label="Availability" value={skill.availability || 'Flexible'}
          onChange={(e) => onChange({ ...skill, availability: e.target.value })}
          sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          {AVAILABILITY_OPTIONS.map((a) => <MenuItem key={a} value={a} sx={{ fontSize: '0.8125rem' }}>{a}</MenuItem>)}
        </Select>
      </FormControl>
    </Box>
  </Box>
);

// ─── Add skill input + quick-add ─────────────────────────────────────────────
const AddSkillInput: React.FC<{
  placeholder: string;
  suggestions: string[];
  existing: string[];
  onAdd: (name: string) => void;
}> = ({ placeholder, suggestions, existing, onAdd }) => {
  const [input, setInput] = useState('');

  const handleAdd = (val: string) => {
    const t = val.trim();
    if (!t || existing.includes(t.toLowerCase())) return;
    onAdd(t);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); handleAdd(input); }
  };

  const unused = suggestions.filter((s) => !existing.includes(s.toLowerCase())).slice(0, 8);

  return (
    <Box>
      <TextField
        fullWidth size="small"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) handleAdd(input); }}
        InputProps={{
          endAdornment: input.trim() ? (
            <InputAdornment position="end">
              <Button size="small" onClick={() => handleAdd(input)}
                sx={{ minWidth: 'unset', color: '#4F46E5', textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', px: '0.5rem' }}>
                Add
              </Button>
            </InputAdornment>
          ) : undefined,
        }}
        helperText="Type a skill name and press Enter"
        sx={{ mb: '0.875rem', '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
      />
      {unused.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', mr: '0.25rem' }}>Quick add:</Typography>
          {unused.map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" onClick={() => handleAdd(s)}
              sx={{ fontSize: '0.6875rem', height: 22, cursor: 'pointer', borderColor: '#D1D5DB', color: '#6B7280',
                    '&:hover': { bgcolor: '#EEF2FF', borderColor: '#4F46E5', color: '#4F46E5' } }} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Interest tag input ───────────────────────────────────────────────────────
// ─── Interest card (editable) ────────────────────────────────────────────────
const InterestCard: React.FC<{
  entry: InterestEntry;
  onChange: (updated: InterestEntry) => void;
  onRemove: () => void;
}> = ({ entry, onChange, onRemove }) => (
  <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.625rem', p: '1rem', position: 'relative', mb: '0.875rem', '&:hover': { borderColor: '#C7D2FE' } }}>
    {/* Remove button */}
    <IconButton size="small" onClick={onRemove}
      sx={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: '#9CA3AF', '&:hover': { color: '#EF4444', background: '#FEF2F2' } }}>
      <i className="fas fa-times" style={{ fontSize: '0.75rem' }} />
    </IconButton>

    {/* Name row */}
    <Box sx={{ mb: '0.875rem', pr: '1.75rem' }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>{entry.name}</Typography>
    </Box>

    {/* Category + Willing to pay */}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.625rem', mb: '0.625rem' }}>
      <FormControl size="small" fullWidth>
        <InputLabel sx={{ fontSize: '0.8125rem' }}>Category</InputLabel>
        <Select label="Category" value={entry.category || 'Other'}
          onChange={(e) => onChange({ ...entry, category: e.target.value })}
          sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          {INTEREST_CATEGORIES.map((c) => <MenuItem key={c} value={c} sx={{ fontSize: '0.8125rem' }}>{c}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" fullWidth label="Willing to pay" placeholder="e.g. 20/hr"
        value={entry.willingToPay}
        onChange={(e) => onChange({ ...entry, willingToPay: e.target.value })}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.8125rem' } }}
        InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
      />
    </Box>

    {/* Description */}
    <TextField fullWidth size="small" label="What do you want to learn?" placeholder="e.g. Basic chords and strumming patterns"
      value={entry.description}
      onChange={(e) => onChange({ ...entry, description: e.target.value })}
      sx={{ mb: '0.625rem', '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.8125rem' } }}
      InputLabelProps={{ sx: { fontSize: '0.8125rem' } }}
    />

    {/* Level */}
    <FormControl size="small" fullWidth>
      <InputLabel sx={{ fontSize: '0.8125rem' }}>Your Level</InputLabel>
      <Select label="Your Level" value={entry.level || 'Beginner'}
        onChange={(e) => onChange({ ...entry, level: e.target.value })}
        sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
        {INTEREST_LEVELS.map((l) => <MenuItem key={l} value={l} sx={{ fontSize: '0.8125rem' }}>{l}</MenuItem>)}
      </Select>
    </FormControl>
  </Box>
);

// ─── Add interest input ───────────────────────────────────────────────────────
const AddInterestInput: React.FC<{
  existing: string[];
  onAdd: (name: string) => void;
}> = ({ existing, onAdd }) => {
  const [input, setInput] = useState('');

  const submit = (val: string) => {
    const t = val.trim();
    if (!t || existing.includes(t.toLowerCase())) return;
    onAdd(t);
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(input); }
  };

  const unused = LEARN_SUGGESTIONS.filter((s) => !existing.includes(s.toLowerCase())).slice(0, 8);

  return (
    <Box>
      <TextField fullWidth size="small" placeholder="e.g. Guitar, Knitting, Pottery…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        InputProps={{
          startAdornment: <InputAdornment position="start"><i className="fas fa-lightbulb" style={{ color: '#10B981', fontSize: '0.8rem' }} /></InputAdornment>,
          endAdornment: input.trim() ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => submit(input)}>
                <i className="fas fa-plus" style={{ fontSize: '0.75rem', color: '#10B981' }} />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        }}
        helperText="Press Enter to add — then fill in details below"
        sx={{ mb: unused.length ? '0.75rem' : 0, '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', '&.Mui-focused fieldset': { borderColor: '#10B981' } } }}
      />
      {unused.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', mr: '0.25rem' }}>Quick add:</Typography>
          {unused.map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" onClick={() => submit(s)}
              sx={{ fontSize: '0.6875rem', height: 22, cursor: 'pointer', borderColor: '#D1D5DB', color: '#6B7280',
                    '&:hover': { bgcolor: '#D1FAE5', borderColor: '#10B981', color: '#10B981' } }} />
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Two-column grid ─────────────────────────────────────────────────────────
const FieldRow: React.FC<{ children: React.ReactNode; cols?: 1 | 2 }> = ({ children, cols = 1 }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: cols === 2 ? { xs: '1fr', sm: '1fr 1fr' } : '1fr', gap: '1rem', mb: '1rem' }}>
    {children}
  </Box>
);

// ─── Main component ───────────────────────────────────────────────────────────
const EditProfile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile]       = useState<File | null>(null);
  const [avatarScanning, setAvatarScanning] = useState(false);

  // Video intro
  const [existingVideo, setExistingVideo] = useState<string | null>(null);
  const [videoRemoved, setVideoRemoved]   = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Fields
  const [name, setName]                   = useState('');
  const [bio, setBio]                     = useState('');
  const [skills, setSkills]               = useState<SkillEntry[]>([]);
  const [interests, setInterests]         = useState<InterestEntry[]>([]);
  const [preferredTags,    setPreferredTags]    = useState<string[]>([]);
  const [tagInput,         setTagInput]         = useState('');
  const [tagDropdownOpen,  setTagDropdownOpen]  = useState(false);
  const [tagHighlight,     setTagHighlight]     = useState(-1);
  const tagContainerRef = useRef<HTMLDivElement>(null);

  // UI
  const [nameError, setNameError]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState('');
  const [saved, setSaved]           = useState(false);

  // Pre-fill
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setBio(user.bio ?? '');
    // Handle legacy string[] skills or new object[] skills
    const rawSkills = (user.skills ?? []) as unknown[];
    setSkills(rawSkills.map((s): SkillEntry => {
      if (typeof s === 'string') return { name: s, type: 'Teaching', description: '', proficiency: 'Intermediate', availability: 'Flexible', rate: '' };
      const e = s as Partial<SkillEntry> & { name: string };
      return { type: 'Teaching', description: '', rate: '', proficiency: 'Intermediate', availability: 'Flexible', ...e };
    }));
    // Handle legacy string[] interests or new object[] interests
    const rawInterests = (user.interests ?? []) as unknown[];
    setInterests(rawInterests.map((i): InterestEntry => {
      if (typeof i === 'string') return { name: i, category: 'Other', description: '', level: 'Beginner', willingToPay: '' };
      const e = i as Partial<InterestEntry> & { name: string };
      return { category: 'Other', description: '', level: 'Beginner', willingToPay: '', ...e };
    }));
    // Preferred tags
    const rawTags = (user as unknown as { preferredTags?: string[] }).preferredTags ?? [];
    setPreferredTags(rawTags.map((t) => t.toLowerCase().trim()).filter(Boolean));

    // Video intro — store whatever URL the server returned on /auth/me
    setExistingVideo((user as unknown as { videoIntro?: string }).videoIntro ?? null);
    setVideoRemoved(false);
  }, [user]);

  // Avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSaveError('Only image files are allowed as a profile picture (JPEG, PNG, GIF, WebP, etc.).');
      e.target.value = '';
      return;
    }
    setSaveError('');
    setAvatarScanning(true);
    const scan = await scanMedia(file);
    setAvatarScanning(false);
    e.target.value = '';
    if (!scan.safe) {
      setSaveError(`"${file.name}" contains NSFW material and cannot be uploaded (${scan.reason ?? 'explicit content'}).`);
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Video helpers
  const handleVideoRemove = () => setVideoRemoved(true);

  const handleVideoSaved = (url: string) => {
    setExistingVideo(url);
    setVideoRemoved(false);
    updateUser({ videoIntro: url } as Record<string, unknown>);
  };

  // Phone verification helpers
  // Tag helpers
  const toggleTag = (tag: string) => {
    const t = tag.toLowerCase().trim();
    setPreferredTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  const addCustomTag = (raw: string) => {
    const t = raw.toLowerCase().trim().replace(/[^a-z0-9\s\-]/g, '').slice(0, 50);
    if (!t || preferredTags.includes(t)) { setTagInput(''); return; }
    setPreferredTags((prev) => [...prev, t]);
    setTagInput('');
  };

  // Skill helpers
  const addSkill = (name: string) => {
    if (skills.find((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setSkills((prev) => [...prev, { name, type: 'Teaching', description: '', proficiency: 'Intermediate', availability: 'Flexible', rate: '' }]);
  };

  const removeSkill = (index: number) => setSkills((prev) => prev.filter((_, i) => i !== index));

  const updateSkill = (index: number, updated: SkillEntry) =>
    setSkills((prev) => prev.map((s, i) => (i === index ? updated : s)));

  // Save
  const handleSave = async () => {
    setSaveError(''); setSaved(false);
    if (!name.trim()) { setNameError('Name is required'); return; }
    if (name.trim().length > 100) { setNameError('Name must be 100 characters or fewer'); return; }
    setNameError('');

    // Content moderation — check name, bio, skill names/descriptions, interest names/descriptions, preferred tags
    if (checkFields(
      name, bio,
      skills.map(s => s.name), skills.map(s => s.description),
      interests.map(i => i.name), interests.map(i => i.description),
      preferredTags,
    )) {
      setSaveError(PROFANITY_ERROR);
      return;
    }

    setSaving(true);
    try {
      // ── Avatar ──────────────────────────────────────────────────────────
      if (avatarFile) {
        const fd = new FormData();
        fd.append('avatar', avatarFile);
        const { data } = await api.put<{ avatar: string }>('/users/me/avatar', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        updateUser({ avatar: data.avatar });
      }

      // ── Video intro ──────────────────────────────────────────────────────
      // Recording + upload is handled immediately inside VideoIntroModal (onSaved).
      // We only need to handle explicit removal here.
      if (videoRemoved && existingVideo) {
        await api.delete('/users/me/video-intro');
        setExistingVideo(null);
        setVideoRemoved(false);
        updateUser({ videoIntro: null } as Record<string, unknown>);
      }

      // ── Profile + tags ───────────────────────────────────────────────────
      const [{ data: updated }] = await Promise.all([
        api.put('/users/me', {
          name: name.trim(),
          bio:  bio.trim(),
          skills,
          interests,
        }),
        api.put('/users/me/tags', { tags: preferredTags }),
      ]);
      updateUser({ ...updated, preferredTags });
      setSaved(true);
      setTimeout(() => navigate('/profile/me'), 900);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setSaveError(msg || 'Failed to save — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const displayAvatar = avatarPreview ?? user.avatar;
  const wordCount     = bio.trim() === '' ? 0 : bio.trim().split(/\s+/).length;
  const atLimit       = wordCount >= 100;

  return (
    <Layout>
      <Box sx={{ py: '1.5rem', px: { xs: '0', sm: '0' } }}>

        {/* ── Gradient header ───────────────────────────────────────────── */}
        <Box sx={{ background: GRAD, borderRadius: '0.875rem', p: '1.5rem 1.75rem', mb: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 4px 20px rgba(79,70,229,0.25)' }}>
          <IconButton onClick={() => navigate('/profile/me')} sx={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)', borderRadius: '0.5rem', p: '0.5rem', '&:hover': { background: 'rgba(255,255,255,0.25)' } }}>
            <i className="fas fa-arrow-left" style={{ fontSize: '0.875rem' }} />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#fff' }}>Edit Profile</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.8)', mt: '0.125rem' }}>Your public profile — visible to your neighbours</Typography>
          </Box>
          <Button onClick={handleSave} disabled={saving}
            sx={{ background: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', px: '1.25rem', py: '0.5rem', border: '1px solid rgba(255,255,255,0.35)', '&:hover': { background: 'rgba(255,255,255,0.3)' }, '&:disabled': { color: 'rgba(255,255,255,0.6)' } }}>
            {saving ? <><CircularProgress size={13} sx={{ mr: '0.375rem', color: 'inherit' }} />Saving…</> : <><i className="fas fa-check" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />Save</>}
          </Button>
        </Box>

        {/* ── Feedback ──────────────────────────────────────────────────── */}
        {saveError && <Alert severity="error"   sx={{ mb: '1rem', borderRadius: '0.625rem' }}>{saveError}</Alert>}
        {saved     && <Alert severity="success" sx={{ mb: '1rem', borderRadius: '0.625rem' }}>Profile saved! Redirecting…</Alert>}

        {/* ═══════════════════════════════════════════════════════════════
            1 — Avatar + Basic Info
        ═══════════════════════════════════════════════════════════════ */}
        <SectionCard icon="fa-user" title="Basic Information" subtitle="Your name and bio appear on your public profile">

          {/* Avatar row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1.5rem', mb: '1.5rem', pb: '1.5rem', borderBottom: '1px solid #F3F4F6' }}>
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <OnlineAvatar userId={user._id} src={displayAvatar ?? undefined} isVerified={user.isVerified} sx={{ width: 88, height: 88, fontSize: '2rem', border: '3px solid #E5E7EB', background: !displayAvatar ? GRAD : undefined }}>
                {!displayAvatar && user.name?.[0]?.toUpperCase()}
              </OnlineAvatar>
              <Box onClick={() => fileInputRef.current?.click()}
                sx={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s', '&:hover': { opacity: 1 } }}>
                <i className="fas fa-camera" style={{ color: '#fff', fontSize: '1.25rem' }} />
              </Box>
              <Box onClick={() => fileInputRef.current?.click()}
                sx={{ position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                <i className="fas fa-camera" style={{ color: '#fff', fontSize: '0.6875rem' }} />
              </Box>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', mb: '0.25rem' }}>Profile Photo</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', mb: '0.5rem' }}>Any image (JPEG, PNG, GIF, WebP…) · max 5 MB · no videos</Typography>
              <Button size="small" onClick={() => fileInputRef.current?.click()}
                disabled={avatarScanning}
                sx={{ border: '1px solid #E5E7EB', color: '#374151', fontSize: '0.8125rem', textTransform: 'none', borderRadius: '0.5rem', px: '0.875rem', py: '0.3125rem', '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: '#F5F3FF' } }}>
                {avatarScanning
                  ? <><CircularProgress size={12} sx={{ mr: '0.375rem' }} /> Scanning…</>
                  : <><i className="fas fa-upload" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />{avatarPreview ? 'Change photo' : 'Upload photo'}</>
                }
              </Button>
            </Box>
          </Box>

          {/* Name */}
          <TextField
            fullWidth required label="Full name" value={name}
            onChange={(e) => { setName(e.target.value); if (nameError) setNameError(''); }}
            onBlur={() => {
              if (!name.trim()) setNameError('Name is required');
              else if (name.trim().length > 100) setNameError('Name must be 100 characters or fewer');
              else setNameError('');
            }}
            error={!!nameError} helperText={nameError}
            inputProps={{ maxLength: 100 }}
            sx={{ mb: '1.25rem', '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
          />

          {/* Bio */}
          <TextField
            fullWidth multiline rows={3} label="Bio"
            placeholder="Tell your neighbours a little about yourself…"
            value={bio}
            onChange={(e) => {
              const val = e.target.value;
              if ((val.trim() === '' ? 0 : val.trim().split(/\s+/).length) <= 100) setBio(val);
            }}
            error={atLimit}
            helperText={
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{atLimit ? '100 word limit reached' : 'Up to 100 words'}</span>
                <span style={{ color: atLimit ? '#EF4444' : '#9CA3AF' }}>{wordCount}/100 words</span>
              </Box>
            }
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
          />
        </SectionCard>

        {/* ═══════════════════════════════════════════════════════════════
            2 — Video Introduction
        ═══════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon="fa-video"
          title="Video Introduction"
          subtitle="Record a short verification video introducing yourself and your skills"
        >
          {/* ── Has an existing video ── */}
          {existingVideo && !videoRemoved ? (
            <Box>
              <Box sx={{
                position: 'relative', borderRadius: '0.75rem', overflow: 'hidden',
                background: '#000', mb: '1rem', boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                aspectRatio: '16/9', maxHeight: 280,
              }}>
                <Box component="video" key={existingVideo} src={existingVideo} controls playsInline preload="metadata"
                  controlsList="nodownload noremoteplayback"
                  disablePictureInPicture
                  onContextMenu={(e: React.MouseEvent) => e.preventDefault()}
                  sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }} />
              </Box>
              <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Button
                  onClick={() => setVideoModalOpen(true)}
                  sx={{ border: '1px solid #E5E7EB', color: '#374151', textTransform: 'none', borderRadius: '0.5rem', px: '1rem', py: '0.4375rem', fontWeight: 500, fontSize: '0.8125rem', '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: '#F5F3FF' } }}
                >
                  <i className="fas fa-redo" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />
                  Re-record video
                </Button>
                <Button
                  onClick={handleVideoRemove}
                  sx={{ border: '1px solid #FEE2E2', color: '#EF4444', textTransform: 'none', borderRadius: '0.5rem', px: '1rem', py: '0.4375rem', fontWeight: 500, fontSize: '0.8125rem', '&:hover': { borderColor: '#EF4444', background: '#FEF2F2' } }}
                >
                  <i className="fas fa-trash-alt" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />
                  Remove video
                </Button>
              </Box>
            </Box>
          ) : (
            /* ── No video — record CTA ── */
            <Box sx={{ border: '2px dashed #E5E7EB', borderRadius: '0.875rem', p: '2.5rem 1.5rem', textAlign: 'center', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', background: '#F5F3FF' } }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '1rem' }}>
                <i className="fas fa-video" style={{ fontSize: '1.5rem', color: '#4F46E5' }} />
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', mb: '0.375rem' }}>
                Record a Video Introduction
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', mb: '1.25rem', maxWidth: 360, mx: 'auto' }}>
                Follow on-screen prompts to record a short identity verification clip (~30s).
                Profiles with videos get up to 3× more exchange requests.
              </Typography>
              <Button
                onClick={() => setVideoModalOpen(true)}
                sx={{ background: GRAD, color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', px: '1.5rem', py: '0.5625rem', boxShadow: '0 2px 10px rgba(79,70,229,0.3)', '&:hover': { opacity: 0.9 } }}
              >
                <i className="fas fa-video" style={{ marginRight: '0.5rem', fontSize: '0.875rem' }} />
                Record Introduction Video
              </Button>
            </Box>
          )}
        </SectionCard>

        {/* ── Video recording modal ── */}
        <VideoIntroModal
          open={videoModalOpen}
          onClose={() => setVideoModalOpen(false)}
          userName={name || user?.name || ''}
          userEmail={(user as unknown as { email?: string })?.email}
          userSkills={skills}
          userInterests={interests}
          onSaved={handleVideoSaved}
        />

        {/* ═══════════════════════════════════════════════════════════════
            3 — Preferred Tags
        ═══════════════════════════════════════════════════════════════ */}
        <SectionCard
          icon="fa-tags"
          title="Your Interests & Tags"
          subtitle="Select topics you care about — your feed will prioritise matching posts"
        >
          {/* Selected tags */}
          {preferredTags.length > 0 && (
            <Box sx={{ mb: '1.25rem' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.625rem' }}>
                Your selected tags ({preferredTags.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {preferredTags.map((tag) => {
                  const meta = POPULAR_TAGS.find((p) => p.label === tag);
                  return (
                    <Box
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      sx={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        px: '0.875rem', py: '0.375rem',
                        borderRadius: '2rem',
                        background: GRAD,
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'opacity 0.15s',
                        '&:hover': { opacity: 0.82 },
                      }}
                    >
                      {meta?.icon && <span>{meta.icon}</span>}
                      {tag}
                      <i className="fas fa-times" style={{ fontSize: '0.625rem', marginLeft: '0.125rem', opacity: 0.8 }} />
                    </Box>
                  );
                })}
              </Box>
            </Box>
          )}

          {/* Popular tags grid */}
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.75rem' }}>
            Popular tags — click to {preferredTags.length === 0 ? 'select' : 'toggle'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', mb: '1.25rem' }}>
            {POPULAR_TAGS.map(({ label, icon }) => {
              const selected = preferredTags.includes(label);
              return (
                <Box
                  key={label}
                  onClick={() => toggleTag(label)}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                    px: '0.875rem', py: '0.375rem',
                    borderRadius: '2rem',
                    border: selected ? '2px solid transparent' : '1.5px solid #E5E7EB',
                    background: selected ? GRAD : '#F9FAFB',
                    color: selected ? '#fff' : '#374151',
                    fontWeight: selected ? 600 : 400,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    userSelect: 'none',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: selected ? 'transparent' : '#4F46E5',
                      color: selected ? '#fff' : '#4F46E5',
                      background: selected ? GRAD : '#EEF2FF',
                    },
                  }}
                >
                  <span>{icon}</span>
                  {label}
                  {selected && (
                    <i className="fas fa-check" style={{ fontSize: '0.6rem', marginLeft: '0.125rem' }} />
                  )}
                </Box>
              );
            })}
          </Box>

          {/* Custom tag input with dropdown */}
          <Box sx={{ borderTop: '1px solid #F3F4F6', pt: '1.125rem' }} ref={tagContainerRef}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.625rem' }}>
              Add a custom tag
            </Typography>
            <Box sx={{ position: 'relative' }}>
              <Box
                component="input"
                value={tagInput}
                disabled={preferredTags.length >= 30}
                placeholder={preferredTags.length >= 30 ? 'Max 30 tags reached' : 'e.g. beekeeping, upcycling, origami…'}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setTagInput(e.target.value); setTagHighlight(-1); setTagDropdownOpen(true);
                }}
                onFocus={() => setTagDropdownOpen(true)}
                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                  if (!tagContainerRef.current?.contains(e.relatedTarget as Node))
                    setTimeout(() => setTagDropdownOpen(false), 150);
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                  const query = tagInput.trim().toLowerCase();
                  const popLabels = POPULAR_TAGS.map(p => p.label);
                  const filtered = popLabels.filter(s => !preferredTags.includes(s) && s.includes(query));
                  const showCustom = query && !popLabels.includes(query) && !preferredTags.includes(query);
                  const items = showCustom ? [query, ...filtered] : filtered;
                  if (e.key === 'ArrowDown') { e.preventDefault(); setTagHighlight(h => Math.min(h + 1, items.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setTagHighlight(h => Math.max(h - 1, 0)); }
                  else if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const pick = tagHighlight >= 0 ? items[tagHighlight] : query;
                    if (pick) { addCustomTag(pick); setTagDropdownOpen(false); setTagHighlight(-1); }
                  } else if (e.key === 'Escape') { setTagDropdownOpen(false); }
                }}
                sx={{
                  width: '100%', padding: '0.75rem 1rem', border: '1px solid #E5E7EB',
                  borderRadius: tagDropdownOpen && preferredTags.length < 30 ? '0.5rem 0.5rem 0 0' : '0.5rem',
                  fontSize: '0.875rem', fontFamily: 'Inter,sans-serif',
                  outline: 'none', boxSizing: 'border-box', color: '#1F2937',
                  transition: 'border-color 0.15s',
                  '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
                  '&::placeholder': { color: '#9CA3AF' },
                  background: '#FFF',
                }}
              />
              {tagDropdownOpen && preferredTags.length < 30 && (() => {
                const query = tagInput.trim().toLowerCase();
                const popLabels = POPULAR_TAGS.map(p => p.label);
                const filtered = popLabels.filter(s => !preferredTags.includes(s) && (query === '' || s.includes(query)));
                const showCustom = query && !popLabels.includes(query) && !preferredTags.includes(query);
                const items: Array<{ label: string; icon?: string; isCustom: boolean }> = [
                  ...(showCustom ? [{ label: query, isCustom: true }] : []),
                  ...filtered.map(s => ({ label: s, icon: POPULAR_TAGS.find(p => p.label === s)?.icon, isCustom: false })),
                ];
                if (!items.length) return null;
                return (
                  <Box sx={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                    background: '#FFF', border: '1px solid #4F46E5', borderTop: 'none',
                    borderRadius: '0 0 0.5rem 0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    maxHeight: 220, overflowY: 'auto',
                  }}>
                    {items.map((item, i) => (
                      <Box key={item.label}
                        onMouseDown={(e: React.MouseEvent) => {
                          e.preventDefault();
                          addCustomTag(item.label);
                          setTagDropdownOpen(false);
                          setTagHighlight(-1);
                        }}
                        onMouseEnter={() => setTagHighlight(i)}
                        sx={{
                          px: '1rem', py: '0.625rem', cursor: 'pointer', fontSize: '0.875rem',
                          fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.5rem',
                          background: tagHighlight === i ? '#EEF2FF' : 'transparent',
                          color: tagHighlight === i ? '#4F46E5' : '#1F2937',
                          transition: 'background 0.1s',
                          borderTop: i === 0 ? 'none' : '1px solid #F3F4F6',
                        }}>
                        {item.isCustom
                          ? <><i className="fas fa-plus" style={{ fontSize: '0.7rem', color: '#10B981' }} /><span>Add <strong>"{item.label}"</strong></span></>
                          : <><span style={{ fontSize: '1rem' }}>{item.icon}</span><span>#{item.label}</span></>
                        }
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', mt: '0.375rem' }}>
              Type to search or add a custom tag — max 30 tags
            </Typography>
          </Box>
        </SectionCard>

        {/* ── Bottom action bar ──────────────────────────────────────────── */}
        <Box sx={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #E5E7EB', p: '1.25rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', flex: 1 }}>
            {saving ? 'Saving your changes…' : saved ? '✓ Saved! Redirecting…' : 'All changes are visible to your community'}
          </Typography>
          <Button onClick={() => navigate('/profile/me')} disabled={saving}
            sx={{ border: '1px solid #E5E7EB', color: '#6B7280', textTransform: 'none', borderRadius: '0.5rem', px: '1.25rem', py: '0.5625rem', fontWeight: 500, '&:hover': { borderColor: '#9CA3AF' } }}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}
            sx={{ background: GRAD, color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', px: '1.75rem', py: '0.5625rem', boxShadow: '0 2px 12px rgba(79,70,229,0.3)', '&:hover': { opacity: 0.92 }, '&:disabled': { opacity: 0.6, color: '#fff' } }}>
            {saving
              ? <><CircularProgress size={14} sx={{ mr: '0.5rem', color: '#fff' }} />Saving…</>
              : <><i className="fas fa-save" style={{ marginRight: '0.5rem', fontSize: '0.875rem' }} />Save Changes</>}
          </Button>
        </Box>

      </Box>
    </Layout>
  );
};

export default EditProfile;
