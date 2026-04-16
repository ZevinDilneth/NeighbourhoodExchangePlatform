import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Group } from '../types';
import { useAuth } from '../context/AuthContext';
import { checkFields, PROFANITY_ERROR } from '../utils/contentFilter';

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6875rem 0.875rem',
  border: '1px solid #E5E7EB',
  borderRadius: '0.5rem',
  fontFamily: 'Inter, sans-serif',
  fontSize: '0.875rem',
  color: '#1F2937',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '0.3125rem',
  fontFamily: 'Inter, sans-serif',
};

// ── Reusable toggle switch ────────────────────────────────────────────────────

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    style={{
      width: 44,
      height: 24,
      borderRadius: 12,
      background: checked ? '#4F46E5' : '#D1D5DB',
      cursor: 'pointer',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0,
    }}
  >
    <div style={{
      position: 'absolute',
      top: 2,
      left: checked ? 22 : 2,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: 'white',
      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      transition: 'left 0.2s',
    }} />
  </div>
);

// ── Section card ──────────────────────────────────────────────────────────────

const SectionCard: React.FC<{
  icon: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}> = ({ icon, iconBg, title, subtitle, children }) => (
  <Box sx={{
    background: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    overflow: 'hidden',
    mb: 2.5,
  }}>
    {/* Header */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: '1.5rem', py: '1rem', borderBottom: '1px solid #F3F4F6' }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: '0.5rem',
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <i className={icon} style={{ color: 'white', fontSize: '0.9375rem' }} />
      </Box>
      <Box>
        <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize="0.9375rem" color="#1F2937">{title}</Typography>
        {subtitle && <Typography fontSize="0.8125rem" color="#6B7280">{subtitle}</Typography>}
      </Box>
    </Box>
    {/* Body */}
    <Box sx={{ px: '1.5rem', py: '1.25rem' }}>
      {children}
    </Box>
  </Box>
);

// ── Toggle row ────────────────────────────────────────────────────────────────

const ToggleRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, description, checked, onChange }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1 }}>
    <Box>
      <Typography fontSize="0.875rem" fontWeight={500} color="#1F2937" fontFamily="Inter, sans-serif">{label}</Typography>
      {description && <Typography fontSize="0.8125rem" color="#6B7280" fontFamily="Inter, sans-serif">{description}</Typography>}
    </Box>
    <Toggle checked={checked} onChange={onChange} />
  </Box>
);

// ── Main component ────────────────────────────────────────────────────────────

type SettingsForm = {
  // Basic
  name: string;
  description: string;
  category: string;
  tags: string;
  // Privacy
  type: string;
  requireJoinApproval: boolean;
  requirePostApproval: boolean;
  allowMemberPosts: boolean;
  // Moderation
  filterSpam: boolean;
  filterLinks: boolean;
  filterKeywords: boolean;
  bannedKeywords: string;
  reportThreshold: number;
  // Features
  featureEvents: boolean;
  featureResources: boolean;
  featurePolls: boolean;
  featureAnalytics: boolean;
  featureBadges: boolean;
  // Membership
  allowMemberInvites: boolean;
  autoApproveInvites: boolean;
};

const DEFAULT_SETTINGS: SettingsForm = {
  name: '', description: '', category: '', tags: '',
  type: 'public',
  requireJoinApproval: false, requirePostApproval: false, allowMemberPosts: true,
  filterSpam: true, filterLinks: false, filterKeywords: false, bannedKeywords: '', reportThreshold: 3,
  featureEvents: true, featureResources: true, featurePolls: true, featureAnalytics: false, featureBadges: false,
  allowMemberInvites: true, autoApproveInvites: false,
};

const CATEGORIES = [
  'Arts & Crafts', 'Education', 'Technology', 'Sports & Fitness', 'Food & Cooking',
  'Gardening', 'Music', 'Business', 'Health & Wellness', 'Environment',
  'Community Service', 'DIY & Home', 'Family & Parenting', 'Other',
];

