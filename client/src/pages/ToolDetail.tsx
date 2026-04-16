import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, Skeleton, Dialog, DialogContent, Alert, IconButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatDistanceToNow,
  format,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isToday, addMonths, subMonths, addDays,
} from 'date-fns';
import Layout from '../components/layout/Layout';
import GuestBanner from '../components/GuestBanner';
import CreateExchange from './CreateExchange';
import RichTextEditor from '../components/RichTextEditor';
import PublicPlacePicker from '../components/PublicPlacePicker';
import api from '../services/api';
import { scanMedia } from '../utils/scanMedia';
import { getSocket } from '../services/socket';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import OnlineAvatar from '../components/OnlineAvatar';
import RichContent from '../components/RichContent';

/* ── Design tokens ─────────────────────────────────────────────────── */
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';
const TOOL_GRAD = 'linear-gradient(135deg, #3B82F6, #8B5CF6)';
const FONT = 'Inter, sans-serif';
const HEADING = 'Poppins, sans-serif';

/* ── Availability Calendar ─────────────────────────────────────────── */
const AvailabilityCalendar: React.FC<{ post: Post }> = ({ post }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const availableDates = React.useMemo((): Set<string> => {
    const set = new Set<string>();
    const toKey = (d: Date) => d.toISOString().split('T')[0];
    const base = post.startDate ? new Date(post.startDate) : null;
    if (post.recurring === 'once' && base) {
      set.add(toKey(base));
    } else if ((post.recurring === 'weekly' || post.recurring === 'biweekly') && base) {
      const step = post.recurring === 'biweekly' ? 14 : 7;
      const totalSessions = post.sessions ?? 8;
      let cur = new Date(base);
      for (let i = 0; i < totalSessions; i++) {
        set.add(toKey(cur));
        cur = new Date(cur.getTime() + step * 24 * 60 * 60 * 1000);
      }
    }
    return set;
  }, [post.startDate, post.recurring, post.sessions]);

  const isAvailable = (d: Date) => {
    if (!isSameMonth(d, currentMonth)) return false;
    return availableDates.has(d.toISOString().split('T')[0]);
  };

  const TIME_SLOTS = React.useMemo((): string[] => {
    if (!post.timeStart || !post.timeEnd) return [];
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60); const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };
    const start = toMin(post.timeStart); const end = toMin(post.timeEnd);
    return [`${fmt(start)} – ${fmt(end)}`];
  }, [post.timeStart, post.timeEnd]);

  return (
    <Box>
      {/* Calendar header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          <Box component="button" onClick={() => setCurrentMonth(new Date())} sx={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280',
            px: '0.875rem', py: '0.375rem', borderRadius: '0.375rem', cursor: 'pointer',
            fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif',
            '&:hover': { borderColor: '#4F46E5', color: '#4F46E5' },
          }}>Today</Box>
          <Box component="button" onClick={() => setCurrentMonth(m => subMonths(m, 1))} sx={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280',
            width: 32, height: 32, borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            '&:hover': { borderColor: '#4F46E5', color: '#4F46E5' },
          }}><i className="fas fa-chevron-left" style={{ fontSize: '0.75rem' }} /></Box>
          <Box component="button" onClick={() => setCurrentMonth(m => addMonths(m, 1))} sx={{
            background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280',
            width: 32, height: 32, borderRadius: '0.375rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            '&:hover': { borderColor: '#4F46E5', color: '#4F46E5' },
          }}><i className="fas fa-chevron-right" style={{ fontSize: '0.75rem' }} /></Box>
        </Box>
      </Box>

      {/* Calendar grid */}
      <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.75rem', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        {/* Day headers */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <Box key={d} sx={{ textAlign: 'center', py: '0.875rem', fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{d}</Box>
          ))}
        </Box>
        {/* Weeks */}
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
              if (selected) { bg = GRAD; border = '2px solid #4F46E5'; color = '#fff'; }
              if (!avail && inMonth && !today) { bg = '#F9FAFB'; color = '#9CA3AF'; }
              return (
                <Box key={di} onClick={() => avail && inMonth && setSelectedDay(day)} sx={{
                  minHeight: 72, p: '0.5rem', textAlign: 'center', background: bg, border, borderRadius: '0.375rem', m: '2px',
                  cursor: avail && inMonth ? 'pointer' : 'default', transition: 'all 0.15s',
                  '&:hover': avail && inMonth ? { transform: 'translateY(-1px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : {},
                }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%', mb: '0.25rem',
                    fontWeight: selected || today ? 700 : 500, fontSize: '0.9375rem',
                    color: selected ? '#fff' : today ? '#fff' : color,
                    background: today && !selected ? '#10B981' : 'transparent',
                  }}>
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
          { color: 'rgba(16,185,129,0.3)', label: 'Available' },
          { color: '#10B981', label: 'Today' },
          { color: GRAD, label: 'Selected' },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '0.25rem', background: color }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: FONT }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Time slots */}
      {selectedDay && TIME_SLOTS.length > 0 && (
        <Box sx={{ mt: '1.25rem' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.75rem', fontFamily: FONT }}>
            Available times on {format(selectedDay, 'EEEE, MMMM d')}
          </Typography>
          <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TIME_SLOTS.map(slot => (
              <Box key={slot} component="button" onClick={() => setSelectedSlot(slot === selectedSlot ? null : slot)} sx={{
                background: slot === selectedSlot ? GRAD : '#F9FAFB',
                color: slot === selectedSlot ? '#fff' : '#374151',
                border: slot === selectedSlot ? 'none' : '1px solid #E5E7EB',
                px: '1rem', py: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer',
                fontSize: '0.875rem', fontWeight: 500, fontFamily: FONT,
                transition: 'all 0.15s', '&:hover': { borderColor: '#4F46E5', color: slot === selectedSlot ? '#fff' : '#4F46E5' },
              }}>{slot}</Box>
            ))}
          </Box>
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

/* ── Media helpers ─────────────────────────────────────────────────── */
const getMediaType = (url: string | null | undefined): 'video' | 'image' => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|ogg|avi|mkv)$/.test(clean)) return 'video';
  return 'image';
};

