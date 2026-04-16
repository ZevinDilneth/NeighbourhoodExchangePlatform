import React, { useState, useRef, useCallback } from 'react';
import { Box, Typography, Button, Alert, Chip, Avatar, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ─────────────────────── constants ─────────────────────── */

const PRESET_CATEGORIES = [
  'Gardening', 'DIY', 'Cooking', 'Fitness', 'Arts', 'Music', 'Language', 'Tech', 'Business',
  'Skills', 'Tools', 'Events', 'Sports',
];

const STEPS = ['Details', 'Privacy', 'Rules', 'Members', 'Customize', 'Review'];

const PRIVACY_OPTIONS = [
  { value: 'public', icon: 'fas fa-globe', label: 'Public', desc: 'Anyone can discover and join this group', color: '#10B981', bg: '#ECFDF5' },
  { value: 'restricted', icon: 'fas fa-users', label: 'Private', desc: 'Members must request to join', color: '#4F46E5', bg: '#EEF2FF' },
  { value: 'private', icon: 'fas fa-lock', label: 'Hidden', desc: 'Only invited members can join', color: '#6B7280', bg: '#F3F4F6' },
];

const DEFAULT_RULES = [
  { key: 'respectful', label: 'Be Respectful', desc: 'Treat all members with kindness and respect', icon: 'fas fa-heart' },
  { key: 'onTopic', label: 'Stay On Topic', desc: 'Keep discussions relevant to the group theme', icon: 'fas fa-comment-alt' },
  { key: 'noSpam', label: 'No Spam', desc: 'No promotional content or repetitive messages', icon: 'fas fa-ban' },
  { key: 'legal', label: 'Keep It Legal', desc: 'All activities must comply with local laws', icon: 'fas fa-gavel' },
  { key: 'appropriate', label: 'Appropriate Language', desc: 'Use language suitable for all audiences', icon: 'fas fa-font' },
];

const GROUP_COLORS = [
  '#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
];

const BANNER_PATTERNS = [
  { id: 'none', label: 'None', preview: 'transparent' },
  { id: 'dots', label: 'Dots', preview: 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)' },
  { id: 'lines', label: 'Lines', preview: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.15) 0px, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 8px)' },
  { id: 'grid', label: 'Grid', preview: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)' },
  { id: 'waves', label: 'Waves', preview: 'repeating-radial-gradient(circle at 0 0, transparent 0, rgba(255,255,255,0.1) 8px)' },
  { id: 'zigzag', label: 'Zigzag', preview: 'linear-gradient(135deg, rgba(255,255,255,0.15) 25%, transparent 25%) -8px 0, linear-gradient(225deg, rgba(255,255,255,0.15) 25%, transparent 25%) -8px 0' },
];

/* ─────────────────────── shared style helpers ─────────────────────── */

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  border: '1px solid #E5E7EB',
  borderRadius: '0.5rem',
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.9375rem',
  color: '#1F2937',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#374151',
  marginBottom: '0.5rem',
  fontFamily: 'Inter, sans-serif',
};

const fieldGroupStyle: React.CSSProperties = { marginBottom: '1.5rem' };

/* ─────────────────────── Toggle Switch ─────────────────────── */

const ToggleSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: checked ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#E5E7EB',
      position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 2, left: checked ? 22 : 2,
      width: 20, height: 20, borderRadius: '50%',
      background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      transition: 'left 0.2s', display: 'block',
    }} />
  </button>
);

/* ─────────────────────── StepIndicator ─────────────────────── */

