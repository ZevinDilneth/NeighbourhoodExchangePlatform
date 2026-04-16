import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton, CircularProgress } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatDistanceToNow, format,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isToday, addMonths, subMonths,
} from 'date-fns';
import Layout from '../components/layout/Layout';
import GuestBanner from '../components/GuestBanner';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import OnlineAvatar from '../components/OnlineAvatar';

/* ── Design tokens ─────────────────────────────────────────────────── */
const GIFT_GRAD = 'linear-gradient(135deg, #10B981, #059669)';
const FONT = 'Inter, sans-serif';
const HEADING = 'Poppins, sans-serif';

/* ── Extended post type for gift-specific fields ───────────────────── */
interface GiftPost extends Post {
  condition?: string;
  specifications?: { name: string; details: string[] }[];
  locationName?: string;
  locationType?: string;
  startDate?: string;
  endDate?: string;
  timeStart?: string;
  timeEnd?: string;
  rsvps?: { user: { _id: string; name: string; avatar?: string; isVerified?: boolean }; status: 'going' | 'maybe' | 'not-going' }[];
  userRsvp?: 'going' | 'maybe' | 'not-going' | null;
  groupSize?: number;
  ceuRate?: number;
  recurring?: string;
  sessions?: number;
}

/* ── Comment type ──────────────────────────────────────────────────── */
type CommentType = {
  _id: string; content: string; parentId: string | null;
  author: { _id: string; name: string; avatar?: string; ceuBalance?: number; isVerified?: boolean };
  createdAt: string;
};

/* ── CEU tier badge ────────────────────────────────────────────────── */
const getCeuTier = (ceu = 0): { label: string; bg: string } => {
  if (ceu >= 1000) return { label: 'Diamond',  bg: 'linear-gradient(135deg,#6366F1,#8B5CF6)' };
  if (ceu >= 500)  return { label: 'Platinum', bg: 'linear-gradient(135deg,#0EA5E9,#6366F1)' };
  if (ceu >= 250)  return { label: 'Gold',     bg: 'linear-gradient(135deg,#F59E0B,#EF4444)' };
  if (ceu >= 100)  return { label: 'Silver',   bg: 'linear-gradient(135deg,#6B7280,#9CA3AF)' };
  return                  { label: 'Bronze',   bg: 'linear-gradient(135deg,#92400E,#B45309)' };
};

/* ── Condition colours ─────────────────────────────────────────────── */
const CONDITION_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  New:       { bg: '#F0FDF4', color: '#059669', border: '#BBF7D0' },
  Excellent: { bg: '#EFF6FF', color: '#3B82F6', border: '#BFDBFE' },
  Good:      { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
  Fair:      { bg: '#FFF1F2', color: '#EF4444', border: '#FECDD3' },
};

/* ── Media helper ──────────────────────────────────────────────────── */
const getMediaType = (url: string | null | undefined): 'video' | 'image' => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|ogg|avi|mkv)$/.test(clean)) return 'video';
  return 'image';
};