/* ── Image Gallery ─────────────────────────────────────────────────── */
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
      {/* Main viewer */}
      <Box sx={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#111', mb: '0.75rem', boxShadow: '0 4px 16px rgba(0,0,0,0.18)' }}>
        {/* Slides */}
        <Box sx={{ display: 'flex', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform: `translateX(-${safeIdx * 100}%)` }}>
          {valid.map((src, i) => {
            const type = getMediaType(src);
            return (
              <Box key={i} sx={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#111', minHeight: 340 }}>
                {type === 'video' ? (
                  <Box component="video" src={src} controls preload="metadata"
                    sx={{ width: '100%', maxHeight: 480, display: 'block', outline: 'none' }} />
                ) : (
                  <Box component="img" src={src} alt=""
                    onError={() => setErrored(e => ({ ...e, [i]: true }))}
                    sx={{ width: '100%', maxHeight: 480, objectFit: 'contain', display: 'block' }} />
                )}
              </Box>
            );
          })}
        </Box>

        {/* Arrows */}
        {count > 1 && (
          <>
            <Box component="button" onClick={prev} sx={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', backdropFilter: 'blur(6px)', transition: 'background 0.2s',
              '&:hover': { background: 'rgba(0,0,0,0.8)' },
            }}><i className="fas fa-chevron-left" style={{ fontSize: '0.8rem' }} /></Box>
            <Box component="button" onClick={next} sx={{
              position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
              width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center',
              justifyContent: 'center', backdropFilter: 'blur(6px)', transition: 'background 0.2s',
              '&:hover': { background: 'rgba(0,0,0,0.8)' },
            }}><i className="fas fa-chevron-right" style={{ fontSize: '0.8rem' }} /></Box>
          </>
        )}

        {/* Counter + type badge */}
        <Box sx={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {currentType === 'video' && (
            <Box sx={{ background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, px: '0.5rem', py: '0.2rem', borderRadius: '0.375rem', letterSpacing: '0.04em' }}>VIDEO</Box>
          )}
          {count > 1 && (
            <Box sx={{ background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.72rem', fontWeight: 600, px: '0.6rem', py: '0.25rem', borderRadius: '1rem', backdropFilter: 'blur(4px)' }}>
              {safeIdx + 1} / {count}
            </Box>
          )}
        </Box>
      </Box>

      {/* Thumbnail strip */}
      {count > 1 && (
        <Box sx={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', pb: '0.25rem',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 },
        }}>
          {valid.map((src, i) => {
            const type = getMediaType(src);
            const active = i === safeIdx;
            return (
              <Box key={i} onClick={() => setIdx(i)} sx={{
                flexShrink: 0, width: 72, height: 56, borderRadius: '0.5rem', overflow: 'hidden',
                border: active ? '2px solid #4F46E5' : '2px solid #E5E7EB',
                cursor: 'pointer', background: '#111', position: 'relative',
                opacity: active ? 1 : 0.7, transition: 'all 0.18s',
                '&:hover': { opacity: 1, borderColor: active ? '#4F46E5' : '#A5B4FC' },
                boxShadow: active ? '0 0 0 3px rgba(79,70,229,0.2)' : 'none',
              }}>
                {type === 'video' ? (
                  <>
                    <Box component="video" src={src} preload="metadata" muted
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
                      <i className="fas fa-play" style={{ color: '#fff', fontSize: '0.8rem' }} />
                    </Box>
                  </>
                ) : (
                  <Box component="img" src={src} alt=""
                    onError={() => setErrored(e => ({ ...e, [i]: true }))}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

/* ── Comment types + helpers ───────────────────────────────────────── */
type CommentType = { _id: string; content: string; parentId: string | null; author: { _id: string; name: string; avatar?: string; ceuBalance?: number; isVerified?: boolean }; createdAt: string };

const getCeuTier = (ceu = 0): { label: string; bg: string } => {
  if (ceu >= 1000) return { label: 'Diamond',  bg: 'linear-gradient(135deg,#6366F1,#8B5CF6)' };
  if (ceu >= 500)  return { label: 'Platinum', bg: 'linear-gradient(135deg,#0EA5E9,#6366F1)' };
  if (ceu >= 250)  return { label: 'Gold',     bg: 'linear-gradient(135deg,#F59E0B,#EF4444)' };
  if (ceu >= 100)  return { label: 'Silver',   bg: 'linear-gradient(135deg,#6B7280,#9CA3AF)' };
  return                  { label: 'Bronze',   bg: 'linear-gradient(135deg,#92400E,#B45309)' };
};

const CommentCard: React.FC<{ c: CommentType; allComments: CommentType[]; onReply: (body: { content: string; parentId: string | null }) => void; onDelete: (commentId: string) => void; postId: string; depth?: number }> = ({ c, allComments, onReply, onDelete, depth = 0 }) => {
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

  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const cardReplies = allComments.filter(r => r.parentId === c._id);

  return (
    <Box sx={{ display: 'flex', gap: '0.625rem' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <OnlineAvatar userId={c.author._id} src={c.author.avatar} isVerified={c.author.isVerified} dotSize={9} sx={{ width: 32, height: 32, background: GRAD, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate(`/profile/${c.author._id}`)}>{initials}</OnlineAvatar>
        {!collapsed && cardReplies.length > 0 && (
          <Box onClick={() => setCollapsed(true)} sx={{ flex: 1, width: 2, background: '#E5E7EB', mt: '0.375rem', cursor: 'pointer', borderRadius: 1, minHeight: 24, '&:hover': { background: '#4F46E5' } }} />
        )}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem', flexWrap: 'wrap' }}>
          <Typography onClick={() => navigate(`/profile/${c.author._id}`)} sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937', cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}>{c.author.name}</Typography>
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
                    {isOwn ? (
                      <Box component="button" onClick={() => { setMenuOpen(false); onDelete(c._id); }} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#DC2626', fontFamily: FONT, fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FEF2F2' } }}>
                        <i className="fas fa-trash-alt" style={{ fontSize: '0.75rem' }} /> Delete
                      </Box>
                    ) : (
                      <Box component="button" onClick={() => { setMenuOpen(false); alert('Report submitted. Thank you for keeping the community safe.'); }} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#D97706', fontFamily: FONT, fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FFFBEB' } }}>
                        <i className="fas fa-flag" style={{ fontSize: '0.75rem' }} /> Report
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
            {replyOpen && (
              <Box sx={{ mt: '0.75rem' }}>
                <Box component="textarea" value={replyText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)} placeholder={`Reply to ${c.author.name}…`}
                  sx={{ width: '100%', minHeight: 72, p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', fontFamily: FONT, fontSize: '0.875rem', color: '#1F2937', resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }} />
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

const ToolDiscussion: React.FC<{ post: Post }> = ({ post }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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
          <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: HEADING }}>Tool Discussion</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          <i className="fas fa-users" style={{ marginRight: 4 }} />
          {uniqueAuthors} participant{uniqueAuthors !== 1 ? 's' : ''} • {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {!user ? (
        <Box sx={{ mb: '1.5rem' }}><GuestBanner message="Log in to join the discussion and leave a comment." /></Box>
      ) : !composerOpen ? (
        <Box onClick={() => setComposerOpen(true)} sx={{ mb: '1.5rem', p: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '1.5rem', color: '#9CA3AF', cursor: 'text', fontSize: '0.9375rem', background: '#F9FAFB', '&:hover': { borderColor: '#4F46E5' } }}>
          Add a comment…
        </Box>
      ) : (
        <Box sx={{ mb: '1.5rem', border: '1px solid #4F46E5', borderRadius: '0.625rem', overflow: 'hidden', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' }}>
          <Box component="textarea" autoFocus value={newComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)} placeholder="What are your thoughts?"
            sx={{ width: '100%', minHeight: 100, p: '0.875rem 1rem', border: 'none', fontFamily: FONT, fontSize: '0.9375rem', color: '#1F2937', background: '#FFF', resize: 'none', outline: 'none', boxSizing: 'border-box', display: 'block' }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', p: '0.625rem 0.875rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
            <Box component="button" onClick={() => { setComposerOpen(false); setNewComment(''); }} sx={{ background: 'none', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: FONT, '&:hover': { background: '#F3F4F6' } }}>Cancel</Box>
            <Box component="button" onClick={() => { if (newComment.trim()) { addMutation.mutate({ content: newComment, parentId: null }); setNewComment(''); setComposerOpen(false); } }} sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '1rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: FONT, opacity: newComment.trim() ? 1 : 0.4 }}>Comment</Box>
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

/* ── Shared form-style helpers (matches CreatePost visual language) ── */
const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.25rem' }}>
    <i className={`fas ${icon}`} style={{ color: '#4F46E5', fontSize: '1.125rem' }} />
    <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', fontFamily: HEADING }}>{children}</Typography>
  </Box>
);
const FLabel: React.FC<{ required?: boolean; hint?: string; children: React.ReactNode }> = ({ required, hint, children }) => (
  <Box component="label" sx={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', mb: '0.5rem', fontFamily: FONT }}>
    {children}{required && <Box component="span" sx={{ color: '#EF4444', ml: '0.2rem' }}>*</Box>}
    {hint && <Box component="span" sx={{ color: '#9CA3AF', fontWeight: 400, ml: '0.375rem', fontSize: '0.8125rem' }}>{hint}</Box>}
  </Box>
);
const FContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ background: '#F9FAFB', borderRadius: '0.75rem', p: '1.25rem', border: '1px solid #E5E7EB', mb: '1.25rem' }}>
    {children}
  </Box>
);
const inputCss = {
  width: '100%', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
  padding: '0.625rem 0.875rem', fontSize: '0.875rem', fontFamily: 'Inter,sans-serif',
  color: '#1F2937', background: '#FFFFFF', outline: 'none',
  boxSizing: 'border-box' as const, transition: 'border-color 0.15s',
  '&:focus': { borderColor: '#4F46E5' }, '&::placeholder': { color: '#9CA3AF' },
};

/* ── Borrow dialog constants ─────────────────────────────────────── */
const BORROW_CONDITIONS = ['New', 'Excellent', 'Good', 'Fair'];
const BORROW_DEPOSIT_RATES: Record<string, number> = { New: 0.30, Excellent: 0.25, Good: 0.20, Fair: 0.15 };
const BORROW_SPEC_PRESETS = [
  'Fuel Type', 'Power Source', 'Maintenance', 'Weight', 'Dimensions',
  'Brand / Model', 'Age', 'Included Accessories', 'Safety Notes',
  'Operating Instructions', 'Storage Requirements', 'Noise Level',
];
interface BorrowToolSpec { id: string; name: string; details: string[]; newDetail: string; }

/* ── Borrow Stepper ─────────────────────────────────────────────── */
const BORROW_STEPS = ['Tool', 'Exchange Location', 'Schedule', 'Review & Post'];

const BorrowStepper: React.FC<{ step: number }> = ({ step }) => (
  <Box sx={{ border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.25rem 1.5rem 0', mb: '1.5rem', background: '#FFF' }}>
    <Box sx={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
      {BORROW_STEPS.map((label, i) => {
        const active   = i === step;
        const complete = i < step;
        return (
          <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* connector line */}
            {i < BORROW_STEPS.length - 1 && (
              <Box sx={{
                position: 'absolute', top: 18, left: '50%', width: '100%', height: 2,
                background: complete ? 'linear-gradient(90deg,#4F46E5,#10B981)' : '#E5E7EB',
                zIndex: 0,
              }} />
            )}
            {/* circle */}
            <Box sx={{
              width: 36, height: 36, borderRadius: '50%', zIndex: 1, mb: '0.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active || complete ? 'linear-gradient(135deg,#4F46E5,#10B981)' : '#FFF',
              border: active || complete ? 'none' : '2px solid #D1D5DB',
              fontFamily: HEADING, fontWeight: 700, fontSize: '0.9375rem',
              color: active || complete ? '#FFF' : '#9CA3AF',
              transition: 'all .2s',
            }}>
              {complete ? <i className="fas fa-check" style={{ fontSize: '0.75rem' }} /> : i + 1}
            </Box>
            {/* label */}
            <Typography sx={{
              fontFamily: FONT, fontSize: '0.75rem', fontWeight: active ? 600 : 400,
              color: active ? '#4F46E5' : complete ? '#374151' : '#9CA3AF',
              textAlign: 'center', lineHeight: 1.3, pb: '0.75rem',
            }}>
              {label}
            </Typography>
            {/* active underline */}
            {active && (
              <Box sx={{ position: 'absolute', bottom: 0, left: '10%', right: '10%', height: 3, borderRadius: '2px 2px 0 0', background: 'linear-gradient(90deg,#4F46E5,#10B981)' }} />
            )}
          </Box>
        );
      })}
    </Box>
  </Box>
);

interface BorrowDialogProps { open: boolean; onClose: () => void; post: Post; mode?: 'borrow' | 'permanent'; }
const BorrowRequestDialog: React.FC<BorrowDialogProps> = ({ open, onClose, post, mode = 'borrow' }) => {
  const isPermanent = mode === 'permanent';
  const navigate    = useNavigate();
  const tomorrow    = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  const weekOut     = format(addDays(new Date(), 8), 'yyyy-MM-dd');
  const specDropRef = useRef<HTMLDivElement>(null);

  const [step,             setStep]             = useState(0);
  const [borrowerToolName, setBorrowerToolName] = useState('');
  const [content,          setContent]          = useState('');
  const [mediaFiles,       setMediaFiles]       = useState<File[]>([]);
  const [mediaScanning,    setMediaScanning]    = useState(false);
  const [mediaScanError,   setMediaScanError]   = useState('');
  const [borrowFrom,       setBorrowFrom]       = useState('');
  const [returnBy,         setReturnBy]         = useState('');
  const [locationType,     setLocationType]     = useState<'public' | 'private'>('public');
  const [publicPlace,      setPublicPlace]      = useState('');
  const [privatePlace,     setPrivatePlace]     = useState('');
  const [ceuRate,          setCeuRate]          = useState('');
  const [condition,        setCondition]        = useState('Good');
  const [marketValue,      setMarketValue]      = useState('');
  const [toolSpecs,        setToolSpecs]        = useState<BorrowToolSpec[]>([]);
  const [specCatInput,     setSpecCatInput]     = useState('');
  const [specPresetOpen,   setSpecPresetOpen]   = useState(false);
  const [error,            setError]            = useState('');

  useEffect(() => {
    if (!open) return;
    setStep(0); setContent(''); setError('');
    setBorrowerToolName('');
    setMediaFiles([]); setMediaScanning(false); setMediaScanError('');
    setBorrowFrom(post.startDate ? post.startDate.slice(0, 10) : tomorrow);
    setReturnBy(weekOut);
    const providerLoc = post.locationName && post.locationName !== 'Online' && post.locationName !== '[Private Location — Secure Sharing Enabled]'
      ? post.locationName : '';
    setPublicPlace(providerLoc);
    setPrivatePlace('');
    setLocationType(post.locationName === '[Private Location — Secure Sharing Enabled]' ? 'private' : 'public');
    setCeuRate(post.ceuRate ? String(post.ceuRate) : '');
    setCondition('Good');
    setMarketValue('');
    setToolSpecs([]);
    setSpecCatInput('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const borrowDays = (borrowFrom && returnBy)
    ? Math.max(1, Math.round((new Date(returnBy + 'T00:00:00').getTime() - new Date(borrowFrom + 'T00:00:00').getTime()) / 86400000))
    : 1;

  /* Deposit calc */
  const mvRaw       = parseFloat(marketValue) || 0;
  const depositRate = BORROW_DEPOSIT_RATES[condition] ?? 0.20;
  const depositCeu  = Math.round(mvRaw * depositRate);
  const depositDisp = mvRaw > 0 ? `${depositCeu} CEU` : '—';

  /* Spec category helpers */
  const addSpecCat = (name: string) => {
    const n = name.trim(); if (!n) return;
    setToolSpecs(prev => [...prev, { id: String(Date.now()), name: n, details: [], newDetail: '' }]);
    setSpecCatInput(''); setSpecPresetOpen(false);
  };
  const specQ           = specCatInput.trim().toLowerCase();
  const specSuggestions = BORROW_SPEC_PRESETS.filter(p =>
    !toolSpecs.some(s => s.name === p) && (!specQ || p.toLowerCase().includes(specQ))
  );
  const isExactPreset = BORROW_SPEC_PRESETS.some(p => p.toLowerCase() === specQ);

  const mutation = useMutation({
    mutationFn: (payload: object) => api.post('/exchanges', payload),
    onSuccess: (res) => { onClose(); navigate(`/exchanges/${res.data._id}`); },
    onError: (err: unknown) => setError(
      (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
      'Failed to submit — check your connection and try again.'
    ),
  });

  const handleNext = () => {
    setError('');
    if (step === 0 && !borrowerToolName.trim()) { setError('Tool name is required.'); return; }
    if (step === 0 && !content.trim()) { setError('Description is required.'); return; }
    if (step === 2 && !borrowFrom)     { setError(isPermanent ? 'Pick Up Date is required.' : 'Borrow From date is required.'); return; }
    if (step === 2 && !isPermanent && !returnBy) { setError('Return By date is required.'); return; }
    if (step < 3) { setStep(s => s + 1); return; }
    // step === 3: submit
    const resolvedLocation = locationType === 'public'
      ? publicPlace.trim()
      : (privatePlace.trim() || '[Private Location — Secure Sharing Enabled]');
    mutation.mutate({
      type: 'tool',
      title: borrowerToolName.trim()
        ? `${borrowerToolName.trim()} ↔ ${post.title}`
        : `Tool exchange ↔ ${post.title}`,
      description: content.trim() || ' ',
      offering: borrowerToolName.trim() || 'My tool',
      seeking: post.title,
      ceuValue: parseFloat(ceuRate) || 1,
      tags: [...(post.tags ?? []), condition.toLowerCase()],
      scheduledDate: borrowFrom ? new Date(borrowFrom + 'T09:00:00').toISOString() : undefined,
      ...(!isPermanent && returnBy ? { returnDate: new Date(returnBy + 'T09:00:00').toISOString() } : {}),
      locationName: resolvedLocation || undefined,
      postId: post._id,
      // Tool-specific fields
      toolCondition: condition,
      toolMarketValue: marketValue ? parseFloat(marketValue) : undefined,
      toolSpecs: toolSpecs.map(s => ({ name: s.name, details: s.details })),
      // Borrow deposit only applies to borrow requests
      ...(!isPermanent && depositCeu > 0 ? { depositAmount: depositCeu } : {}),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper"
      PaperProps={{ sx: { borderRadius: '1rem', maxHeight: '92vh' } }}>

      {/* ── Header ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '1.5rem', pt: '1rem', pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Box sx={{ width: 36, height: 36, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.875rem' }}>
            <i className={`fas ${isPermanent ? 'fa-random' : 'fa-hand-holding'}`} />
          </Box>
          <Typography sx={{ fontFamily: HEADING, fontWeight: 700, fontSize: '1.25rem', color: '#1F2937' }}>
            {isPermanent ? 'Offer Permanent Exchange' : 'Request to Borrow'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: '#6B7280', '&:hover': { color: '#1F2937' } }}>
          <i className="fas fa-times" style={{ fontSize: '1rem' }} />
        </IconButton>
      </Box>

      <DialogContent sx={{ pt: '1.25rem', px: '1.5rem' }}>
        {/* ── Stepper ── */}
        <BorrowStepper step={step} />

        {error && <Alert severity="error" sx={{ mb: '1.25rem', borderRadius: '0.5rem' }}>{error}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

          {/* ══ STEP 1: Tool ══ */}
          {step === 0 && (<>

          {/* ══ SECTION: Your Tool Offering ══ */}
          <SectionTitle icon="fa-tools">Your Tool Offering</SectionTitle>
          <FContainer>
            {/* Tool Name + Condition row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', mb: '1.25rem' }}>
              <Box sx={{ flex: 1, minWidth: 220 }}>
                <FLabel required>Tool Name</FLabel>
                <Box component="input" type="text" value={borrowerToolName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrowerToolName(e.target.value)}
                  placeholder="Search or type a tool name..."
                  sx={{ ...inputCss, width: '100%' }} />
                <Box sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: FONT, mt: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <i className="fas fa-info-circle" style={{ fontSize: '0.65rem' }} />
                  Choose from the list or type a custom tool name
                </Box>
              </Box>
              <Box>
                <FLabel>Condition</FLabel>
                <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {BORROW_CONDITIONS.map(c => {
                    const isActive = condition === c;
                    return (
                      <Box key={c} component="button" type="button" onClick={() => setCondition(c)}
                        sx={{
                          padding: '0.5rem 1rem', border: '1px solid',
                          borderColor: isActive ? 'transparent' : '#E5E7EB',
                          borderRadius: '0.375rem', cursor: 'pointer',
                          background: isActive ? GRAD : '#FFF',
                          color: isActive ? '#FFF' : '#374151',
                          fontFamily: FONT, fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                          transition: 'all .15s',
                          '&:hover': { borderColor: isActive ? 'transparent' : '#4F46E5', color: isActive ? '#FFF' : '#4F46E5' },
                        }}>
                        {c}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>

            {/* Add photos or videos */}
            <Box sx={{ mb: '1.25rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Box
                  component="label"
                  htmlFor="borrow-media-upload"
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                    px: '0.875rem', py: '0.45rem', borderRadius: '0.375rem',
                    border: '1px dashed #4F46E5', cursor: mediaScanning ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem', fontWeight: 500, color: '#4F46E5',
                    background: 'rgba(79,70,229,0.04)', opacity: mediaScanning ? 0.6 : 1,
                    fontFamily: FONT,
                    '&:hover': { background: mediaScanning ? undefined : 'rgba(79,70,229,0.08)' },
                  }}
                >
                  <i className="fas fa-photo-video" style={{ fontSize: '0.875rem' }} />
                  {mediaScanning ? 'Scanning…' : 'Add photos or videos'}
                  <input
                    id="borrow-media-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/ogg"
                    multiple
                    hidden
                    disabled={mediaScanning}
                    onChange={async (e: React.ChangeEvent<HTMLInputElement>) => {
                      const files = Array.from(e.target.files || []);
                      e.target.value = '';
                      if (!files.length) return;
                      setMediaScanError('');
                      const MAX_BYTES = 100 * 1024 * 1024;
                      for (const file of files) {
                        if (file.size > MAX_BYTES) {
                          setMediaScanError(`"${file.name}" exceeds 100 MB limit.`);
                          return;
                        }
                      }
                      setMediaScanning(true);
                      const safe: File[] = [];
                      for (const file of files) {
                        const result = await scanMedia(file);
                        if (!result.safe) {
                          setMediaScanError(`"${file.name}" was removed — ${result.reason ?? 'explicit content'}.`);
                          setMediaScanning(false);
                          return;
                        }
                        safe.push(file);
                      }
                      setMediaScanning(false);
                      setMediaFiles(prev => [...prev, ...safe]);
                    }}
                  />
                </Box>
                {mediaScanning && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                    <i className="fas fa-spinner fa-spin" style={{ color: '#4F46E5' }} />
                    Checking for NSFW content…
                  </Box>
                )}
              </Box>

              {/* Scan error */}
              {mediaScanError && (
                <Alert severity="error" sx={{ mt: '0.625rem', fontSize: '0.8125rem', fontFamily: FONT }}>
                  {mediaScanError}
                </Alert>
              )}

              {/* Preview strip */}
              {mediaFiles.length > 0 && (
                <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.75rem' }}>
                  {mediaFiles.map((file, idx) => {
                    const url = URL.createObjectURL(file);
                    const isVideo = file.type.startsWith('video/');
                    return (
                      <Box key={idx} sx={{ position: 'relative', width: 72, height: 72, borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid #E5E7EB', flexShrink: 0 }}>
                        {isVideo
                          ? <Box sx={{ width: '100%', height: '100%', background: '#1F2937', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className="fas fa-play-circle" style={{ color: '#FFF', fontSize: '1.5rem' }} />
                            </Box>
                          : <Box component="img" src={url} alt={file.name}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onLoad={() => URL.revokeObjectURL(url)} />
                        }
                        <Box component="button" type="button"
                          onClick={() => setMediaFiles(prev => prev.filter((_, i) => i !== idx))}
                          sx={{
                            position: 'absolute', top: 2, right: 2,
                            width: 18, height: 18, borderRadius: '50%', border: 'none',
                            background: 'rgba(0,0,0,0.6)', color: '#FFF', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6rem', p: 0,
                          }}>
                          <i className="fas fa-times" />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Box>

            {/* Description — RichTextEditor */}
            <FLabel required>Description</FLabel>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder={'Describe the tool you\'re requesting...\n• Make and model\n• Condition and age\n• What it\'s suitable for\n• Any terms for borrowing'}
              minHeight={160}
              extraToolbar={
                <Box component="button" type="button"
                  onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); document.execCommand('insertText', false, '\n## '); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', px: '0.75rem', py: '0.375rem', borderRadius: '0.375rem', border: '1px solid #E5E7EB', background: '#fff', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, color: '#374151', '&:hover': { background: '#F3F4F6', borderColor: '#D1D5DB' } }}>
                  <i className="fas fa-heading" style={{ fontSize: '0.75rem' }} /> Heading
                </Box>
              }
            />
            <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className="fas fa-info-circle" style={{ fontSize: '0.65rem' }} />
              Use bullet points and headings to make your post easy to read
            </Box>
          </FContainer>

          {/* ══ SECTION: Market Value & Deposit ══ */}
          <SectionTitle icon="fa-tag">Market Value &amp; Deposit</SectionTitle>
          <FContainer>
            {/* Market Value input */}
            <Box sx={{ mb: '1.5rem' }}>
              <FLabel>Second-hand Market Value</FLabel>
              <Box sx={{ display: 'flex', gap: '0.5rem', mb: '0.5rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', px: '0.75rem', py: '0.625rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#F9FAFB', color: '#374151', fontFamily: FONT, fontSize: '0.875rem', fontWeight: 500, gap: '0.3rem', flexShrink: 0 }}>
                  USD <i className="fas fa-chevron-down" style={{ fontSize: '0.55rem', color: '#9CA3AF' }} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFF', overflow: 'hidden' }}>
                  <Box sx={{ px: '0.75rem', color: '#9CA3AF', fontFamily: FONT, fontSize: '0.875rem', borderRight: '1px solid #E5E7EB', py: '0.625rem', background: '#F9FAFB' }}>$</Box>
                  <Box component="input" type="number" value={marketValue} min="0" step="0.01"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMarketValue(e.target.value)}
                    placeholder="0.00"
                    sx={{ flex: 1, border: 'none', outline: 'none', px: '0.75rem', py: '0.625rem', fontSize: '0.875rem', fontFamily: FONT, color: '#1F2937', background: 'transparent', '&::placeholder': { color: '#9CA3AF' } }} />
                </Box>
              </Box>
              <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fas fa-info-circle" style={{ fontSize: '0.65rem' }} />
                Current second-hand market rate for this tool
              </Box>
            </Box>

            {/* Deposit calculation panel */}
            <Box>
              <FLabel>Deposit Required</FLabel>
              <Box sx={{ border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.625rem', overflow: 'hidden' }}>
                <Box sx={{ px: '0.875rem', py: '0.4rem', background: 'rgba(79,70,229,0.06)', borderBottom: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                  <Box sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', fontFamily: FONT, flex: 1 }}>Deposit Calculation</Box>
                  <Box sx={{ fontSize: '0.65rem', color: '#6B7280', fontFamily: FONT }}>auto-calculated</Box>
                </Box>
                <Box sx={{ px: '0.875rem', py: '0.5rem', background: '#FAFAFA' }}>
                  {([
                    { icon: 'fa-tag',     label: 'Market Value', value: mvRaw > 0 ? `$${mvRaw.toFixed(2)}` : '—' },
                    { icon: 'fa-wrench',  label: 'Condition',    value: condition },
                    { icon: 'fa-percent', label: 'Deposit Rate', value: `${(depositRate * 100).toFixed(0)}%`, note: condition === 'New' ? 'New tools carry highest value' : condition === 'Excellent' ? 'Excellent condition' : condition === 'Good' ? 'Good condition' : 'Fair condition — lower rate' },
                    { icon: 'fa-equals',  label: 'Deposit',      value: depositDisp, highlight: true },
                  ] as { icon: string; label: string; value: string; note?: string; highlight?: boolean }[]).map((row, i) => (
                    <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '0.28rem', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <i className={`fas ${row.icon}`} style={{ color: row.highlight ? '#4F46E5' : '#9CA3AF', fontSize: '0.65rem', width: 12 }} />
                        <Box sx={{ fontSize: '0.75rem', color: row.highlight ? '#4F46E5' : '#6B7280', fontFamily: FONT, fontWeight: row.highlight ? 600 : 400 }}>
                          {row.label}
                          {row.note && <Box component="span" sx={{ ml: '0.3rem', color: '#9CA3AF', fontStyle: 'italic', fontSize: '0.68rem' }}>{row.note}</Box>}
                        </Box>
                      </Box>
                      <Box sx={{ fontSize: row.highlight ? '0.85rem' : '0.75rem', fontWeight: row.highlight ? 700 : 500, color: row.highlight ? '#4F46E5' : '#1F2937', fontFamily: FONT }}>
                        {row.value}
                      </Box>
                    </Box>
                  ))}
                </Box>
                {mvRaw > 0 ? (
                  <Box sx={{ px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.06)', borderTop: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                      <Box sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4F46E5', fontFamily: FONT }}>Borrower's deposit</Box>
                    </Box>
                    <Box sx={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: HEADING }}>{depositDisp}</Box>
                  </Box>
                ) : (
                  <Box sx={{ px: '0.875rem', py: '0.5rem', background: '#F9FAFB', borderTop: '1px solid #F3F4F6', fontSize: '0.75rem', color: '#9CA3AF', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <i className="fas fa-info-circle" /> Enter a market value above to calculate the deposit
                  </Box>
                )}
              </Box>
              <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className="fas fa-shield-alt" style={{ fontSize: '0.65rem' }} />
                Deposit held in CEU until the tool is returned in the same condition · New: 30% · Excellent: 25% · Good: 20% · Fair: 15% of market value
              </Box>
            </Box>
          </FContainer>

          {/* ══ SECTION: Tool Specifications ══ */}
          <SectionTitle icon="fa-list-ul">Tool Specifications</SectionTitle>
          <FContainer>
            {/* Existing spec categories */}
            {toolSpecs.map((cat, catIdx) => (
              <Box key={cat.id} sx={{ mb: '1.25rem', border: '1px solid #E5E7EB', borderRadius: '0.625rem', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.05)', borderBottom: '1px solid #E5E7EB' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <i className="fas fa-tag" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                    <Box sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', fontFamily: FONT }}>{cat.name}</Box>
                  </Box>
                  <Box component="button" type="button" onClick={() => setToolSpecs(prev => prev.filter((_, i) => i !== catIdx))}
                    sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.75rem', p: '0.125rem 0.25rem', borderRadius: '0.25rem', '&:hover': { color: '#EF4444', background: '#FEE2E2' } }}>
                    <i className="fas fa-times" />
                  </Box>
                </Box>
                <Box sx={{ px: '0.875rem', pt: '0.5rem', pb: '0.625rem', background: '#FAFAFA' }}>
                  {cat.details.map((detail, dIdx) => (
                    <Box key={dIdx} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', py: '0.25rem' }}>
                      <i className="fas fa-circle" style={{ color: '#4F46E5', fontSize: '0.35rem', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, fontSize: '0.8125rem', color: '#374151', fontFamily: FONT }}>{detail}</Box>
                      <Box component="button" type="button"
                        onClick={() => setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: c.details.filter((_, di) => di !== dIdx) }))}
                        sx={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D1D5DB', fontSize: '0.65rem', p: '0.125rem', '&:hover': { color: '#EF4444' } }}>
                        <i className="fas fa-times" />
                      </Box>
                    </Box>
                  ))}
                  <Box sx={{ display: 'flex', gap: '0.5rem', mt: cat.details.length > 0 ? '0.5rem' : 0, pt: cat.details.length > 0 ? '0.5rem' : 0, borderTop: cat.details.length > 0 ? '1px dashed #E5E7EB' : 'none' }}>
                    <Box component="input" type="text" value={cat.newDetail}
                      placeholder={`Add a detail for ${cat.name}…`}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, newDetail: e.target.value }))
                      }
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && cat.newDetail.trim()) {
                          e.preventDefault();
                          setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                        }
                      }}
                      sx={{ flex: 1, px: '0.625rem', py: '0.375rem', border: '1px solid #E5E7EB', borderRadius: '0.375rem', fontSize: '0.8125rem', fontFamily: FONT, color: '#1F2937', outline: 'none', background: '#FFF', '&:focus': { borderColor: '#4F46E5' }, '&::placeholder': { color: '#9CA3AF' } }} />
                    <Box component="button" type="button"
                      onClick={() => {
                        if (!cat.newDetail.trim()) return;
                        setToolSpecs(prev => prev.map((c, ci) => ci !== catIdx ? c : { ...c, details: [...c.details, c.newDetail.trim()], newDetail: '' }));
                      }}
                      sx={{ px: '0.625rem', py: '0.375rem', background: GRAD, color: '#FFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap', '&:hover': { opacity: 0.88 } }}>
                      + Add
                    </Box>
                  </Box>
                </Box>
              </Box>
            ))}

            {/* Add category combobox */}
            <Box ref={specDropRef} sx={{ position: 'relative', maxWidth: 320 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', border: `1.5px solid ${specPresetOpen ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', background: '#FFF', boxShadow: specPresetOpen ? '0 0 0 3px rgba(79,70,229,0.08)' : 'none', transition: 'border-color .15s, box-shadow .15s' }}>
                <i className="fas fa-plus" style={{ color: '#4F46E5', fontSize: '0.7rem', paddingLeft: '0.75rem', flexShrink: 0 }} />
                <Box component="input" type="text" value={specCatInput}
                  placeholder="Add category — choose preset or type custom…"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSpecCatInput(e.target.value); setSpecPresetOpen(true); }}
                  onFocus={() => setSpecPresetOpen(true)}
                  onBlur={() => setTimeout(() => setSpecPresetOpen(false), 150)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') { e.preventDefault(); addSpecCat(specCatInput); }
                    if (e.key === 'Escape') { setSpecCatInput(''); setSpecPresetOpen(false); }
                  }}
                  sx={{ flex: 1, px: '0.625rem', py: '0.5rem', border: 'none', outline: 'none', background: 'transparent', fontSize: '0.8125rem', fontFamily: FONT, color: '#1F2937', '&::placeholder': { color: '#9CA3AF' } }} />
                {specCatInput && (
                  <Box component="button" type="button" onMouseDown={() => { setSpecCatInput(''); setSpecPresetOpen(false); }}
                    sx={{ px: '0.5rem', border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: '0.65rem', '&:hover': { color: '#6B7280' } }}>
                    <i className="fas fa-times" />
                  </Box>
                )}
                <Box component="button" type="button" onMouseDown={() => addSpecCat(specCatInput)}
                  sx={{ px: '0.75rem', py: '0.5rem', background: GRAD, color: '#FFF', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.2)', cursor: specCatInput.trim() ? 'pointer' : 'default', opacity: specCatInput.trim() ? 1 : 0.45, fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap', borderRadius: '0 0.375rem 0.375rem 0', transition: 'opacity .15s' }}>
                  Add
                </Box>
              </Box>
              {specPresetOpen && (specSuggestions.length > 0 || (specQ && !isExactPreset)) && (
                <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#FFF', border: '1.5px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
                  {specSuggestions.length > 0 && (
                    <Box sx={{ px: '0.75rem', pt: '0.4rem', pb: '0.25rem' }}>
                      <Box sx={{ fontSize: '0.67rem', fontWeight: 700, color: '#9CA3AF', fontFamily: FONT, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggestions</Box>
                    </Box>
                  )}
                  {specSuggestions.map(preset => (
                    <Box key={preset} onMouseDown={() => addSpecCat(preset)}
                      sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#1F2937', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: 'rgba(79,70,229,0.06)', color: '#4F46E5' } }}>
                      <i className="fas fa-tag" style={{ fontSize: '0.6rem', color: '#9CA3AF', width: 10 }} />
                      {preset}
                    </Box>
                  ))}
                  {specQ && !isExactPreset && (
                    <Box onMouseDown={() => addSpecCat(specCatInput)}
                      sx={{ px: '0.875rem', py: '0.45rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', borderTop: specSuggestions.length > 0 ? '1px solid #F3F4F6' : 'none', background: '#FAFAFA', '&:hover': { background: 'rgba(79,70,229,0.06)' } }}>
                      <i className="fas fa-plus" style={{ fontSize: '0.6rem', color: '#4F46E5', width: 10 }} />
                      <Box component="span" sx={{ color: '#374151' }}>Add "<Box component="strong" sx={{ color: '#4F46E5' }}>{specCatInput}</Box>"</Box>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
            <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className="fas fa-info-circle" style={{ fontSize: '0.65rem' }} />
              Add categories like Fuel Type, Weight, or Maintenance to give borrowers important details about your tool
            </Box>
          </FContainer>

          </>)}

          {/* ══ STEP 2: Exchange Location ══ */}
          {step === 1 && (<>
            <SectionTitle icon="fa-map-marker-alt">Exchange Location</SectionTitle>

            {/* Public / Private type cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1.5rem' }}>
              {([
                { key: 'public',  icon: 'fa-store', label: 'Public Place',     desc: 'Meet at a cafe, library, community center, or other public location' },
                { key: 'private', icon: 'fa-home',  label: 'Private Location', desc: 'Home or private location (requires secure sharing)' },
              ] as { key: 'public'|'private'; icon: string; label: string; desc: string }[]).map(loc => {
                const active = locationType === loc.key;
                return (
                  <Box key={loc.key} onClick={() => {
                    setLocationType(loc.key);
                    if (loc.key === 'public') setPrivatePlace('');
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
                    <Typography sx={{ fontWeight: 600, mb: '0.5rem', fontFamily: FONT, color: '#1F2937' }}>{loc.label}</Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>{loc.desc}</Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Public Place picker */}
            {locationType === 'public' && (
              <FContainer>
                <FLabel required>Public Place Selection</FLabel>
                <PublicPlacePicker
                  value={publicPlace}
                  onChange={setPublicPlace}
                  userCoordinates={undefined}
                />
                <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <i className="fas fa-shield-alt" style={{ fontSize: '0.65rem' }} />
                  Search or click a pin on the map — public locations are recommended for safety
                </Box>
              </FContainer>
            )}

            {/* Private Location picker */}
            {locationType === 'private' && (<>
              <FContainer>
                <FLabel required>Location Selection</FLabel>
                <PublicPlacePicker
                  value={privatePlace}
                  onChange={setPrivatePlace}
                  userCoordinates={undefined}
                />
                <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: FONT, mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <i className="fas fa-lock" style={{ fontSize: '0.65rem' }} />
                  Your exact location will only be shared securely after both parties confirm
                </Box>
              </FContainer>

              {/* Security warning */}
              <Box sx={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(245,158,11,0.1))', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.75rem', padding: '1.5rem', mb: '1.5rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '0.75rem' }}>
                  <i className="fas fa-exclamation-triangle" style={{ color: '#EF4444', fontSize: '1.25rem' }} />
                  <Typography sx={{ fontWeight: 600, color: '#EF4444', fontFamily: HEADING }}>Important Security Notice</Typography>
                </Box>
                {[
                  'Your exact address will never be stored in chat logs',
                  'Location will be shared via one-time secure link only',
                  'Links expire automatically after the meeting time',
                  'All location access is logged for security monitoring',
                ].map(item => (
                  <Box key={item} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.5rem' }}>
                    <i className="fas fa-check-circle" style={{ color: '#F59E0B', marginTop: 2, fontSize: '0.8rem', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: FONT }}>{item}</Typography>
                  </Box>
                ))}
              </Box>

            </>)}
          </>)}

          {/* ══ STEP 3: Schedule ══ */}
          {step === 2 && (<>
            <SectionTitle icon="fa-calendar-alt">{isPermanent ? 'Pickup Schedule' : 'Borrow Schedule'}</SectionTitle>
            <FContainer>
              {post.startDate && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.5rem', px: '0.875rem', py: '0.625rem', mb: '1.25rem' }}>
                  <i className="fas fa-magic" style={{ color: '#10B981', fontSize: '0.75rem' }} />
                  <Typography sx={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#065F46', fontWeight: 500 }}>
                    Dates auto-filled from the provider's availability
                  </Typography>
                </Box>
              )}
              {isPermanent ? (
                /* Permanent exchange — single pick-up date */
                <Box sx={{ maxWidth: 260 }}>
                  <FLabel required>Pick Up Date</FLabel>
                  <Box component="input" type="date" value={borrowFrom}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrowFrom(e.target.value)}
                    sx={inputCss} />
                  {borrowFrom && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(79,70,229,0.06)', borderRadius: '0.5rem', px: '0.875rem', py: '0.5rem', mt: '0.75rem' }}>
                      <i className="fas fa-info-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                      <Typography sx={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#4F46E5', fontWeight: 500 }}>
                        Permanent handover on <strong>{new Date(borrowFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                /* Borrow — two dates */
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1rem' }}>
                    <Box>
                      <FLabel required>Borrow From</FLabel>
                      <Box component="input" type="date" value={borrowFrom}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBorrowFrom(e.target.value)}
                        sx={inputCss} />
                    </Box>
                    <Box>
                      <FLabel required>Return By</FLabel>
                      <Box component="input" type="date" value={returnBy}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReturnBy(e.target.value)}
                        sx={inputCss} />
                    </Box>
                  </Box>
                  {borrowFrom && returnBy && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(79,70,229,0.06)', borderRadius: '0.5rem', px: '0.875rem', py: '0.5rem' }}>
                      <i className="fas fa-info-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                      <Typography sx={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#4F46E5', fontWeight: 500 }}>
                        Borrow period: <strong>{borrowDays} day{borrowDays !== 1 ? 's' : ''}</strong>
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </FContainer>
          </>)}

          {/* ══ STEP 4: Review & Post ══ */}
          {step === 3 && (<>
            <SectionTitle icon="fa-clipboard-check">Review & Confirmation</SectionTitle>

            {/* ── Deposit deduction notice (borrow only) ── */}
            {!isPermanent && depositCeu > 0 && (
              <Box sx={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start', background: 'rgba(79,70,229,0.06)', border: '1.5px solid rgba(79,70,229,0.18)', borderRadius: '0.75rem', p: '1rem', mb: '1.25rem' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '0.1rem' }}>
                  <i className="fas fa-shield-alt" style={{ color: '#FFF', fontSize: '0.875rem' }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontFamily: HEADING, fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', mb: '0.25rem' }}>
                    Borrow Deposit: <Box component="span" sx={{ color: '#4F46E5' }}>{depositCeu} CEU will be deducted</Box>
                  </Typography>
                  <Typography sx={{ fontFamily: FONT, fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.6 }}>
                    This deposit is held as collateral while you borrow the tool. It will be <strong>automatically refunded</strong> to your CEU balance when the exchange is marked <em>completed</em> (tool returned in good condition). It is also refunded if the exchange is cancelled.
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', mt: '0.75rem' }}>
                    {[
                      { label: 'Your tool value', value: mvRaw > 0 ? `$${mvRaw.toFixed(2)}` : '—' },
                      { label: 'Condition', value: condition },
                      { label: 'Deposit rate', value: `${(depositRate * 100).toFixed(0)}%` },
                      { label: 'Deposit held', value: `${depositCeu} CEU`, highlight: true },
                    ].map(t => (
                      <Box key={t.label} sx={{ background: t.highlight ? 'rgba(79,70,229,0.1)' : '#FFF', border: `1px solid ${t.highlight ? 'rgba(79,70,229,0.25)' : '#E5E7EB'}`, borderRadius: '0.5rem', px: '0.75rem', py: '0.375rem', display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                        <Typography sx={{ fontFamily: FONT, fontSize: '0.75rem', color: '#9CA3AF' }}>{t.label}:</Typography>
                        <Typography sx={{ fontFamily: FONT, fontSize: '0.75rem', fontWeight: 700, color: t.highlight ? '#4F46E5' : '#1F2937' }}>{t.value}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            <FContainer>
              <Typography sx={{ fontWeight: 600, color: '#4F46E5', mb: '1rem', fontFamily: HEADING, fontSize: '1rem' }}>
                Exchange Summary
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.5rem', mb: '1.5rem' }}>
                {[
                  { label: 'Exchange Type', value: 'Tool Borrow' },
                  { label: 'Your Tool',     value: borrowerToolName.trim() ? `${borrowerToolName.trim()} (${condition})` : `(${condition})` },
                  { label: "Provider's Tool", value: post.title },
                  { label: 'Exchange Location', value: locationType === 'public'
                    ? (publicPlace || 'Public place TBD')
                    : (privatePlace || '[Private Location — Secure Sharing Enabled]') },
                  ...(isPermanent ? [
                    { label: 'Pick Up Date', value: borrowFrom
                      ? new Date(borrowFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'TBD' },
                  ] : [
                    { label: 'Borrow From', value: borrowFrom
                      ? new Date(borrowFrom + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'TBD' },
                    { label: 'Return By', value: returnBy
                      ? new Date(returnBy + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : 'TBD' },
                    { label: 'Duration', value: borrowFrom && returnBy
                      ? `${borrowDays} day${borrowDays !== 1 ? 's' : ''}`
                      : '—' },
                    ...(depositCeu > 0 ? [{ label: 'Deposit (held)', value: `${depositCeu} CEU`, highlight: true }] : []),
                  ]),
                ].map(item => (
                  <Box key={item.label}>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, mb: '0.375rem', fontFamily: FONT }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.875rem', color: (item as { highlight?: boolean }).highlight ? '#4F46E5' : '#1F2937', fontWeight: (item as { highlight?: boolean }).highlight ? 700 : 500, fontFamily: FONT, lineHeight: 1.5 }}>
                      {item.value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Description preview */}
              {content.trim() && (
                <Box sx={{ pt: '1rem', borderTop: '1px solid #E5E7EB' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, mb: '0.5rem', fontFamily: FONT }}>
                    Offering Description
                  </Typography>
                  <Box sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: FONT, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                    {content.trim()}
                  </Box>
                </Box>
              )}
            </FContainer>
          </>)}

          {/* ── Footer ── */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: '0.5rem', mt: '0.25rem' }}>
            {/* Left: Previous (steps 1–3) */}
            <Box>
              {step > 0 && (
                <Box component="button" type="button" onClick={() => { setError(''); setStep(s => s - 1); }}
                  sx={{ background: '#FFF', border: '1px solid #E5E7EB', color: '#374151', borderRadius: '0.5rem', px: '1.25rem', py: '0.6875rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: '#F3F4F6' } }}>
                  <i className="fas fa-arrow-left" /> Previous
                </Box>
              )}
            </Box>
            {/* Right: Save Draft + Next Step / Submit */}
            <Box sx={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Box component="button" type="button" onClick={onClose}
                sx={{ background: '#FFF', border: '1.5px solid #E5E7EB', color: '#4F46E5', borderRadius: '0.5rem', px: '1.25rem', py: '0.6875rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { background: 'rgba(79,70,229,0.04)', borderColor: '#4F46E5' } }}>
                <i className="fas fa-save" /> Save Draft
              </Box>
              <Box component="button" type="button" onClick={handleNext} disabled={mutation.isPending}
                sx={{ background: mutation.isPending ? '#9CA3AF' : GRAD, color: '#FFF', border: 'none', borderRadius: '0.5rem', px: '1.5rem', py: '0.6875rem', fontSize: '0.875rem', fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { opacity: mutation.isPending ? 1 : 0.9 } }}>
                {mutation.isPending
                  ? <><i className="fas fa-spinner fa-spin" /> Submitting…</>
                  : step < 3
                    ? <>Next Step <i className="fas fa-arrow-right" /></>
                    : <><i className="fas fa-handshake" /> Submit Request</>
                }
              </Box>
            </Box>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

/* ── Main Component ────────────────────────────────────────────────── */
const ToolDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [borrowModalOpen,    setBorrowModalOpen]    = useState(false);
  const [permanentModalOpen, setPermanentModalOpen] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => { const res = await api.get(`/posts/${id}`); return res.data as Post; },
  });

  if (isLoading) return <Layout><Skeleton variant="rounded" height={400} /></Layout>;
  if (!post) return null;

  const isOwner = user?._id === post.author._id;
  const tags = parseTags(post.tags ?? []).filter(Boolean);
  const ceuRate = post.ceuRate ?? 25;
  const hasSched = post.timeStart && post.timeEnd;

  /* ── Details grid — Condition + Market Value only ── */
  const detailCols: { icon: string; label: string; primary: string; secondary?: string }[] = [
    {
      icon: 'fa-star',
      label: 'Condition',
      primary: 'Excellent',
      secondary: 'Regularly maintained and serviced',
    },
    {
      icon: 'fa-coins',
      label: 'Market Value',
      primary: post.ceuRate ? `${post.ceuRate} CEU` : 'Contact owner',
      secondary: 'Community Exchange Units',
    },
  ];

  /* ── Sidebar (passed as rightPanel to Layout) ── */
  const sidebar = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Owner Info Card */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.5rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: '0.75rem' }}>
          <Box sx={{ position: 'relative', display: 'inline-block' }}>
            <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} sx={{ width: 80, height: 80, fontSize: '1.5rem', background: TOOL_GRAD, boxShadow: '0 4px 12px rgba(59,130,246,0.25)' }}>
              {post.author.name[0]}
            </OnlineAvatar>
          </Box>
        </Box>
        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, mb: '0.25rem' }}>
          {post.author.name}
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: FONT, mb: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#4F46E5' }} />
          Local area
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', mb: '1rem' }}>
          {[
            { value: `${post.author.rating.toFixed(1)}★`, label: 'Rating' },
            { value: `${post.upvotes?.length ?? 0}`, label: 'Interested' },
            { value: post.author.isVerified ? '✓' : '—', label: 'Verified' },
            { value: post.commentCount?.toString() ?? '0', label: 'Comments' },
          ].map((s, i) => (
            <Box key={i} sx={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))', borderRadius: '0.5rem', p: '0.6rem 0.5rem' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: FONT, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: FONT, mt: '0.2rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          <Box component="button" onClick={() => navigate(`/profile/${post.author._id}`)}
            sx={{ flex: 1, background: TOOL_GRAD, color: '#FFF', border: 'none', p: '0.6rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'opacity 0.2s', '&:hover': { opacity: 0.85 } }}>
            <i className="fas fa-user" />
            Profile
          </Box>
          <Box component="button" onClick={() => user ? navigate('/exchanges/create') : navigate('/login')}
            sx={{ flex: 1, background: '#F3F4F6', color: '#4F46E5', border: '1px solid #E5E7EB', p: '0.6rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'background 0.2s', '&:hover': { background: '#E9EAF0' } }}>
            <i className="fas fa-comment" />
            Message
          </Box>
        </Box>
      </Box>

      {/* Tool Statistics */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, mb: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-chart-bar" style={{ color: '#4F46E5' }} />
          Tool Statistics
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
          {[
            { value: `${post.upvotes?.length ?? 0}`, label: 'Total Interest', grad: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' },
            { value: '100%', label: 'Success Rate', grad: 'linear-gradient(135deg, #10B981, #059669)' },
            { value: post.author.rating.toFixed(1), label: 'Avg Rating', grad: 'linear-gradient(135deg, #F59E0B, #D97706)' },
            { value: '< 2h', label: 'Response Time', grad: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
          ].map((s, i) => (
            <Box key={i} sx={{ background: s.grad, borderRadius: '0.5rem', p: '0.75rem 0.6rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFF', fontFamily: FONT, lineHeight: 1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', fontFamily: FONT, mt: '0.2rem' }}>{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Safety Tips */}
      <Box sx={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', p: '1.25rem' }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#065F46', fontFamily: FONT, mb: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <i className="fas fa-shield-alt" style={{ color: '#10B981' }} />
          Safety Tips
        </Typography>
        {[
          'Always inspect tools before use and report any issues immediately.',
          'Meet in public places for pickup/dropoff during daylight hours.',
          'Follow all manufacturer instructions and safety guidelines.',
          'Return tools clean and in the same condition you received them.',
        ].map((tip, i) => (
          <Typography key={i} sx={{ fontSize: '0.775rem', color: '#065F46', lineHeight: 1.5, mb: '0.5rem', pl: '0.6rem', borderLeft: '2px solid #10B981', fontFamily: FONT }}>
            {tip}
          </Typography>
        ))}
      </Box>

    </Box>
  );

  return (
    <Layout rightPanel={sidebar}>
      {/* ── Breadcrumbs ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.5rem', fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>
        <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Home</Box>
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" onClick={() => navigate('/feed?type=tool')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Tools</Box>
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" sx={{ color: '#1F2937', fontWeight: 500 }}>{post.title}</Box>
      </Box>

      {/* ── Main Card ── */}
      <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden', mb: '2rem' }}>

        {/* ═══ Zone 1 — Header ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg, rgba(59,130,246,0.05), rgba(139,92,246,0.05))' }}>
          {/* Top row: badge + rating */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem' }}>
            <Box component="span" sx={{
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              background: TOOL_GRAD, color: '#FFF', borderRadius: '0.375rem',
              px: '1rem', py: '0.5rem', fontSize: '0.875rem', fontWeight: 600, fontFamily: FONT,
            }}>
              <i className="fas fa-tools" />
              Tool
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Box sx={{ color: '#FBBF24' }}>
                {[...Array(5)].map((_, i) => (
                  <i key={i} className={`fas ${i < Math.floor(post.author.rating) ? 'fa-star' : i < post.author.rating ? 'fa-star-half-alt' : 'fa-star'}`} style={{ fontSize: '0.8rem' }} />
                ))}
              </Box>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT }}>
                {post.author.rating.toFixed(1)}
              </Typography>
            </Box>
          </Box>

          {/* Owner row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem' }}>
            <Box sx={{ position: 'relative' }}>
              <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} sx={{ width: 64, height: 64, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {post.author.name[0]}
              </OnlineAvatar>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography
                onClick={() => navigate(`/profile/${post.author._id}`)}
                sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', fontFamily: FONT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', '&:hover': { color: '#4F46E5' } }}
              >
                {post.author.name}
                {post.author.isVerified && <i className="fas fa-shield-alt" style={{ color: '#10B981', fontSize: '0.875rem' }} />}
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: FONT, mt: '0.25rem' }}>
                Tool Owner
              </Typography>
              <Box sx={{ display: 'flex', gap: '1.5rem', mt: '0.5rem', fontSize: '0.875rem', fontFamily: FONT }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-star" style={{ color: '#4F46E5', width: 16 }} />
                  <span>{post.author.rating.toFixed(1)} Rating</span>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fas fa-clock" style={{ color: '#4F46E5', width: 16 }} />
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
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: FONT }}>{hasSched ? `${post.timeStart} – ${post.timeEnd}` : 'Flexible'}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Availability</Typography>
            </Box>
            <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4F46E5', fontFamily: FONT }}>{post.upvotes.length}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Interested</Typography>
            </Box>
            <Box sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, color: '#4F46E5', fontFamily: FONT }}>{post.commentCount}</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.25rem', fontFamily: FONT }}>Comments</Typography>
            </Box>
          </Box>
        </Box>

        {/* ═══ Zone 2 — Image Gallery ═══ */}
        {post.images.length > 0 && <Gallery media={post.images} />}

        {/* ═══ Zone 3 — Tool Details ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: FONT }}>
            <i className="fas fa-info-circle" style={{ color: '#4F46E5' }} />
            Tool Details
          </Typography>

          {/* ── Description (right under the title) ── */}
          {post.content?.trim() && (
            <Box sx={{ mb: '1.75rem' }}>
              <Box sx={{ pl: '0.25rem' }}>
                <RichContent text={post.content} />
              </Box>
            </Box>
          )}

          {/* Divider before specs grid */}
          <Box sx={{ borderTop: '1px solid #F3F4F6', mb: '1.5rem' }} />

          {/* Details grid — 8 fixed categories */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: '1.5rem', mb: tags.length > 0 ? '1.5rem' : 0 }}>
            {detailCols.map((d, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: '0.5rem', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(79,70,229,0.1), rgba(16,185,129,0.1))',
                  color: '#4F46E5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <i className={`fas ${d.icon}`} style={{ fontSize: '0.8rem' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', mb: '0.2rem', fontFamily: FONT }}>{d.label}</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5, fontFamily: FONT }}>
                    {d.primary}{d.secondary ? <> • <span style={{ color: '#9CA3AF' }}>{d.secondary}</span></> : null}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Tool Specifications */}
          {post.specifications && post.specifications.length > 0 && (
            <Box sx={{ mt: '1.5rem' }}>
              <Box sx={{ borderTop: '1px solid #F3F4F6', mb: '1.5rem' }} />
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#1F2937', mb: '1rem', fontFamily: FONT, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-list-ul" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
                Tool Specifications
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: '1rem' }}>
                {post.specifications.map((spec, si) => (
                  <Box key={si} sx={{
                    background: 'linear-gradient(135deg, rgba(79,70,229,0.03), rgba(16,185,129,0.03))',
                    border: '1px solid #E5E7EB', borderRadius: '0.625rem', p: '0.875rem 1rem',
                  }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.06em', mb: '0.5rem', fontFamily: FONT }}>
                      {spec.name}
                    </Typography>
                    {spec.details.map((detail, di) => (
                      <Box key={di} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: di < spec.details.length - 1 ? '0.25rem' : 0 }}>
                        <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#10B981)', flexShrink: 0, mt: '0.45rem' }} />
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
                <Box key={t} component="span" sx={{
                  background: '#F3F4F6', color: '#6B7280', borderRadius: '2rem',
                  px: '0.75rem', py: '0.25rem', fontSize: '0.75rem', fontWeight: 500, fontFamily: FONT,
                }}>
                  #{t}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ═══ Zone 3b — Availability Calendar ═══ */}
        {post.startDate && post.recurring && (
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem' }}>
              <i className="fas fa-calendar-check" style={{ color: '#4F46E5' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.25rem', color: '#1F2937', fontFamily: FONT }}>Availability</Typography>
            </Box>
            <AvailabilityCalendar post={post} />
          </Box>
        )}

        {/* ═══ Zone 4 — Exchange Options ═══ */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: FONT }}>
            <i className="fas fa-exchange-alt" style={{ color: '#4F46E5' }} />
            Exchange Options
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: '1.5rem' }}>
            {/* Borrow — featured */}
            <Box sx={{
              background: 'linear-gradient(135deg, rgba(79,70,229,0.03), rgba(16,185,129,0.03))',
              border: '2px solid #4F46E5', borderRadius: '0.75rem', p: '1.5rem', position: 'relative',
              transition: 'all 0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(79,70,229,0.15)' },
            }}>
              <Box sx={{ position: 'absolute', top: -12, right: '1rem', background: GRAD, color: '#FFF', px: '0.75rem', py: '0.25rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT }}>
                Most Popular
              </Box>
              <Box sx={{ width: 56, height: 56, borderRadius: '0.75rem', background: GRAD, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', mb: '1rem' }}>
                <i className="fas fa-hand-holding" />
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '0.5rem', fontFamily: HEADING }}>Borrow</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '1.5rem', lineHeight: 1.6, fontFamily: FONT }}>
                Temporarily borrow this tool from the owner. Agree on a duration, pickup/dropoff, and return it in good condition.
              </Typography>
              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mb: '1.5rem' }}>
                {['Time-limited', 'Return required', 'CEU or skill swap'].map(tag => (
                  <Box key={tag} component="span" sx={{ background: 'rgba(79,70,229,0.08)', color: '#4F46E5', borderRadius: '1rem', px: '0.625rem', py: '0.2rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT }}>{tag}</Box>
                ))}
              </Box>
              <Box component="button" onClick={() => {
                if (!user) { navigate('/login'); return; }
                setBorrowModalOpen(true);
              }} sx={{
                width: '100%', background: GRAD, color: '#FFF', border: 'none', p: '0.875rem',
                borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' },
              }}>
                <i className="fas fa-handshake" />
                Request to Borrow
              </Box>
            </Box>

            {/* Permanent Exchange */}
            <Box sx={{
              background: '#FFF', border: '2px solid #E5E7EB', borderRadius: '0.75rem', p: '1.5rem',
              transition: 'all 0.3s', '&:hover': { borderColor: '#4F46E5', transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
            }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '0.75rem', background: TOOL_GRAD, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', mb: '1rem' }}>
                <i className="fas fa-random" />
              </Box>
              <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#1F2937', mb: '0.5rem', fontFamily: HEADING }}>Permanent Exchange</Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '1.5rem', lineHeight: 1.6, fontFamily: FONT }}>
                Propose a full ownership transfer. Offer your skills, tools, or CEU in exchange for permanent ownership of this tool.
              </Typography>
              <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mb: '1.5rem' }}>
                {['Ownership transfer', 'Skill or tool offer', 'Negotiable'].map(tag => (
                  <Box key={tag} component="span" sx={{ background: '#F3F4F6', color: '#6B7280', borderRadius: '1rem', px: '0.625rem', py: '0.2rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: FONT }}>{tag}</Box>
                ))}
              </Box>
              <Box component="button" onClick={() => {
                if (!user) { navigate('/login'); return; }
                setPermanentModalOpen(true);
              }} sx={{
                width: '100%', background: '#F9FAFB', color: '#4F46E5', border: '2px solid #E5E7EB',
                p: '0.875rem', borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.04)' },
              }}>
                <i className="fas fa-random" />
                Offer Permanent Exchange
              </Box>
            </Box>
          </Box>

        </Box>

        {/* ═══ Zone 5 — Discussion ═══ */}
        <ToolDiscussion post={post} />
      </Box>

      {/* ── Guest banner ── */}
      {!user && <GuestBanner message="Log in to request tools and interact with the community." />}

      {/* ── Request to Borrow Dialog ── */}
      <BorrowRequestDialog open={borrowModalOpen} onClose={() => setBorrowModalOpen(false)} post={post} />

      {/* ── Offer Permanent Exchange Modal ── */}
      <BorrowRequestDialog
        open={permanentModalOpen}
        onClose={() => setPermanentModalOpen(false)}
        post={post}
        mode="permanent"
      />

      {/* ── Floating Action ── */}
      {user && !isOwner && (
        <Box sx={{ position: 'fixed', bottom: '2rem', right: '2rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', zIndex: 90 }}>
          <Box
            component="button"
            onClick={() => { if (!user) { navigate('/login'); return; } setBorrowModalOpen(true); }}
            sx={{
              width: 56, height: 56, background: GRAD, color: '#FFF', border: 'none', borderRadius: '50%',
              fontSize: '1.25rem', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s', '&:hover': { transform: 'scale(1.1)', boxShadow: '0 20px 40px rgba(79,70,229,0.3)' },
            }}
          >
            <i className="fas fa-exchange-alt" />
          </Box>
        </Box>
      )}
    </Layout>
  );
};

export default ToolDetail;
