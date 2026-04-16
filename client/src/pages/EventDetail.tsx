import React, { useState } from 'react';
import { Box, Typography, Skeleton, CircularProgress } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Post, Comment } from '../types';
import { useAuth } from '../context/AuthContext';
import OnlineAvatar from '../components/OnlineAvatar';
import RichContent from '../components/RichContent';

const EV_GRAD  = 'linear-gradient(135deg, #8B5CF6, #EC4899)';
const PRI_GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

// Derive duration string from timeStart / timeEnd (e.g. "2h", "1h 30m")
const calcDuration = (start?: string, end?: string): string | null => {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};


// ── Right Sidebar ─────────────────────────────────────────────────────────────
const RightSidebar: React.FC<{ post: Post }> = ({ post }) => {
  const sec   = { borderRadius: '0.75rem', p: '1rem', mb: '1.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB' };
  const title = { fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em', fontFamily: 'Inter,sans-serif' };

  const going    = post.rsvps?.filter(r => r.status === 'going').length    ?? 0;
  const maybe    = post.rsvps?.filter(r => r.status === 'maybe').length    ?? 0;
  const notGoing = post.rsvps?.filter(r => r.status === 'not-going').length ?? 0;
  const capacity = post.groupSize ?? null;
  const filled   = capacity && capacity > 0 ? Math.round((going / capacity) * 100) : null;

  return (
    <>
      {/* Event Resources (specifications) — top of sidebar */}
      {post.specifications && post.specifications.length > 0 && (
        <Box sx={sec}>
          <Typography sx={title}><i className="fas fa-list-ul" style={{ marginRight: '0.4rem' }} />Event Resources</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {post.specifications.map(spec => (
              <Box key={spec.name} sx={{ border: '1px solid #E5E7EB', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <Box sx={{ px: '0.75rem', py: '0.375rem', background: 'linear-gradient(135deg,rgba(139,92,246,0.08),rgba(236,72,153,0.08))', borderBottom: spec.details.length > 0 ? '1px solid #E5E7EB' : 'none', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-tag" style={{ color: '#8B5CF6', fontSize: '0.65rem' }} />
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{spec.name}</Typography>
                </Box>
                {spec.details.length > 0 && (
                  <Box sx={{ px: '0.75rem', py: '0.5rem', background: '#FAFAFA' }}>
                    {spec.details.map((d, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', py: '0.2rem' }}>
                        <i className="fas fa-circle" style={{ color: '#8B5CF6', fontSize: '0.3rem', flexShrink: 0, marginTop: '0.45rem' }} />
                        <Typography sx={{ fontSize: '0.8rem', color: '#374151', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>{d}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Event Stats */}
      <Box sx={sec}>
        <Typography sx={title}>Event Stats</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr' }, gap: '0.75rem' }}>
          {[
            [capacity != null ? String(capacity) : '∞', 'Capacity'],
            [filled != null ? `${filled}%` : '—', 'Filled'],
            [String(going), 'Going'],
            [String(maybe + notGoing), 'Maybe/No'],
          ].map(([v, l]) => (
            <Box key={l} sx={{ background: EV_GRAD, color: 'white', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>{v}</Typography>
              <Typography sx={{ fontSize: '0.75rem', opacity: 0.9, fontFamily: 'Inter,sans-serif' }}>{l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Event Details quick-ref */}
      <Box sx={sec}>
        <Typography sx={title}>Event Info</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { icon: 'fas fa-calendar-alt', label: post.startDate ? new Date(post.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date TBD' },
            { icon: 'fas fa-clock',        label: post.timeStart ? `${post.timeStart}${post.timeEnd ? ` – ${post.timeEnd}` : ''}` : 'Time TBD' },
            { icon: post.isOnline ? 'fas fa-video' : 'fas fa-map-marker-alt', label: post.isOnline ? (post.onlineLink ? 'Join Online' : 'Online Event') : (post.locationName || 'Location TBD'), href: (post.isOnline && post.onlineLink) ? post.onlineLink : undefined },
            { icon: 'fas fa-hourglass-half', label: post.duration || calcDuration(post.timeStart, post.timeEnd) || 'Duration TBD' },
            ...(capacity != null ? [{ icon: 'fas fa-users', label: `Max ${capacity} attendees` }] : [{ icon: 'fas fa-users', label: 'Open to all' }]),
          ].map(d => (
            <Box key={d.label} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '0.375rem', background: 'linear-gradient(135deg,rgba(139,92,246,0.15),rgba(236,72,153,0.15))', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem' }}>
                <i className={d.icon} />
              </Box>
              {(d as { href?: string }).href ? (
                <Typography component="a" href={(d as { href?: string }).href} target="_blank" rel="noopener noreferrer"
                  sx={{ fontSize: '0.8125rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', lineHeight: 1.4, textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem', '&:hover': { textDecoration: 'underline' } }}>
                  {d.label} <i className="fas fa-external-link-alt" style={{ fontSize: '0.6rem' }} />
                </Typography>
              ) : (
                <Typography sx={{ fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif', lineHeight: 1.4 }}>{d.label}</Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tags */}
      {post.tags.length > 0 && (
        <Box sx={sec}>
          <Typography sx={title}>Tags</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {post.tags.map(t => (
              <Box key={t} component="span" sx={{ px: '0.75rem', py: '0.375rem', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '2rem', fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                #{t}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Safety */}
      <Box sx={sec}>
        <Typography sx={title}>Safety & Guidelines</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[
            { icon: 'fas fa-shield-alt', name: 'Community Guidelines', sub: 'Read before attending' },
            { icon: 'fas fa-first-aid',  name: 'Safety Information',   sub: 'Important reminders' },
          ].map(r => (
            <Box key={r.name} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '0.75rem', background: 'rgba(16,185,129,0.05)', border: '1px solid #E5E7EB', borderRadius: '0.5rem', cursor: 'pointer', '&:hover': { background: '#F3F4F6' } }}>
              <Box sx={{ width: 34, height: 34, borderRadius: '0.375rem', background: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><i className={r.icon} /></Box>
              <Box><Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{r.name}</Typography><Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>{r.sub}</Typography></Box>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
};

// ── Single comment ────────────────────────────────────────────────────────────
const CommentBlock: React.FC<{
  comment: Comment;
  onReply: (parentId: string, authorName: string) => void;
  indent?: boolean;
}> = ({ comment, onReply, indent }) => (
  <Box sx={{ ml: indent ? '3rem' : 0, position: 'relative', '&::before': indent ? { content: '""', position: 'absolute', left: '-1.5rem', top: 0, bottom: 0, width: 2, background: '#E5E7EB' } : {} }}>
    <Box sx={{ background: '#fff', border: '1px solid #EDEFF1', borderRadius: '0.5rem', p: '1rem', position: 'relative', '&::before': { content: '""', position: 'absolute', left: '-0.75rem', top: '1rem', width: '0.75rem', height: 2, background: '#E5E7EB' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem', flexWrap: 'wrap' }}>
        <OnlineAvatar userId={comment.author._id} src={comment.author.avatar} isVerified={comment.author.isVerified} sx={{ width: 24, height: 24, fontSize: '0.7rem', fontWeight: 600 }}>
          {comment.author.name[0]}
        </OnlineAvatar>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>{comment.author.name}</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#1F2937', mb: '0.75rem', fontFamily: 'Inter,sans-serif' }}>{comment.content}</Typography>
      <Box sx={{ display: 'flex', gap: '1rem', pt: '0.75rem', borderTop: '1px solid #EDEFF1' }}>
        <Box component="button" onClick={() => onReply(comment._id, comment.author.name)} sx={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '0.75rem', fontWeight: 500, cursor: 'pointer', px: '0.5rem', py: '0.25rem', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6', color: '#4F46E5' } }}>
          <i className="fas fa-reply" /> Reply
        </Box>
      </Box>
    </Box>
  </Box>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const EventDetail: React.FC = () => {
  const { id }     = useParams<{ id: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const qc         = useQueryClient();

  const [comment,      setComment]      = useState('');
  const [replyTo,      setReplyTo]      = useState<{ id: string; name: string } | null>(null);
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);

  // ── Fetch post ──
  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => { const r = await api.get(`/posts/${id}`); return r.data as Post; },
  });

  // ── Fetch comments ──
  const { data: comments = [] } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => { const r = await api.get(`/posts/${id}/comments`); return r.data as Comment[]; },
    enabled: !!id,
  });

  // ── RSVP mutation ──
  const rsvpMutation = useMutation({
    mutationFn: (status: 'going' | 'maybe' | 'not-going' | null) =>
      api.put(`/posts/${id}/rsvp`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', id] }),
  });

  // ── Comment mutation ──
  const commentMutation = useMutation({
    mutationFn: (body: { content: string; parentId?: string }) =>
      api.post(`/posts/${id}/comments`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', id] });
      setComment('');
      setReplyTo(null);
    },
  });

  const handleRsvp = (status: 'going' | 'maybe' | 'not-going') => {
    if (!user) { navigate('/login'); return; }
    const next = post?.userRsvp === status ? null : status;
    rsvpMutation.mutate(next);
  };

  const handleComment = () => {
    if (!user) { navigate('/login'); return; }
    if (!comment.trim()) return;
    commentMutation.mutate({ content: comment.trim(), parentId: replyTo?.id });
  };

  if (isLoading) return <Layout><Skeleton variant="rounded" height={400} /></Layout>;
  if (!post) return null;

  const eventDate      = post.startDate || (post as any).eventDate;
  const location       = post.locationName || (post as any).eventLocation;
  const duration       = post.duration || calcDuration(post.timeStart, post.timeEnd) || '—';
  const capacity       = post.groupSize ?? null;           // null = unlimited
  const ceu            = post.ceuRate ?? 0;
  const eventCategory  = post.eventCategory || null;

  const goingCount    = post.rsvps?.filter(r => r.status === 'going').length    ?? 0;
  const spotsLeft     = capacity != null ? Math.max(0, capacity - goingCount) : null;

  const userRsvp = post.userRsvp ?? null;

  // Attendees: only "going" shown in the Who's Attending grid
  const goingAttendees = post.rsvps?.filter(r => r.status === 'going') ?? [];
  // 2 rows × 6 columns = 12 shown before expand
  const VISIBLE_ROWS = 2;
  const COLS = 6;
  const VISIBLE_MAX = VISIBLE_ROWS * COLS;
  const hasMore = goingAttendees.length > VISIBLE_MAX;
  const visibleAttendees = attendeesExpanded ? goingAttendees : goingAttendees.slice(0, VISIBLE_MAX);

  // Build threaded comment structure
  const topLevel = comments.filter(c => !c.parentId);
  const replies  = comments.filter(c => !!c.parentId);

  return (
    <Layout rightPanel={<RightSidebar post={post} />}>
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>

        {/* Breadcrumbs */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.5rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', flexWrap: 'wrap' }}>
          <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Home</Box>
          <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
          <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Events</Box>
          {post.tags[0] && (
            <>
              <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
              <Box component="span" sx={{ textTransform: 'capitalize', cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>{post.tags[0]}</Box>
            </>
          )}
          <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
          <Box component="span" sx={{ color: '#1F2937' }}>{post.title}</Box>
        </Box>

        <Box sx={{ background: '#fff', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', border: '1px solid #E5E7EB', overflow: 'hidden' }}>

          {/* ── Header ── */}
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg,rgba(139,92,246,0.05),rgba(236,72,153,0.05))' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem', flexWrap: 'wrap', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                {/* Event type badge */}
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '1rem', py: '0.5rem', background: EV_GRAD, color: 'white', fontSize: '0.875rem', fontWeight: 600, borderRadius: '0.375rem', fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-calendar-alt" /> Event
                </Box>
                {/* Event category badge */}
                {eventCategory && (
                  <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.5rem', background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontSize: '0.8125rem', fontWeight: 600, borderRadius: '0.375rem', fontFamily: 'Inter,sans-serif', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <i className="fas fa-layer-group" style={{ fontSize: '0.7rem' }} /> {eventCategory}
                  </Box>
                )}
              </Box>
              <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {ceu > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                    <i className="fas fa-coins" style={{ color: '#4F46E5' }} /> {ceu} CEU Reward
                  </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-users" style={{ color: '#4F46E5' }} /> {goingCount} Going
                </Box>
              </Box>
            </Box>

            {/* Organizer */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem' }}>
              <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} sx={{ width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
                {post.author.name[0]}
              </OnlineAvatar>
              <Box sx={{ flex: 1 }}>
                <Typography onClick={() => navigate(`/profile/${post.author._id}`)} sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '0.25rem', fontFamily: 'Inter,sans-serif', cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
                  {post.author.name}
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '0.25rem', fontFamily: 'Inter,sans-serif' }}>
                  Event Organizer{post.author.isVerified ? ' • Verified' : ''} • {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                </Typography>
              </Box>
            </Box>

            {eventCategory && (
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#7C3AED', mb: '0.375rem', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {eventCategory}
              </Typography>
            )}
            <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#1F2937', mb: '1rem', lineHeight: 1.2, fontFamily: 'Poppins,sans-serif' }}>
              {post.title}
            </Typography>

            {/* Stats grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3,1fr)' }, gap: '1rem', mt: '1.5rem' }}>
              {[
                [goingCount, 'Going'],
                [spotsLeft != null ? spotsLeft : '∞', 'Spots Left'],
                [duration, 'Duration'],
              ].map(([v, l]) => (
                <Box key={String(l)} sx={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>{v}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: 'Inter,sans-serif' }}>{l}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* ── Gallery — only shown when the organiser uploaded images ── */}
          {post.images && post.images.length > 0 && (
            <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                <i className="fas fa-images" style={{ color: '#4F46E5' }} /> Event Gallery
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: '1rem', mt: '1.5rem' }}>
                {post.images.map((src, i) => (
                  <Box key={i} component="img" src={src} sx={{ borderRadius: '0.5rem', height: 150, width: '100%', objectFit: 'cover', cursor: 'pointer', transition: 'all 0.3s', '&:hover': { transform: 'scale(1.05)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' } }} />
                ))}
              </Box>
            </Box>
          )}

          {/* ── Event Details ── */}
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
              <i className="fas fa-info-circle" style={{ color: '#4F46E5' }} /> Event Details
            </Typography>
            <Box sx={{ mb: '2rem', lineHeight: 1.7, color: '#1F2937' }}>
              <RichContent text={post.content} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.5rem' }}>
              {[
                { icon: 'fas fa-calendar-alt', label: 'Date & Time', value: eventDate ? new Date(eventDate).toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' }) + (post.timeStart ? ` • ${post.timeStart}${post.timeEnd?` – ${post.timeEnd}`:''}` : '') : 'Date TBD' },
                { icon: post.isOnline ? 'fas fa-video' : 'fas fa-map-marker-alt', label: 'Location', value: post.isOnline ? (post.onlineLink || 'Online Event') : (location || 'Location TBD'), href: (post.isOnline && post.onlineLink) ? post.onlineLink : undefined },
                { icon: 'fas fa-users',          label: 'Capacity',   value: capacity != null ? `Maximum ${capacity} participants • ${goingCount} registered` : `Open to all • ${goingCount} registered` },
                ...(eventCategory ? [{ icon: 'fas fa-layer-group', label: 'Category', value: eventCategory }] : []),
                ...(ceu > 0 ? [{ icon: 'fas fa-coins', label: 'CEU Opportunity', value: `Earn ${ceu} CEU • Free admission` }] : []),
              ].map(d => (
                <Box key={d.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))', color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={d.icon} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.25rem', fontFamily: 'Inter,sans-serif' }}>{d.label}</Typography>
                    {(d as { href?: string }).href ? (
                      <Typography component="a" href={(d as { href?: string }).href} target="_blank" rel="noopener noreferrer"
                        sx={{ fontSize: '0.875rem', color: '#4F46E5', lineHeight: 1.5, fontFamily: 'Inter,sans-serif', textDecoration: 'none', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '0.3rem', '&:hover': { textDecoration: 'underline' } }}>
                        {d.value} <i className="fas fa-external-link-alt" style={{ fontSize: '0.65rem', flexShrink: 0 }} />
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5, fontFamily: 'Inter,sans-serif' }}>{d.value}</Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>

          {/* ── RSVP Status + Who's Attending ── */}
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
              <i className="fas fa-calendar-check" style={{ color: '#4F46E5' }} /> RSVP Status
            </Typography>

            {/* Compact RSVP action row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.75rem', flexWrap: 'wrap' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mr: '0.25rem' }}>
                {user ? 'Your response:' : 'Log in to RSVP:'}
              </Typography>
              {([
                { key: 'going'     as const, icon: 'fas fa-check-circle',    label: 'Going',     activeColor: '#10B981', activeBg: 'rgba(16,185,129,0.1)' },
                { key: 'maybe'     as const, icon: 'fas fa-question-circle', label: 'Maybe',     activeColor: '#F59E0B', activeBg: 'rgba(245,158,11,0.1)' },
                { key: 'not-going' as const, icon: 'fas fa-times-circle',    label: 'Not Going', activeColor: '#EF4444', activeBg: 'rgba(239,68,68,0.1)' },
              ]).map(opt => {
                const isActive = userRsvp === opt.key;
                return (
                  <Box
                    key={opt.key}
                    onClick={() => handleRsvp(opt.key)}
                    sx={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      px: '0.875rem', py: '0.5rem',
                      border: `1.5px solid ${isActive ? opt.activeColor : '#E5E7EB'}`,
                      borderRadius: '2rem',
                      background: isActive ? opt.activeBg : '#FAFAFA',
                      color: isActive ? opt.activeColor : '#6B7280',
                      fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                      fontFamily: 'Inter,sans-serif',
                      cursor: rsvpMutation.isPending ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': rsvpMutation.isPending ? {} : { borderColor: opt.activeColor, color: opt.activeColor, background: opt.activeBg },
                    }}
                  >
                    {rsvpMutation.isPending && userRsvp === opt.key
                      ? <CircularProgress size={12} sx={{ color: opt.activeColor }} />
                      : <i className={opt.icon} style={{ fontSize: '0.875rem' }} />
                    }
                    {opt.label}
                  </Box>
                );
              })}
              {userRsvp && (
                <Typography sx={{ fontSize: '0.8125rem', color: '#10B981', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', ml: '0.25rem' }}>
                  <i className="fas fa-check-circle" /> Click again to change
                </Typography>
              )}
            </Box>

            {/* Who's Attending section */}
            <Box sx={{ borderTop: '1px solid #F3F4F6', pt: '1.5rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem', flexWrap: 'wrap', gap: 1 }}>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-users" style={{ color: '#4F46E5', fontSize: '0.9rem' }} />
                  Who's Attending
                  <Box component="span" sx={{ ml: '0.25rem', px: '0.625rem', py: '0.125rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', borderRadius: '2rem', fontSize: '0.8125rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                    {goingCount} confirmed
                  </Box>
                </Typography>
              </Box>

              {goingAttendees.length === 0 ? (
                <Box sx={{ py: '2rem', textAlign: 'center', background: '#F9FAFB', borderRadius: '0.75rem', border: '1px dashed #E5E7EB' }}>
                  <Box sx={{ fontSize: '2rem', mb: '0.5rem' }}>🎉</Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>
                    Be the first to confirm! Click <strong>Going</strong> above to RSVP.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: '0.75rem' }}>
                    {visibleAttendees.map(r => (
                      <Box key={r.user._id} onClick={() => navigate(`/profile/${r.user._id}`)} sx={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '0.875rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                        <OnlineAvatar userId={r.user._id} src={r.user.avatar} isVerified={r.user.isVerified} sx={{ width: 44, height: 44, fontSize: '0.875rem', fontWeight: 600, mx: 'auto', mb: '0.5rem' }}>
                          {r.user.name[0]}
                        </OnlineAvatar>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {r.user.name}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {hasMore && (
                    <Box
                      component="button"
                      onClick={() => setAttendeesExpanded(v => !v)}
                      sx={{
                        mt: '1rem', width: '100%', py: '0.625rem',
                        border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                        background: '#FAFAFA', cursor: 'pointer',
                        fontSize: '0.875rem', fontWeight: 600, color: '#4F46E5',
                        fontFamily: 'Inter,sans-serif',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s',
                        '&:hover': { background: 'rgba(79,70,229,0.05)', borderColor: '#4F46E5' },
                      }}
                    >
                      <i className={`fas fa-chevron-${attendeesExpanded ? 'up' : 'down'}`} />
                      {attendeesExpanded
                        ? 'Show less'
                        : `Show ${goingAttendees.length - VISIBLE_MAX} more attending`}
                    </Box>
                  )}
                </>
              )}
            </Box>
          </Box>

          {/* ── Discussion ── */}
          <Box sx={{ p: '2rem', background: '#F6F7F8' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.5rem', pb: '1rem', borderBottom: '1px solid #EDEFF1', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
                <i className="fas fa-comments" /> Event Discussion
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                <i className="fas fa-comment-alt" style={{ marginRight: '0.25rem' }} /> {comments.length} comment{comments.length !== 1 ? 's' : ''}
              </Typography>
            </Box>

            {topLevel.length === 0 ? (
              <Typography sx={{ color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', mb: '1.5rem' }}>
                No comments yet. Be the first to start the discussion!
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', mb: '2rem' }}>
                {topLevel.map(c => (
                  <Box key={c._id}>
                    <CommentBlock comment={c} onReply={(pid, name) => setReplyTo({ id: pid, name })} />
                    {replies.filter(r => r.parentId === c._id).map(r => (
                      <Box key={r._id} sx={{ mt: '1rem' }}>
                        <CommentBlock comment={r} onReply={(pid, name) => setReplyTo({ id: pid, name })} indent />
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            )}

            {/* Input */}
            <Box sx={{ p: '1.5rem', background: '#fff', border: '1px solid #EDEFF1', borderRadius: '0.5rem' }}>
              {replyTo && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem', p: '0.5rem 0.75rem', background: 'rgba(79,70,229,0.06)', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-reply" /> Replying to <strong>{replyTo.name}</strong>
                  <Box component="button" onClick={() => setReplyTo(null)} sx={{ ml: 'auto', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '0.75rem', p: 0 }}>✕</Box>
                </Box>
              )}
              <Typography component="label" sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.75rem', display: 'block', fontFamily: 'Inter,sans-serif' }}>
                {user ? 'Join the Discussion' : 'Log in to comment'}
              </Typography>
              <Box component="textarea" value={comment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
                disabled={!user}
                placeholder={user ? 'What would you like to ask or share about this event?' : 'Log in to join the discussion…'}
                sx={{ width: '100%', p: '0.875rem 1rem', border: '1px solid #EDEFF1', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#1F2937', background: user ? '#fff' : '#F9FAFB', resize: 'vertical', minHeight: 100, mb: '0.75rem', fontFamily: 'Inter,sans-serif', outline: 'none', display: 'block', boxSizing: 'border-box', opacity: user ? 1 : 0.6, '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }}
              />
              <Box component="button" onClick={user ? handleComment : () => navigate('/login')} disabled={commentMutation.isPending}
                sx={{ background: PRI_GRAD, color: 'white', border: 'none', px: '1.25rem', py: '0.625rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'Inter,sans-serif', transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' } }}>
                {commentMutation.isPending ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <i className="fas fa-paper-plane" />}
                {user ? 'Post Comment' : 'Log in to Comment'}
              </Box>
            </Box>
          </Box>

        </Box>
      </Box>
    </Layout>
  );
};

export default EventDetail;