const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, flexWrap: 'wrap', rowGap: '0.5rem' }}>
    {STEPS.map((label, idx) => {
      const done = idx < current;
      const active = idx === current;
      return (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: done ? '#10B981' : active ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#E5E7EB',
              color: (done || active) ? '#fff' : '#9CA3AF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.875rem', fontFamily: 'Poppins, sans-serif',
              boxShadow: active ? '0 4px 6px -1px rgba(79,70,229,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
              {done ? <i className="fas fa-check" style={{ fontSize: '0.75rem' }} /> : idx + 1}
            </div>
            <span style={{
              fontSize: '0.6875rem', fontWeight: active ? 600 : 400,
              color: active ? '#4F46E5' : done ? '#10B981' : '#9CA3AF',
              whiteSpace: 'nowrap', fontFamily: 'Inter, sans-serif',
            }}>
              {label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div style={{
              flex: 1, height: 2, minWidth: 20, maxWidth: 48,
              background: done ? '#10B981' : '#E5E7EB',
              marginBottom: 22, transition: 'background 0.2s',
            }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

/* ─────────────────────── main component ─────────────────────── */

interface InvitedUser {
  _id: string;
  name: string;
  avatar?: string;
  bio?: string;
  location?: { city?: string; neighbourhood?: string };
}

const CreateGroup: React.FC = () => {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [categoryMode, setCategoryMode] = useState<'preset' | 'custom'>('preset');
  const [customCategoryInput, setCustomCategoryInput] = useState('');

  /* ── members search ── */
  const [memberSearch, setMemberSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [invitedUsers, setInvitedUsers] = useState<InvitedUser[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── group icon ── */
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  /* ── cover image ── */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    type: 'public' as 'public' | 'private' | 'restricted',
    category: '',
    location: '',
    tags: [] as string[],
    rules: {
      respectful: true, onTopic: true, noSpam: true, legal: true, appropriate: true,
    } as Record<string, boolean>,
    customRules: '',
    color: '#4F46E5',
    bannerPattern: 'none',
  });

  const setField = (field: string, value: unknown) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const effectiveCategory = categoryMode === 'custom' ? customCategoryInput.trim() : form.category;

  /* ── tags ── */
  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
      if (!form.tags.includes(tag) && form.tags.length < 10) setField('tags', [...form.tags, tag]);
      setTagInput('');
    }
  };
  const removeTag = (tag: string) => setField('tags', form.tags.filter(t => t !== tag));

  /* ── user search ── */
  const handleMemberSearchChange = useCallback((val: string) => {
    setMemberSearch(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(val.trim()), 400);
  }, []);

  const { data: searchResults = [], isFetching: isSearching } = useQuery<InvitedUser[]>({
    queryKey: ['userSearch', searchQuery],
    queryFn: () =>
      searchQuery.length >= 2
        ? api.get('/groups/users/search', { params: { q: searchQuery } }).then(r => r.data)
        : Promise.resolve([]),
    enabled: searchQuery.length >= 2,
    staleTime: 10_000,
  });

  const filteredResults = searchResults.filter(u => !invitedUsers.some(inv => inv._id === u._id));

  const addInvitedUser = (user: InvitedUser) => {
    setInvitedUsers(prev => [...prev, user]);
    setMemberSearch('');
    setSearchQuery('');
  };

  const removeInvitedUser = (id: string) => setInvitedUsers(prev => prev.filter(u => u._id !== id));

  /* ── group icon ── */
  const handleIconFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconFile(file);
    const reader = new FileReader();
    reader.onload = ev => setIconPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* ── cover image ── */
  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = ev => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* ── validation ── */
  const validateStep = (): boolean => {
    setError('');
    if (step === 0) {
      if (!form.name.trim()) { setError('Group name is required.'); return false; }
      if (!effectiveCategory) { setError('Category is required.'); return false; }
      if (categoryMode === 'custom' && customCategoryInput.trim().length < 2) {
        setError('Custom category must be at least 2 characters.'); return false;
      }
      if (!form.description.trim()) { setError('Description is required.'); return false; }
    }
    return true;
  };

  const handleNext = () => { if (!validateStep()) return; if (step < STEPS.length - 1) setStep(s => s + 1); };
  const handleBack = () => { setError(''); if (step > 0) setStep(s => s - 1); };

  /* ── mutation ── */
  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Create group
      const res = await api.post('/groups', {
        name: form.name,
        description: form.description,
        type: form.type,
        category: effectiveCategory,
        tags: form.tags,
        color: form.color,
        bannerPattern: form.bannerPattern,
      });
      const groupId: string = res.data._id;

      // 2. Upload group icon if provided
      if (iconFile) {
        const fd = new FormData();
        fd.append('avatar', iconFile);
        await api.post(`/groups/${groupId}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // 3. Upload cover image if provided
      if (coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        await api.post(`/groups/${groupId}/cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      // 4. Send invitations
      if (invitedUsers.length > 0) {
        await api.post(`/groups/${groupId}/invite`, { userIds: invitedUsers.map(u => u._id) });
      }

      return groupId;
    },
    onSuccess: (groupId) => navigate(`/groups/${groupId}`),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Group not created — check your connection and try again.');
    },
  });

  const handleSubmit = () => { setError(''); mutation.mutate(); };

  const cardStyle: React.CSSProperties = {
    background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', padding: '2rem',
  };

  /* ─────────── Step renderers ─────────── */

  const renderStep1 = () => (
    <>
      {/* Group Name */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Group Name <span style={{ color: '#EF4444' }}>*</span></label>
        <input
          style={inputStyle} value={form.name} maxLength={100}
          placeholder="e.g. Hackney Gardeners, East Side Fixers"
          onChange={e => setField('name', e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#4F46E5')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem', textAlign: 'right' }}>
          {form.name.length}/100
        </div>
      </div>

      {/* Category */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Category <span style={{ color: '#EF4444' }}>*</span></label>

        {/* Toggle between preset and custom */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {(['preset', 'custom'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => { setCategoryMode(mode); if (mode === 'preset') setCustomCategoryInput(''); }}
              style={{
                padding: '0.3rem 0.9rem',
                borderRadius: '999px',
                border: `1px solid ${categoryMode === mode ? '#4F46E5' : '#E5E7EB'}`,
                background: categoryMode === mode ? '#EEF2FF' : '#FFFFFF',
                color: categoryMode === mode ? '#4F46E5' : '#6B7280',
                fontSize: '0.8125rem',
                fontWeight: categoryMode === mode ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.15s',
              }}
            >
              {mode === 'preset' ? 'Choose from list' : 'Custom category'}
            </button>
          ))}
        </div>

        {categoryMode === 'preset' ? (
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.category}
            onChange={e => setField('category', e.target.value)}
            onFocus={e => (e.target.style.borderColor = '#4F46E5')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          >
            <option value="">Select a category...</option>
            {PRESET_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        ) : (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', top: '50%', left: '0.875rem', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
              <i className="fas fa-tag" />
            </span>
            <input
              style={{ ...inputStyle, paddingLeft: '2.25rem' }}
              value={customCategoryInput}
              maxLength={50}
              placeholder="e.g. Beekeeping, Urban Foraging, Vintage Cars..."
              onChange={e => setCustomCategoryInput(e.target.value)}
              onFocus={e => (e.target.style.borderColor = '#4F46E5')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>
        )}
      </div>

      {/* Description */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Description <span style={{ color: '#EF4444' }}>*</span></label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
          value={form.description} maxLength={1000} rows={4}
          placeholder="What is this group about? What will members do or share?"
          onChange={e => setField('description', e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#4F46E5')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        <div style={{ fontSize: '0.75rem', color: '#9CA3AF', marginTop: '0.25rem', textAlign: 'right' }}>
          {form.description.length}/1000
        </div>
      </div>

      {/* Location */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Location <span style={{ fontSize: '0.8125rem', color: '#9CA3AF', fontWeight: 400 }}>(optional)</span></label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', top: '50%', left: '0.875rem', transform: 'translateY(-50%)', color: '#9CA3AF' }}>
            <i className="fas fa-map-marker-alt" />
          </span>
          <input
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
            value={form.location} placeholder="e.g. Brooklyn, NY"
            onChange={e => setField('location', e.target.value)}
            onFocus={e => (e.target.style.borderColor = '#4F46E5')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
        </div>
      </div>

      {/* Tags */}
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Tags</label>
        <input
          style={inputStyle} value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={addTag}
          placeholder="Type a tag and press Enter (max 10)"
          disabled={form.tags.length >= 10}
          onFocus={e => (e.target.style.borderColor = '#4F46E5')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
        {form.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
            {form.tags.map(tag => (
              <Chip key={tag} label={`#${tag}`} size="small" onDelete={() => removeTag(tag)}
                sx={{ bgcolor: '#EEF2FF', color: '#4F46E5', '& .MuiChip-deleteIcon': { color: '#4F46E5' } }}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );

  const renderStep2 = () => (
    <>
      <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5, lineHeight: 1.6 }}>
        Choose who can see and join your group. You can change this later in group settings.
      </Typography>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {PRIVACY_OPTIONS.map(opt => {
          const selected = form.type === opt.value;
          return (
            <div key={opt.value} onClick={() => setField('type', opt.value)} style={{
              border: selected ? `2px solid ${opt.color}` : '1px solid #E5E7EB',
              padding: '1rem', borderRadius: '0.5rem', cursor: 'pointer',
              background: selected ? opt.bg : '#FFFFFF',
              display: 'flex', alignItems: 'center', gap: '1rem', transition: 'all 0.15s',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '0.5rem',
                background: selected ? opt.bg : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: selected ? opt.color : '#9CA3AF', fontSize: '1.2rem', flexShrink: 0,
                border: selected ? `1px solid ${opt.color}30` : '1px solid transparent',
              }}>
                <i className={opt.icon} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: selected ? opt.color : '#1F2937', fontFamily: 'Inter, sans-serif', marginBottom: '0.25rem' }}>{opt.label}</div>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>{opt.desc}</div>
              </div>
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: `2px solid ${selected ? opt.color : '#D1D5DB'}`,
                background: selected ? opt.color : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
              }}>
                {selected && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  const renderStep3 = () => (
    <>
      <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5, lineHeight: 1.6 }}>
        Set community guidelines to keep your group welcoming and productive.
      </Typography>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
        {DEFAULT_RULES.map(rule => (
          <div key={rule.key} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
            background: form.rules[rule.key] ? '#F9FAFB' : '#FFFFFF', gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{
                width: 36, height: 36, borderRadius: '0.5rem',
                background: form.rules[rule.key] ? '#EEF2FF' : '#F3F4F6',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: form.rules[rule.key] ? '#4F46E5' : '#9CA3AF', flexShrink: 0,
              }}>
                <i className={rule.icon} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Inter, sans-serif' }}>{rule.label}</div>
                <div style={{ fontSize: '0.8125rem', color: '#6B7280', marginTop: '0.125rem' }}>{rule.desc}</div>
              </div>
            </div>
            <ToggleSwitch checked={form.rules[rule.key]} onChange={v => setField('rules', { ...form.rules, [rule.key]: v })} />
          </div>
        ))}
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Custom Rules <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: '0.8125rem' }}>(optional)</span></label>
        <textarea
          style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
          value={form.customRules} rows={3}
          placeholder="Add any specific rules for your group..."
          onChange={e => setField('customRules', e.target.value)}
          onFocus={e => (e.target.style.borderColor = '#4F46E5')}
          onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
        />
      </div>
    </>
  );

  const renderStep4 = () => (
    <>
      <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5, lineHeight: 1.6 }}>
        Search for community members to invite. They'll receive a notification to accept or decline.
      </Typography>

      {/* Search box */}
      <div style={{ ...fieldGroupStyle, position: 'relative' }}>
        <label style={labelStyle}>Search Members</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', top: '50%', left: '0.875rem', transform: 'translateY(-50%)', color: '#9CA3AF', zIndex: 1 }}>
            {isSearching ? <CircularProgress size={14} sx={{ color: '#9CA3AF' }} /> : <i className="fas fa-search" />}
          </span>
          <input
            style={{ ...inputStyle, paddingLeft: '2.25rem' }}
            value={memberSearch}
            onChange={e => handleMemberSearchChange(e.target.value)}
            placeholder="Search by name or email..."
            onFocus={e => (e.target.style.borderColor = '#4F46E5')}
            onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
          />
        </div>

        {/* Search results dropdown */}
        {searchQuery.length >= 2 && filteredResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)', marginTop: '0.25rem',
            maxHeight: 280, overflowY: 'auto',
          }}>
            {filteredResults.map(user => (
              <div
                key={user._id}
                onClick={() => addInvitedUser(user)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', cursor: 'pointer', transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar src={user.avatar} sx={{ width: 38, height: 38, background: 'linear-gradient(135deg,#4F46E5,#10B981)', fontSize: '0.875rem' }}>
                  {user.name?.charAt(0)}
                </Avatar>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Inter, sans-serif' }}>{user.name}</div>
                  {(() => {
                    const viewerCity = authUser?.location?.city?.toLowerCase().trim() || '';
                    const memberCity = user.location?.city?.toLowerCase().trim() || '';
                    const isLocal = !viewerCity || !memberCity || viewerCity === memberCity;
                    return (
                      <div style={{ fontSize: '0.75rem', color: isLocal ? '#10B981' : '#6B7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <i className={`fas ${isLocal ? 'fa-map-marker-alt' : 'fa-map-marker'}`} style={{ fontSize: '0.65rem' }} />
                        {isLocal ? 'Local area' : 'Outside your area'}
                      </div>
                    );
                  })()}
                </div>
                <span style={{ color: '#4F46E5', fontSize: '0.8rem', fontWeight: 500 }}>Invite</span>
              </div>
            ))}
          </div>
        )}

        {searchQuery.length >= 2 && !isSearching && filteredResults.length === 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)', marginTop: '0.25rem',
            padding: '1rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.875rem',
          }}>
            No users found matching "{searchQuery}"
          </div>
        )}
      </div>

      {/* Invited users list */}
      {invitedUsers.length > 0 ? (
        <div>
          <label style={{ ...labelStyle, marginBottom: '0.75rem' }}>
            Invited ({invitedUsers.length})
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {invitedUsers.map(user => (
              <div key={user._id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                background: '#F9FAFB',
              }}>
                <Avatar src={user.avatar} sx={{ width: 36, height: 36, background: 'linear-gradient(135deg,#4F46E5,#10B981)', fontSize: '0.875rem' }}>
                  {user.name?.charAt(0)}
                </Avatar>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937' }}>{user.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 500 }}>
                    <i className="fas fa-check" style={{ marginRight: '0.25rem' }} /> Invited
                  </span>
                  <button
                    type="button"
                    onClick={() => removeInvitedUser(user._id)}
                    style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}
                  >
                    <i className="fas fa-times" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#9CA3AF' }}>
          <i className="fas fa-user-plus" style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }} />
          <div style={{ fontSize: '0.9rem' }}>Search above to find and invite members</div>
          <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>You can also skip this step and invite members later</div>
        </div>
      )}
    </>
  );

  const renderStep5 = () => {
    const patternBg = (id: string) => {
      const p = BANNER_PATTERNS.find(p => p.id === id);
      return p ? p.preview : 'transparent';
    };

    return (
      <>
        <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5, lineHeight: 1.6 }}>
          Personalize your group to make it stand out in the community.
        </Typography>

        {/* Group Icon */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Group Icon</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Icon preview circle */}
            <div
              onClick={() => iconInputRef.current?.click()}
              style={{
                width: 88, height: 88, borderRadius: '1rem', flexShrink: 0,
                border: '2px dashed #E5E7EB', cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: iconPreview ? 'transparent' : (form.color || '#4F46E5') + '22',
                position: 'relative', transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F46E5')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
            >
              {iconPreview ? (
                <>
                  <img src={iconPreview} alt="Icon preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >
                    <i className="fas fa-camera" style={{ color: '#fff', fontSize: '1.125rem' }} />
                  </div>
                </>
              ) : (
                <span style={{
                  fontSize: '2rem', fontWeight: 700, color: form.color || '#4F46E5',
                  fontFamily: 'Poppins, sans-serif', userSelect: 'none',
                }}>
                  {form.name ? form.name[0].toUpperCase() : <i className="fas fa-image" style={{ fontSize: '1.5rem', color: '#9CA3AF' }} />}
                </span>
              )}
            </div>

            {/* Upload prompt */}
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter, sans-serif', marginBottom: '0.375rem' }}>
                Upload Group Icon
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter, sans-serif', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                Square image works best. Appears on your group card and header.
                <br />JPEG, PNG, WebP — up to 5 MB
              </div>
              <button
                type="button"
                onClick={() => iconInputRef.current?.click()}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                  padding: '0.4rem 0.875rem', borderRadius: '0.5rem',
                  border: '1px solid #E5E7EB', background: '#F9FAFB',
                  fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                  color: '#1F2937', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.background = '#F9FAFB'; e.currentTarget.style.color = '#1F2937'; }}
              >
                <i className="fas fa-upload" />
                {iconPreview ? 'Change Icon' : 'Upload Icon'}
              </button>
              {iconPreview && (
                <button
                  type="button"
                  onClick={() => { setIconFile(null); setIconPreview(null); }}
                  style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#EF4444', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
                >
                  <i className="fas fa-trash" style={{ marginRight: '0.25rem' }} />Remove
                </button>
              )}
            </div>
          </div>
          <input
            ref={iconInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleIconFileChange}
          />
        </div>

        {/* Cover image */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Cover Image</label>
          <div
            onClick={() => coverInputRef.current?.click()}
            style={{
              width: '100%', height: 160, borderRadius: '0.75rem',
              border: '2px dashed #E5E7EB', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative', transition: 'border-color 0.2s',
              background: coverPreview ? 'transparent' : '#F9FAFB',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4F46E5')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E7EB')}
          >
            {coverPreview ? (
              <>
                <img src={coverPreview} alt="Cover preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 600 }}>
                    <i className="fas fa-camera" style={{ marginRight: '0.5rem' }} />Change Image
                  </span>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: '#9CA3AF' }}>
                <i className="fas fa-image" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>Click to upload cover image</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>JPEG, PNG, WebP — up to 5MB</div>
              </div>
            )}
          </div>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: 'none' }}
            onChange={handleCoverFileChange}
          />
          {coverPreview && (
            <button
              type="button"
              onClick={() => { setCoverFile(null); setCoverPreview(null); }}
              style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#EF4444', fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
            >
              <i className="fas fa-trash" style={{ marginRight: '0.25rem' }} /> Remove image
            </button>
          )}
        </div>

        {/* Group color */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Group Color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: '0.75rem' }}>
            {GROUP_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setField('color', color)}
                style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: color, border: 'none', cursor: 'pointer',
                  outline: form.color === color ? `3px solid ${color}` : 'none',
                  outlineOffset: 2,
                  boxShadow: form.color === color ? `0 0 0 2px #fff, 0 0 0 4px ${color}` : 'none',
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                {form.color === color && (
                  <i className="fas fa-check" style={{ color: '#fff', fontSize: '0.75rem' }} />
                )}
              </button>
            ))}
            {/* Custom color swatch */}
            <label style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: '2px dashed #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Custom color">
              <input
                type="color"
                value={form.color}
                onChange={e => setField('color', e.target.value)}
                style={{ opacity: 0, position: 'absolute', width: 0, height: 0 }}
              />
              <i className="fas fa-plus" style={{ color: '#9CA3AF', fontSize: '0.875rem' }} />
            </label>
          </div>

          {/* Live preview */}
          <div style={{
            height: 48, borderRadius: '0.5rem',
            background: form.color,
            display: 'flex', alignItems: 'center', paddingLeft: '1rem',
            color: '#fff', fontWeight: 600, fontSize: '0.875rem',
            fontFamily: 'Inter, sans-serif',
          }}>
            <i className="fas fa-users" style={{ marginRight: '0.5rem' }} />
            {form.name || 'Your Group Name'} &nbsp;
            <span style={{ fontWeight: 400, opacity: 0.8 }}>— color preview</span>
          </div>
        </div>

        {/* Banner pattern */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Banner Pattern</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.75rem' }}>
            {BANNER_PATTERNS.map(pattern => (
              <div
                key={pattern.id}
                onClick={() => setField('bannerPattern', pattern.id)}
                style={{
                  height: 70, borderRadius: '0.5rem', cursor: 'pointer',
                  background: form.color,
                  backgroundImage: patternBg(pattern.id),
                  backgroundSize: pattern.id === 'grid' ? '16px 16px' : '8px 8px',
                  border: form.bannerPattern === pattern.id ? `3px solid #4F46E5` : '2px solid #E5E7EB',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  paddingBottom: '0.375rem', transition: 'all 0.15s',
                  position: 'relative',
                }}
              >
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, color: '#fff',
                  background: 'rgba(0,0,0,0.35)', borderRadius: '999px',
                  padding: '0.125rem 0.5rem',
                }}>
                  {pattern.label}
                </span>
                {form.bannerPattern === pattern.id && (
                  <div style={{ position: 'absolute', top: '0.375rem', right: '0.375rem', width: 18, height: 18, borderRadius: '50%', background: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-check" style={{ color: '#fff', fontSize: '0.6rem' }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live banner preview */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Preview</label>
          <div style={{
            borderRadius: '0.75rem', overflow: 'hidden',
            border: '1px solid #E5E7EB',
          }}>
            <div style={{
              height: 100,
              background: form.color,
              backgroundImage: patternBg(form.bannerPattern),
              backgroundSize: form.bannerPattern === 'grid' ? '16px 16px' : '8px 8px',
              position: 'relative',
            }} />
            <div style={{ background: '#fff', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: 48, height: 48, borderRadius: '0.5rem', background: form.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1.25rem', marginTop: -24, border: '3px solid #fff', flexShrink: 0 }}>
                <i className="fas fa-users" />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: '#1F2937', fontFamily: 'Poppins, sans-serif' }}>{form.name || 'Your Group Name'}</div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>{effectiveCategory || 'Category'}</div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderStep6 = () => (
    <>
      <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5, lineHeight: 1.6 }}>
        Review your group details before publishing.
      </Typography>

      {[
        {
          title: 'Details', stepIdx: 0,
          rows: [
            { label: 'Name', value: form.name || '—' },
            { label: 'Category', value: effectiveCategory || '—' },
            { label: 'Location', value: form.location || 'Not specified' },
            { label: 'Description', value: form.description ? form.description.slice(0, 120) + (form.description.length > 120 ? '...' : '') : '—' },
          ],
        },
        {
          title: 'Privacy', stepIdx: 1,
          rows: [{ label: 'Type', value: PRIVACY_OPTIONS.find(o => o.value === form.type)?.label || '—' }],
        },
        {
          title: 'Rules', stepIdx: 2,
          rows: DEFAULT_RULES.filter(r => form.rules[r.key]).map(r => ({ label: r.label, value: 'Enabled' })),
        },
        {
          title: 'Members', stepIdx: 3,
          rows: [{ label: 'Invited', value: invitedUsers.length > 0 ? `${invitedUsers.length} member(s) — ${invitedUsers.map(u => u.name).join(', ')}` : 'None (open group)' }],
        },
        {
          title: 'Customize', stepIdx: 4,
          rows: [
            { label: 'Icon', value: iconFile ? iconFile.name : 'Not set' },
            { label: 'Color', value: form.color },
            { label: 'Banner', value: BANNER_PATTERNS.find(p => p.id === form.bannerPattern)?.label || 'None' },
            { label: 'Cover Image', value: coverFile ? coverFile.name : 'Not set' },
          ],
        },
      ].map(section => (
        <div key={section.title} style={{ border: '1px solid #E5E7EB', borderRadius: '0.5rem', marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.875rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
          }}>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins, sans-serif' }}>{section.title}</span>
            <button type="button" onClick={() => { setError(''); setStep(section.stepIdx); }}
              style={{ background: 'none', border: 'none', color: '#4F46E5', fontWeight: 500, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Edit
            </button>
          </div>
          <div style={{ padding: '0.875rem 1rem' }}>
            {section.rows.map(row => (
              <div key={row.label} style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                <span style={{ color: '#6B7280', minWidth: 90, flexShrink: 0 }}>{row.label}</span>
                <span style={{ color: '#1F2937', fontWeight: 500 }}>
                  {row.label === 'Color' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: row.value }} />
                      {row.value}
                    </span>
                  ) : row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {form.tags.length > 0 && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {form.tags.map(tag => (
            <Chip key={tag} label={`#${tag}`} size="small" sx={{ bgcolor: '#EEF2FF', color: '#4F46E5' }} />
          ))}
        </div>
      )}
    </>
  );

  const stepContent = [renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  /* ─────────────────────── right sidebar ─────────────────────── */

  const STEP_TIPS: { icon: string; title: string; tips: string[] }[] = [
    {
      icon: 'fas fa-info-circle', title: 'Group Details',
      tips: ['Choose a clear, memorable name', 'Pick a specific category so people can discover you', 'Write a description that explains what members will do together'],
    },
    {
      icon: 'fas fa-shield-alt', title: 'Privacy Settings',
      tips: ['Public groups grow faster through discovery', 'Private groups keep conversations exclusive', 'Hidden groups work best for invite-only communities'],
    },
    {
      icon: 'fas fa-gavel', title: 'Community Rules',
      tips: ['Clear rules reduce conflicts later', 'Enable rules that match your group culture', 'Custom rules let you add group-specific guidelines'],
    },
    {
      icon: 'fas fa-user-plus', title: 'Invite Members',
      tips: ['Invite people who share the interest', 'A few active members beats many inactive ones', 'Invitations appear as notifications — members can accept or decline'],
    },
    {
      icon: 'fas fa-paint-brush', title: 'Customization',
      tips: ['A cover image makes your group stand out', 'The color appears on your group badge and card', 'Patterns add texture to your group banner'],
    },
    {
      icon: 'fas fa-check-circle', title: 'Review',
      tips: ['Double-check the group name and category', 'You can edit all settings after creation', 'Members will be notified once the group is live'],
    },
  ];

  const bannerBg = (() => {
    const pat = BANNER_PATTERNS.find(b => b.id === form.bannerPattern);
    if (!pat || pat.id === 'none') return form.color;
    return `${pat.preview}, ${form.color}`;
  })();

  const rightPanel = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Live Preview Card */}
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          Live Preview
        </Typography>
        <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {/* Banner */}
          <Box sx={{
            height: 72, background: bannerBg,
            backgroundSize: form.bannerPattern === 'grid' ? '20px 20px' : '16px 16px',
            display: 'flex', alignItems: 'flex-end', p: '0 1rem 0.625rem',
          }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: '0.625rem',
              background: 'rgba(255,255,255,0.25)', border: '2px solid rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.125rem',
            }}>
              {coverPreview
                ? <img src={coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '0.5rem' }} />
                : <i className="fas fa-users" />}
            </Box>
          </Box>
          <Box sx={{ p: '0.75rem 1rem 1rem' }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', lineHeight: 1.3, mb: 0.25 }}>
              {form.name || <span style={{ color: '#9CA3AF' }}>Group name…</span>}
            </Typography>
            {effectiveCategory && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.875, py: 0.25, borderRadius: '1rem', background: `${form.color}18`, mb: 0.75 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: form.color }} />
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: form.color }}>{effectiveCategory}</Typography>
              </Box>
            )}
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {form.description || <span style={{ color: '#D1D5DB' }}>No description yet…</span>}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              {(() => {
                const p = PRIVACY_OPTIONS.find(o => o.value === form.type);
                return p ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <i className={p.icon} style={{ fontSize: '0.6875rem', color: p.color }} />
                    <Typography sx={{ fontSize: '0.6875rem', color: p.color, fontWeight: 600 }}>{p.label}</Typography>
                  </Box>
                ) : null;
              })()}
              {invitedUsers.length > 0 && (
                <Typography sx={{ fontSize: '0.6875rem', color: '#6B7280' }}>· {invitedUsers.length} invited</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Step Tips */}
      <Box>
        <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5 }}>
          Tips
        </Typography>
        <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: '0.5rem', background: 'linear-gradient(135deg, #4F46E5, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', flexShrink: 0 }}>
              <i className={STEP_TIPS[step].icon} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937' }}>{STEP_TIPS[step].title}</Typography>
          </Box>
          <Box component="ul" sx={{ m: 0, pl: '1.25rem', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {STEP_TIPS[step].tips.map(tip => (
              <Box component="li" key={tip} sx={{ fontSize: '0.8125rem', color: '#4B5563', lineHeight: 1.5 }}>{tip}</Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Progress */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280' }}>Progress</Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5' }}>{Math.round(((step + 1) / STEPS.length) * 100)}%</Typography>
        </Box>
        <Box sx={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', borderRadius: 3, background: 'linear-gradient(135deg, #4F46E5, #10B981)', width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s ease' }} />
        </Box>
        <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', mt: 0.75 }}>Step {step + 1} of {STEPS.length}</Typography>
      </Box>
    </Box>
  );

  /* ─────────────────────── render ─────────────────────── */

  return (
    <Layout rightPanel={rightPanel}>
      <Box sx={{ maxWidth: 700, mx: 'auto', py: 2 }}>

        {/* Page header card */}
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.75rem 2rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: 1.25 }}>
            <Box sx={{
              width: 52, height: 52, borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1.375rem', flexShrink: 0,
              boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)',
            }}>
              <i className="fas fa-users" />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#1F2937', lineHeight: 1.3 }}>
                Create New Group
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '0.875rem' }}>
                Build a community around a shared interest or skill
              </Typography>
            </Box>
          </Box>
          <Box sx={{ mt: 2.5 }}>
            <StepIndicator current={step} />
          </Box>
        </Box>

        {/* Form card */}
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '2rem', mb: 2 }}>
          <Box sx={{ mb: 2.5, pb: 2, borderBottom: '1px solid #E5E7EB' }}>
            <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mb: 0.25 }}>
              Step {step + 1}: {STEPS[step]}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              {STEPS.map((_, idx) => (
                <Box key={idx} sx={{
                  height: 3, flex: 1, borderRadius: 999,
                  background: idx <= step ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#E5E7EB',
                  transition: 'background 0.3s',
                }} />
              ))}
            </Box>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: '0.5rem' }}>{error}</Alert>}

          <div>{stepContent[step]()}</div>
        </Box>

        {/* Navigation buttons */}
        <Box sx={{
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem',
          p: '1.25rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2,
        }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined" onClick={() => navigate('/groups')}
              sx={{ borderColor: '#E5E7EB', color: '#6B7280', '&:hover': { borderColor: '#D1D5DB', background: '#F9FAFB' } }}
            >
              Cancel
            </Button>
            {step > 0 && (
              <Button
                variant="outlined" onClick={handleBack}
                startIcon={<i className="fas fa-arrow-left" style={{ fontSize: '0.875rem' }} />}
                sx={{ borderColor: '#E5E7EB', color: '#374151', '&:hover': { borderColor: '#D1D5DB', background: '#F9FAFB' } }}
              >
                Back
              </Button>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>{step + 1} of {STEPS.length}</Typography>
            {step < STEPS.length - 1 ? (
              <Button
                variant="contained" onClick={handleNext}
                endIcon={<i className="fas fa-arrow-right" style={{ fontSize: '0.875rem' }} />}
                sx={{
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  '&:hover': { background: 'linear-gradient(135deg, #4338CA, #059669)' },
                  boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)', fontWeight: 600, px: 3,
                }}
              >
                {step === STEPS.length - 2 ? 'Review' : 'Next'}
              </Button>
            ) : (
              <Button
                variant="contained" onClick={handleSubmit} disabled={mutation.isPending}
                startIcon={mutation.isPending ? <CircularProgress size={14} sx={{ color: '#fff' }} /> : <i className="fas fa-check" style={{ fontSize: '0.875rem' }} />}
                sx={{
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  '&:hover': { background: 'linear-gradient(135deg, #4338CA, #059669)' },
                  boxShadow: '0 4px 6px -1px rgba(79,70,229,0.2)', fontWeight: 600, px: 3,
                }}
              >
                {mutation.isPending ? 'Creating...' : 'Create Group'}
              </Button>
            )}
          </Box>
        </Box>
      </Box>
    </Layout>
  );
};

export default CreateGroup;
