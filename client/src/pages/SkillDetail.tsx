import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton, Menu, MenuItem, IconButton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow, format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns';
import Layout from '../components/layout/Layout';
import GuestBanner from '../components/GuestBanner';
import api from '../services/api';
import { getSocket } from '../services/socket';
import OnlineAvatar from '../components/OnlineAvatar';
import { useOnline } from '../context/OnlineContext';
import { Post, User } from '../types';
import CreateExchange from './CreateExchange';
import RichContent from '../components/RichContent';

const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';
const SKILL_GRAD = 'linear-gradient(135deg, #8B5CF6, #EC4899)';

const getMediaType = (url: string | null | undefined): 'video' | 'gif' | 'image' => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|ogg|avi)$/.test(clean)) return 'video';
  if (/\.gif$/.test(clean)) return 'gif';
  return 'image';
};

const MediaGallery: React.FC<{ media: string[] }> = ({ media }) => {
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
    <Box sx={{ p: '1.25rem', pb: '1rem' }}>
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
              <Box
                key={i}
                onClick={() => setIdx(i)}
                sx={{
                  flexShrink: 0, width: 72, height: 56, borderRadius: '0.5rem', overflow: 'hidden',
                  border: active ? '2px solid #4F46E5' : '2px solid #E5E7EB',
                  cursor: 'pointer', background: '#111', position: 'relative',
                  opacity: active ? 1 : 0.7, transition: 'all 0.18s',
                  '&:hover': { opacity: 1, borderColor: active ? '#4F46E5' : '#A5B4FC' },
                  boxShadow: active ? '0 0 0 3px rgba(79,70,229,0.2)' : 'none',
                }}
              >
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

const parseTags = (tags: string[]): string[] => {
  if (!tags || tags.length === 0) return [];
  if (tags.length === 1 && tags[0].trim().startsWith('[')) {
    try { return JSON.parse(tags[0]) as string[]; } catch { /* */ }
  }
  return tags;
};

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

// ── Availability Calendar ─────────────────────────────────────────────────────
const AvailabilityCalendar: React.FC<{ post: Post }> = ({ post }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // Derive available dates from the post's schedule
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

  // Build time slots from post's timeStart / timeEnd
  const TIME_SLOTS = React.useMemo((): string[] => {
    if (!post.timeStart || !post.timeEnd) return [];
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmt = (mins: number) => {
      const h = Math.floor(mins / 60); const m = mins % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };
    const start = toMin(post.timeStart); const end = toMin(post.timeEnd);
    const slots: string[] = [];
    // Single session slot
    slots.push(`${fmt(start)} – ${fmt(end)}`);
    return slots;
  }, [post.timeStart, post.timeEnd]);

  const BOOKED: string[] = [];

  return (
    <Box>
      {/* Calendar header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
          {format(currentMonth, 'MMMM yyyy')}
        </Typography>
        <Box sx={{ display: 'flex', gap: '0.5rem' }}>
          {['Today', ''].map((label, i) => i === 0 ? (
            <Box key="today" component="button" onClick={() => setCurrentMonth(new Date())} sx={{
              background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280',
              px: '0.875rem', py: '0.375rem', borderRadius: '0.375rem', cursor: 'pointer',
              fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif',
              '&:hover': { borderColor: '#4F46E5', color: '#4F46E5' },
            }}>Today</Box>
          ) : null)}
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
              let bg = '#FFF';
              let border = '1px solid transparent';
              let color = inMonth ? '#1F2937' : '#9CA3AF';
              if (!inMonth) bg = '#F9FAFB';
              if (today) { bg = 'rgba(16,185,129,0.08)'; border = '2px solid #10B981'; }
              if (avail && !today) { bg = 'rgba(16,185,129,0.1)'; border = '1px solid rgba(16,185,129,0.25)'; }
              if (selected) { bg = GRAD; border = '2px solid #4F46E5'; color = '#fff'; }
              if (!avail && inMonth && !today) { bg = '#F9FAFB'; color = '#9CA3AF'; }

              return (
                <Box
                  key={di}
                  onClick={() => avail && inMonth && setSelectedDay(day)}
                  sx={{
                    minHeight: 72, p: '0.5rem', textAlign: 'center',
                    background: bg, border, borderRadius: '0.375rem', m: '2px',
                    cursor: avail && inMonth ? 'pointer' : 'default',
                    transition: 'all 0.15s',
                    '&:hover': avail && inMonth ? { transform: 'translateY(-1px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : {},
                  }}
                >
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 28, height: 28, borderRadius: '50%', mb: '0.25rem',
                    fontWeight: selected || today ? 700 : 500,
                    fontSize: '0.9375rem', color: selected ? '#fff' : today ? '#fff' : color,
                    background: today && !selected ? '#10B981' : 'transparent',
                  }}>
                    {format(day, 'd')}
                  </Box>
                  {inMonth && (
                    <Typography sx={{ fontSize: '0.65rem', color: selected ? 'rgba(255,255,255,0.9)' : avail ? '#10B981' : '#9CA3AF', fontWeight: 600, lineHeight: 1 }}>
                      {today && !selected ? 'Today' : avail ? 'Available' : ''}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: '1rem', mt: '1rem', flexWrap: 'wrap', p: '0.875rem', background: '#F9FAFB', borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
        {[
          { label: 'Available', bg: 'rgba(16,185,129,0.15)', border: '2px solid rgba(16,185,129,0.3)' },
          { label: 'Selected', bg: GRAD, border: 'none' },
          { label: 'Booked', bg: 'rgba(239,68,68,0.1)', border: '2px solid rgba(239,68,68,0.3)' },
          { label: 'Today', bg: 'rgba(16,185,129,0.08)', border: '2px solid #10B981' },
        ].map(({ label, bg, border }) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#6B7280' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '0.25rem', background: bg, border, flexShrink: 0 }} />
            {label}
          </Box>
        ))}
      </Box>

      {/* Time slots — only when a day is selected */}
      {selectedDay && (
        <Box sx={{ mt: '1.25rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>
              {format(selectedDay, 'EEEE, MMMM d')}
            </Typography>
            <Box sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>Pick a time</Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: '0.625rem' }}>
            {TIME_SLOTS.map(slot => {
              const booked = BOOKED.includes(slot);
              const sel = selectedSlot === slot;
              return (
                <Box
                  key={slot}
                  onClick={() => !booked && setSelectedSlot(s => s === slot ? null : slot)}
                  sx={{
                    p: '0.75rem', textAlign: 'center', borderRadius: '0.5rem',
                    fontSize: '0.8125rem', fontWeight: 500, cursor: booked ? 'not-allowed' : 'pointer',
                    border: sel ? '2px solid #4F46E5' : booked ? '2px solid rgba(239,68,68,0.3)' : '2px solid rgba(16,185,129,0.3)',
                    background: sel ? GRAD : booked ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.1)',
                    color: sel ? '#fff' : booked ? '#EF4444' : '#10B981',
                    textDecoration: booked ? 'line-through' : 'none',
                    opacity: booked ? 0.7 : 1,
                    transition: 'all 0.15s',
                    '&:hover': !booked ? { transform: 'translateY(-2px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' } : {},
                  }}
                >
                  {slot}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ── Right Sidebar ─────────────────────────────────────────────────────────────
const RSSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ borderRadius: '0.75rem', p: '1rem', mb: '1.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const SkillDetailRightPanel: React.FC<{ post: Post }> = ({ post }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const authorId = post.author._id;

  // Fetch full author profile for stats (auth required)
  const { data: author } = useQuery({
    queryKey: ['user', authorId],
    queryFn: async () => { const res = await api.get(`/users/${authorId}`); return res.data as User; },
    enabled: !!user,
  });

  // Fetch author's other skill posts (auth required)
  const { data: authorPostsData } = useQuery({
    queryKey: ['user-posts', authorId],
    queryFn: async () => { const res = await api.get(`/users/${authorId}/posts`); return res.data as { posts: Post[] }; },
    enabled: !!user,
  });
  const similarSkills = (authorPostsData?.posts ?? [])
    .filter((p) => p.type === 'skill' && p._id !== post._id)
    .slice(0, 3);

  const STATS = [
    { value: String(author?.exchangeCount ?? 0), label: 'Exchanges Done' },
    { value: author?.reviewCount ? `${Math.min(100, Math.round((author.reviewCount / Math.max(1, author.exchangeCount ?? 1)) * 100))}%` : '—', label: 'Success Rate' },
    { value: '24h', label: 'Avg Response' },
    { value: (author?.rating ?? post.author.rating).toFixed(1), label: 'Rating' },
  ];

  const SAFETY = [
    { icon: 'fa-shield-alt', text: 'Meet in public for first sessions' },
    { icon: 'fa-clock', text: 'Discuss terms and expectations clearly' },
    { icon: 'fa-exchange-alt', text: 'Use platform chat for all negotiations' },
  ];

  const authorInitials = post.author.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const authorRating = author?.rating ?? post.author.rating;
  const roundedRating = Math.round(authorRating);

  return (
    <>
      {/* Recent Reviews — based on author rating/reviewCount */}
      <RSSection title={`Reviews of ${post.author.name.split(' ')[0]}`}>
        {(author?.reviewCount ?? 0) === 0 ? (
          <Box sx={{ textAlign: 'center', py: '1rem', color: '#9CA3AF' }}>
            <i className="fas fa-star" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }} />
            <Typography sx={{ fontSize: '0.8125rem' }}>No reviews yet</Typography>
          </Box>
        ) : (
          <>
            {/* Summary card */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', p: '0.875rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', mb: '0.875rem' }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '2rem', fontWeight: 700, color: '#1F2937', lineHeight: 1 }}>{authorRating.toFixed(1)}</Typography>
                <Box sx={{ color: '#FBBF24', fontSize: '0.75rem', my: '0.25rem' }}>
                  {'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}
                </Box>
                <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF' }}>{author?.reviewCount} reviews</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                {[5,4,3,2,1].map((star) => {
                  const pct = star === roundedRating ? 70 : star === roundedRating - 1 ? 20 : star === roundedRating + 1 ? 8 : 2;
                  return (
                    <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', mb: '0.2rem' }}>
                      <Typography sx={{ fontSize: '0.65rem', color: '#6B7280', width: 8 }}>{star}</Typography>
                      <Box sx={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: '1rem', overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', background: '#FBBF24', borderRadius: '1rem' }} />
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
            {/* Author card as representative review */}
            <Box sx={{ p: '0.75rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.5rem' }}>
                <OnlineAvatar userId={post.author._id} src={post.author.avatar} isVerified={post.author.isVerified} dotSize={8} sx={{ width: 28, height: 28, background: GRAD, fontSize: '0.7rem', fontWeight: 700 }}>{authorInitials}</OnlineAvatar>
                <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1F2937' }}>{post.author.name}</Typography>
                <Box sx={{ color: '#FBBF24', fontSize: '0.65rem', ml: 'auto' }}>{'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}</Box>
              </Box>
              <Typography sx={{ fontSize: '0.8125rem', color: '#4B5563', lineHeight: 1.5 }}>
                {author?.bio ? author.bio.slice(0, 120) + (author.bio.length > 120 ? '…' : '') : 'Highly rated skill instructor in the community.'}
              </Typography>
            </Box>
          </>
        )}
      </RSSection>

      {/* Similar Skills by the same author */}
      <RSSection title={`More Skills by ${post.author.name.split(' ')[0]}`}>
        {similarSkills.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: '1rem', color: '#9CA3AF' }}>
            <i className="fas fa-chalkboard-teacher" style={{ fontSize: '1.5rem', marginBottom: '0.5rem', display: 'block' }} />
            <Typography sx={{ fontSize: '0.8125rem' }}>No other skills posted yet</Typography>
          </Box>
        ) : (
          similarSkills.map((s) => (
            <Box key={s._id} onClick={() => navigate(`/skills/${s._id}`)} sx={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', p: '0.625rem', borderRadius: '0.5rem',
              cursor: 'pointer', transition: 'background 0.15s', mb: '0.25rem',
              '&:hover': { background: '#F3F4F6' },
            }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '0.5rem', background: SKILL_GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-chalkboard-teacher" style={{ color: '#fff', fontSize: '0.875rem' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>{post.author.name}</Typography>
              </Box>
              <Box sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#8B5CF6', flexShrink: 0 }}>VIEW</Box>
            </Box>
          ))
        )}
      </RSSection>

      {/* Exchange Stats — from author profile */}
      <RSSection title={`${post.author.name.split(' ')[0]}'s Stats`}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.625rem' }}>
          {STATS.map(({ value, label }) => (
            <Box key={label} sx={{ p: '0.875rem 0.5rem', background: GRAD, borderRadius: '0.5rem', textAlign: 'center', color: '#fff' }}>
              <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
              <Typography sx={{ fontSize: '0.7rem', opacity: 0.9, mt: '0.25rem' }}>{label}</Typography>
            </Box>
          ))}
        </Box>
      </RSSection>

      {/* Safety Tips */}
      <RSSection title="Safety Tips">
        {SAFETY.map(({ icon, text }) => (
          <Box key={text} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.625rem', p: '0.625rem', mb: '0.5rem', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '0.5rem', '&:last-child': { mb: 0 } }}>
            <i className={`fas ${icon}`} style={{ color: '#10B981', fontSize: '0.875rem', marginTop: '0.125rem', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#374151', lineHeight: 1.5 }}>{text}</Typography>
          </Box>
        ))}
      </RSSection>
    </>
  );
};

// ── Exchange Discussion ────────────────────────────────────────────────────────
type CommentType = { _id: string; content: string; parentId: string | null; author: { _id: string; name: string; avatar?: string; ceuBalance?: number; isVerified?: boolean }; createdAt: string };

const getCeuTier = (ceu = 0): { label: string; bg: string } => {
  if (ceu >= 1000) return { label: 'Diamond',  bg: 'linear-gradient(135deg,#6366F1,#8B5CF6)' };
  if (ceu >= 500)  return { label: 'Platinum', bg: 'linear-gradient(135deg,#0EA5E9,#6366F1)' };
  if (ceu >= 250)  return { label: 'Gold',     bg: 'linear-gradient(135deg,#F59E0B,#EF4444)' };
  if (ceu >= 100)  return { label: 'Silver',   bg: 'linear-gradient(135deg,#6B7280,#9CA3AF)' };
  return                  { label: 'Bronze',   bg: 'linear-gradient(135deg,#92400E,#B45309)' };
};

const CommentCard: React.FC<{ c: CommentType; allComments: CommentType[]; onReply: (body: { content: string; parentId: string | null }) => void; onDelete: (commentId: string) => void; postId: string; depth?: number }> = ({ c, allComments, onReply, onDelete, postId, depth = 0 }) => {
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

  // Close menu on outside click
  React.useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);
  const cardReplies = allComments.filter(r => r.parentId === c._id);

  return (
    <Box sx={{ display: 'flex', gap: '0.625rem' }}>
      {/* Left: avatar + collapse thread line */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <OnlineAvatar userId={c.author._id} src={c.author.avatar} isVerified={c.author.isVerified} dotSize={9} sx={{ width: 32, height: 32, background: GRAD, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate(`/profile/${c.author._id}`)}>{initials}</OnlineAvatar>
        {!collapsed && cardReplies.length > 0 && (
          <Box onClick={() => setCollapsed(true)} sx={{ flex: 1, width: 2, background: '#E5E7EB', mt: '0.375rem', cursor: 'pointer', borderRadius: 1, minHeight: 24, '&:hover': { background: '#4F46E5' } }} />
        )}
      </Box>

      {/* Right: content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {/* Meta row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem', flexWrap: 'wrap' }}>
          <Typography onClick={() => navigate(`/profile/${c.author._id}`)} sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937', cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}>{c.author.name}</Typography>
          <Box sx={{ px: '0.4rem', py: '0.1rem', borderRadius: '0.25rem', fontSize: '0.625rem', fontWeight: 700, background: bg, color: '#fff', letterSpacing: '0.02em' }}>{label}</Box>
          <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF' }}>• {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</Typography>
        </Box>

        {collapsed ? (
          <Box component="button" onClick={() => setCollapsed(false)} sx={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Inter,sans-serif', p: 0 }}>
            [show comment]
          </Box>
        ) : (
          <>
            <Typography sx={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, mb: '0.625rem', wordBreak: 'break-word' }}>{c.content}</Typography>

            {/* Actions row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.125rem', flexWrap: 'wrap' }}>
              {[
                { icon: 'fa-comment', label: 'Reply', onClick: () => { if (!user) { navigate('/login'); return; } setReplyOpen(v => !v); } },
                { icon: 'fa-share', label: 'Share', onClick: () => navigator.clipboard.writeText(window.location.href) },
              ].map(({ icon, label: lbl, onClick }) => (
                <Box key={icon} component="button" onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                  <i className={`fas ${icon}`} style={{ fontSize: '0.75rem' }} /> {lbl}
                </Box>
              ))}
              {/* … dropdown */}
              <Box ref={menuRef} sx={{ position: 'relative' }}>
                <Box component="button" onClick={() => setMenuOpen(v => !v)} sx={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                  <i className="fas fa-ellipsis-h" style={{ fontSize: '0.75rem' }} />
                </Box>
                {menuOpen && (
                  <Box sx={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 120, py: '0.25rem', overflow: 'hidden' }}>
                    {isOwn ? (
                      <Box component="button" onClick={() => { setMenuOpen(false); onDelete(c._id); }}
                        sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FEF2F2' } }}>
                        <i className="fas fa-trash-alt" style={{ fontSize: '0.75rem' }} /> Delete
                      </Box>
                    ) : (
                      <Box component="button" onClick={() => { setMenuOpen(false); alert('Report submitted. Thank you for keeping the community safe.'); }}
                        sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#D97706', fontFamily: 'Inter,sans-serif', fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FFFBEB' } }}>
                        <i className="fas fa-flag" style={{ fontSize: '0.75rem' }} /> Report
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>

            {/* Inline reply box */}
            {replyOpen && (
              <Box sx={{ mt: '0.75rem' }}>
                <Box component="textarea" value={replyText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)} placeholder={`Reply to ${c.author.name}…`}
                  sx={{ width: '100%', minHeight: 72, p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', color: '#1F2937', resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', mt: '0.5rem' }}>
                  <Box component="button" onClick={() => { setReplyOpen(false); setReplyText(''); }} sx={{ background: '#F3F4F6', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>Cancel</Box>
                  <Box component="button" onClick={() => { if (replyText.trim()) { onReply({ content: replyText, parentId: c._id }); setReplyText(''); setReplyOpen(false); } }} sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>Reply</Box>
                </Box>
              </Box>
            )}

            {/* Nested replies */}
            {cardReplies.length > 0 && (
              <Box sx={{ mt: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', pl: '0.25rem', borderLeft: '2px solid #E5E7EB' }}>
                {cardReplies.map(r => <CommentCard key={r._id} c={r} allComments={allComments} onReply={onReply} onDelete={onDelete} postId={postId} depth={depth + 1} />)}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

const ExchangeDiscussion: React.FC<{ post: Post }> = ({ post }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', post._id],
    queryFn: async () => { const r = await api.get(`/posts/${post._id}/comments`); return r.data as CommentType[]; },
  });

  // ── Real-time: join post room, append incoming comments to cache ──────────
  useEffect(() => {
    if (!user) return; // Socket requires auth — skip for guests
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

    return () => {
      socket.emit('leave-post', post._id);
      socket.off('new-comment', handleNewComment);
    };
  }, [post._id, queryClient, user]);

  const addMutation = useMutation({
    mutationFn: (body: { content: string; parentId: string | null }) => api.post(`/posts/${post._id}/comments`, body),
    onSuccess: (res) => {
      // Optimistically add own comment immediately (server also broadcasts it)
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
      queryClient.setQueryData<CommentType[]>(['comments', post._id], (prev = []) =>
        prev.filter(c => c._id !== commentId)
      );
      queryClient.invalidateQueries({ queryKey: ['post', post._id] });
    },
  });

  // Newest first
  const topLevel = comments
    .filter(c => !c.parentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const uniqueAuthors = new Set(comments.map(c => c.author._id)).size;

  return (
    <Box sx={{ p: '2rem', background: '#FFF', borderRadius: '0 0 0.75rem 0.75rem' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <i className="fas fa-comments" style={{ color: '#1F2937', fontSize: '1.125rem' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>Exchange Discussion</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
          <i className="fas fa-users" style={{ marginRight: 4 }} />
          {uniqueAuthors} participant{uniqueAuthors !== 1 ? 's' : ''} • {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      {/* Add comment prompt */}
      {!user ? (
        <Box sx={{ mb: '1.5rem' }}><GuestBanner message="Log in to join the discussion and leave a comment." /></Box>
      ) : !composerOpen ? (
        <Box onClick={() => setComposerOpen(true)} sx={{ mb: '1.5rem', p: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '1.5rem', color: '#9CA3AF', cursor: 'text', fontSize: '0.9375rem', background: '#F9FAFB', '&:hover': { borderColor: '#4F46E5' } }}>
          Add a comment…
        </Box>
      ) : (
        <Box sx={{ mb: '1.5rem', border: '1px solid #4F46E5', borderRadius: '0.625rem', overflow: 'hidden', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' }}>
          <Box component="textarea" autoFocus value={newComment} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)} placeholder="What are your thoughts?"
            sx={{ width: '100%', minHeight: 100, p: '0.875rem 1rem', border: 'none', fontFamily: 'Inter,sans-serif', fontSize: '0.9375rem', color: '#1F2937', background: '#FFF', resize: 'none', outline: 'none', boxSizing: 'border-box', display: 'block' }} />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', p: '0.625rem 0.875rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
            <Box component="button" onClick={() => { setComposerOpen(false); setNewComment(''); }} sx={{ background: 'none', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6' } }}>Cancel</Box>
            <Box component="button" onClick={() => { if (newComment.trim()) { addMutation.mutate({ content: newComment, parentId: null }); setNewComment(''); setComposerOpen(false); } }} sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '1rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Inter,sans-serif', opacity: newComment.trim() ? 1 : 0.4 }}>Comment</Box>
          </Box>
        </Box>
      )}

      {/* Thread */}
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

// ── Main Page ─────────────────────────────────────────────────────────────────
const SkillDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const onlineIds = useOnline();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false);
  const [exchangeModalTitle, setExchangeModalTitle] = useState('Request Skill Swap');

  const { data: post, isLoading, isError } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => { const res = await api.get(`/posts/${id}`); return res.data as Post; },
  });

  const { data: linkedExchanges } = useQuery({
    queryKey: ['post-exchanges', id],
    queryFn: async () => {
      const res = await api.get(`/exchanges?postId=${id}&limit=50`);
      return res.data.exchanges as import('../types').Exchange[];
    },
    enabled: !!id && !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      navigate('/feed');
    },
  });

  if (isLoading) return (
    <Layout>
      <Skeleton variant="rounded" height={300} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={400} />
    </Layout>
  );
  if (isError || !post) return (
    <Layout>
      <Box sx={{ textAlign: 'center', py: '4rem', color: '#6B7280' }}>
        <i className="fas fa-exclamation-circle" style={{ fontSize: '2.5rem', marginBottom: '1rem', display: 'block', color: '#E5E7EB' }} />
        <Typography sx={{ fontWeight: 600, fontSize: '1.125rem', color: '#1F2937', mb: '0.5rem' }}>Post not found</Typography>
        <Typography sx={{ fontSize: '0.875rem', mb: '1.5rem' }}>This post may have been removed or is unavailable.</Typography>
        <Box component="button" onClick={() => navigate('/feed')} sx={{ background: '#4F46E5', color: '#fff', border: 'none', borderRadius: '0.5rem', px: '1.25rem', py: '0.625rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Back to Feed
        </Box>
      </Box>
    </Layout>
  );

  const rightPanel = <SkillDetailRightPanel post={post} />;

  const tags = parseTags(post.tags);
  const profTag = tags.find(t => PROFICIENCY_LEVELS.includes(t.toLowerCase()))?.toLowerCase();
  const displayTags = tags.filter(t => !PROFICIENCY_LEVELS.includes(t.toLowerCase()) && t !== 'skill');
  const score = post.upvotes.length - post.downvotes.length;
  const initials = post.author.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const isAuthorOnline = onlineIds.has(post.author._id);

  // Parse description — strip bullet metadata

  return (
    <Layout rightPanel={rightPanel}>
      {/* Breadcrumbs */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem', fontSize: '0.875rem', color: '#6B7280' }}>
        {[{ label: 'Home', path: '/feed' }, { label: 'Skills', path: '/feed?type=skill' }].map(({ label, path }) => (
          <React.Fragment key={label}>
            <Box component="span" onClick={() => navigate(path)} sx={{ cursor: 'pointer', color: '#6B7280', '&:hover': { color: '#4F46E5' } }}>{label}</Box>
            <Box component="span" sx={{ color: '#D1D5DB' }}>/</Box>
          </React.Fragment>
        ))}
        <Box component="span" sx={{ color: '#1F2937', fontWeight: 500 }}>{post.title}</Box>
      </Box>

      {/* ── Header Card ─────────────────────────────────────────────────── */}
      <Box sx={{ background: '#FFF', borderRadius: '0.75rem', border: '1px solid #E5E7EB', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', mb: '1.5rem', overflow: 'hidden' }}>
        {/* Gradient header zone */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(236,72,153,0.06))' }}>
          {/* Category + rating row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '0.875rem', py: '0.4rem', background: SKILL_GRAD, color: '#fff', borderRadius: '0.375rem', fontSize: '0.8125rem', fontWeight: 600 }}>
              <i className="fas fa-star" />
              Skill Offering
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Box sx={{ color: '#FBBF24', fontSize: '0.875rem' }}>
                  {'★'.repeat(Math.round(post.author.rating))}{'☆'.repeat(5 - Math.round(post.author.rating))}
                </Box>
                <Typography sx={{ fontSize: '0.875rem', color: '#6B7280' }}>{post.author.rating.toFixed(1)} rating</Typography>
              </Box>
              {/* Three-dot menu */}
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ color: '#6B7280', '&:hover': { background: '#F3F4F6' } }}
              >
                <i className="fas fa-ellipsis-v" style={{ fontSize: '0.875rem' }} />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                PaperProps={{ sx: { borderRadius: '0.5rem', border: '1px solid #E5E7EB', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 160 } }}
              >
                {user?._id === post.author._id && (
                  <MenuItem onClick={() => { setMenuAnchor(null); navigate(`/create?edit=${post._id}`); }} sx={{ fontSize: '0.875rem', gap: 1 }}>
                    <i className="fas fa-edit" style={{ color: '#4F46E5', width: 16 }} /> Edit post
                  </MenuItem>
                )}
                {user?._id === post.author._id && (
                  <MenuItem onClick={() => { setMenuAnchor(null); if (window.confirm('Delete this post?')) deleteMutation.mutate(); }} sx={{ fontSize: '0.875rem', gap: 1, color: '#EF4444' }}>
                    <i className="fas fa-trash-alt" style={{ color: '#EF4444', width: 16 }} /> Delete post
                  </MenuItem>
                )}
                <MenuItem onClick={() => { setMenuAnchor(null); }} sx={{ fontSize: '0.875rem', gap: 1 }}>
                  <i className="fas fa-flag" style={{ color: '#F59E0B', width: 16 }} /> Report
                </MenuItem>
                <MenuItem onClick={() => { setMenuAnchor(null); navigator.clipboard.writeText(window.location.href); }} sx={{ fontSize: '0.875rem', gap: 1 }}>
                  <i className="fas fa-link" style={{ color: '#6B7280', width: 16 }} /> Copy link
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* Teacher row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem' }}>
            <OnlineAvatar
              userId={post.author._id}
              src={post.author.avatar}
              isVerified={post.author.isVerified}
              sx={{ width: 64, height: 64, background: GRAD, fontSize: '1.5rem', fontWeight: 700, boxShadow: '0 4px 6px rgba(0,0,0,0.12)' }}
            >
              {initials}
            </OnlineAvatar>
            <Box sx={{ flex: 1 }}>
              <Box
                onClick={() => navigate(`/profile/${post.author._id}`)}
                sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', mb: '0.25rem' }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', '&:hover': { color: '#4F46E5' } }}>
                  {post.author.name}
                </Typography>
                <i className="fas fa-shield-alt" style={{ color: '#10B981', fontSize: '0.875rem' }} />
              </Box>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '0.5rem' }}>
                Skill Instructor · {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </Typography>
              <Box sx={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { icon: 'fa-coins', label: `${score > 0 ? '+' : ''}${score} votes` },
                  { icon: 'fa-star', label: `${post.author.rating.toFixed(1)} rating` },
                  { icon: 'fa-comment-alt', label: `${post.commentCount} comments` },
                  ...(profTag ? [{ icon: 'fa-signal', label: profTag.charAt(0).toUpperCase() + profTag.slice(1) }] : []),
                ].map(({ icon, label }) => (
                  <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                    <i className={`fas ${icon}`} style={{ color: '#4F46E5', width: 14 }} />
                    {label}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>

          {/* Title */}
          <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 800, fontSize: '1.75rem', color: '#1F2937', mb: '0.75rem', lineHeight: 1.25, textTransform: 'capitalize' }}>
            {post.title}
          </Typography>

          {/* Stats grid */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)' }, gap: '1rem' }}>
            {[
              { value: `${Math.max(1, score * 2 + 5)} CEU`, label: 'Estimated Value' },
              { value: post.commentCount.toString(), label: 'Comments' },
              { value: post.author.rating.toFixed(1), label: 'Author Rating' },
            ].map(({ value, label }) => (
              <Box key={label} sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '1rem', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.375rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif' }}>{value}</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', mt: '0.25rem' }}>{label}</Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* ── Media ─────────────────────────────────────────────────── */}
        {post.images && post.images.length > 0 && (
          <Box sx={{ borderBottom: '1px solid #E5E7EB', overflow: 'hidden' }}>
            <MediaGallery media={post.images} />
          </Box>
        )}

        {/* ── Description + Details ─────────────────────────────────── */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1rem' }}>
            <i className="fas fa-info-circle" style={{ color: '#4F46E5' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#1F2937' }}>Skill Description</Typography>
          </Box>

          <Box sx={{ mb: '1.75rem' }}>
            <RichContent text={post.content} />
          </Box>

          {/* Details grid */}
          {(() => {
            const gridItems: { icon: string; title: string; primary: string; secondary: string }[] = [];

            // ── Duration — only show if user explicitly picked a duration chip ─
            if (post.duration) {
              const durationSecondary = post.sessions && post.sessions > 1
                ? `${post.sessions} sessions available`
                : 'Flexible scheduling';
              gridItems.push({ icon: 'fa-clock', title: 'Duration', primary: post.duration as string, secondary: durationSecondary });
            }

            // ── Location — only show if user set a location or toggled online ─
            const locName = post.locationName && post.locationName.toLowerCase() !== 'online'
              ? post.locationName : null;
            const hasLocation = post.isOnline || Boolean(locName);
            if (hasLocation) {
              const locationPrimary = post.isOnline ? 'Online' : locName!;
              const locationSecondary = post.isOnline && locName
                ? `${locName} • Online sessions available`
                : post.isOnline
                  ? 'Online sessions available'
                  : 'In-person only';
              gridItems.push({ icon: 'fa-map-marker-alt', title: 'Location', primary: locationPrimary, secondary: locationSecondary });
            }

            // ── Group Size — only show if user specified a size ──────────────
            const gs = post.groupSize;
            if (gs) {
              const groupPrimary = gs === 1
                ? '1-on-1 (individual)'
                : gs <= 3
                  ? `1-on-1 or small groups (max ${gs} students)`
                  : `Groups up to ${gs} students`;
              const groupSecondary = gs === 1 ? 'Private sessions only' : 'Group or individual';
              gridItems.push({ icon: 'fa-users', title: 'Group Size', primary: groupPrimary, secondary: groupSecondary });
            }

            // ── Level — only show if a proficiency tag was set ───────────────
            if (profTag) {
              const levelPrimary = profTag.charAt(0).toUpperCase() + profTag.slice(1);
              gridItems.push({ icon: 'fa-graduation-cap', title: 'Level', primary: levelPrimary, secondary: 'Customized curriculum' });
            }

            // ── Requirements — only show if user entered requirements ─────────
            const reqList = post.requirements && (post.requirements as string[]).length > 0
              ? post.requirements as string[] : null;
            if (reqList) {
              gridItems.push({ icon: 'fa-tools', title: 'Requirements', primary: reqList.join(' • '), secondary: '' });
            }

            // ── Languages — only show if user selected languages ─────────────
            const langList = post.languages && (post.languages as string[]).length > 0
              ? post.languages as string[] : null;
            if (langList) {
              gridItems.push({ icon: 'fa-language', title: 'Languages', primary: langList.join(', '), secondary: 'Patient and clear instruction' });
            }

            if (gridItems.length === 0) return null;

            return (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1.5rem', mb: '2rem' }}>
                {gridItems.map(({ icon, title, primary, secondary }) => (
                  <Box key={title} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                    <Box sx={{
                      width: 36, height: 36, borderRadius: '0.625rem', flexShrink: 0,
                      background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className={`fas ${icon}`} style={{ color: '#4F46E5', fontSize: '0.9rem' }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937', mb: '0.2rem', fontFamily: 'Inter,sans-serif' }}>
                        {title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.8375rem', color: '#6B7280', lineHeight: 1.6, fontFamily: 'Inter,sans-serif' }}>
                        {primary}
                        {secondary && (
                          <>
                            <Box component="span" sx={{ mx: '0.35rem', color: '#D1D5DB' }}>•</Box>
                            {secondary}
                          </>
                        )}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          })()}

          {/* Tags row */}
          {displayTags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {displayTags.map(tag => (
                <Box key={tag} component="span" sx={{
                  px: '0.75rem', py: '0.375rem', background: '#FFF', border: '1px solid #E5E7EB',
                  borderRadius: '2rem', fontSize: '0.75rem', color: '#6B7280', fontWeight: 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: 'rgba(79,70,229,0.04)' },
                }}>
                  #{tag}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ── Availability Calendar — only when schedule is set ──────── */}
        {post.startDate && post.recurring && (
          <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem' }}>
              <i className="fas fa-calendar-check" style={{ color: '#4F46E5' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#1F2937' }}>Availability</Typography>
            </Box>
            <AvailabilityCalendar post={post} />
          </Box>
        )}

        {/* ── Exchange Options ───────────────────────────────────────── */}
        <Box sx={{ p: '2rem', borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem' }}>
            <i className="fas fa-exchange-alt" style={{ color: '#4F46E5' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#1F2937' }}>Exchange Options</Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px,1fr))' }, gap: '1.25rem' }}>
            {[
              {
                icon: 'fa-exchange-alt', title: 'Skill Swap',
                desc: 'Exchange your skill for theirs — both parties benefit equally.',
                cta: 'Request Skill Swap', featured: true, badge: 'Most Popular',
              },
              {
                icon: 'fa-coins', title: 'CEU Exchange',
                desc: 'Pay with Community Exchange Units from your balance.',
                cta: 'Exchange with CEU', featured: false, badge: null,
              },
            ].map(({ icon, title, desc, cta, featured, badge }) => (
              <Box
                key={title}
                sx={{
                  position: 'relative', p: '1.5rem', borderRadius: '0.75rem',
                  border: featured ? '2px solid #4F46E5' : '2px solid #E5E7EB',
                  background: featured ? 'linear-gradient(135deg,rgba(79,70,229,0.03),rgba(16,185,129,0.03))' : '#FFF',
                  transition: 'all 0.25s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
                }}
              >
                {badge && (
                  <Box sx={{
                    position: 'absolute', top: -12, right: '1rem',
                    background: GRAD, color: '#fff', px: '0.75rem', py: '0.2rem',
                    borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700,
                  }}>{badge}</Box>
                )}
                <Box sx={{ width: 48, height: 48, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '1rem' }}>
                  <i className={`fas ${icon}`} style={{ color: '#fff', fontSize: '1.25rem' }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', mb: '0.5rem' }}>{title}</Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5, mb: '1.25rem' }}>{desc}</Typography>
                <Box
                  component="button"
                  onClick={() => {
                    if (!user) { navigate('/login'); return; }
                    setExchangeModalTitle(cta);
                    setExchangeModalOpen(true);
                  }}
                  sx={{
                    width: '100%', background: GRAD, color: '#fff', border: 'none',
                    py: '0.875rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem',
                    cursor: 'pointer', fontFamily: 'Inter,sans-serif',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'all 0.2s', '&:hover': { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' },
                  }}
                >
                  <i className={`fas ${icon}`} /> {cta}
                </Box>
              </Box>
            ))}
          </Box>

          {/* ── Skill Swap Requests (always visible) ────────────────── */}
          <Box sx={{ mt: '2rem', pt: '1.5rem', borderTop: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1rem' }}>
              <i className="fas fa-handshake" style={{ color: '#10B981' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
                Skill Swap Requests
              </Typography>
              {linkedExchanges && linkedExchanges.length > 0 && (
                <Box sx={{ ml: 0.5, background: GRAD, color: '#fff', borderRadius: '1rem', px: '0.55rem', py: '0.1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                  {linkedExchanges.length}
                </Box>
              )}
            </Box>
            {!linkedExchanges || linkedExchanges.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: '1.5rem', color: '#9CA3AF', border: '1.5px dashed #E5E7EB', borderRadius: '0.75rem' }}>
                <i className="fas fa-handshake" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }} />
                <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>No swap requests yet — be the first!</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {linkedExchanges.map(ex => {
                  const FAIR_CFG: Record<string, { color: string; bg: string; border: string; emoji: string; label: string }> = {
                    fair:             { color: '#059669', bg: 'rgba(5,150,105,0.08)',  border: 'rgba(5,150,105,0.22)',  emoji: '✅', label: 'Fair'    },
                    needs_adjustment: { color: '#D97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.22)',  emoji: '⚠️', label: 'Adjust' },
                    unfair:           { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', border: 'rgba(220,38,38,0.22)',  emoji: '❌', label: 'Unfair' },
                  };
                  const lbl = (ex.fairnessLabel ?? 'fair') as keyof typeof FAIR_CFG;
                  const cfg = FAIR_CFG[lbl] ?? FAIR_CFG.fair;
                  const pct = ex.fairnessScore != null ? Math.round(ex.fairnessScore * 100) : null;
                  return (
                    <Box
                      key={ex._id}
                      onClick={() => navigate(`/exchanges/${ex._id}`)}
                      sx={{
                        borderRadius: '0.75rem', border: '1.5px solid #E5E7EB',
                        background: '#FAFAFA', cursor: 'pointer', transition: 'all 0.2s', overflow: 'hidden',
                        '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.03)', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
                      }}
                    >
                      {/* Main row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '1rem 1.25rem' }}>
                        <OnlineAvatar
                          userId={ex.requester._id}
                          isVerified={ex.requester.isVerified}
                          src={ex.requester.avatar}
                          sx={{ width: 36, height: 36, fontSize: '0.8rem' }}
                        >
                          {ex.requester.name?.[0]}
                        </OnlineAvatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937' }}>{ex.title}</Typography>
                            <Box sx={{
                              px: '0.45rem', py: '0.08rem', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 700,
                              background: ex.status === 'open' ? 'rgba(16,185,129,0.1)' : ex.status === 'completed' ? 'rgba(79,70,229,0.1)' : 'rgba(107,114,128,0.1)',
                              color: ex.status === 'open' ? '#059669' : ex.status === 'completed' ? '#4F46E5' : '#6B7280',
                            }}>
                              {ex.status.charAt(0).toUpperCase() + ex.status.slice(1)}
                            </Box>
                          </Box>
                          <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mt: '0.15rem' }}>
                            by {ex.requester.name}
                          </Typography>
                        </Box>
                        <i className="fas fa-chevron-right" style={{ color: '#D1D5DB', fontSize: '0.8rem' }} />
                      </Box>

                      {/* Fairness & CEU strip */}
                      {((ex.ceuValue ?? 0) > 0 || pct != null) && (
                        <Box sx={{
                          px: '1.25rem', py: '0.45rem',
                          borderTop: '1px solid #F3F4F6',
                          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
                          background: '#F9FAFB',
                        }}>
                          <i className="fas fa-balance-scale" style={{ color: '#9CA3AF', fontSize: '0.7rem' }} />
                          {/* CEU pill */}
                          {(ex.ceuValue ?? 0) > 0 && (
                            <Box sx={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              px: '0.5rem', py: '0.15rem', borderRadius: '2rem',
                              background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))',
                              border: '1px solid rgba(79,70,229,0.18)',
                              fontSize: '0.68rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif',
                            }}>
                              <i className="fas fa-coins" style={{ fontSize: '0.58rem' }} />
                              {ex.ceuValue} CEU
                            </Box>
                          )}
                          {/* Score bar + badge */}
                          {pct != null ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <Box sx={{ width: 40, height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                                <Box sx={{ height: '100%', borderRadius: 2, background: cfg.color, width: `${pct}%` }} />
                              </Box>
                              <Box sx={{
                                px: '0.45rem', py: '0.1rem', borderRadius: '2rem',
                                background: cfg.bg, border: `1px solid ${cfg.border}`,
                                fontSize: '0.65rem', fontWeight: 700, color: cfg.color,
                                fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap',
                              }}>
                                {cfg.emoji} {pct}% {cfg.label}
                              </Box>
                            </Box>
                          ) : (
                            <Box sx={{
                              px: '0.45rem', py: '0.1rem', borderRadius: '2rem',
                              background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.2)',
                              fontSize: '0.65rem', fontWeight: 600, color: '#6B7280', fontFamily: 'Inter,sans-serif',
                            }}>
                              ⏳ Fairness pending
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* ── Exchange Discussion ─────────────────────────────────────── */}
        <ExchangeDiscussion post={post} />
      </Box>

      {/* ── Request Skill Swap Modal ─────────────────────────────────── */}
      <CreateExchange
        modal
        open={exchangeModalOpen}
        onClose={() => setExchangeModalOpen(false)}
        modalTitle={exchangeModalTitle}
        targetPost={{ _id: post._id, title: post.title, tags: post.tags, locationName: post.locationName, isOnline: post.isOnline, onlineLink: post.onlineLink, sessions: post.sessions, timeStart: post.timeStart, timeEnd: post.timeEnd, recurring: post.recurring, startDate: post.startDate }}
      />
    </Layout>
  );
};

export default SkillDetail;