/* ── Image / Video Gallery ─────────────────────────────────────────── */
const Gallery: React.FC<{ media: string[] }> = ({ media }) => {
  const [idx, setIdx] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});
  const valid = media.filter(Boolean).filter((_, i) => !errored[i]);
  if (valid.length === 0) return null;
  const count = valid.length;
  const safeIdx = Math.min(idx, count - 1);
  const prev = () => setIdx(i => (i - 1 + count) % count);
  const next = () => setIdx(i => (i + 1) % count);
  const currentType = getMediaType(valid[safeIdx]);
  return (
    <Box sx={{ p: '1.25rem', pb: '1rem', borderBottom: '1px solid #E5E7EB' }}>
      <Box sx={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#111', mb: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        <Box sx={{ display: 'flex', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform: `translateX(-${safeIdx * 100}%)` }}>
          {valid.map((src, i) => {
            const type = getMediaType(src);
            return (
              <Box key={i} sx={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#111', minHeight: 340 }}>
                {type === 'video'
                  ? <Box component="video" src={src} controls preload="metadata" sx={{ width: '100%', maxHeight: 480, display: 'block', outline: 'none' }} />
                  : <Box component="img" src={src} alt="" onError={() => setErrored(e => ({ ...e, [i]: true }))} sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }} />}
              </Box>
            );
          })}
        </Box>
        {count > 1 && (
          <>
            <Box component="button" onClick={prev} sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', '&:hover': { background: 'rgba(0,0,0,0.8)' } }}><i className="fas fa-chevron-left" style={{ fontSize: '0.8rem' }} /></Box>
            <Box component="button" onClick={next} sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', '&:hover': { background: 'rgba(0,0,0,0.8)' } }}><i className="fas fa-chevron-right" style={{ fontSize: '0.8rem' }} /></Box>
          </>
        )}
        <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {currentType === 'video' && <Box sx={{ background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, px: '0.5rem', py: '0.2rem', borderRadius: '0.375rem', letterSpacing: '0.04em' }}>VIDEO</Box>}
          {count > 1 && <Box sx={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.72rem', fontWeight: 600, px: '0.6rem', py: '0.25rem', borderRadius: '1rem', backdropFilter: 'blur(4px)' }}>{safeIdx + 1} / {count}</Box>}
        </Box>
      </Box>
      {count > 1 && (
        <Box sx={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', pb: '0.25rem', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
          {valid.map((src, i) => {
            const type = getMediaType(src);
            const active = i === safeIdx;
            return (
              <Box key={i} onClick={() => setIdx(i)} sx={{ flexShrink: 0, width: 72, height: 56, borderRadius: '0.5rem', overflow: 'hidden', border: active ? '2px solid #10B981' : '2px solid #E5E7EB', cursor: 'pointer', background: '#111', position: 'relative', opacity: active ? 1 : 0.7, transition: 'all 0.18s', '&:hover': { opacity: 1 }, boxShadow: active ? '0 0 0 3px rgba(16,185,129,0.2)' : 'none' }}>
                {type === 'video'
                  ? <><Box component="video" src={src} preload="metadata" muted sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} /><Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}><i className="fas fa-play" style={{ color: '#fff', fontSize: '0.8rem' }} /></Box></>
                  : <Box component="img" src={src} alt="" onError={() => setErrored(e => ({ ...e, [i]: true }))} sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

/* ── Comment Card ──────────────────────────────────────────────────── */
const CommentCard: React.FC<{
  c: CommentType; allComments: CommentType[];
  onReply: (body: { content: string; parentId: string | null }) => void;
  onDelete: (commentId: string) => void;
  postId: string; depth?: number;
}> = ({ c, allComments, onReply, onDelete, depth = 0 }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const initials = c.author.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const { label, bg } = getCeuTier(c.author.ceuBalance);
  const isOwn = user?._id === c.author._id;
  const cardReplies = allComments.filter(r => r.parentId === c._id);

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <Box sx={{ display: 'flex', gap: '0.625rem' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <OnlineAvatar userId={c.author._id} src={c.author.avatar} isVerified={c.author.isVerified} dotSize={9} sx={{ width: 32, height: 32, background: GIFT_GRAD, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate(`/profile/${c.author._id}`)}>{initials}</OnlineAvatar>
        {!collapsed && cardReplies.length > 0 && (
          <Box onClick={() => setCollapsed(true)} sx={{ flex: 1, width: 2, background: '#E5E7EB', mt: '0.375rem', cursor: 'pointer', borderRadius: 1, minHeight: 24, '&:hover': { background: '#10B981' } }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem', flexWrap: 'wrap' }}>
          <Typography onClick={() => navigate(`/profile/${c.author._id}`)} sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937', cursor: 'pointer', '&:hover': { color: '#10B981', textDecoration: 'underline' } }}>{c.author.name}</Typography>
          <Box sx={{ px: '0.4rem', py: '0.1rem', borderRadius: '0.25rem', fontSize: '0.625rem', fontWeight: 700, background: bg, color: '#fff', letterSpacing: '0.02em' }}>{label}</Box>
          <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>• {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</Typography>
        </Box>
        {collapsed ? (
          <Box component="button" onClick={() => setCollapsed(false)} sx={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: FONT, p: 0 }}>[show comment]</Box>
        ) : (
          <>
            <Typography sx={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, mb: '0.625rem', wordBreak: 'break-word' }}>{c.content}</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flexWrap: 'wrap' }}>
              {[
                { icon: 'fa-comment', label: 'Reply', onClick: () => { if (!user) { navigate('/login'); return; } setReplyOpen(v => !v); } },
                { icon: 'fa-share',   label: 'Share',  onClick: () => navigator.clipboard.writeText(window.location.href) },
              ].map(({ icon, label: lbl, onClick }) => (
                <Box key={icon} component="button" onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, fontFamily: FONT, '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                  <i className={`fas ${icon}`} style={{ fontSize: '0.75rem' }} /> {lbl}
                </Box>
              ))}
              <Box ref={menuRef} sx={{ position: 'relative' }}>
                <Box component="button" onClick={() => setMenuOpen(v => !v)} sx={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                  <i className="fas fa-ellipsis-h" style={{ fontSize: '0.75rem' }} />
                </Box>
                {menuOpen && (
                  <Box sx={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 120, py: '0.25rem', overflow: 'hidden' }}>
                    {isOwn
                      ? <Box component="button" onClick={() => { setMenuOpen(false); onDelete(c._id); }} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#DC2626', fontFamily: FONT, fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FEF2F2' } }}><i className="fas fa-trash-alt" style={{ fontSize: '0.75rem' }} /> Delete</Box>
                      : <Box component="button" onClick={() => { setMenuOpen(false); alert('Report submitted. Thank you for keeping the community safe.'); }} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#D97706', fontFamily: FONT, fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FFFBEB' } }}><i className="fas fa-flag" style={{ fontSize: '0.75rem' }} /> Report</Box>}
                  </Box>
                )}
              </Box>
            </Box>
            {replyOpen && (
              <Box sx={{ mt: '0.75rem' }}>
                <Box component="textarea" value={replyText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)} placeholder={`Reply to ${c.author.name}…`}
                  sx={{ width: '100%', minHeight: 72, p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', fontFamily: FONT, fontSize: '0.875rem', color: '#1F2937', resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.1)' } }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', mt: '0.5rem' }}>
                  <Box component="button" onClick={() => { setReplyOpen(false); setReplyText(''); }} sx={{ background: '#F3F4F6', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: FONT }}>Cancel</Box>
                  <Box component="button" onClick={() => { if (replyText.trim()) { onReply({ content: replyText, parentId: c._id }); setReplyText(''); setReplyOpen(false); } }} sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: FONT }}>Reply</Box>
                </Box>
              </Box>
            )}
            {cardReplies.length > 0 && (
              <Box sx={{ mt: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', pl: '0.25rem', borderLeft: '2px solid #E5E7EB' }}>
                {cardReplies.map(r => <CommentCard key={r._id} c={r} allComments={allComments} onReply={onReply} onDelete={onDelete} postId="" depth={depth + 1} />)}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

/* ── Gift Discussion ───────────────────────────────────────────────── */
const GiftDiscussion: React.FC<{ post: GiftPost }> = ({ post }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', post._id],
    queryFn: async () => { const r = await api.get(`/posts/${post._id}/comments`); return r.data as CommentType[]; },
  });

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    socket.emit('join-post', post._id);
    const handleNewComment = (comment: CommentType) => {
      queryClient.setQueryData<CommentType[]>(['comments', post._id], (prev = []) => {
        if (prev.some(c => c._id === comment._id)) return prev;
        return [...prev, comment];
      });
      queryClient.invalidateQueries({ queryKey: ['post', post._id] });
    };
    socket.on('new-comment', handleNewComment);
    return () => { socket.emit('leave-post', post._id); socket.off('new-comment', handleNewComment); };
  }, [post._id, queryClient, user]);

  const addMutation = useMutation({
    mutationFn: (body: { content: string; parentId: string | null }) => api.post(`/posts/${post._id}/comments`, body),
    onSuccess: (res) => {
      queryClient.setQueryData<CommentType[]>(['comments', post._id], (prev = []) => {
        if (prev.some(c => c._id === res.data._id)) return prev;
        return [...prev, res.data];
      });
      queryClient.invalidateQueries({ queryKey: ['post', post._id] });
      setNewComment(''); setComposerOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: string) => api.delete(`/posts/${post._id}/comments/${commentId}`),
    onSuccess: (_res, commentId) => {
      queryClient.setQueryData<CommentType[]>(['comments', post._id], (prev = []) => prev.filter(c => c._id !== commentId));
      queryClient.invalidateQueries({ queryKey: ['post', post._id] });
    },
  });

  const topLevel = comments.filter(c => !c.parentId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const uniqueAuthors = new Set(comments.map(c => c.author._id)).size;

  return (
    <Box sx={{ p: '2rem', background: '#FFF', borderRadius: '0 0 0.75rem 0.75rem' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <i className="fas fa-comments" style={{ color: '#1F2937', fontSize: '1.125rem' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: HEADING }}>Gift Discussion</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          <i className="fas fa-users" style={{ marginRight: 4 }} />
          {uniqueAuthors} participant{uniqueAuthors !== 1 ? 's' : ''} • {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {!user ? (
        <Box sx={{ mb: '1.5rem' }}><GuestBanner message="Log in to join the discussion and leave a comment." /></Box>
      ) : !composerOpen ? (
        <Box onClick={() => setComposerOpen(true)} sx={{ mb: '1.5rem', p: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '1.5rem', color: '#9CA3AF', cursor: 'text', fontSize: '0.9375rem', background: '#F9FAFB', '&:hover': { borderColor: '#10B981' } }}>
          Add a comment…
        </Box>
      ) : (
        <Box sx={{ mb: '1.5rem', border: '1px solid #10B981', borderRadius: '0.625rem', overflow: 'hidden', boxShadow: '0 0 0 3px rgba(16,185,129,0.08)' }}>
          <Box component="textarea" autoFocus value={newComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)} placeholder="What would you like to ask or share about this gift?"
            sx={{ width: '100%', minHeight: 100, p: '0.875rem 1rem', border: 'none', fontFamily: FONT, fontSize: '0.9375rem', color: '#1F2937', background: '#FFF', resize: 'none', outline: 'none', boxSizing: 'border-box', display: 'block' }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', p: '0.625rem 0.875rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
            <Box component="button" onClick={() => { setComposerOpen(false); setNewComment(''); navigate; }} sx={{ background: 'none', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: FONT, '&:hover': { background: '#F3F4F6' } }}>Cancel</Box>
            <Box component="button" onClick={() => { if (newComment.trim()) addMutation.mutate({ content: newComment, parentId: null }); }} sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '1rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: FONT, opacity: newComment.trim() ? 1 : 0.4 }}>Comment</Box>
          </Box>
        </Box>
      )}

      {topLevel.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: '2rem', color: '#9CA3AF' }}>
          <i className="fas fa-comment-dots" style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }} />
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500 }}>No discussion yet</Typography>
          <Typography sx={{ fontSize: '0.8125rem', mt: '0.25rem' }}>Be the first to start the conversation!</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {topLevel.map(c => (
            <CommentCard key={c._id} c={c} allComments={comments} onReply={(body) => addMutation.mutate(body)} onDelete={(id) => deleteMutation.mutate(id)} postId={post._id} />
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ── Gift Availability Calendar ────────────────────────────────────── */
const GiftAvailabilityCalendar: React.FC<{ post: GiftPost }> = ({ post }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const availableDates = React.useMemo((): Set<string> => {
    const set = new Set<string>();
    const toKey = (d: Date) => d.toISOString().split('T')[0];
    if (!post.startDate) return set;
    const start = new Date(post.startDate);
    const end = post.endDate ? new Date(post.endDate) : start;
    const range = eachDayOfInterval({ start, end });
    range.forEach(d => set.add(toKey(d)));
    return set;
  }, [post.startDate, post.endDate]);

  const isAvailable = (d: Date) => {
    if (!isSameMonth(d, currentMonth)) return false;
    return availableDates.has(d.toISOString().split('T')[0]);
  };

  const timeSlot = (post.timeStart && post.timeEnd)
    ? `${post.timeStart} – ${post.timeEnd}`
    : post.timeStart ? post.timeStart : null;

  return (
    <Box>
      {/* Calendar header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937', fontFamily: FONT }}>
          {format(currentMonth, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          <Box component="button" onClick={() => setCurrentMonth(new Date())} sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: FONT, '&:hover': { borderColor: '#10B981', color: '#10B981' } }}>Today</Box>
          <Box component="button" onClick={() => setCurrentMonth(m => subMonths(m, 1))} sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', width: 32, height: 32, borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { borderColor: '#10B981', color: '#10B981' } }}><i className="fas fa-chevron-left" style={{ fontSize: '0.75rem' }} /></Box>
          <Box component="button" onClick={() => setCurrentMonth(m => addMonths(m, 1))} sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280', width: 32, height: 32, borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { borderColor: '#10B981', color: '#10B981' } }}><i className="fas fa-chevron-right" style={{ fontSize: '0.75rem' }} /></Box>
        </Box>
      </Box>

      {/* Calendar grid */}
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <Box key={d} sx={{ textAlign: 'center', py: '0.875rem', fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</Box>
          ))}
        </Box>
        {Array.from({ length: Math.ceil(days.length / 7) }).map((_, wi) => (
          <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', borderBottom: wi < Math.ceil(days.length/7)-1 ? '1px solid #E5E7EB' : 'none' }}>
            {days.slice(wi * 7, wi * 7 + 7).map((day, di) => {
              const inMonth = isSameMonth(day, currentMonth);
              const avail = inMonth && isAvailable(day);
              const today = isToday(day);
              const selected = selectedDay && day.toDateString() === selectedDay.toDateString();
              let bg = '#FFF'; let border = '1px solid transparent'; let color = inMonth ? '#1F2937' : '#9CA3AF';
              if (!inMonth) bg = '#F9FAFB';
              if (today) { bg = 'rgba(16,185,129,0.08)'; border = '2px solid #10B981'; }
              if (avail && !today) { bg = 'rgba(16,185,129,0.1)'; border = '1px solid rgba(16,185,129,0.25)'; }
              if (selected) { bg = GIFT_GRAD; border = '2px solid #059669'; color = '#fff'; }
              if (!avail && inMonth && !today) { bg = '#F9FAFB'; color = '#9CA3AF'; }
              return (
                <Box key={di} onClick={() => avail && inMonth && setSelectedDay(day)} sx={{ minHeight: 72, p: '0.5rem', textAlign: 'center', background: bg, border, borderRadius: '0.375rem', m: '2px', cursor: avail && inMonth ? 'pointer' : 'default', transition: 'all 0.15s', '&:hover': avail && inMonth ? { transform: 'translateY(-1px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : {} }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: '50%', mb: '0.25rem', fontWeight: selected || today ? 700 : 500, fontSize: '0.9375rem', color: selected ? '#fff' : today ? '#fff' : color, background: today && !selected ? '#10B981' : 'transparent' }}>
                    {format(day, 'd')}
                  </Box>
                  {avail && !selected && (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', mx: 'auto' }} />
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: '1.5rem', mt: '1rem', flexWrap: 'wrap' }}>
        {[
          { color: 'rgba(16,185,129,0.3)', label: 'Available for pick-up' },
          { color: '#10B981', label: 'Today' },
          { color: GIFT_GRAD, label: 'Selected' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '0.25rem', background: color }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: FONT }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Time slot + location info */}
      {(timeSlot || post.locationName) && (
        <Box sx={{ mt: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {timeSlot && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '0.875rem 1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.625rem' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', background: GIFT_GRAD, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-clock" style={{ fontSize: '0.8rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.125rem', fontFamily: FONT }}>Available Hours</Typography>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', fontFamily: FONT }}>{timeSlot}</Typography>
              </Box>
            </Box>
          )}
          {post.locationName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '0.875rem 1rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.625rem' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', background: GIFT_GRAD, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-map-marker-alt" style={{ fontSize: '0.8rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.125rem', fontFamily: FONT }}>
                  {post.locationType === 'private' ? 'Meet-Up Location' : 'Pick-Up Location'}
                </Typography>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1F2937', fontFamily: FONT }}>{post.locationName}</Typography>
              </Box>
            </Box>
          )}
          {selectedDay && (
            <Box sx={{ p: '0.875rem 1rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.625rem' }}>
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#059669', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-calendar-check" style={{ fontSize: '0.8rem' }} />
                Pick-up on {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                {timeSlot && ` · ${timeSlot}`}
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

/* ── Tag parser (handles JSON-stringified arrays) ──────────────────── */
const parseTags = (tags: string[]): string[] => {
  if (!tags || tags.length === 0) return [];
  if (tags.length === 1 && tags[0].trim().startsWith('[')) {
    try { return JSON.parse(tags[0]) as string[]; } catch { /* fall through */ }
  }
  return tags;
};

/* ── Main Component ────────────────────────────────────────────────── */
const GiftDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [attendeesExpanded, setAttendeesExpanded] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => { const res = await api.get(`/posts/${id}`); return res.data as GiftPost; },
  });

  const rsvpMutation = useMutation({
    mutationFn: (status: 'going' | 'maybe' | 'not-going' | null) => api.put(`/posts/${id}/rsvp`, { status }),
    onMutate: async (newStatus) => {
      await qc.cancelQueries({ queryKey: ['post', id] });
      const previous = qc.getQueryData<GiftPost>(['post', id]);
      if (previous) {
        qc.setQueryData<GiftPost>(['post', id], old => {
          if (!old) return old;
          const filteredRsvps = (old.rsvps ?? []).filter(r => r.user._id !== user?._id);
          const newRsvps = newStatus
            ? [...filteredRsvps, { user: { _id: user!._id, name: user!.name, avatar: user!.avatar, isVerified: user!.isVerified }, status: newStatus }]
            : filteredRsvps;
          return { ...old, userRsvp: newStatus, rsvps: newRsvps };
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(['post', id], context.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['post', id] }),
  });

  const handleRsvp = (status: 'going' | 'maybe' | 'not-going') => {
    if (!user) { navigate('/login'); return; }
    const next = post?.userRsvp === status ? null : status;
    rsvpMutation.mutate(next);
  };

  if (isLoading) return <Layout><Skeleton variant="rounded" height={400} /></Layout>;
  if (!post) return null;

  const isOwner = user?._id === post.author._id;
  const tags = parseTags(post.tags ?? []).filter(t => t !== 'gift' && Boolean(t));
  const conditionStyle = post.condition ? CONDITION_COLORS[post.condition] : null;

  /* RSVP stats */
  const interestedCount = post.rsvps?.filter(r => r.status === 'going').length ?? 0;
  const interestedAttendees = post.rsvps?.filter(r => r.status === 'going') ?? [];
  const VISIBLE_MAX = 12;
  const hasMore = interestedAttendees.length > VISIBLE_MAX;
  const visibleAttendees = attendeesExpanded ? interestedAttendees : interestedAttendees.slice(0, VISIBLE_MAX);
  const userRsvp = post.userRsvp ?? null;

  /* ── Right Sidebar ── */
  const sidebar = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Gifter Info Card */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.5rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: '0.75rem' }}>
          <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} sx={{ width: 80, height: 80, fontSize: '1.5rem', background: GIFT_GRAD, boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
            {post.author.name[0]}
          </OnlineAvatar>
        </Box>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, mb: '0.25rem' }}>{post.author.name}</Typography>
        <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: FONT, mb: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#10B981' }} />
          {post.locationName ?? 'Local area'}
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', mb: '1rem' }}>
          {[
            { value: `${post.author.rating.toFixed(1)}★`, label: 'Rating' },
            { value: `${interestedCount}`, label: 'Interested' },
            { value: post.author.isVerified ? '✓' : '—', label: 'Verified' },
            { value: post.commentCount?.toString() ?? '0', label: 'Comments' },
          ].map((s, i) => (
            <Box key={i} sx={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(5,150,105,0.06))', borderRadius: '0.5rem', p: '0.6rem 0.5rem' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#059669', fontFamily: FONT, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: FONT, mt: '0.2rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          <Box component="button" onClick={() => navigate(`/profile/${post.author._id}`)}
            sx={{ flex: 1, background: GIFT_GRAD, color: '#FFF', border: 'none', p: '0.6rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'opacity 0.2s', '&:hover': { opacity: 0.85 } }}>
            <i className="fas fa-user" /> Profile
          </Box>
          <Box component="button" onClick={() => user ? navigate('/exchanges/create') : navigate('/login')}
            sx={{ flex: 1, background: '#F3F4F6', color: '#059669', border: '1px solid #E5E7EB', p: '0.6rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'background 0.2s', '&:hover': { background: '#E9EAF0' } }}>
            <i className="fas fa-comment" /> Message
          </Box>
        </Box>
      </Box>

      {/* Gift Statistics */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, mb: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-chart-bar" style={{ color: '#10B981' }} /> Gift Statistics
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
          {[
            { value: `${interestedCount}`, label: 'Interested',   grad: 'linear-gradient(135deg, #10B981, #059669)' },
            { value: '1',                  label: 'Available',    grad: 'linear-gradient(135deg, #3B82F6, #6366F1)' },
            { value: post.author.rating.toFixed(1), label: 'Gifter Rating', grad: 'linear-gradient(135deg, #F59E0B, #D97706)' },
            { value: '< 2h',              label: 'Response Time', grad: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
          ].map((s, i) => (
            <Box key={i} sx={{ background: s.grad, borderRadius: '0.5rem', p: '0.75rem 0.6rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', fontFamily: FONT, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', fontFamily: FONT, mt: '0.2rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Community Safety */}
      <Box sx={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', p: '1.25rem' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#065F46', fontFamily: FONT, mb: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-shield-alt" style={{ color: '#10B981' }} /> Safety Tips
        </Typography>
        {[
          'Meet in a public place for pickup during daylight hours.',
          'Inspect the item before accepting the gift.',
          'Leave an honest review to help the community.',
          'Report any issues to community moderators.',
        ].map((tip, i) => (
          <Typography key={i} sx={{ fontSize: '0.775rem', color: '#065F46', lineHeight: 1.5, mb: '0.5rem', pl: '0.6rem', borderLeft: '2px solid #10B981', fontFamily: FONT }}>{tip}</Typography>
        ))}
      </Box>

    </Box>
  );

  return (
    <Layout rightPanel={sidebar}>
      {/* Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.5rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>
        <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#10B981' } }}>Home</Box>
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#10B981' } }}>Gifts</Box>
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" sx={{ color: '#1F2937', fontWeight: 500 }}>{post.title}</Box>
      </Box>

      {/* Main Card */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden', mb: '2rem' }}>

        {/* ═══ Zone 1 — Header ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg, rgba(16,185,129,0.05), rgba(5,150,105,0.05))' }}>
          {/* Top row: badge + condition */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem', flexWrap: 'wrap', gap: 1 }}>
            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: GIFT_GRAD, color: '#FFF', borderRadius: '0.375rem', px: '1rem', py: '0.5rem', fontSize: '0.875rem', fontWeight: 600, fontFamily: FONT }}>
              <i className="fas fa-gift" /> Gift
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              {post.condition && conditionStyle && (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: conditionStyle.bg, color: conditionStyle.color, border: `1px solid ${conditionStyle.border}`, borderRadius: '0.375rem', px: '0.875rem', py: '0.375rem', fontSize: '0.8125rem', fontWeight: 600, fontFamily: FONT }}>
                  <i className="fas fa-star" style={{ fontSize: '0.65rem' }} /> {post.condition}
                </Box>
              )}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>
                <i className="fas fa-hand-holding-heart" style={{ color: '#10B981' }} /> {interestedCount} Interested
              </Box>
            </Box>
          </Box>

          {/* Gifter row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem' }}>
            <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} sx={{ width: 64, height: 64, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
              {post.author.name[0]}
            </OnlineAvatar>
            <Box sx={{ flex: 1 }}>
              <Typography onClick={() => navigate(`/profile/${post.author._id}`)} sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { color: '#10B981' } }}>
                {post.author.name}
                {post.author.isVerified && <i className="fas fa-shield-alt" style={{ color: '#10B981', fontSize: '0.875rem' }} />}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT, mt: '0.25rem' }}>Gift Owner</Typography>
              <Box sx={{ display: 'flex', gap: '1.5rem', mt: '0.5rem', fontSize: '0.875rem', fontFamily: FONT }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-star" style={{ color: '#10B981', width: 16 }} />
                  <span>{post.author.rating.toFixed(1)} Rating</span>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-clock" style={{ color: '#10B981', width: 16 }} />
                  <span>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</span>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Title */}
          <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#1F2937', lineHeight: 1.2, mb: '1.5rem', fontFamily: HEADING }}>
            {post.title}
          </Typography>

          {/* Quick stats */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' }, gap: '1rem' }}>
            <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#059669', fontFamily: FONT }}>
                {post.startDate ? format(new Date(post.startDate), 'MMM d') : 'Flexible'}
                {post.endDate ? ` – ${format(new Date(post.endDate), 'MMM d')}` : ''}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Pick-Up</Typography>
            </Box>
            <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', fontFamily: FONT }}>{interestedCount}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Interested</Typography>
            </Box>
            <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#059669', fontFamily: FONT }}>{post.commentCount ?? 0}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Comments</Typography>
            </Box>
          </Box>
        </Box>

        {/* ═══ Zone 2 — Image Gallery ═══ */}
        {post.images.length > 0 && <Gallery media={post.images} />}

        {/* ═══ Zone 3 — Gift Details ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: FONT }}>
            <i className="fas fa-info-circle" style={{ color: '#10B981' }} /> Gift Details
          </Typography>

          {/* Description */}
          {post.content?.trim() && (
            <Box sx={{ mb: '1.75rem', pl: '0.25rem', fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, fontFamily: FONT }}>
              {post.content}
            </Box>
          )}

          <Box sx={{ borderTop: '1px solid #F3F4F6', mb: '1.5rem' }} />

          {/* Condition detail row */}
          {post.condition && conditionStyle && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', mb: '1.5rem' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', flexShrink: 0, background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))', color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-star" style={{ fontSize: '0.8rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.2rem', fontFamily: FONT }}>Condition</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>{post.condition}</Typography>
              </Box>
            </Box>
          )}

          {/* Specifications */}
          {post.specifications && post.specifications.length > 0 && (
            <Box>
              <Box sx={{ borderTop: '1px solid #F3F4F6', mb: '1.5rem' }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', mb: '1rem', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-list-ul" style={{ color: '#10B981', fontSize: '0.875rem' }} /> Item Specifications
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: '1rem' }}>
                {post.specifications.map((spec, si) => (
                  <Box key={si} sx={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.03), rgba(5,150,105,0.03))', border: '1px solid #E5E7EB', borderRadius: '0.625rem', p: '0.875rem 1rem' }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em', mb: '0.5rem', fontFamily: FONT }}>
                      {spec.name}
                    </Typography>
                    {spec.details.map((detail, di) => (
                      <Box key={di} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: di < spec.details.length - 1 ? '0.25rem' : 0 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: GIFT_GRAD, flexShrink: 0, mt: '0.45rem' }} />
                        <Typography sx={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.5, fontFamily: FONT }}>{detail}</Typography>
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: post.specifications?.length ? '1.25rem' : 0 }}>
              {tags.map(t => (
                <Box key={t} component="span" sx={{ background: '#F3F4F6', color: '#6B7280', borderRadius: '2rem', px: '0.75rem', py: '0.25rem', fontSize: '0.75rem', fontWeight: 500, fontFamily: FONT }}>#{t}</Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ═══ Zone 3b — Availability Calendar ═══ */}
        {post.startDate && (
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem' }}>
              <i className="fas fa-calendar-check" style={{ color: '#10B981' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#1F2937', fontFamily: FONT }}>Availability</Typography>
            </Box>
            <GiftAvailabilityCalendar post={post} />
          </Box>
        )}

        {/* ═══ Zone 4 — RSVP Status ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: FONT }}>
            <i className="fas fa-hand-holding-heart" style={{ color: '#10B981' }} /> RSVP Status
          </Typography>

          {/* RSVP action row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.75rem', flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT, mr: '0.25rem' }}>
              {user ? 'Your response:' : 'Log in to RSVP:'}
            </Typography>
            {([
              { key: 'going'     as const, icon: 'fas fa-check-circle',    label: 'Interested', activeColor: '#10B981', activeBg: 'rgba(16,185,129,0.1)' },
              { key: 'maybe'     as const, icon: 'fas fa-question-circle', label: 'Maybe',      activeColor: '#F59E0B', activeBg: 'rgba(245,158,11,0.1)' },
              { key: 'not-going' as const, icon: 'fas fa-times-circle',    label: 'Not For Me', activeColor: '#EF4444', activeBg: 'rgba(239,68,68,0.1)' },
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
                    fontSize: '0.875rem', fontWeight: isActive ? 600 : 400, fontFamily: FONT,
                    cursor: rsvpMutation.isPending ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    '&:hover': rsvpMutation.isPending ? {} : { borderColor: opt.activeColor, color: opt.activeColor, background: opt.activeBg },
                  }}
                >
                  {rsvpMutation.isPending && isActive
                    ? <CircularProgress size={12} sx={{ color: opt.activeColor }} />
                    : <i className={opt.icon} style={{ fontSize: '0.875rem' }} />}
                  {opt.label}
                </Box>
              );
            })}
            {userRsvp && (
              <Typography sx={{ fontSize: '0.8125rem', color: '#10B981', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.375rem', ml: '0.25rem' }}>
                <i className="fas fa-check-circle" /> Click again to change
              </Typography>
            )}
          </Box>

          {/* Who's Interested */}
          <Box sx={{ borderTop: '1px solid #F3F4F6', pt: '1.5rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem', flexWrap: 'wrap', gap: 1 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: FONT }}>
                <i className="fas fa-users" style={{ color: '#10B981', fontSize: '0.9rem' }} />
                Who's Interested
                <Box component="span" sx={{ ml: '0.25rem', px: '0.625rem', py: '0.125rem', background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: '2rem', fontSize: '0.8125rem', fontWeight: 700, fontFamily: FONT }}>
                  {interestedCount} confirmed
                </Box>
              </Typography>
            </Box>

            {interestedAttendees.length === 0 ? (
              <Box sx={{ py: '2rem', textAlign: 'center', background: '#F9FAFB', borderRadius: '0.75rem', border: '1px dashed #E5E7EB' }}>
                <Box sx={{ fontSize: '2rem', mb: '0.5rem' }}>🎁</Box>
                <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontFamily: FONT }}>
                  Be the first to show interest! Click <strong>Interested</strong> above to RSVP.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(110px,1fr))', gap: '0.75rem' }}>
                  {visibleAttendees.map(r => (
                    <Box key={r.user._id} onClick={() => navigate(`/profile/${r.user._id}`)} sx={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '0.875rem', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#10B981', transform: 'translateY(-2px)', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' } }}>
                      <OnlineAvatar userId={r.user._id} src={r.user.avatar} isVerified={r.user.isVerified} sx={{ width: 44, height: 44, fontSize: '0.875rem', fontWeight: 600, mx: 'auto', mb: '0.5rem' }}>
                        {r.user.name[0]}
                      </OnlineAvatar>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1F2937', fontFamily: FONT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.user.name}
                      </Typography>
                    </Box>
                  ))}
                </Box>
                {hasMore && (
                  <Box component="button" onClick={() => setAttendeesExpanded(v => !v)} sx={{ mt: '1rem', width: '100%', py: '0.625rem', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', background: '#FAFAFA', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#10B981', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', '&:hover': { background: 'rgba(16,185,129,0.05)', borderColor: '#10B981' } }}>
                    <i className={`fas fa-chevron-${attendeesExpanded ? 'up' : 'down'}`} />
                    {attendeesExpanded ? 'Show less' : `Show ${interestedAttendees.length - VISIBLE_MAX} more`}
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>

        {/* ═══ Zone 5 — Discussion ═══ */}
        <GiftDiscussion post={post} />
      </Box>

      {/* Guest banner */}
      {!user && <GuestBanner message="Log in to claim gifts and interact with the community." />}

      {/* Floating action button */}
      {user && !isOwner && (
        <Box sx={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 90 }}>
          <Box component="button" onClick={() => handleRsvp('going')} sx={{ width: 56, height: 56, background: GIFT_GRAD, color: '#FFF', border: 'none', borderRadius: '50%', fontSize: '1.25rem', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', '&:hover': { transform: 'scale(1.1)', boxShadow: '0 20px 40px rgba(16,185,129,0.3)' } }}>
            <i className="fas fa-hand-holding-heart" />
          </Box>
        </Box>
      )}
    </Layout>
  );
};

export default GiftDetail;