const GroupSettings: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<SettingsForm>(DEFAULT_SETTINGS);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => { const res = await api.get(`/groups/${id}`); return res.data as Group; },
  });

  useEffect(() => {
    if (!group) return;
    const s = group.settings;
    setForm({
      name: group.name,
      description: group.description,
      category: group.category ?? '',
      tags: (group.tags ?? []).join(', '),
      type: group.type,
      requireJoinApproval: s?.requireJoinApproval ?? false,
      requirePostApproval: s?.requirePostApproval ?? false,
      allowMemberPosts: s?.allowMemberPosts ?? true,
      filterSpam: s?.filterSpam ?? true,
      filterLinks: s?.filterLinks ?? false,
      filterKeywords: s?.filterKeywords ?? false,
      bannedKeywords: (s?.bannedKeywords ?? []).join(', '),
      reportThreshold: s?.reportThreshold ?? 3,
      featureEvents: s?.featureEvents ?? true,
      featureResources: s?.featureResources ?? true,
      featurePolls: s?.featurePolls ?? true,
      featureAnalytics: s?.featureAnalytics ?? false,
      featureBadges: s?.featureBadges ?? false,
      allowMemberInvites: s?.allowMemberInvites ?? true,
      autoApproveInvites: s?.autoApproveInvites ?? false,
    });
  }, [group]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: (data: object) => api.put(`/groups/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group', id] });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to save — check your connection and try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/groups/${id}`),
    onSuccess: () => navigate('/groups'),
    onError: (err: unknown) =>
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to delete group.'),
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (checkFields(form.name, form.description)) { setError(PROFANITY_ERROR); return; }

    const body = {
      name: form.name,
      description: form.description,
      category: form.category,
      type: form.type,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      settings: {
        requireJoinApproval: form.requireJoinApproval,
        requirePostApproval: form.requirePostApproval,
        allowMemberPosts: form.allowMemberPosts,
        filterSpam: form.filterSpam,
        filterLinks: form.filterLinks,
        filterKeywords: form.filterKeywords,
        bannedKeywords: form.bannedKeywords.split(',').map(k => k.trim()).filter(Boolean),
        reportThreshold: form.reportThreshold,
        featureEvents: form.featureEvents,
        featureResources: form.featureResources,
        featurePolls: form.featurePolls,
        featureAnalytics: form.featureAnalytics,
        featureBadges: form.featureBadges,
        allowMemberInvites: form.allowMemberInvites,
        autoApproveInvites: form.autoApproveInvites,
      },
    };
    saveMutation.mutate(body);
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <Layout>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress size={32} sx={{ color: '#4F46E5' }} />
      </Box>
    </Layout>
  );

  // ── Admin guard ──────────────────────────────────────────────────────────────

  if (group && user) {
    const isAdmin =
      group.admin._id === user._id ||
      group.members.some(m => m.user._id === user._id && m.role === 'admin');

    if (!isAdmin) return (
      <Layout>
        <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, textAlign: 'center' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', background: '#FEF2F2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <i className="fas fa-lock" style={{ color: '#EF4444', fontSize: '1.5rem' }} />
          </Box>
          <Typography fontWeight={700} fontSize="1.25rem" color="#1F2937" mb={0.75}>Admins Only</Typography>
          <Typography fontSize="0.875rem" color="#6B7280" mb={3}>
            Group settings can only be changed by group admins.
          </Typography>
          <button onClick={() => navigate(`/groups/${id}`)} style={{
            padding: '0.625rem 1.5rem', background: 'linear-gradient(135deg,#4F46E5,#10B981)',
            color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600,
            fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
          }}>
            Back to Group
          </button>
        </Box>
      </Layout>
    );
  }

  const isOwner = group?.admin._id === user?._id;
  const adminMembers = (group?.members ?? []).filter(m => m.role === 'admin' || m.role === 'moderator');

  return (
    <Layout>
      <Box>

        {/* Back button */}
        <Box component="button" onClick={() => navigate(`/groups/${id}`)} sx={{
          display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
          mb: 2.5, background: 'transparent', border: 'none', color: '#6B7280',
          fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
          fontFamily: 'Inter, sans-serif', padding: '0.25rem 0',
          '&:hover': { color: '#4F46E5' },
        }}>
          <i className="fas fa-arrow-left" style={{ fontSize: '0.75rem' }} />
          Back to Group
        </Box>

        {/* Page header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '0.625rem',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="fas fa-cog" style={{ color: 'white', fontSize: '1.125rem' }} />
          </Box>
          <Box>
            <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize="1.375rem" color="#1F2937" lineHeight={1.2}>
              Group Settings
            </Typography>
            <Typography fontSize="0.875rem" color="#6B7280">Manage settings for {group?.name}</Typography>
          </Box>
        </Box>

        {/* Alert banners */}
        {success && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#ECFDF5',
            border: '1px solid #10B981', borderRadius: '0.5rem', px: '1rem', py: '0.75rem',
            mb: 2.5, color: '#065F46', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            <i className="fas fa-check-circle" style={{ color: '#10B981' }} />
            {success}
          </Box>
        )}
        {error && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, background: '#FEF2F2',
            border: '1px solid #FCA5A5', borderRadius: '0.5rem', px: '1rem', py: '0.75rem',
            mb: 2.5, color: '#991B1B', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
            <i className="fas fa-exclamation-circle" style={{ color: '#EF4444' }} />
            {error}
          </Box>
        )}

        <Box component="form" onSubmit={handleSave}>

          {/* ── 1. Basic Information ─────────────────────────────────────────── */}
          <SectionCard icon="fas fa-info-circle" iconBg="linear-gradient(135deg,#4F46E5,#6366F1)" title="Basic Information" subtitle="Edit your group's name, description, and category">

            <Box sx={{ mb: 2 }}>
              <label style={labelStyle}>Group Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input style={inputStyle} type="text" value={form.name} required
                onChange={e => set('name', e.target.value)}
                placeholder="Enter group name"
                onFocus={e => (e.target.style.borderColor = '#4F46E5')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <label style={labelStyle}>Description <span style={{ color: '#EF4444' }}>*</span></label>
              <textarea style={{ ...inputStyle, minHeight: '5rem', resize: 'vertical' }}
                value={form.description} required rows={3}
                onChange={e => set('description', e.target.value)}
                placeholder="Describe your group..."
                onFocus={e => (e.target.style.borderColor = '#4F46E5')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </Box>

            <Box sx={{ mb: 2 }}>
              <label style={labelStyle}>Category</label>
              <select style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}
                value={form.category} onChange={e => set('category', e.target.value)}
                onFocus={e => (e.target.style.borderColor = '#4F46E5')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              >
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Box>

            <Box>
              <label style={labelStyle}>Tags <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(comma-separated)</span></label>
              <input style={inputStyle} type="text" value={form.tags}
                onChange={e => set('tags', e.target.value)}
                placeholder="e.g. woodworking, tools, diy"
                onFocus={e => (e.target.style.borderColor = '#4F46E5')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
            </Box>
          </SectionCard>

          {/* ── 2. Privacy Settings ──────────────────────────────────────────── */}
          <SectionCard icon="fas fa-shield-alt" iconBg="linear-gradient(135deg,#10B981,#059669)" title="Privacy Settings" subtitle="Control who can join and see your group">

            <Box sx={{ mb: 2 }}>
              <label style={labelStyle}>Group Visibility</label>
              {[
                { value: 'public',     icon: 'fas fa-globe',   label: 'Public',     desc: 'Anyone can find and join this group' },
                { value: 'restricted', icon: 'fas fa-users',   label: 'Restricted', desc: 'Anyone can find, but must request to join' },
                { value: 'private',    icon: 'fas fa-lock',    label: 'Private',    desc: 'Only invited members can join' },
              ].map(opt => (
                <Box key={opt.value}
                  onClick={() => set('type', opt.value)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, p: '0.75rem 1rem',
                    border: `1px solid ${form.type === opt.value ? '#4F46E5' : '#E5E7EB'}`,
                    borderRadius: '0.5rem', mb: 1, cursor: 'pointer',
                    background: form.type === opt.value ? '#EEF2FF' : '#FAFAFA',
                    transition: 'all 0.15s',
                  }}
                >
                  <i className={opt.icon} style={{ color: form.type === opt.value ? '#4F46E5' : '#9CA3AF', width: 16 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937" fontFamily="Inter, sans-serif">{opt.label}</Typography>
                    <Typography fontSize="0.8125rem" color="#6B7280" fontFamily="Inter, sans-serif">{opt.desc}</Typography>
                  </Box>
                  <Box sx={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: `2px solid ${form.type === opt.value ? '#4F46E5' : '#D1D5DB'}`,
                    background: form.type === opt.value ? '#4F46E5' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {form.type === opt.value && <i className="fas fa-check" style={{ color: 'white', fontSize: '0.5625rem' }} />}
                  </Box>
                </Box>
              ))}
            </Box>

            <Box sx={{ borderTop: '1px solid #F3F4F6', pt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <ToggleRow label="Require approval for new members" description="Manually review each join request before approval" checked={form.requireJoinApproval} onChange={v => set('requireJoinApproval', v)} />
              <ToggleRow label="Require approval for new posts" description="All posts must be approved by a moderator before going live" checked={form.requirePostApproval} onChange={v => set('requirePostApproval', v)} />
              <ToggleRow label="Allow member posts" description="Members can create posts in the group feed" checked={form.allowMemberPosts} onChange={v => set('allowMemberPosts', v)} />
            </Box>
          </SectionCard>

          {/* ── 3. Content Moderation ─────────────────────────────────────────── */}
          <SectionCard icon="fas fa-filter" iconBg="linear-gradient(135deg,#F59E0B,#D97706)" title="Content Moderation" subtitle="Configure automatic content filtering and reporting">

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
              <ToggleRow label="Spam filter" description="Automatically detect and flag suspected spam posts" checked={form.filterSpam} onChange={v => set('filterSpam', v)} />
              <ToggleRow label="Block external links" description="Prevent members from sharing links to external websites" checked={form.filterLinks} onChange={v => set('filterLinks', v)} />
              <ToggleRow label="Keyword filter" description="Block posts containing banned keywords" checked={form.filterKeywords} onChange={v => set('filterKeywords', v)} />
            </Box>

            {form.filterKeywords && (
              <Box sx={{ mb: 2 }}>
                <label style={labelStyle}>Banned Keywords <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(comma-separated)</span></label>
                <textarea style={{ ...inputStyle, minHeight: '4rem', resize: 'vertical' }}
                  value={form.bannedKeywords} rows={2}
                  onChange={e => set('bannedKeywords', e.target.value)}
                  placeholder="e.g. spam, scam, adult"
                  onFocus={e => (e.target.style.borderColor = '#4F46E5')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </Box>
            )}

            <Box>
              <label style={labelStyle}>Report Threshold</label>
              <Typography fontSize="0.8125rem" color="#6B7280" sx={{ mb: 0.75, fontFamily: 'Inter, sans-serif' }}>
                Number of member reports required to auto-flag content for review
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[1, 2, 3, 5, 10].map(n => (
                  <Box key={n} onClick={() => set('reportThreshold', n)} sx={{
                    width: 40, height: 40, borderRadius: '0.5rem', cursor: 'pointer',
                    border: `1px solid ${form.reportThreshold === n ? '#4F46E5' : '#E5E7EB'}`,
                    background: form.reportThreshold === n ? '#EEF2FF' : '#FAFAFA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: '0.875rem', color: form.reportThreshold === n ? '#4F46E5' : '#6B7280',
                    fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                  }}>{n}</Box>
                ))}
              </Box>
            </Box>
          </SectionCard>

          {/* ── 4. Group Features ────────────────────────────────────────────── */}
          <SectionCard icon="fas fa-puzzle-piece" iconBg="linear-gradient(135deg,#8B5CF6,#7C3AED)" title="Group Features" subtitle="Enable or disable specific features for your group">

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <ToggleRow label="Events" description="Allow creating and RSVP-ing to events in this group" checked={form.featureEvents} onChange={v => set('featureEvents', v)} />
              <ToggleRow label="Resource Sharing" description="Allow members to upload and share files" checked={form.featureResources} onChange={v => set('featureResources', v)} />
              <ToggleRow label="Polls" description="Allow members to create polls and vote" checked={form.featurePolls} onChange={v => set('featurePolls', v)} />
              <ToggleRow label="Analytics" description="View detailed member engagement and activity stats" checked={form.featureAnalytics} onChange={v => set('featureAnalytics', v)} />
              <ToggleRow label="Badges & Achievements" description="Award badges to active and contributing members" checked={form.featureBadges} onChange={v => set('featureBadges', v)} />
            </Box>
          </SectionCard>

          {/* ── 5. Membership Settings ──────────────────────────────────────── */}
          <SectionCard icon="fas fa-user-plus" iconBg="linear-gradient(135deg,#EC4899,#DB2777)" title="Membership Settings" subtitle="Control how members can join and invite others">

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <ToggleRow label="Allow member invites" description="Members can invite others to join the group" checked={form.allowMemberInvites} onChange={v => set('allowMemberInvites', v)} />
              <ToggleRow label="Auto-approve invites" description="Invited users are automatically approved without needing admin review" checked={form.autoApproveInvites} onChange={v => set('autoApproveInvites', v)} />
            </Box>
          </SectionCard>

          {/* ── 6. Admin Management ─────────────────────────────────────────── */}
          <SectionCard icon="fas fa-user-shield" iconBg="linear-gradient(135deg,#0EA5E9,#0284C7)" title="Admin Management" subtitle="View admins and moderators">
            {adminMembers.length === 0 ? (
              <Typography fontSize="0.875rem" color="#6B7280" fontFamily="Inter, sans-serif">No admins or moderators found.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {adminMembers.map(m => (
                  <Box key={m.user._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
                    p: '0.75rem', border: '1px solid #F3F4F6', borderRadius: '0.5rem', background: '#FAFAFA' }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.user.avatar
                        ? <img src={m.user.avatar} alt={m.user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <i className="fas fa-user" style={{ color: 'white', fontSize: '0.875rem' }} />}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937" fontFamily="Inter, sans-serif" noWrap>
                        {m.user.name}
                        {m.user._id === group?.admin._id && (
                          <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#4F46E5', fontWeight: 700 }}>Owner</span>
                        )}
                      </Typography>
                      <Typography fontSize="0.8125rem" color="#6B7280" fontFamily="Inter, sans-serif" sx={{ textTransform: 'capitalize' }}>{m.role}</Typography>
                    </Box>
                    <Box sx={{
                      px: 1, py: 0.25, borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600,
                      fontFamily: 'Inter, sans-serif',
                      background: m.role === 'admin' ? '#EEF2FF' : '#F0FDF4',
                      color: m.role === 'admin' ? '#4F46E5' : '#16A34A',
                    }}>
                      {m.role === 'admin' ? 'Admin' : 'Mod'}
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </SectionCard>

          {/* ── Save / Cancel ──────────────────────────────────────────────── */}
          <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
            <button type="submit" disabled={saveMutation.isPending} style={{
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              color: 'white', border: 'none', padding: '0.75rem 1.75rem',
              borderRadius: '0.5rem', fontWeight: 600, cursor: saveMutation.isPending ? 'not-allowed' : 'pointer',
              fontSize: '0.9375rem', fontFamily: 'Inter, sans-serif',
              opacity: saveMutation.isPending ? 0.7 : 1,
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.15s',
            }}>
              {saveMutation.isPending
                ? <><i className="fas fa-spinner fa-spin" /> Saving...</>
                : <><i className="fas fa-save" /> Save Changes</>}
            </button>
            <button type="button" onClick={() => navigate(`/groups/${id}`)} style={{
              background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB',
              padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontWeight: 600,
              cursor: 'pointer', fontSize: '0.9375rem', fontFamily: 'Inter, sans-serif',
            }}>
              Cancel
            </button>
          </Box>
        </Box>

        {/* ── Danger Zone ───────────────────────────────────────────────────── */}
        {isOwner && (
          <Box sx={{
            background: '#FFFFFF', border: '1.5px solid #FCA5A5', borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', mb: 4,
          }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: '1.5rem', py: '1rem', borderBottom: '1px solid #FEE2E2', background: '#FFF5F5' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '0.5rem', background: 'linear-gradient(135deg,#EF4444,#DC2626)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-exclamation-triangle" style={{ color: 'white', fontSize: '0.9375rem' }} />
              </Box>
              <Box>
                <Typography fontFamily="Inter, sans-serif" fontWeight={600} fontSize="0.9375rem" color="#991B1B">Danger Zone</Typography>
                <Typography fontSize="0.8125rem" color="#B91C1C">Irreversible actions — proceed with caution</Typography>
              </Box>
            </Box>
            {/* Body */}
            <Box sx={{ px: '1.5rem', py: '1.25rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937" fontFamily="Inter, sans-serif">Delete this group</Typography>
                  <Typography fontSize="0.8125rem" color="#6B7280" fontFamily="Inter, sans-serif">
                    Permanently delete this group, all its posts, messages, and files. This cannot be undone.
                  </Typography>
                </Box>
                {!showDeleteConfirm && (
                  <button type="button" onClick={() => setShowDeleteConfirm(true)} style={{
                    background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5',
                    padding: '0.5625rem 1.125rem', borderRadius: '0.5rem', fontWeight: 600,
                    cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>
                    <i className="fas fa-trash" style={{ marginRight: 6 }} /> Delete Group
                  </button>
                )}
              </Box>

              {showDeleteConfirm && (
                <Box sx={{ mt: 2, p: '1rem', background: '#FEF2F2', borderRadius: '0.5rem', border: '1px solid #FCA5A5' }}>
                  <Typography fontSize="0.875rem" fontWeight={600} color="#991B1B" fontFamily="Inter, sans-serif" mb={0.5}>
                    Are you absolutely sure?
                  </Typography>
                  <Typography fontSize="0.8125rem" color="#B91C1C" fontFamily="Inter, sans-serif" mb={1.5}>
                    Type <strong>{group?.name}</strong> to confirm deletion.
                  </Typography>
                  <input style={{ ...inputStyle, borderColor: '#FCA5A5', mb: 8 }} type="text"
                    value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                    placeholder={group?.name}
                    onFocus={e => (e.target.style.borderColor = '#EF4444')}
                    onBlur={e => (e.target.style.borderColor = '#FCA5A5')}
                  />
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                    <button type="button"
                      onClick={() => { if (deleteInput === group?.name) deleteMutation.mutate(); }}
                      disabled={deleteInput !== group?.name || deleteMutation.isPending}
                      style={{
                        background: deleteInput === group?.name ? '#DC2626' : '#D1D5DB',
                        color: 'white', border: 'none', padding: '0.625rem 1.25rem',
                        borderRadius: '0.5rem', fontWeight: 600,
                        cursor: deleteInput === group?.name ? 'pointer' : 'not-allowed',
                        fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                        display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                        transition: 'background 0.15s',
                      }}>
                      {deleteMutation.isPending
                        ? <><i className="fas fa-spinner fa-spin" /> Deleting...</>
                        : <><i className="fas fa-trash" /> Confirm Delete</>}
                    </button>
                    <button type="button" onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }} style={{
                      background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB',
                      padding: '0.625rem 1.125rem', borderRadius: '0.5rem', fontWeight: 600,
                      cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif',
                    }}>
                      Cancel
                    </button>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>
        )}

      </Box>
    </Layout>
  );
};

export default GroupSettings;
