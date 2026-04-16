import React, { useState, useRef, useEffect } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  formatDistanceToNow, format, addMonths, subMonths,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday,
} from 'date-fns';
import Layout from '../components/layout/Layout';
import VideoVerificationGate from '../components/VideoVerificationGate';
import PhoneVerificationGate from '../components/PhoneVerificationGate';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { Exchange, ExchangeApplication, FairnessSuggestion } from '../types';
import { useAuth } from '../context/AuthContext';
import { containsProfanity, PROFANITY_ERROR } from '../utils/contentFilter';
import OnlineAvatar from '../components/OnlineAvatar';
import RichContent from '../components/RichContent';
import CreateExchange from './CreateExchange';

// ─── CEU helpers ──────────────────────────────────────────────────────────────
const parseHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0.25, mins / 60);
};
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr}${ap}` : `${hr}:${String(m).padStart(2, '0')}${ap}`;
};
const PROF_MULT: Record<string, number> = { beginner: 0.8, intermediate: 1.0, expert: 1.5 };
const CEU_GRAD = 'linear-gradient(135deg,#4F46E5,#10B981)';

const formatCountdown = (ms: number): string => {
  const total = Math.max(0, ms);
  const days  = Math.floor(total / 86_400_000);
  const hours = Math.floor((total % 86_400_000) / 3_600_000);
  const mins  = Math.floor((total % 3_600_000) / 60_000);
  const secs  = Math.floor((total % 60_000) / 1_000);
  if (days > 0)  return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
};

// ─── CEU Breakdown Panel ───────────────────────────────────────────────────────
const CeuBreakdownPanel: React.FC<{
  ceuValue: number;
  timeStart?: string;
  timeEnd?: string;
  sessions?: number;
  tags?: string[];
  offering?: string;
}> = ({ ceuValue, timeStart, timeEnd, sessions, tags, offering }) => {
  const hrs      = timeStart && timeEnd ? parseHours(timeStart, timeEnd) : 1;
  const sess     = Math.max(1, sessions ?? 1);
  const profTag  = tags?.find(t => t in PROF_MULT) ?? 'intermediate';
  const profMult = PROF_MULT[profTag] ?? 1.0;
  const profLabel= profTag.charAt(0).toUpperCase() + profTag.slice(1);
  const perSess  = Math.max(1, Math.round(hrs * profMult));
  const calcCeu  = perSess * sess;
  // CEU exchanges have offering like "13 CEU" — detect by pattern
  const isCeuEx  = /^\d+\s*CEU$/i.test(offering ?? '');
  const awarded  = ceuValue > 0 ? ceuValue : calcCeu;           // fallback to calculated
  const ratio    = calcCeu > 0 ? awarded / calcCeu : 1;
  const isFair   = ratio >= 1.0;
  const isLow    = ratio >= 0.8 && ratio < 1.0;
  const isUnfair = ratio < 0.8;
  const fColor   = isUnfair ? '#DC2626' : isLow ? '#D97706' : '#059669';
  const fBg      = isUnfair ? 'rgba(220,38,38,0.07)' : isLow ? 'rgba(217,119,6,0.07)' : 'rgba(5,150,105,0.07)';
  const fBorder  = isUnfair ? 'rgba(220,38,38,0.2)'  : isLow ? 'rgba(217,119,6,0.2)'  : 'rgba(5,150,105,0.2)';
  const fIcon    = isUnfair ? 'fa-times-circle' : isLow ? 'fa-exclamation-triangle' : 'fa-check-circle';
  const fLabel   = isUnfair ? 'Unfair' : isLow ? 'Slightly Low' : 'Fair';

  const rows = [
    timeStart && timeEnd
      ? { icon: 'fa-clock',         label: 'Session length',   value: `${hrs.toFixed(1).replace(/\.0$/, '')}h`,    note: `${fmt12(timeStart)} – ${fmt12(timeEnd)}` }
      : { icon: 'fa-clock',         label: 'Session length',   value: '1h',                                         note: 'Default (no schedule set)' },
    { icon: 'fa-user-graduate',   label: `Proficiency`,        value: `×${profMult.toFixed(1)}`,                    note: profLabel },
    { icon: 'fa-layer-group',     label: 'Sessions',           value: `×${sess}`,                                   note: `${sess} session${sess !== 1 ? 's' : ''}` },
    { icon: 'fa-coins',           label: 'CEU per session',    value: `${perSess} CEU`,                             note: `${hrs.toFixed(1).replace(/\.0$/, '')}h × ×${profMult.toFixed(1)} = ${perSess}` },
  ];

  return (
    <Box sx={{ mt: '1rem', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.75rem', overflow: 'hidden' }}>
      {/* header */}
      <Box sx={{ px: '0.875rem', py: '0.5rem', background: 'rgba(79,70,229,0.06)', borderBottom: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.72rem' }} />
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>
          CEU Breakdown
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
          {isCeuEx ? 'how this offer was calculated' : 'skill exchange value'}
        </Typography>
      </Box>

      {/* formula rows */}
      <Box sx={{ px: '0.875rem', pt: '0.625rem', pb: '0.5rem', background: '#FAFAFA' }}>
        {rows.map((row, i) => (
          <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '0.3rem', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <i className={`fas ${row.icon}`} style={{ color: '#9CA3AF', fontSize: '0.6rem', width: 11 }} />
              <Box>
                <Typography sx={{ fontSize: '0.74rem', color: '#374151', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{row.label}</Typography>
                <Typography sx={{ fontSize: '0.64rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>{row.note}</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap' }}>{row.value}</Typography>
          </Box>
        ))}

        {/* calculated total */}
        <Box sx={{ mt: '0.375rem', pt: '0.375rem', borderTop: '1.5px solid rgba(79,70,229,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Calculated fair value</Typography>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', px: '0.6rem', py: '0.2rem', borderRadius: '2rem', background: CEU_GRAD, color: '#FFF', fontSize: '0.76rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>
            <i className="fas fa-coins" style={{ fontSize: '0.6rem' }} /> {calcCeu} CEU
          </Box>
        </Box>
      </Box>

      {/* ── Awarded / Offered highlight ── */}
      <Box sx={{ px: '0.875rem', py: '0.5rem', borderTop: '1.5px solid rgba(79,70,229,0.18)', background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(16,185,129,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <i className="fas fa-award" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
            {isCeuEx ? 'Awarded' : 'Exchange Value'}
          </Typography>
        </Box>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', px: '0.75rem', py: '0.3rem', borderRadius: '2rem', background: CEU_GRAD, color: '#FFF', fontSize: '0.85rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}>
          <i className="fas fa-coins" style={{ fontSize: '0.7rem' }} /> {awarded} CEU
        </Box>
      </Box>

      {/* offered vs calculated fairness — CEU exchanges only */}
      {isCeuEx && !isFair && (
        <Box sx={{ px: '0.875rem', py: '0.5rem', borderTop: `1px solid ${fBorder}`, background: fBg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <i className={`fas ${fIcon}`} style={{ color: fColor, fontSize: '0.75rem' }} />
            <Box>
              <Typography sx={{ fontSize: '0.74rem', fontWeight: 700, color: fColor, fontFamily: 'Inter,sans-serif' }}>{fLabel}</Typography>
              <Typography sx={{ fontSize: '0.64rem', color: fColor, opacity: 0.85, fontFamily: 'Inter,sans-serif' }}>
                Offered {awarded} CEU — fair value is {calcCeu} CEU
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ─── Media gallery ────────────────────────────────────────────────────────────
const getMediaType = (url: string | null | undefined): 'video' | 'image' => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|mov|webm|ogg|avi|mkv)$/.test(clean) ? 'video' : 'image';
};

const ExchangeMediaGallery: React.FC<{ media: string[]; label?: string; fallback?: React.ReactNode }> = ({ media, label, fallback }) => {
  const [idx, setIdx] = useState(0);
  // Key errors by URL string so indices shifting after a removal can't corrupt the set
  const [errored, setErrored] = useState<Set<string>>(new Set());
  const valid = media.filter((src): src is string => Boolean(src) && !errored.has(src));
  if (valid.length === 0) return fallback ? <>{fallback}</> : null;
  const count = valid.length;
  const safeIdx = Math.min(idx, count - 1);

  const markErrored = (src: string) =>
    setErrored(prev => { const n = new Set(prev); n.add(src); return n; });

  return (
    <Box sx={{ mb: '0.75rem' }}>
      {label && (
        <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: '0.4rem' }}>
          {label}
        </Typography>
      )}
      {/* Main viewer */}
      <Box sx={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#111', mb: '0.625rem', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', height: 280 }}>
        <Box sx={{ display: 'flex', height: '100%', transition: 'transform 0.3s ease', transform: `translateX(-${safeIdx * 100}%)` }}>
          {valid.map((src, i) => (
            <Box key={src} sx={{ minWidth: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#111' }}>
              {getMediaType(src) === 'video' ? (
                <Box component="video" src={src} controls preload="metadata"
                  sx={{ width: '100%', height: '100%', display: 'block', outline: 'none', objectFit: 'contain' }} />
              ) : (
                <Box component="img" src={src} alt=""
                  onError={() => markErrored(src)}
                  sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
              )}
            </Box>
          ))}
        </Box>
        {count > 1 && (
          <>
            {[{ dir: -1, icon: 'fa-chevron-left', pos: { left: 8 } }, { dir: 1, icon: 'fa-chevron-right', pos: { right: 8 } }].map(({ dir, icon, pos }) => (
              <Box key={icon} component="button"
                onClick={() => setIdx(i => (i + dir + count) % count)}
                sx={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', ...pos, background: 'rgba(0,0,0,0.45)', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>
                <i className={`fas ${icon}`} />
              </Box>
            ))}
            <Box sx={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '1rem', px: '0.5rem', py: '0.1rem', fontSize: '0.7rem', fontFamily: 'Inter,sans-serif' }}>
              {safeIdx + 1} / {count}
            </Box>
          </>
        )}
      </Box>
      {/* Thumbnails */}
      {count > 1 && (
        <Box sx={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', pb: '0.25rem' }}>
          {valid.map((src, i) => (
            <Box key={src} onClick={() => setIdx(i)}
              sx={{ width: 56, height: 56, borderRadius: '0.375rem', overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: i === safeIdx ? '2px solid #4F46E5' : '2px solid transparent', transition: 'border-color 0.15s' }}>
              {getMediaType(src) === 'video' ? (
                <Box component="video" src={src} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Box component="img" src={src} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

// ── Availability Calendar (same as SkillDetail) ──────────────────────────────
const ExchangeAvailabilityCalendar: React.FC<{ exchange: Exchange }> = ({ exchange }) => {
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
    const base = exchange.startDate ? new Date(exchange.startDate) : exchange.scheduledDate ? new Date(exchange.scheduledDate) : null;
    if (!base) return set;

    if (!exchange.recurring || exchange.recurring === 'once') {
      set.add(toKey(base));
    } else if (exchange.recurring === 'weekly' || exchange.recurring === 'biweekly') {
      const step = exchange.recurring === 'biweekly' ? 14 : 7;
      const total = exchange.sessions ?? 8;
      let cur = new Date(base);
      for (let i = 0; i < total; i++) { set.add(toKey(cur)); cur = new Date(cur.getTime() + step * 86400000); }
    }
    return set;
  }, [exchange.startDate, exchange.scheduledDate, exchange.recurring, exchange.sessions]);

  const isAvailable = (d: Date) => isSameMonth(d, currentMonth) && availableDates.has(d.toISOString().split('T')[0]);

  const TIME_SLOTS = React.useMemo((): string[] => {
    if (!exchange.timeStart || !exchange.timeEnd) return [];
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const fmt = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; const a = h >= 12 ? 'PM' : 'AM'; return `${h > 12 ? h - 12 : h || 12}:${m.toString().padStart(2, '0')} ${a}`; };
    return [`${fmt(toMin(exchange.timeStart))} – ${fmt(toMin(exchange.timeEnd))}`];
  }, [exchange.timeStart, exchange.timeEnd]);

  if (availableDates.size === 0) return null;

  return (
    <Box sx={{ mb: '1.5rem' }}>
      {/* Section header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '1rem' }}>
        <i className="fas fa-calendar-check" style={{ color: '#4F46E5', fontSize: '1rem' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
          Availability
        </Typography>
      </Box>

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
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => (
            <Box key={d} sx={{ textAlign: 'center', py: '0.875rem', fontSize: '0.8125rem', fontWeight: 600, color: '#6B7280', letterSpacing: '0.04em' }}>{d}</Box>
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
                  }}>{format(day, 'd')}</Box>
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

      {/* Time slots — when a day is selected */}
      {selectedDay && TIME_SLOTS.length > 0 && (
        <Box sx={{ mt: '1.25rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem' }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>
              {format(selectedDay, 'EEEE, MMMM d')}
            </Typography>
            <Box sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>Pick a time</Box>
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px,1fr))', gap: '0.625rem' }}>
            {TIME_SLOTS.map(slot => {
              const sel = selectedSlot === slot;
              return (
                <Box key={slot} onClick={() => setSelectedSlot(s => s === slot ? null : slot)} sx={{
                  p: '0.75rem', textAlign: 'center', borderRadius: '0.5rem', fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                  border: sel ? '2px solid #4F46E5' : '2px solid rgba(16,185,129,0.3)',
                  background: sel ? GRAD : 'rgba(16,185,129,0.1)', color: sel ? '#fff' : '#10B981',
                  transition: 'all 0.15s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
                }}>{slot}</Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
};

const statusColors: Record<string, string> = {
  open:      '#4F46E5',
  pending:   '#D97706',
  active:    '#059669',
  completed: '#6B7280',
  cancelled: '#DC2626',
};

const typeIcons: Record<string, string> = {
  skill:   'fas fa-star',
  tool:    'fas fa-wrench',
  service: 'fas fa-handshake',
};

// ─── Fairness panel ───────────────────────────────────────────────────────────

const FAIRNESS_CONFIG = {
  fair:             { color: '#059669', bg: 'rgba(5,150,105,0.07)',  border: 'rgba(5,150,105,0.25)',  bar: '#059669' },
  needs_adjustment: { color: '#D97706', bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.25)',  bar: '#D97706' },
  unfair:           { color: '#DC2626', bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.25)',  bar: '#DC2626' },
};

const PARTY_COLORS: Record<string, string> = { A: '#4F46E5', B: '#10B981', both: '#6B7280' };

interface FairnessPanelProps {
  ceuA: number;
  ceuB?: number;
  score: number | null | undefined;
  label: string | null | undefined;
  description: string;
  adjustmentNeeded?: number;
  targetCEU?: { A: number; B: number };
  suggestions?: FairnessSuggestion[];
  requesterName: string;
  providerName?: string;
  marketValue?: { score: number; valueA: number; valueB: number; gap: number } | null;
}

const FairnessPanel: React.FC<FairnessPanelProps> = ({
  ceuA, ceuB, score, label, description,
  adjustmentNeeded = 0, targetCEU, suggestions = [],
  requesterName, providerName, marketValue,
}) => {
  const safeLabel = (label ?? 'fair') as keyof typeof FAIRNESS_CONFIG;
  const cfg       = FAIRNESS_CONFIG[safeLabel] ?? FAIRNESS_CONFIG.fair;
  const pct       = Math.round((score ?? 1) * 100);

  // Map generic party letters to actual names
  const nameOf = (party: 'A' | 'B' | 'both') =>
    party === 'A' ? requesterName : party === 'B' ? (providerName ?? 'Provider') : 'Both parties';

  return (
    <Box sx={{
      borderRadius: '0.75rem', border: `1px solid ${cfg.border}`,
      background: cfg.bg, padding: '1.25rem', mb: '1.5rem',
    }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1rem' }}>
        <i className="fas fa-balance-scale" style={{ color: cfg.color, fontSize: '1rem' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', flex: 1 }}>
          Fairness Check
        </Typography>
        <Box sx={{
          padding: '0.25rem 0.75rem', borderRadius: '2rem', background: cfg.color,
          color: '#FFF', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Inter,sans-serif',
        }}>
          {safeLabel === 'fair' ? '✅ Fair Match' : safeLabel === 'needs_adjustment' ? '⚠️ Needs Adjustment' : '❌ Unfair'}
        </Box>
      </Box>

      {/* Score bar */}
      <Box sx={{ mb: '1rem' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '0.375rem' }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
            Fairness Score
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: cfg.color, fontFamily: 'Inter,sans-serif' }}>
            {pct}%
          </Typography>
        </Box>
        <Box sx={{ height: 8, borderRadius: 4, background: '#E5E7EB', overflow: 'hidden' }}>
          <Box sx={{
            height: '100%', borderRadius: 4, background: cfg.bar,
            width: `${pct}%`, transition: 'width 0.6s ease',
          }} />
        </Box>
        {/* Threshold markers */}
        <Box sx={{ position: 'relative', height: 14, mt: '2px' }}>
          {[{ pct: 70, label: '0.7' }, { pct: 80, label: '0.8 Fair' }].map(m => (
            <Box key={m.pct} sx={{ position: 'absolute', left: `${m.pct}%`, transform: 'translateX(-50%)' }}>
              <Box sx={{ width: 1, height: 6, background: '#9CA3AF', mx: 'auto' }} />
              <Typography sx={{ fontSize: '0.6rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap' }}>
                {m.label}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Participants comparison */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' }, gap: '0.5rem', alignItems: 'center', mb: '1rem' }}>
        <Box sx={{ background: '#EEF2FF', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {requesterName}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '1rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>⇄</Typography>
        <Box sx={{ background: '#ECFDF5', borderRadius: '0.5rem', padding: '0.625rem 0.875rem', textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#10B981', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {providerName ?? 'Provider'}
          </Typography>
        </Box>
      </Box>

      {/* Description */}
      <Typography sx={{ fontSize: '0.8125rem', color: '#374151', fontFamily: 'Inter,sans-serif', mb: '0.875rem' }}>
        {description}
      </Typography>

      {/* Market value breakdown — tool exchanges only */}
      {marketValue && (
        <Box sx={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.625rem', p: '0.875rem', mb: '1rem' }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#6B7280', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.625rem' }}>
            Tool Market Values
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: requesterName, value: `$${marketValue.valueA.toFixed(0)}`, color: '#4F46E5', bg: 'rgba(79,70,229,0.08)' },
              { label: providerName ?? 'Provider', value: `$${marketValue.valueB.toFixed(0)}`, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
            ].map(p => (
              <Box key={p.label} sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: p.bg, borderRadius: '0.5rem', px: '0.75rem', py: '0.375rem' }}>
                <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: p.color, fontWeight: 600 }}>{p.label}</Typography>
                <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8125rem', color: '#1F2937', fontWeight: 700 }}>{p.value}</Typography>
              </Box>
            ))}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', ml: 'auto' }}>
              <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6B7280' }}>Gap:</Typography>
              <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.8125rem', fontWeight: 700, color: marketValue.gap > 0 ? '#D97706' : '#059669' }}>
                ${marketValue.gap.toFixed(0)}
              </Typography>
            </Box>
            <Box sx={{ width: '100%', mt: '0.375rem' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '0.25rem' }}>
                <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', color: '#9CA3AF' }}>Market Value Fairness</Typography>
                <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.7rem', fontWeight: 700, color: marketValue.score >= 0.8 ? '#059669' : marketValue.score >= 0.7 ? '#D97706' : '#DC2626' }}>
                  {Math.round(marketValue.score * 100)}%
                </Typography>
              </Box>
              <Box sx={{ height: 6, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
                <Box sx={{ height: '100%', width: `${Math.round(marketValue.score * 100)}%`, background: marketValue.score >= 0.8 ? '#059669' : marketValue.score >= 0.7 ? '#D97706' : '#DC2626', borderRadius: 3, transition: 'width 0.4s ease' }} />
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Adjustment suggestions */}
      {suggestions.length > 0 && (
        <Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.625rem' }}>
            Suggestions
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {suggestions.map((s, i) => (
              <Box key={i} sx={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                background: '#FFF', borderRadius: '0.5rem', padding: '0.75rem 0.875rem',
                border: '1px solid #E5E7EB',
              }}>
                {/* Party badge */}
                <Box sx={{
                  flexShrink: 0, padding: '0.2rem 0.5rem', borderRadius: '0.375rem',
                  background: `${PARTY_COLORS[s.party]}15`, fontFamily: 'Inter,sans-serif',
                  fontSize: '0.68rem', fontWeight: 700, color: PARTY_COLORS[s.party],
                  whiteSpace: 'nowrap', alignSelf: 'flex-start', mt: '1px',
                }}>
                  {nameOf(s.party)}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', mb: '0.2rem' }}>
                    {s.action}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                    {s.detail}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ─── Location helpers ─────────────────────────────────────────────────────────
const LOCATION_PREFIX = '__LOCATION__:';

function parseLocation(content: string): { lat: number; lng: number } | null {
  if (!content.startsWith(LOCATION_PREFIX)) return null;
  const coords = content.slice(LOCATION_PREFIX.length).split(',');
  if (coords.length !== 2) return null;
  const lat = parseFloat(coords[0]);
  const lng = parseFloat(coords[1]);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A single message bubble */
const MessageBubble: React.FC<{
  content: string;
  isMine: boolean;
  senderName: string;
  timestamp: string;
  isVideoVerified: boolean;
}> = ({ content, isMine, senderName, timestamp, isVideoVerified }) => {
  const loc = parseLocation(content);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        mb: '0.75rem',
      }}
    >
      {/* Sender label */}
      {!isMine && (
        <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', mb: '0.25rem', ml: '0.25rem' }}>
          {senderName}
        </Typography>
      )}

      {loc ? (
        /* ── Location message ── */
        isVideoVerified ? (
          /* Verified: show map link */
          <Box
            sx={{
              background: isMine ? '#EEF2FF' : '#F9FAFB',
              border: `1px solid ${isMine ? '#C7D2FE' : '#E5E7EB'}`,
              borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
              p: '0.75rem 1rem',
              maxWidth: '80%',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: GRAD,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <i className="fas fa-map-marker-alt" style={{ color: '#fff', fontSize: '0.8125rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937' }}>
                  Meeting Location Shared
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }}>
                  {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
                </Typography>
              </Box>
            </Box>
            <Box
              component="a"
              href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.375rem',
                background: GRAD,
                color: '#fff',
                borderRadius: '0.375rem',
                px: '0.75rem',
                py: '0.375rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                textDecoration: 'none',
                alignSelf: 'flex-start',
                '&:hover': { opacity: 0.88 },
              }}
            >
              <i className="fas fa-external-link-alt" style={{ fontSize: '0.625rem' }} />
              Open in Maps
            </Box>
          </Box>
        ) : (
          /* Unverified: blurred / locked */
          <Box
            sx={{
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
              p: '0.75rem 1rem',
              maxWidth: '80%',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Blurred content */}
            <Box sx={{ filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none' }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                📍 Location: 00.00000, 00.00000
              </Typography>
            </Box>
            {/* Lock overlay */}
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.375rem',
              }}
            >
              <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.75rem' }} />
              <Typography
                onClick={() => window.location.href = '/profile/edit'}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#D97706',
                  cursor: 'pointer',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                Verify to view location
              </Typography>
            </Box>
          </Box>
        )
      ) : (
        /* ── Text message ── */
        <Box
          sx={{
            background: isMine ? '#EEF2FF' : '#F9FAFB',
            border: `1px solid ${isMine ? '#C7D2FE' : '#E5E7EB'}`,
            borderRadius: isMine ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
            p: '0.625rem 0.875rem',
            maxWidth: '80%',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.875rem',
              color: '#1F2937',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {content}
          </Typography>
        </Box>
      )}

      {/* Timestamp */}
      <Typography sx={{ fontSize: '0.6875rem', color: '#9CA3AF', mt: '0.25rem', mx: '0.25rem' }}>
        {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
      </Typography>
    </Box>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const ExchangeDetail: React.FC = () => {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { user, isVideoVerified, isPhoneVerified } = useAuth();
  const queryClient = useQueryClient();

  const [msgText,           setMsgText]           = useState('');
  const [msgError,          setMsgError]          = useState('');
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState('');
  const [composerOpen,      setComposerOpen]      = useState(false);
  const [openMsgMenu,       setOpenMsgMenu]       = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [hoverRating,       setHoverRating]       = useState(0);
  // ── Apply modal state ───────────────────────────────────────────────────────
  const [applyModalOpen,    setApplyModalOpen]    = useState(false);
  const [applyType,         setApplyType]         = useState<'skill' | 'ceu'>('skill');
  const [applyInput,        setApplyInput]        = useState('');
  const [applyError,        setApplyError]        = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [countdownNow,  setCountdownNow]  = useState(Date.now());
  const [ceModalOpen,            setCeModalOpen]            = useState(false);
  const [ceModalTitle,           setCeModalTitle]           = useState('Request Skill Swap');
  const [seekingTab,             setSeekingTab]             = useState(0);
  // Which of the provider's wantedSkills the visitor is offering for (Start Exchange only)
  const [ceSelectedWantedSkill,  setCeSelectedWantedSkill]  = useState<string>('');

  // ── Data fetching ───────────────────────────────────────────────────────────
  const { data: exchange, isLoading, refetch } = useQuery({
    queryKey: ['exchange', id],
    queryFn: async () => {
      const res = await api.get(`/exchanges/${id}`);
      return res.data as Exchange;
    },
  });

  const { data: meetingData, refetch: refetchMeeting, isFetching: isMeetingFetching } = useQuery({
    queryKey: ['meeting-exchange', id],
    queryFn: async () => {
      const res = await api.get(`/meetings/exchange/${id}`);
      return res.data as {
        meeting: { _id: string; roomId: string; status: string; creatorId: string; endedAt?: string } | null;
        hasRecording: boolean;
        hasChat: boolean;
      };
    },
    enabled: !!id,
    refetchInterval: 30_000,
    retry: 1,
  });

  // Skill Swap Requests — responses to this Start Exchange (only fetched when exchange is loaded)
  const { data: swapRequests } = useQuery({
    queryKey: ['swap-requests', id],
    queryFn: async () => {
      const res = await api.get(`/exchanges?sourceId=${id}&limit=50`);
      return (res.data.exchanges ?? []) as (Exchange & { requester: { _id: string; name: string; avatar?: string; rating: number; isVerified?: boolean } })[];
    },
    enabled: !!id && !!exchange && !exchange.postId,
  });

  // ── Skill Chains ─────────────────────────────────────────────────────────────
  interface ChainExchange {
    _id: string;
    title: string;
    offering: string;
    seeking: string;
    tags?: string[];
    locationName?: string;
    onlineLink?: string;
  }
  interface ChainMember {
    exchange: ChainExchange | string;
    user: { _id: string; name: string; avatar?: string; isVerified?: boolean } | string;
    offering: string;   // snapshot label stored in chain doc
    seeking: string;    // snapshot label stored in chain doc
    status: 'pending' | 'accepted' | 'declined';
  }
  interface SkillChain {
    _id: string;
    members: ChainMember[];
    status: 'proposed' | 'active' | 'declined' | 'expired';
    createdAt: string;
  }

  const { data: chainsData, refetch: refetchChains } = useQuery<{ chains: SkillChain[] }>({
    queryKey: ['chains', id],
    queryFn: () => api.get(`/exchanges/${id}/chains`).then(r => r.data),
    enabled: !!id && !!exchange && !exchange.postId,
    refetchInterval: 30_000,
  });

  const chainRespondMutation = useMutation({
    mutationFn: ({ chainId, action }: { chainId: string; action: 'accept' | 'decline' }) =>
      api.post(`/exchanges/${id}/chains/${chainId}/respond`, { action }),
    onSuccess: () => { refetchChains(); queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const chainUndoMutation = useMutation({
    mutationFn: (chainId: string) =>
      api.post(`/exchanges/${id}/chains/${chainId}/undo-accept`),
    onSuccess: () => { refetchChains(); queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  // ── Real-time: join exchange room, append incoming messages ─────────────────
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();
    socket.emit('join-exchange', id);

    const handleMsg = () => {
      // Refetch the full exchange so messages array is up to date
      queryClient.invalidateQueries({ queryKey: ['exchange', id] });
    };

    socket.on('exchange-message', handleMsg);
    return () => {
      socket.emit('leave-exchange', id);
      socket.off('exchange-message', handleMsg);
    };
  }, [id, queryClient]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const respondMutation = useMutation({
    mutationFn: () => api.post(`/exchanges/${id}/respond`),
    onSuccess: () => refetch(),
  });

  const sendMsgMutation = useMutation({
    mutationFn: ({ content, parentId }: { content: string; parentId?: string }) =>
      api.post(`/exchanges/${id}/messages`, { content, parentId }),
    onSuccess: () => { setMsgText(''); setComposerOpen(false); refetch(); },
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/exchanges/${id}/status`, { status }),
    onSuccess: () => refetch(),
  });

  const deleteMsgMutation = useMutation({
    mutationFn: (messageId: string) => api.delete(`/exchanges/${id}/messages/${messageId}`),
    onSuccess: () => refetch(),
  });

  // Always calls /meetings/create — server is idempotent:
  // reuses the existing room for this exchange or creates one on first call.
  const joinMeetingMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/meetings/create', { exchangeId: id, title: exchange?.title });
      return res.data as { url: string; roomId: string; reused: boolean };
    },
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer');
      refetchMeeting();
    },
  });

  const undoCancelMutation = useMutation({
    mutationFn: () => api.put(`/exchanges/${id}/status`, { status: 'open' }),
    onSuccess: () => refetch(),
  });

  const reviewMutation = useMutation({
    mutationFn: (rating: number) => api.post(`/exchanges/${id}/review`, { rating }),
    onSuccess: () => { refetch(); setHoverRating(0); },
  });

  const applyMutation = useMutation({
    mutationFn: (body: { type: 'skill' | 'ceu'; skillOffer?: string; ceuOffer?: number }) =>
      api.post(`/exchanges/${id}/apply`, body),
    onSuccess: () => {
      refetch();
      setApplyModalOpen(false);
      setApplyInput('');
      setApplyError('');
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      setApplyError(err?.response?.data?.message ?? 'Failed to submit application.');
    },
  });

  const reviewAppMutation = useMutation({
    mutationFn: ({ appId, action }: { appId: string; action: 'accept' | 'reject' }) =>
      api.put(`/exchanges/${id}/applications/${appId}`, { action }),
    onSuccess: () => refetch(),
  });

  const deleteExchangeMutation = useMutation({
    mutationFn: async () => {
      // If a provider is already involved, send them a system notice first
      if (exchange?.provider) {
        await api.post(`/exchanges/${id}/messages`, {
          content: '⚠️ The requester has withdrawn this exchange request.',
        });
      }
      await api.put(`/exchanges/${id}/status`, { status: 'cancelled' });
    },
    onSuccess: () => {
      setDeleteConfirmOpen(false);
      navigate('/exchanges');
    },
  });

  // ── Auto-scroll to latest message ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [exchange?.messages?.length]);

  // ── Countdown ticker (1-second resolution for location reveal countdown) ──
  useEffect(() => {
    const id = setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Geolocation share ──────────────────────────────────────────────────────
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }
    setLocationError('');
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const content = `${LOCATION_PREFIX}${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        sendMsgMutation.mutate({ content });
        setLocationLoading(false);
      },
      () => {
        setLocationError('Could not get your location. Please allow location access.');
        setLocationLoading(false);
      }
    );
  };

  const handleSendMsg = () => {
    const trimmed = msgText.trim();
    if (!trimmed || sendMsgMutation.isPending) return;
    if (containsProfanity(trimmed)) {
      setMsgError(PROFANITY_ERROR);
      return;
    }
    setMsgError('');
    sendMsgMutation.mutate({ content: trimmed });
  };

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Layout>
        <Skeleton variant="rounded" height={400} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} />
      </Layout>
    );
  }

  if (!exchange) return null;

  // ── Derived state ──────────────────────────────────────────────────────────
  const isRequester    = exchange.requester._id === user?._id;
  const isProvider     = exchange.provider?._id === user?._id;
  const isParty        = isRequester || isProvider;
  // Only the designated provider can directly accept; everyone else uses the Apply flow
  const canRespond     = isProvider && exchange.status === 'open';
  const isProtected    = true; // all exchange types require video verification
  const needsGate      = !isPhoneVerified || !isVideoVerified;
  const canMessage     = (!exchange.postId ? !!user : isParty) && exchange.status !== 'cancelled';
  const canComplete    = isParty && exchange.status === 'active';
  const canCancel      = isParty && ['open', 'pending', 'active'].includes(exchange.status);

  // ── Review derived values ────────────────────────────────────────────────────
  // requesterRating = rating submitted BY the requester (for the provider)
  // providerRating  = rating submitted BY the provider  (for the requester)
  const myRating       = isRequester ? exchange.requesterRating : exchange.providerRating;
  const otherParty     = isRequester ? exchange.provider : exchange.requester;
  const canReview      = isParty && exchange.status === 'completed' && !myRating;

  const statusColor = statusColors[exchange.status] ?? '#6B7280';
  const typeIcon    = typeIcons[exchange.type]      ?? 'fas fa-star';

  // ── Fairness derived values ─────────────────────────────────────────────────
  const fairnessVisible = true;
  const fairnessCeuA    = exchange.ceuValue;
  const fairnessCeuB    = exchange.providerCeuValue ?? exchange.ceuValue;

  // For tool exchanges, build a market-value breakdown from the stored fields
  const fairnessMV = (() => {
    if (exchange.type !== 'tool') return null;
    const mvA = exchange.toolMarketValue;
    const mvB = exchange.seekingMarketValue;
    if (!mvA || !mvB || mvA <= 0 || mvB <= 0) return null;
    const gap   = Math.abs(mvA - mvB);
    const score = parseFloat((1 - gap / Math.max(mvA, mvB)).toFixed(4));
    return { score, valueA: mvA, valueB: mvB, gap: parseFloat(gap.toFixed(2)) };
  })();
  const fairnessSafeLabel = (exchange.fairnessLabel ?? 'fair') as 'fair' | 'needs_adjustment' | 'unfair';
  const FAIRNESS_DESC: Record<string, string> = {
    fair:             'This exchange is well-balanced. Both parties are contributing roughly equal value.',
    needs_adjustment: 'This exchange has a minor imbalance. Small adjustments would bring it to a fair balance.',
    unfair:           'This exchange is significantly unbalanced. Adjustments are strongly recommended before proceeding.',
  };
  const fairnessHigher       = Math.max(fairnessCeuA, fairnessCeuB);
  const fairnessLower        = Math.min(fairnessCeuA, fairnessCeuB);
  const fairnessFair80       = Math.round(fairnessHigher * 0.8);
  const fairnessAdjNeeded    = Math.max(0, fairnessFair80 - fairnessLower);
  const fairnessTargetCEU    = {
    A: fairnessCeuA < fairnessCeuB ? fairnessFair80 : fairnessCeuA,
    B: fairnessCeuB < fairnessCeuA ? fairnessFair80 : fairnessCeuB,
  };

  // ── Undo-cancel derived values ──────────────────────────────────────────────
  const UNDO_WINDOW_MS  = 24 * 60 * 60 * 1000; // 24 h
  const msSinceCancelled = exchange.status === 'cancelled'
    ? Date.now() - new Date(exchange.updatedAt).getTime()
    : null;
  const canUndoCancel = exchange.status === 'cancelled' && isParty
    && msSinceCancelled !== null && msSinceCancelled < UNDO_WINDOW_MS;
  const undoRemainingMs = canUndoCancel && msSinceCancelled !== null
    ? UNDO_WINDOW_MS - msSinceCancelled : 0;

  const formatUndoRemaining = (ms: number): string => {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // ── Apply derived values ────────────────────────────────────────────────────
  // A "3rd party" is authenticated, not the requester, and not the provider
  const isThirdParty = !!user && !isParty;
  const canApply     = isThirdParty && exchange.status === 'open';
  const myPendingApp = exchange.applications?.find(
    (a) => typeof a.applicant === 'object'
      ? (a.applicant as ExchangeApplication['applicant'])._id === user?._id
      : (a.applicant as unknown as string) === user?._id
  );

  // Helper: resolve sender name from ID
  const getSenderName = (senderId: string): string => {
    if (senderId === exchange.requester._id) return exchange.requester.name;
    if (exchange.provider && senderId === exchange.provider._id) return exchange.provider.name;
    return 'Unknown';
  };

  return (
    <Layout>
      {/* Back button */}
      <Box
        component="button"
        onClick={() => navigate(-1)}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6B7280',
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
          fontWeight: 500,
          padding: '0.25rem 0',
          mb: 2,
          '&:hover': { color: '#1F2937' },
        }}
      >
        <i className="fas fa-arrow-left" />
        Back
      </Box>

      {/* ── Main card ────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          overflow: 'hidden',
          mb: 2,
        }}
      >
        {/* Zone 1 — Header (post-card style) */}
        {(() => {
          const typeLabel = exchange.type === 'skill' ? 'Skill Offering'
            : exchange.type === 'tool' ? 'Tool Exchange'
            : 'Hybrid Exchange';
          const levelTag = exchange.tags?.find(t => ['beginner','intermediate','advanced','expert'].includes(t));
          const statItem = (icon: string, text: string, color = '#6B7280') => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className={`fas ${icon}`} style={{ color: '#4F46E5', fontSize: '0.72rem' }} />
              <Typography sx={{ fontSize: '0.78rem', color, fontFamily: 'Inter,sans-serif' }}>{text}</Typography>
            </Box>
          );
          return (
            <Box sx={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E5E7EB', background: 'linear-gradient(135deg, rgba(79,70,229,0.07) 0%, rgba(16,185,129,0.07) 100%)' }}>
              {/* Row 1: type badge (left) | rating stars + status (right) */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1rem' }}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', px: '0.875rem', py: '0.38rem', borderRadius: '2rem', background: GRAD, color: '#fff', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                  <i className={typeIcon} style={{ fontSize: '0.75rem' }} />
                  {typeLabel}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.18rem' }}>
                    {[1,2,3,4,5].map(s => (
                      <i key={s} className="fas fa-star" style={{ color: '#F59E0B', fontSize: '0.72rem', opacity: s <= Math.round(exchange.requester.rating) ? 1 : 0.25 }} />
                    ))}
                    <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', ml: '0.25rem' }}>
                      {exchange.requester.rating.toFixed(1)} rating
                    </Typography>
                  </Box>
                  <Box component="span" sx={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}35`, borderRadius: '2rem', px: '0.75rem', py: '0.28rem', fontSize: '0.75rem', fontWeight: 700, fontFamily: 'Inter,sans-serif', textTransform: 'capitalize' }}>
                    {exchange.status}
                  </Box>
                </Box>
              </Box>

              {/* ── Provider acceptance banner ─────────────────────── */}
              {(() => {
                const accepted  = ['pending', 'active', 'completed'].includes(exchange.status);
                const cancelled = exchange.status === 'cancelled';

                const cfg = cancelled ? {
                  bg: 'rgba(220,38,38,0.07)', border: 'rgba(220,38,38,0.2)', icon: 'fa-times-circle',
                  iconColor: '#DC2626', text: 'Exchange cancelled', subtext: null as string | null,
                } : accepted ? {
                  bg: 'rgba(5,150,105,0.07)', border: 'rgba(5,150,105,0.2)', icon: 'fa-check-circle',
                  iconColor: '#059669',
                  text: exchange.provider ? `${exchange.provider.name} accepted` : 'Provider accepted',
                  subtext: exchange.status === 'active' ? 'Exchange is now in progress'
                    : exchange.status === 'completed' ? 'Exchange completed'
                    : 'Confirmed — awaiting start',
                } : {
                  bg: 'rgba(217,119,6,0.07)', border: 'rgba(217,119,6,0.2)', icon: 'fa-clock',
                  iconColor: '#D97706',
                  text: exchange.provider
                    ? `Waiting for ${exchange.provider.name} to accept`
                    : 'Waiting for a provider to accept',
                  subtext: null as string | null,
                };

                return (
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    borderRadius: '0.625rem', px: '0.875rem', py: '0.5rem', mb: '1rem',
                  }}>
                    <i className={`fas ${cfg.icon}`} style={{ color: cfg.iconColor, fontSize: '0.9rem', flexShrink: 0 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', fontWeight: 700, color: '#1F2937', lineHeight: 1.3 }}>
                        {cfg.text}
                      </Typography>
                      {cfg.subtext && (
                        <Typography sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4 }}>
                          {cfg.subtext}
                        </Typography>
                      )}
                    </Box>
                    {accepted && exchange.provider && (
                      <Box
                        onClick={() => navigate(`/profile/${exchange.provider!._id}`)}
                        sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', '&:hover span': { color: '#4F46E5' } }}
                      >
                        <Box sx={{
                          width: 28, height: 28, borderRadius: '50%',
                          background: exchange.provider.avatar ? 'transparent' : GRAD,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden', border: '2px solid #FFF', flexShrink: 0,
                        }}>
                          {exchange.provider.avatar
                            ? <Box component="img" src={exchange.provider.avatar} alt={exchange.provider.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontSize: '0.7rem', fontWeight: 700, color: '#FFF' }}>{exchange.provider.name[0]}</Typography>
                          }
                        </Box>
                        <Box component="span" sx={{ fontFamily: 'Inter,sans-serif', fontSize: '0.78rem', fontWeight: 600, color: '#374151', transition: 'color .15s' }}>
                          {exchange.provider.name}
                        </Box>
                      </Box>
                    )}
                  </Box>
                );
              })()}

              {/* Row 2: avatar with verified dot + author info */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                {/* Avatar with online/verified indicator */}
                <OnlineAvatar
                  userId={exchange.requester._id}
                  src={exchange.requester.avatar}
                  isVerified={exchange.requester.isVerified}
                  sx={{ width: 52, height: 52, fontSize: '1rem', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => navigate(`/profile/${exchange.requester._id}`)}
                >
                  {exchange.requester.name[0]}
                </OnlineAvatar>

                {/* Name, subtitle, stats */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Name + shield */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', mb: '0.125rem' }}>
                    <Typography
                      onClick={() => navigate(`/profile/${exchange.requester._id}`)}
                      sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', cursor: 'pointer', lineHeight: 1.3, '&:hover': { color: '#4F46E5' } }}
                    >
                      {exchange.requester.name}
                    </Typography>
                    {exchange.requester.isVerified && (
                      <i className="fas fa-shield-alt" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
                    )}
                  </Box>

                  {/* Subtitle: role · time */}
                  <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>
                    Requester · {formatDistanceToNow(new Date(exchange.createdAt), { addSuffix: true })}
                  </Typography>

                  {/* Stats row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '1.1rem', flexWrap: 'wrap' }}>
                    {statItem('fa-star', `${exchange.requester.rating.toFixed(1)} rating`, '#D97706')}
                    {statItem('fa-comment-alt', `${exchange.messages?.length ?? 0} messages`)}
                    {levelTag && statItem('fa-chart-bar', levelTag)}
                  </Box>

                  {/* Provider strip — shown if matched */}
                  {exchange.provider && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mt: '0.75rem', pt: '0.75rem', borderTop: '1px solid #F3F4F6' }}>
                      <i className="fas fa-exchange-alt" style={{ color: '#9CA3AF', fontSize: '0.72rem' }} />
                      <Box sx={{ position: 'relative', flexShrink: 0 }}>
                        <OnlineAvatar userId={exchange.provider._id} src={exchange.provider.avatar} isVerified={exchange.provider.isVerified} sx={{ width: 28, height: 28, fontSize: '0.65rem', cursor: 'pointer' }} onClick={() => navigate(`/profile/${exchange.provider!._id}`)}>
                          {exchange.provider.name[0]}
                        </OnlineAvatar>
                      </Box>
                      <Typography onClick={() => navigate(`/profile/${exchange.provider!._id}`)} sx={{ fontWeight: 600, fontSize: '0.8375rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
                        {exchange.provider.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>· Provider</Typography>
                      {exchange.provider.rating > 0 && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#D97706', fontFamily: 'Inter,sans-serif', ml: 'auto' }}>
                          ★ {exchange.provider.rating.toFixed(1)}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })()}

        {/* Zone 2 — Content */}
        <Box sx={{ background: '#FFFFFF', padding: '1.5rem' }}>
          {/* Exchange title */}
          <Typography
            component="h1"
            sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#1F2937', lineHeight: 1.3, textTransform: 'capitalize', mb: exchange.type === 'tool' ? '0.625rem' : '1.25rem' }}
          >
            {exchange.title}
          </Typography>
          {exchange.type === 'tool' && (
            <Box sx={{ mb: '1.25rem' }}>
              {/^permanent/i.test(exchange.seeking ?? '') ? (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', border: '1px solid rgba(79,70,229,0.25)', borderRadius: '2rem', px: '0.875rem', py: '0.3rem', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-exchange-alt" style={{ fontSize: '0.7rem' }} />
                  Permanent Exchange
                </Box>
              ) : (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '2rem', px: '0.875rem', py: '0.3rem', fontSize: '0.78rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-undo-alt" style={{ fontSize: '0.7rem' }} />
                  Borrow / Return
                </Box>
              )}
            </Box>
          )}

          {/* Meta details row */}
          {(() => {
            const locTag = exchange.tags?.find(t => ['public', 'private', 'online'].includes(t));
            const locLabel = locTag === 'public' ? { icon: 'fa-map-marker-alt', text: 'Public meetup', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' }
              : locTag === 'private' ? { icon: 'fa-lock', text: 'Private location', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' }
              : locTag === 'online' ? { icon: 'fa-video', text: 'Online / Remote', color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE' }
              : null;
            return (locLabel || exchange.scheduledDate || exchange.completedDate || exchange.providerCeuValue) ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', mb: '1.25rem' }}>
                {locLabel && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.5rem', background: locLabel.bg, border: `1px solid ${locLabel.border}`, borderRadius: '0.5rem' }}>
                    <i className={`fas ${locLabel.icon}`} style={{ color: locLabel.color, fontSize: '0.8rem' }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: locLabel.color, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{locLabel.text}</Typography>
                  </Box>
                )}
                {exchange.scheduledDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.5rem', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '0.5rem' }}>
                    <i className="fas fa-calendar-alt" style={{ color: '#8B5CF6', fontSize: '0.8rem' }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6D28D9', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                      Scheduled: {format(new Date(exchange.scheduledDate), 'EEE, MMM d yyyy · h:mm a')}
                    </Typography>
                  </Box>
                )}
                {exchange.completedDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.5rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.5rem' }}>
                    <i className="fas fa-check-circle" style={{ color: '#059669', fontSize: '0.8rem' }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#065F46', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                      Completed: {format(new Date(exchange.completedDate), 'EEE, MMM d yyyy')}
                    </Typography>
                  </Box>
                )}
                {exchange.type !== 'skill' && exchange.providerCeuValue != null && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', px: '0.875rem', py: '0.5rem', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: '0.5rem' }}>
                    <i className="fas fa-coins" style={{ color: '#8B5CF6', fontSize: '0.8rem' }} />
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6D28D9', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                      Provider offering: {exchange.providerCeuValue} CEU
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : null;
          })()}

          {/* Offering / Seeking grid */}
          {(() => {
            const titleParts = exchange.title.split(' ↔ ');
            const offeringTitle = titleParts[0]?.trim() ?? '';
            const dashIdx = exchange.offering.indexOf(' — ');
            const embeddedDesc = dashIdx > -1 ? exchange.offering.slice(dashIdx + 3).trim() : '';
            // Prefer the dedicated field (no length limit); fall back to embedded string
            const offeringDesc = (exchange as any).offeringDescription || embeddedDesc;
            const seekingTitle = titleParts[1]?.trim() ?? exchange.seeking;
            const isTool = exchange.type === 'tool';

            // ── Deposit rates (mirrors BorrowRequestDialog) ──────────────────
            const DEPOSIT_RATES: Record<string, number> = { New: 0.30, Excellent: 0.25, Good: 0.20, Fair: 0.15 };
            const condColor: Record<string, string> = { New: '#7C3AED', Excellent: '#059669', Good: '#2563EB', Fair: '#D97706' };
            const condIcon:  Record<string, string> = { New: 'fa-star', Excellent: 'fa-medal', Good: 'fa-thumbs-up', Fair: 'fa-info-circle' };

            const ToolMeta: React.FC<{
              condition?: string; marketValue?: number;
              specs?: { name: string; details: string[] }[];
              accentColor: string;
            }> = ({ condition, marketValue, specs, accentColor }) => {
              const depRate  = DEPOSIT_RATES[condition ?? ''] ?? null;
              const depCeu   = marketValue && depRate ? Math.round(marketValue * depRate) : null;
              return (
                <>
                  {/* Condition + Market Value row */}
                  {(condition || marketValue != null) && (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.5rem', mt: '0.75rem', mb: '0.25rem' }}>
                      {condition && (
                        <Box sx={{ background: '#FFF', borderRadius: '0.625rem', p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '0.5rem', background: `${condColor[condition] ?? accentColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`fas ${condIcon[condition] ?? 'fa-wrench'}`} style={{ color: condColor[condition] ?? accentColor, fontSize: '0.7rem' }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Condition</Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>{condition}</Typography>
                            {depRate && <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Deposit rate {(depRate * 100).toFixed(0)}%</Typography>}
                          </Box>
                        </Box>
                      )}
                      {(marketValue != null || depCeu != null) && (
                        <Box sx={{ background: '#FFF', borderRadius: '0.625rem', p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          <Box sx={{ width: 28, height: 28, borderRadius: '0.5rem', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fas fa-coins" style={{ color: '#059669', fontSize: '0.7rem' }} />
                          </Box>
                          <Box>
                            <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Market Value</Typography>
                            <Typography sx={{ fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                              {marketValue ? `$${marketValue.toFixed(2)}` : 'Contact owner'}
                            </Typography>
                            {depCeu != null && <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Deposit ≈ {depCeu} CEU</Typography>}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  )}
                  {/* Tool Specifications */}
                  {specs && specs.length > 0 && (
                    <Box sx={{ mt: '0.75rem' }}>
                      <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: '0.4rem' }}>
                        Tool Specifications
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.5rem' }}>
                        {specs.map((s, si) => (
                          <Box key={si} sx={{ background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '0.5rem 0.625rem' }}>
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: accentColor, fontFamily: 'Inter,sans-serif', mb: '0.2rem' }}>{s.name}</Typography>
                            {s.details.map((d, di) => (
                              <Box key={di} sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                <Box sx={{ width: 5, height: 5, borderRadius: '50%', background: '#9CA3AF', flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.75rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>{d}</Typography>
                              </Box>
                            ))}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </>
              );
            };

            return (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem', mb: '1.5rem', alignItems: 'stretch' }}>
                {/* Offering */}
                <Box sx={{ background: '#EEF2FF', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem' }}>
                    <i className="fas fa-gift" style={{ color: '#4F46E5', fontSize: '0.8125rem' }} />
                    <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {isTool ? 'Requester\'s Tool' : 'Offering'}
                    </Typography>
                  </Box>
                  {offeringTitle && (
                    <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, mb: '0.75rem' }}>
                      {offeringTitle}
                    </Typography>
                  )}
                  {!isTool && (() => {
                    // Build the avatar fallback used when images are absent or all fail to load
                    const avatarFallback = (
                      <Box sx={{ mb: '0.75rem' }}>
                        <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: '0.4rem' }}>
                          Requester
                        </Typography>
                        <Box sx={{ borderRadius: '0.75rem', height: 160, background: 'rgba(79,70,229,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(79,70,229,0.12)' }}>
                          {exchange.requester.avatar ? (
                            <Box component="img"
                              src={exchange.requester.avatar}
                              alt={exchange.requester.name}
                              onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                  e.currentTarget.style.display = 'none';
                                  parent.innerHTML = `<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#4F46E5,#10B981);display:flex;align-items:center;justify-content:center"><span style="color:#fff;font-size:2rem;font-weight:700">${exchange.requester.name.charAt(0).toUpperCase()}</span></div>`;
                                }
                              }}
                              sx={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(79,70,229,0.25)' }}
                            />
                          ) : (
                            <Box sx={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#4F46E5,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '2rem', fontFamily: 'Inter,sans-serif' }}>
                                {exchange.requester.name.charAt(0).toUpperCase()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.375rem', textAlign: 'center', fontStyle: 'italic' }}>
                          Upload photos when creating an exchange to showcase your skill
                        </Typography>
                      </Box>
                    );
                    return (
                      <ExchangeMediaGallery
                        media={exchange.images ?? []}
                        label={exchange.images?.length ? 'Media' : undefined}
                        fallback={avatarFallback}
                      />
                    );
                  })()}
                  {offeringDesc && !isTool && (
                    <Box sx={{ mt: '0.25rem' }}>
                      <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: '0.4rem' }}>
                        Description
                      </Typography>
                      <RichContent text={offeringDesc} />
                    </Box>
                  )}
                  {isTool && exchange.seekingDescription && (
                    <Box sx={{ mt: '0.5rem' }}>
                      <RichContent text={exchange.seekingDescription} />
                    </Box>
                  )}

                  {/* ── Tool meta (condition / market value / specs) ── */}
                  {isTool && (
                    <ToolMeta
                      condition={exchange.toolCondition}
                      marketValue={exchange.toolMarketValue}
                      specs={exchange.toolSpecs}
                      accentColor="#4F46E5"
                    />
                  )}

                  {/* ── CEU Breakdown — CEU exchanges only ── */}
                  {!isTool && /^\d+\s*CEU$/i.test(exchange.offering ?? '') && (
                    <CeuBreakdownPanel
                      ceuValue={exchange.ceuValue ?? 0}
                      timeStart={exchange.timeStart}
                      timeEnd={exchange.timeEnd}
                      sessions={exchange.sessions}
                      tags={exchange.tags}
                      offering={exchange.offering}
                    />
                  )}
                </Box>

                {/* Seeking */}
                {(() => {
                  const skills = (!isTool && exchange.wantedSkills && exchange.wantedSkills.length > 0)
                    ? exchange.wantedSkills
                    : null;
                  const safeTab = skills ? Math.min(seekingTab, skills.length - 1) : 0;
                  const activeSkill = skills?.[safeTab];

                  // Slice seekingImages per skill using stored imageCount
                  const allSeekingImgs = exchange.seekingImages ?? [];
                  let imgCursor = 0;
                  const skillImgSlices: string[][] = skills
                    ? skills.map(sk => {
                        const count = sk.imageCount ?? 0;
                        const slice = allSeekingImgs.slice(imgCursor, imgCursor + count);
                        imgCursor += count;
                        return slice;
                      })
                    : [];
                  // Any leftover images (e.g. old data without imageCount) fall to first skill
                  if (skills && imgCursor < allSeekingImgs.length) {
                    skillImgSlices[0] = [...(skillImgSlices[0] ?? []), ...allSeekingImgs.slice(imgCursor)];
                  }
                  const activeImages = skills ? (skillImgSlices[safeTab] ?? []) : allSeekingImgs;

                  return (
                    <Box sx={{ background: '#ECFDF5', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: skills && skills.length > 1 ? '0.5rem' : '0.75rem' }}>
                        <i className="fas fa-search" style={{ color: '#10B981', fontSize: '0.8125rem' }} />
                        <Typography component="span" sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#10B981', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {isTool ? 'Provider\'s Tool' : 'Seeking'}
                        </Typography>
                        {skills && skills.length > 1 && (
                          <Typography component="span" sx={{ ml: 'auto', fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                            {skills.length} skills wanted
                          </Typography>
                        )}
                      </Box>

                      {/* Tab nav — only when multiple skills */}
                      {skills && skills.length > 1 && (
                        <Box sx={{ display: 'flex', gap: '0.375rem', mb: '0.875rem', flexWrap: 'wrap' }}>
                          {skills.map((sk, i) => (
                            <Box
                              key={i}
                              component="button"
                              onClick={() => setSeekingTab(i)}
                              sx={{
                                cursor: 'pointer', border: 'none', outline: 'none',
                                px: '0.75rem', py: '0.3rem', borderRadius: '2rem',
                                fontSize: '0.78rem', fontWeight: 600, fontFamily: 'Inter,sans-serif',
                                transition: 'all 0.15s',
                                background: safeTab === i ? '#10B981' : 'rgba(16,185,129,0.1)',
                                color: safeTab === i ? '#fff' : '#059669',
                                boxShadow: safeTab === i ? '0 2px 6px rgba(16,185,129,0.3)' : 'none',
                              }}
                            >
                              {sk.name || `Skill ${i + 1}`}
                            </Box>
                          ))}
                        </Box>
                      )}

                      {/* Single-skill or current tab content */}
                      {skills ? (
                        <>
                          <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, mb: '0.375rem' }}>
                            {activeSkill?.name}
                          </Typography>
                          {activeSkill?.proficiency && (
                            <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(16,185,129,0.1)', color: '#059669', borderRadius: '2rem', px: '0.6rem', py: '0.2rem', fontSize: '0.72rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', mb: '0.5rem', alignSelf: 'flex-start' }}>
                              <i className="fas fa-user-graduate" style={{ fontSize: '0.65rem' }} />
                              {activeSkill.proficiency}
                            </Box>
                          )}
                          {activeImages.length > 0 && (
                            <ExchangeMediaGallery media={activeImages} />
                          )}
                          {activeSkill?.description && (
                            <Box sx={{ mt: '0.25rem' }}>
                              <RichContent text={activeSkill.description} />
                            </Box>
                          )}
                        </>
                      ) : (
                        <>
                          {seekingTitle && (
                            <Typography sx={{ fontSize: '1.2rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter, sans-serif', lineHeight: 1.4, mb: '0.5rem' }}>
                              {seekingTitle}
                            </Typography>
                          )}
                          {exchange.seekingImages && exchange.seekingImages.length > 0 && (
                            <ExchangeMediaGallery media={exchange.seekingImages} />
                          )}
                          {exchange.seekingDescription && (
                            <Box sx={{ mt: '0.5rem' }}>
                              <RichContent text={exchange.seekingDescription} />
                            </Box>
                          )}
                        </>
                      )}

                      {/* ── Tool meta for provider's tool ── */}
                      {isTool && (
                        <ToolMeta
                          condition={exchange.seekingCondition}
                          marketValue={exchange.seekingMarketValue}
                          specs={exchange.seekingSpecs}
                          accentColor="#10B981"
                        />
                      )}
                    </Box>
                  );
                })()}
              </Box>
            );
          })()}

          {/* Public Negotiation Terms — hidden for tool exchanges */}
          {exchange.type !== 'tool' && (() => {
            const locTag = exchange.tags?.find(t => ['public','private','online'].includes(t));
            const locLabel = locTag === 'online' ? 'Online / Remote'
              : locTag === 'public' ? 'Public meetup'
              : locTag === 'private' ? 'Private location'
              : null;
            const locIcon = locTag === 'online' ? 'fa-video'
              : locTag === 'public' ? 'fa-map-marker-alt'
              : 'fa-lock';
            const typeLabel = exchange.type === 'skill' ? 'Skill-for-Skill' : 'Hybrid Exchange';
            const terms: { icon: string; label: string; value: string; color?: string }[] = [
              { icon: 'fa-exchange-alt', label: 'Exchange Type', value: typeLabel },
              ...(exchange.type !== 'skill' ? [{ icon: 'fa-coins', label: 'CEU Value', value: `${exchange.ceuValue ?? 1} CEU`, color: '#7C3AED' }] : []),
              ...(exchange.type !== 'skill' && exchange.providerCeuValue != null ? [{ icon: 'fa-coins', label: 'Provider Offering', value: `${exchange.providerCeuValue} CEU`, color: '#059669' }] : []),
              { icon: 'fa-info-circle', label: 'Status', value: exchange.status.charAt(0).toUpperCase() + exchange.status.slice(1) },
            ];
            return (
              <Box sx={{ mb: '1.5rem', p: '1.25rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.75rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1rem' }}>
                  <i className="fas fa-file-contract" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Inter, sans-serif' }}>
                    Public Negotiation Terms
                  </Typography>
                </Box>
                {/* Terms text entered in the form */}
                {(() => {
                  const isAutoGenerated = /^Exchange:\s/.test(exchange.description ?? '');
                  const termsText = !isAutoGenerated ? exchange.description?.trim() : '';
                  return (
                    <Box sx={{ mb: '1rem', p: '0.875rem', background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem' }}>
                      <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', mb: '0.4rem' }}>
                        Terms
                      </Typography>
                      {termsText ? (
                        <RichContent text={termsText} />
                      ) : (
                        <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontStyle: 'italic' }}>
                          No specific terms entered.
                        </Typography>
                      )}
                    </Box>
                  );
                })()}

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                  {terms.map(t => (
                    <Box key={t.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '0.375rem', background: '#EEF2FF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: '0.05rem' }}>
                        <i className={`fas ${t.icon}`} style={{ color: t.color ?? '#4F46E5', fontSize: '0.75rem' }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.3 }}>{t.label}</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', fontWeight: 600, lineHeight: 1.4 }}>{t.value}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })()}

          {/* Exchange Location & Schedule — separate section, stacked vertically */}
          {isParty && (() => {
            const locTag = exchange.tags?.find(t => ['public','private','online'].includes(t));
            const isOnline  = locTag === 'online';
            const isPrivate = locTag === 'private';

            // ── Private location 24-hour reveal window ──────────────────────
            // The location is only shown to parties within 24 h before the
            // scheduled date and hidden again 24 h after it.
            const scheduledMs = exchange.scheduledDate
              ? new Date(exchange.scheduledDate).getTime()
              : exchange.startDate
                ? new Date(exchange.startDate).getTime()
                : null;
            const now = countdownNow;
            const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h
            const privateRevealed = isPrivate && isRequester && scheduledMs !== null
              && now >= scheduledMs - WINDOW_MS   // within 24 h before
              && now <= scheduledMs + WINDOW_MS;  // and up to 24 h after

            // Hide private location completely until 24 h before (and after 24 h past meeting)
            if (isPrivate && !privateRevealed) return null;

            const locIcon = isOnline ? 'fa-video' : 'fa-map-marker-alt';

            // Strip '[Private] ' prefix for display when revealed
            const rawLocName = exchange.locationName ?? '';
            const strippedPrivateName = rawLocName.startsWith('[Private] ')
              ? rawLocName.slice('[Private] '.length)
              : rawLocName;

            const locPrimary = isOnline
              ? 'Online / Remote'
              : isPrivate
                ? privateRevealed && strippedPrivateName && !/^\[Private/.test(strippedPrivateName)
                  ? strippedPrivateName
                  : 'Private Location'
                : rawLocName && !/^\[Private/.test(rawLocName)
                  ? rawLocName
                  : locTag === 'public' ? 'Public Meetup'
                  : 'Not specified';

            const locSecondary = isOnline
              ? null
              : isPrivate
                ? privateRevealed
                  ? scheduledMs
                    ? `Location revealed · hidden again ${format(new Date(scheduledMs + WINDOW_MS), 'MMM d, h:mm a')}`
                    : 'Location revealed for this exchange'
                  : scheduledMs
                    ? now < scheduledMs - WINDOW_MS
                      ? `Revealed 24 h before · ${format(new Date(scheduledMs - WINDOW_MS), 'MMM d, h:mm a')}`
                      : 'Location window has closed'
                    : 'Secure location details shared 24 h before the scheduled date'
                : locTag === 'public'
                  ? exchange.locationName && !/^Public location/.test(exchange.locationName)
                    ? 'Public meetup'
                    : 'Meet in a safe public space'
                  : '';

            // Build a Google Maps URL — public in-person locations, or private during reveal window
            const mapsEligible = !isOnline && locPrimary !== 'Not specified' && locPrimary !== 'Private Location';
            const mapsUrl = mapsEligible
              ? exchange.location?.coordinates
                ? `https://www.google.com/maps/dir/?api=1&destination=${exchange.location.coordinates[1]},${exchange.location.coordinates[0]}`
                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locPrimary)}`
              : null;

            const rows: { icon: string; title: string; primary: string; secondary: string | null; isLink?: boolean; mapsUrl?: string | null; privateRevealed?: boolean }[] = [
              { icon: locIcon, title: 'Exchange Location', primary: locPrimary, secondary: locSecondary, isLink: isOnline && !!exchange.onlineLink, mapsUrl, privateRevealed: isPrivate ? privateRevealed : undefined },
            ];

            const displayTags = (exchange.tags ?? []).filter(t => !['public','private','online'].includes(t));
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', mb: '1.5rem' }}>
                {rows.map(({ icon, title, primary, secondary, isLink, mapsUrl, privateRevealed }) => (
                  <Box key={title} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', p: '1rem 1.25rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.75rem' }}>
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
                        {mapsUrl ? (
                          <Box
                            component="a"
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              color: '#4F46E5', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              '&:hover': { textDecoration: 'underline', color: '#4338CA' },
                            }}
                          >
                            <i className="fas fa-map-marker-alt" style={{ fontSize: '0.75rem' }} />
                            {primary}
                            <i className="fas fa-external-link-alt" style={{ fontSize: '0.65rem', opacity: 0.7 }} />
                          </Box>
                        ) : primary}
                        {secondary && (
                          <>
                            <Box component="span" sx={{ mx: '0.35rem', color: '#D1D5DB' }}>•</Box>
                            {secondary}
                          </>
                        )}
                      </Typography>
                      {/* Private location reveal badge */}
                      {privateRevealed === true && (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', mt: '0.5rem', px: '0.6rem', py: '0.25rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '0.375rem' }}>
                          <i className="fas fa-unlock-alt" style={{ color: '#059669', fontSize: '0.7rem' }} />
                          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#059669', fontFamily: 'Inter,sans-serif' }}>
                            Location revealed for 24 h
                          </Typography>
                        </Box>
                      )}
                      {/* Online meeting link — both parties see the same link */}
                      {isLink && isParty && exchange.onlineLink && (
                        <Box sx={{ mt: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {/* Copyable link display */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '0.5rem 0.75rem' }}>
                            <i className="fas fa-video" style={{ color: '#10B981', fontSize: '0.8rem', flexShrink: 0 }} />
                            <Box sx={{ fontSize: '0.78rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1, wordBreak: 'break-all' }}>
                              {exchange.onlineLink}
                            </Box>
                            <Box
                              component="button"
                              onClick={() => { navigator.clipboard.writeText(exchange.onlineLink!); }}
                              sx={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '0.8rem', flexShrink: 0, '&:hover': { color: '#4F46E5' } }}
                            >
                              <i className="fas fa-copy" />
                            </Box>
                          </Box>
                          {/* Join button */}
                          <Box
                            component="a"
                            href={exchange.onlineLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              background: GRAD, color: '#fff', border: 'none', borderRadius: '0.5rem',
                              px: '0.875rem', py: '0.45rem', fontSize: '0.8125rem', fontWeight: 600,
                              fontFamily: 'Inter,sans-serif', textDecoration: 'none', cursor: 'pointer',
                              width: 'fit-content',
                              '&:hover': { opacity: 0.88 } }}
                          >
                            <i className="fas fa-video" />
                            Join Meeting
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                ))}
                {/* Tags — below Exchange Schedule */}
                {displayTags.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', pt: '0.25rem' }}>
                    {displayTags.map(tag => (
                      <Box key={tag} component="span" sx={{ background: '#EEF2FF', color: '#4F46E5', borderRadius: '2rem', px: '0.625rem', py: '0.25rem', fontSize: '0.72rem', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                        #{tag}
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })()}

          {/* Availability Calendar — Exchange Schedule */}
          <ExchangeAvailabilityCalendar exchange={exchange} />

          {/* Fairness Panel — visible once a provider has responded */}
          {fairnessVisible && (
            <FairnessPanel
              ceuA={fairnessCeuA}
              ceuB={fairnessCeuB}
              score={exchange.fairnessScore}
              label={fairnessSafeLabel}
              description={FAIRNESS_DESC[fairnessSafeLabel] ?? FAIRNESS_DESC.fair}
              adjustmentNeeded={fairnessAdjNeeded}
              targetCEU={fairnessTargetCEU}
              suggestions={exchange.fairnessSuggestions ?? []}
              requesterName={exchange.requester.name}
              providerName={exchange.provider?.name}
              marketValue={fairnessMV}
            />
          )}


        </Box>

        {/* Zone 2b — Recordings panel (parties only, when meeting exists) */}
        {isParty && meetingData?.meeting && (
          <Box sx={{ borderTop: '1px solid #E5E7EB', background: '#FAFAFA', px: '1.5rem', py: '1.25rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '1rem' }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-film" style={{ color: '#fff', fontSize: '0.8rem' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', flex: 1 }}>
                Meeting Recordings
              </Typography>
              <Box component="button"
                onClick={() => { refetchMeeting(); }}
                disabled={isMeetingFetching}
                sx={{ background: 'none', border: 'none', color: isMeetingFetching ? '#4F46E5' : '#9CA3AF',
                  cursor: isMeetingFetching ? 'default' : 'pointer', fontSize: '0.75rem',
                  fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  '&:hover': !isMeetingFetching ? { color: '#4F46E5' } : {} }}>
                <i className={isMeetingFetching ? 'fas fa-spinner fa-spin' : 'fas fa-sync-alt'} />
                {isMeetingFetching ? 'Refreshing…' : 'Refresh'}
              </Box>
            </Box>

            {meetingData.meeting.status === 'ended' ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {/* Recording download */}
                {meetingData.hasRecording ? (
                  <Box component="a"
                    href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/meetings/${meetingData.meeting.roomId}/recording`}
                    download="recording.mp4"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '1rem', py: '0.625rem', background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '0.625rem', color: '#4F46E5', fontWeight: 600, fontSize: '0.8375rem', fontFamily: 'Inter,sans-serif', textDecoration: 'none', '&:hover': { background: '#E0E7FF' } }}>
                    <i className="fas fa-download" />
                    Download Recording
                    <Box component="span" sx={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 400 }}>.mp4</Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '1rem', py: '0.625rem', background: '#F3F4F6', borderRadius: '0.625rem', color: '#9CA3AF', fontSize: '0.8375rem', fontFamily: 'Inter,sans-serif' }}>
                    <i className="fas fa-clock" /> Recording processing…
                  </Box>
                )}

                {/* Chat export download */}
                {meetingData.hasChat ? (
                  <Box component="a"
                    href={`${import.meta.env.VITE_API_URL ?? 'http://localhost:5000'}/api/meetings/${meetingData.meeting.roomId}/chat`}
                    download="chat.json"
                    sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '1rem', py: '0.625rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '0.625rem', color: '#059669', fontWeight: 600, fontSize: '0.8375rem', fontFamily: 'Inter,sans-serif', textDecoration: 'none', '&:hover': { background: '#D1FAE5' } }}>
                    <i className="fas fa-comments" />
                    Download Chat Log
                    <Box component="span" sx={{ fontSize: '0.7rem', color: '#6B7280', fontWeight: 400 }}>.json</Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '1rem', py: '0.625rem', background: '#F3F4F6', borderRadius: '0.625rem', color: '#9CA3AF', fontSize: '0.8375rem', fontFamily: 'Inter,sans-serif' }}>
                    <i className="fas fa-comment-slash" /> No chat exported yet
                  </Box>
                )}

                {meetingData.meeting.endedAt && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', alignSelf: 'center' }}>
                    Ended {formatDistanceToNow(new Date(meetingData.meeting.endedAt), { addSuffix: true })}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulse 1.5s infinite' }} />
                <Typography sx={{ fontSize: '0.8375rem', color: '#059669', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                  Meeting is live — recording in progress
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Zone 3 — Actions */}
        <Box sx={{ background: '#F9FAFB', padding: '1rem 1.5rem', borderTop: '1px solid #E5E7EB' }}>

          {/* ── REQUESTER actions ─────────────────────────────────────────────── */}
          {isRequester && !['cancelled','completed'].includes(exchange.status) && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                {exchange.status === 'open' ? 'Your exchange request is open' : `Exchange is ${exchange.status}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                {canComplete && (
                  <Box component="button" onClick={() => statusMutation.mutate('completed')} disabled={statusMutation.isPending}
                    sx={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', px: '1rem', py: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { opacity: 0.88 }, opacity: statusMutation.isPending ? 0.6 : 1 }}>
                    <i className="fas fa-check-circle" /> Mark Completed
                  </Box>
                )}
                <Box component="button" onClick={() => setDeleteConfirmOpen(true)}
                  sx={{ background: 'none', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '0.5rem', px: '1rem', py: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { background: '#FEF2F2' } }}>
                  <i className="fas fa-trash-alt" /> Delete Request
                </Box>
              </Box>
            </Box>
          )}

          {/* ── PROVIDER: not yet responded — Accept + Decline ────────────────── */}
          {canRespond && (
            needsGate ? (
              !isPhoneVerified ? (
                <PhoneVerificationGate feature="Responding to Exchanges" description="Verify your mobile number to respond to this exchange." compact />
              ) : (
                <VideoVerificationGate feature={exchange.type === 'skill' ? 'Skill Exchange' : exchange.type === 'tool' ? 'Tool Exchange' : 'Hybrid Exchange'} compact />
              )
            ) : (
              <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Box component="button" onClick={() => statusMutation.mutate('cancelled')} disabled={statusMutation.isPending}
                  sx={{ flex: '0 0 auto', background: 'none', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '0.5rem', px: '1.25rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { background: '#FEF2F2' }, opacity: statusMutation.isPending ? 0.6 : 1 }}>
                  <i className="fas fa-times" /> Decline
                </Box>
                <Box component="button" onClick={() => respondMutation.mutate()} disabled={respondMutation.isPending}
                  sx={{ flex: 1, background: GRAD, color: '#fff', border: 'none', borderRadius: '0.5rem', px: '1.25rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: respondMutation.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: respondMutation.isPending ? 0.7 : 1, transition: 'opacity 0.15s', '&:hover': !respondMutation.isPending ? { opacity: 0.9 } : {} }}>
                  <i className="fas fa-handshake" />
                  {respondMutation.isPending ? 'Accepting…' : 'Accept Request'}
                </Box>
              </Box>
            )
          )}

          {/* ── PROVIDER: already matched — Complete + Cancel ─────────────────── */}
          {isProvider && !canRespond && !['cancelled','completed'].includes(exchange.status) && (
            <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                You are providing in this exchange
              </Typography>
              <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                {canComplete && (
                  <Box component="button" onClick={() => statusMutation.mutate('completed')} disabled={statusMutation.isPending}
                    sx={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', px: '1rem', py: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { opacity: 0.88 }, opacity: statusMutation.isPending ? 0.6 : 1 }}>
                    <i className="fas fa-check-circle" /> Mark Completed
                  </Box>
                )}
                <Box component="button" onClick={() => statusMutation.mutate('cancelled')} disabled={statusMutation.isPending}
                  sx={{ background: 'none', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '0.5rem', px: '1rem', py: '0.5rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { background: '#FEF2F2' }, opacity: statusMutation.isPending ? 0.6 : 1 }}>
                  <i className="fas fa-times-circle" /> Cancel Exchange
                </Box>
              </Box>
            </Box>
          )}

          {/* ── Completed: star rating ───────────────────────────────────────── */}
          {exchange.status === 'completed' && (
            <Box>
              {/* Completion badge */}
              <Typography sx={{ fontSize: '0.875rem', color: '#059669', fontFamily: 'Inter,sans-serif', textAlign: 'center', fontWeight: 600, mb: '1rem' }}>
                ✅ This exchange has been completed.
              </Typography>

              {/* Rating prompt — shown to parties who haven't rated yet */}
              {isParty && (
                <Box sx={{ background: canReview ? 'linear-gradient(135deg,rgba(79,70,229,0.04),rgba(16,185,129,0.04))' : '#F9FAFB', border: `1px solid ${canReview ? 'rgba(79,70,229,0.18)' : '#E5E7EB'}`, borderRadius: '0.75rem', p: '1.25rem', textAlign: 'center' }}>
                  {canReview ? (
                    <>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', mb: '0.25rem' }}>
                        How was your experience with{' '}
                        <Box component="span" sx={{ color: '#4F46E5' }}>{otherParty?.name ?? 'your partner'}</Box>?
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mb: '1rem' }}>
                        Your rating helps build trust in the community
                      </Typography>
                      {/* Star row */}
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', mb: '0.75rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Box
                            key={star}
                            component="button"
                            onClick={() => !reviewMutation.isPending && reviewMutation.mutate(star)}
                            onMouseEnter={() => setHoverRating(star)}
                            onMouseLeave={() => setHoverRating(0)}
                            sx={{
                              background: 'none', border: 'none', p: '0.25rem', cursor: reviewMutation.isPending ? 'not-allowed' : 'pointer',
                              fontSize: '1.75rem', lineHeight: 1, transition: 'transform 0.1s',
                              color: star <= (hoverRating || 0) ? '#FBBF24' : '#D1D5DB',
                              transform: star <= (hoverRating || 0) ? 'scale(1.2)' : 'scale(1)',
                              '&:hover': { transform: 'scale(1.25)' },
                            }}
                          >
                            ★
                          </Box>
                        ))}
                      </Box>
                      {reviewMutation.isPending && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Submitting…</Typography>
                      )}
                      {reviewMutation.isError && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#DC2626', fontFamily: 'Inter,sans-serif' }}>Failed to submit. Please try again.</Typography>
                      )}
                    </>
                  ) : (
                    /* Already rated */
                    <>
                      <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>
                        Your rating for <Box component="span" sx={{ color: '#4F46E5', fontWeight: 600 }}>{otherParty?.name ?? 'your partner'}</Box>
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: '0.25rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <Box key={star} component="span" sx={{ fontSize: '1.5rem', color: star <= (myRating ?? 0) ? '#FBBF24' : '#E5E7EB' }}>★</Box>
                        ))}
                      </Box>
                      <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.25rem' }}>
                        Thank you for your feedback!
                      </Typography>
                    </>
                  )}
                </Box>
              )}
            </Box>
          )}

          {exchange.status === 'cancelled' && (
            canUndoCancel ? (
              /* ── Undo available ── */
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <Box>
                  <Typography sx={{ fontSize: '0.875rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', fontWeight: 600, mb: '0.15rem' }}>
                    ❌ This exchange was cancelled.
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <i className="fas fa-clock" style={{ color: '#D97706', fontSize: '0.72rem' }} />
                    <Typography sx={{ fontSize: '0.78rem', color: '#D97706', fontFamily: 'Inter,sans-serif' }}>
                      Undo available for another <strong>{formatUndoRemaining(undoRemainingMs)}</strong>
                    </Typography>
                  </Box>
                </Box>
                <Box component="button"
                  onClick={() => undoCancelMutation.mutate()}
                  disabled={undoCancelMutation.isPending}
                  sx={{
                    background: GRAD, color: '#fff', border: 'none',
                    borderRadius: '0.5rem', px: '1.25rem', py: '0.625rem',
                    fontSize: '0.875rem', fontWeight: 600, cursor: undoCancelMutation.isPending ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.4rem',
                    opacity: undoCancelMutation.isPending ? 0.7 : 1,
                    transition: 'opacity 0.15s', '&:hover': !undoCancelMutation.isPending ? { opacity: 0.88 } : {},
                  }}
                >
                  <i className="fas fa-undo" />
                  {undoCancelMutation.isPending ? 'Restoring…' : 'Undo Cancel'}
                </Box>
              </Box>
            ) : (
              /* ── Window expired ── */
              <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', textAlign: 'center' }}>
                ❌ This exchange was cancelled and can no longer be restored.
              </Typography>
            )
          )}
        </Box>

        {/* ── Delete Confirmation Dialog ───────────────────────────────────────── */}
        {deleteConfirmOpen && (
          <Box sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '1rem' }}
            onClick={() => setDeleteConfirmOpen(false)}>
            <Box onClick={(e) => e.stopPropagation()}
              sx={{ background: '#fff', borderRadius: '1rem', p: '2rem', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', textAlign: 'center' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', border: '2px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: '1.25rem' }}>
                <i className="fas fa-trash-alt" style={{ color: '#DC2626', fontSize: '1.25rem' }} />
              </Box>
              <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mb: '0.5rem' }}>
                Delete Exchange Request?
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mb: '0.5rem', lineHeight: 1.6 }}>
                This will permanently withdraw your request.
              </Typography>
              {exchange.provider && (
                <Box sx={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '0.5rem', p: '0.75rem', mb: '1.25rem' }}>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#92400E', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>
                    <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.375rem' }} />
                    <strong>{exchange.provider.name}</strong> has already accepted — they will be notified.
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: '0.75rem', mt: exchange.provider ? 0 : '1.25rem' }}>
                <Box component="button" onClick={() => setDeleteConfirmOpen(false)}
                  sx={{ flex: 1, background: 'none', border: '1px solid #E5E7EB', borderRadius: '0.5rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', color: '#6B7280', '&:hover': { background: '#F9FAFB' } }}>
                  Keep Request
                </Box>
                <Box component="button" onClick={() => deleteExchangeMutation.mutate()} disabled={deleteExchangeMutation.isPending}
                  sx={{ flex: 1, background: '#DC2626', color: '#fff', border: 'none', borderRadius: '0.5rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: deleteExchangeMutation.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', opacity: deleteExchangeMutation.isPending ? 0.7 : 1, '&:hover': !deleteExchangeMutation.isPending ? { background: '#B91C1C' } : {} }}>
                  {deleteExchangeMutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Deleting…</> : <><i className="fas fa-trash-alt" /> Yes, Delete</>}
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Exchange Options (Start Exchange flows only, SkillDetail style) ─── */}
      {canApply && !exchange.postId && exchange.type !== 'tool' && (
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', p: '1.5rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.25rem' }}>
            <i className="fas fa-exchange-alt" style={{ color: '#4F46E5' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>Exchange Options</Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(240px,1fr))' }, gap: '1.25rem' }}>
            {/* ── Skill Swap card ─────────────────────────────────────────── */}
            {(() => {
              const hasMultipleWanted = exchange.wantedSkills && exchange.wantedSkills.length > 1;
              const hasSingleWanted   = exchange.wantedSkills && exchange.wantedSkills.length === 1;
              // Fall back to plain-text seeking when no structured wantedSkills exist
              const hasPlainSeeking   = !hasMultipleWanted && !hasSingleWanted && !!exchange.seeking;
              // Auto-select when only one wanted skill or plain seeking text
              const effectiveSelected = hasSingleWanted
                ? exchange.wantedSkills![0].name
                : hasPlainSeeking
                  ? exchange.seeking
                  : ceSelectedWantedSkill;
              const needsPick = hasMultipleWanted && !effectiveSelected;
              return (
                <Box
                  sx={{
                    position: 'relative', p: '1.5rem', borderRadius: '0.75rem',
                    border: '2px solid #4F46E5',
                    background: 'linear-gradient(135deg,rgba(79,70,229,0.03),rgba(16,185,129,0.03))',
                    transition: 'all 0.25s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
                  }}
                >
                  <Box sx={{ position: 'absolute', top: -12, right: '1rem', background: GRAD, color: '#fff', px: '0.75rem', py: '0.2rem', borderRadius: '1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                    Most Popular
                  </Box>
                  <Box sx={{ width: 48, height: 48, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '1rem' }}>
                    <i className="fas fa-exchange-alt" style={{ color: '#fff', fontSize: '1.25rem' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', mb: '0.5rem', fontFamily: 'Poppins,sans-serif' }}>Skill Swap</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5, mb: hasMultipleWanted ? '1rem' : '1.25rem', fontFamily: 'Inter,sans-serif' }}>
                    Exchange your skill for theirs — both parties benefit equally.
                  </Typography>

                  {/* ── Wanted-skill picker (Start Exchange with wantedSkills or plain seeking) ── */}
                  {(hasMultipleWanted || hasSingleWanted || hasPlainSeeking) && (
                    <Box sx={{ mb: '1.25rem' }}>
                      <Typography sx={{ fontSize: '0.775rem', fontWeight: 700, color: '#374151', fontFamily: 'Inter,sans-serif', mb: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <i className="fas fa-hand-point-right" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                        {hasMultipleWanted ? 'Select which skill you\'re offering for:' : 'Skill you\'re offering for:'}
                      </Typography>
                      {hasSingleWanted ? (
                        /* Single skill — read-only pill */
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '0.75rem', py: '0.4rem', borderRadius: '0.5rem', background: 'rgba(79,70,229,0.08)', border: '1.5px solid rgba(79,70,229,0.3)' }}>
                          <i className="fas fa-check-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                            {exchange.wantedSkills![0].name}
                          </Typography>
                          {exchange.wantedSkills![0].proficiency && (
                            <Box sx={{ px: '0.35rem', py: '0.1rem', borderRadius: '0.25rem', background: '#4F46E5', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
                              {exchange.wantedSkills![0].proficiency}
                            </Box>
                          )}
                        </Box>
                      ) : hasMultipleWanted ? (
                        /* Multiple structured skills — radio buttons */
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {exchange.wantedSkills!.map((sk) => (
                            <Box
                              key={sk.name}
                              onClick={() => setCeSelectedWantedSkill(sk.name)}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                px: '0.75rem', py: '0.6rem', borderRadius: '0.5rem',
                                border: ceSelectedWantedSkill === sk.name ? '1.5px solid #4F46E5' : '1.5px solid #E5E7EB',
                                background: ceSelectedWantedSkill === sk.name ? 'rgba(79,70,229,0.05)' : '#FAFAFA',
                                cursor: 'pointer', transition: 'all 0.15s',
                                '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.03)' },
                              }}
                            >
                              <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${ceSelectedWantedSkill === sk.name ? '#4F46E5' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {ceSelectedWantedSkill === sk.name && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#4F46E5' }} />}
                              </Box>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1 }}>{sk.name}</Typography>
                              {sk.proficiency && (
                                <Box sx={{ px: '0.35rem', py: '0.1rem', borderRadius: '0.25rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', fontSize: '0.65rem', fontWeight: 700 }}>{sk.proficiency}</Box>
                              )}
                            </Box>
                          ))}
                          {needsPick && (
                            <Typography sx={{ fontSize: '0.72rem', color: '#EF4444', fontFamily: 'Inter,sans-serif', mt: '0.25rem' }}>
                              Please select a skill to continue.
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        /* Plain-text seeking fallback — read-only pill */
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '0.75rem', py: '0.4rem', borderRadius: '0.5rem', background: 'rgba(79,70,229,0.08)', border: '1.5px solid rgba(79,70,229,0.3)' }}>
                          <i className="fas fa-check-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                            {exchange.seeking}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box
                    component="button"
                    onClick={() => {
                      if (!user) { navigate('/login'); return; }
                      if (hasMultipleWanted && !ceSelectedWantedSkill) return; // picker enforces selection
                      setCeModalTitle('Request Skill Swap');
                      setCeModalOpen(true);
                    }}
                    sx={{
                      width: '100%', background: needsPick ? '#E5E7EB' : GRAD, color: needsPick ? '#9CA3AF' : '#fff', border: 'none',
                      py: '0.875rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem',
                      cursor: needsPick ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      transition: 'all 0.2s',
                      ...(!needsPick && { '&:hover': { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' } }),
                    }}
                  >
                    <i className="fas fa-exchange-alt" /> Request Skill Swap
                  </Box>
                </Box>
              );
            })()}

            {/* ── CEU Exchange card ────────────────────────────────────────── */}
            {(() => {
              const hasMultipleWanted = exchange.wantedSkills && exchange.wantedSkills.length > 1;
              const hasSingleWanted   = exchange.wantedSkills && exchange.wantedSkills.length === 1;
              const hasPlainSeeking   = !hasMultipleWanted && !hasSingleWanted && !!exchange.seeking;
              const effectiveSelected = hasSingleWanted
                ? exchange.wantedSkills![0].name
                : hasPlainSeeking
                  ? exchange.seeking
                  : ceSelectedWantedSkill;
              const needsPick = hasMultipleWanted && !effectiveSelected;
              return (
                <Box
                  sx={{
                    position: 'relative', p: '1.5rem', borderRadius: '0.75rem',
                    border: '2px solid #E5E7EB', background: '#FFF',
                    transition: 'all 0.25s',
                    '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 6px 20px rgba(0,0,0,0.1)' },
                  }}
                >
                  <Box sx={{ width: 48, height: 48, borderRadius: '0.5rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '1rem' }}>
                    <i className="fas fa-coins" style={{ color: '#fff', fontSize: '1.25rem' }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', mb: '0.5rem', fontFamily: 'Poppins,sans-serif' }}>CEU Exchange</Typography>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.5, mb: hasMultipleWanted ? '1rem' : '1.25rem', fontFamily: 'Inter,sans-serif' }}>
                    Pay with Community Exchange Units from your balance.
                  </Typography>

                  {/* ── Wanted-skill picker ── */}
                  {(hasMultipleWanted || hasSingleWanted || hasPlainSeeking) && (
                    <Box sx={{ mb: '1.25rem' }}>
                      <Typography sx={{ fontSize: '0.775rem', fontWeight: 700, color: '#374151', fontFamily: 'Inter,sans-serif', mb: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <i className="fas fa-hand-point-right" style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                        {hasMultipleWanted ? 'Select which skill you\'re offering for:' : 'Skill you\'re offering for:'}
                      </Typography>
                      {hasSingleWanted ? (
                        /* Single skill — read-only pill */
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '0.75rem', py: '0.4rem', borderRadius: '0.5rem', background: 'rgba(79,70,229,0.08)', border: '1.5px solid rgba(79,70,229,0.3)' }}>
                          <i className="fas fa-check-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                            {exchange.wantedSkills![0].name}
                          </Typography>
                          {exchange.wantedSkills![0].proficiency && (
                            <Box sx={{ px: '0.35rem', py: '0.1rem', borderRadius: '0.25rem', background: '#4F46E5', color: '#fff', fontSize: '0.65rem', fontWeight: 700 }}>
                              {exchange.wantedSkills![0].proficiency}
                            </Box>
                          )}
                        </Box>
                      ) : hasMultipleWanted ? (
                        /* Multiple structured skills — radio buttons */
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {exchange.wantedSkills!.map((sk) => (
                            <Box
                              key={sk.name}
                              onClick={() => setCeSelectedWantedSkill(sk.name)}
                              sx={{
                                display: 'flex', alignItems: 'center', gap: '0.75rem',
                                px: '0.75rem', py: '0.6rem', borderRadius: '0.5rem',
                                border: ceSelectedWantedSkill === sk.name ? '1.5px solid #4F46E5' : '1.5px solid #E5E7EB',
                                background: ceSelectedWantedSkill === sk.name ? 'rgba(79,70,229,0.05)' : '#FAFAFA',
                                cursor: 'pointer', transition: 'all 0.15s',
                                '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.03)' },
                              }}
                            >
                              <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${ceSelectedWantedSkill === sk.name ? '#4F46E5' : '#D1D5DB'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {ceSelectedWantedSkill === sk.name && <Box sx={{ width: 7, height: 7, borderRadius: '50%', background: '#4F46E5' }} />}
                              </Box>
                              <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1 }}>{sk.name}</Typography>
                              {sk.proficiency && (
                                <Box sx={{ px: '0.35rem', py: '0.1rem', borderRadius: '0.25rem', background: 'rgba(79,70,229,0.1)', color: '#4F46E5', fontSize: '0.65rem', fontWeight: 700 }}>{sk.proficiency}</Box>
                              )}
                            </Box>
                          ))}
                          {needsPick && (
                            <Typography sx={{ fontSize: '0.72rem', color: '#EF4444', fontFamily: 'Inter,sans-serif', mt: '0.25rem' }}>
                              Please select a skill to continue.
                            </Typography>
                          )}
                        </Box>
                      ) : (
                        /* Plain-text seeking fallback — read-only pill */
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', px: '0.75rem', py: '0.4rem', borderRadius: '0.5rem', background: 'rgba(79,70,229,0.08)', border: '1.5px solid rgba(79,70,229,0.3)' }}>
                          <i className="fas fa-check-circle" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
                            {exchange.seeking}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  <Box
                    component="button"
                    onClick={() => {
                      if (!user) { navigate('/login'); return; }
                      if (hasMultipleWanted && !ceSelectedWantedSkill) return;
                      setCeModalTitle('Exchange with CEU');
                      setCeModalOpen(true);
                    }}
                    sx={{
                      width: '100%', background: needsPick ? '#E5E7EB' : GRAD, color: needsPick ? '#9CA3AF' : '#fff', border: 'none',
                      py: '0.875rem', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.875rem',
                      cursor: needsPick ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      transition: 'all 0.2s',
                      ...(!needsPick && { '&:hover': { opacity: 0.9, transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' } }),
                    }}
                  >
                    <i className="fas fa-coins" /> Exchange with CEU
                  </Box>
                </Box>
              );
            })()}
          </Box>
        </Box>
      )}

      {/* ── 3rd-party Apply section ─────────────────────────────────────────── */}
      {canApply && !!exchange.postId && exchange.type !== 'tool' && (
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', p: '1.5rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '1.25rem' }}>
            <i className="fas fa-hand-paper" style={{ color: '#4F46E5', fontSize: '1.1rem' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
              Interested in this exchange?
            </Typography>
          </Box>

          {myPendingApp ? (
            /* Already applied */
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '1rem', background: 'rgba(79,70,229,0.04)', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.75rem' }}>
              <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fas fa-clock" style={{ color: '#4F46E5', fontSize: '0.9rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                  Application pending
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                  You applied with a {myPendingApp.type === 'ceu' ? `${myPendingApp.ceuOffer} CEU offer` : 'skill offer'}. Waiting for the requester's response.
                </Typography>
              </Box>
            </Box>
          ) : (
            /* Option cards */
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem' }}>
              {/* Offer a Skill card */}
              <Box
                onClick={() => { setCeModalTitle('Request Skill Swap'); setCeModalOpen(true); }}
                sx={{ p: '1.25rem', border: '2px solid rgba(79,70,229,0.2)', borderRadius: '0.875rem', cursor: 'pointer', transition: 'all 0.18s', background: 'rgba(79,70,229,0.02)', '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.05)', transform: 'translateY(-2px)', boxShadow: '0 4px 16px rgba(79,70,229,0.12)' } }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: '0.625rem', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '0.875rem' }}>
                  <i className="fas fa-star" style={{ color: '#4F46E5', fontSize: '1.1rem' }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', mb: '0.375rem' }}>
                  Offer a Skill
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                  Propose a skill swap — describe what you can offer in return.
                </Typography>
              </Box>

              {/* Pay with CEU card */}
              <Box
                onClick={() => { setCeModalTitle('Exchange with CEU'); setCeModalOpen(true); }}
                sx={{ p: '1.25rem', border: '2px solid rgba(16,185,129,0.2)', borderRadius: '0.875rem', cursor: 'pointer', transition: 'all 0.18s', background: 'rgba(16,185,129,0.02)', '&:hover': { borderColor: '#10B981', background: 'rgba(16,185,129,0.05)', transform: 'translateY(-2px)', boxShadow: '0 4px 16px rgba(16,185,129,0.12)' } }}
              >
                <Box sx={{ width: 44, height: 44, borderRadius: '0.625rem', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: '0.875rem' }}>
                  <i className="fas fa-coins" style={{ color: '#10B981', fontSize: '1.1rem' }} />
                </Box>
                <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif', mb: '0.375rem' }}>
                  Pay with CEU
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', lineHeight: 1.5 }}>
                  Offer Community Exchange Units as payment for this exchange.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── Apply modal ──────────────────────────────────────────────────────── */}
      {applyModalOpen && (
        <Box sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', p: '1rem' }}
          onClick={() => setApplyModalOpen(false)}>
          <Box onClick={(e) => e.stopPropagation()}
            sx={{ background: '#fff', borderRadius: '1rem', p: '2rem', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.25rem' }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '0.625rem', background: applyType === 'skill' ? 'rgba(79,70,229,0.1)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${applyType === 'skill' ? 'fa-star' : 'fa-coins'}`} style={{ color: applyType === 'skill' ? '#4F46E5' : '#10B981', fontSize: '1.1rem' }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
                  {applyType === 'skill' ? 'Offer a Skill' : 'Pay with CEU'}
                </Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                  Applying for: <Box component="span" sx={{ color: '#4F46E5', fontWeight: 600 }}>{exchange.title}</Box>
                </Typography>
              </Box>
            </Box>

            {/* Input */}
            {applyType === 'skill' ? (
              <Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>
                  Describe your skill offer
                </Typography>
                <Box
                  component="textarea"
                  value={applyInput}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setApplyInput(e.target.value)}
                  placeholder="e.g. I can teach guitar — 5 years experience, intermediate–advanced level..."
                  rows={4}
                  sx={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '0.75rem', fontSize: '0.9rem', fontFamily: 'Inter,sans-serif', resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' } }}
                />
              </Box>
            ) : (
              <Box>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>
                  CEU amount to offer
                </Typography>
                <Box sx={{ position: 'relative' }}>
                  <Box component="input"
                    type="number"
                    min={1}
                    value={applyInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApplyInput(e.target.value)}
                    placeholder={`${exchange.ceuValue}`}
                    sx={{ width: '100%', border: '1px solid #E5E7EB', borderRadius: '0.5rem', p: '0.75rem 3rem 0.75rem 0.875rem', fontSize: '1rem', fontFamily: 'Inter,sans-serif', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#10B981', boxShadow: '0 0 0 3px rgba(16,185,129,0.08)' } }}
                  />
                  <Typography sx={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', fontWeight: 700, color: '#10B981', fontFamily: 'Poppins,sans-serif', pointerEvents: 'none' }}>
                    CEU
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', mt: '0.375rem' }}>
                  Requested value: {exchange.ceuValue} CEU
                </Typography>
              </Box>
            )}

            {/* Error */}
            {applyError && (
              <Typography sx={{ fontSize: '0.8rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', mt: '0.75rem' }}>
                <i className="fas fa-exclamation-circle" style={{ marginRight: '0.25rem' }} />{applyError}
              </Typography>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: '0.75rem', mt: '1.5rem' }}>
              <Box component="button" onClick={() => setApplyModalOpen(false)}
                sx={{ flex: 1, background: 'none', border: '1px solid #E5E7EB', borderRadius: '0.5rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter,sans-serif', color: '#6B7280', '&:hover': { background: '#F9FAFB' } }}>
                Cancel
              </Box>
              <Box component="button"
                disabled={applyMutation.isPending || !applyInput.trim()}
                onClick={() => {
                  if (!applyInput.trim()) { setApplyError('Please fill in your offer.'); return; }
                  setApplyError('');
                  if (applyType === 'skill') {
                    applyMutation.mutate({ type: 'skill', skillOffer: applyInput.trim() });
                  } else {
                    const n = Number(applyInput);
                    if (!n || n <= 0) { setApplyError('Enter a valid CEU amount.'); return; }
                    applyMutation.mutate({ type: 'ceu', ceuOffer: n });
                  }
                }}
                sx={{ flex: 2, background: applyType === 'skill' ? 'linear-gradient(135deg,#4F46E5,#10B981)' : 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', border: 'none', borderRadius: '0.5rem', py: '0.625rem', fontSize: '0.875rem', fontWeight: 700, cursor: applyMutation.isPending || !applyInput.trim() ? 'not-allowed' : 'pointer', fontFamily: 'Poppins,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', opacity: applyMutation.isPending || !applyInput.trim() ? 0.65 : 1, transition: 'opacity 0.15s', '&:hover': !applyMutation.isPending && applyInput.trim() ? { opacity: 0.9 } : {} }}>
                {applyMutation.isPending ? <><i className="fas fa-spinner fa-spin" /> Submitting…</> : <><i className={`fas ${applyType === 'skill' ? 'fa-paper-plane' : 'fa-coins'}`} /> Submit Application</>}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* ── Skill Swap Requests (Start Exchange, requester side) ────────────── */}
      {isRequester && !exchange.postId && (
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', p: '1.5rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '1.25rem' }}>
            <i className="fas fa-handshake" style={{ color: '#10B981', fontSize: '1.1rem' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
              Skill Swap Requests
            </Typography>
            {swapRequests && swapRequests.length > 0 && (
              <Box sx={{ ml: 0.5, background: GRAD, color: '#fff', borderRadius: '1rem', px: '0.55rem', py: '0.1rem', fontSize: '0.72rem', fontWeight: 700 }}>
                {swapRequests.length}
              </Box>
            )}
          </Box>

          {/* Wanted skills filter tabs (only when >1 wanted skill) */}
          {exchange.wantedSkills && exchange.wantedSkills.length > 1 && (
            <Box sx={{ display: 'flex', gap: '0.5rem', mb: '1.25rem', flexWrap: 'wrap' }}>
              <Box
                onClick={() => setSeekingTab(0)}
                sx={{ px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', border: '1px solid', transition: 'all 0.15s',
                  borderColor: seekingTab === 0 ? '#4F46E5' : '#E5E7EB',
                  background: seekingTab === 0 ? 'rgba(79,70,229,0.08)' : '#F9FAFB',
                  color: seekingTab === 0 ? '#4F46E5' : '#6B7280' }}
              >
                All
              </Box>
              {exchange.wantedSkills.map((sk, i) => (
                <Box
                  key={sk.name}
                  onClick={() => setSeekingTab(i + 1)}
                  sx={{ px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', border: '1px solid', transition: 'all 0.15s',
                    borderColor: seekingTab === i + 1 ? '#4F46E5' : '#E5E7EB',
                    background: seekingTab === i + 1 ? 'rgba(79,70,229,0.08)' : '#F9FAFB',
                    color: seekingTab === i + 1 ? '#4F46E5' : '#6B7280' }}
                >
                  {sk.name}
                </Box>
              ))}
            </Box>
          )}

          {(!swapRequests || swapRequests.length === 0) ? (
            <Box sx={{ textAlign: 'center', py: '1.5rem', color: '#9CA3AF', border: '1.5px dashed #E5E7EB', borderRadius: '0.75rem' }}>
              <i className="fas fa-handshake" style={{ fontSize: '1.75rem', marginBottom: '0.5rem', display: 'block', opacity: 0.4 }} />
              <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF' }}>No swap requests yet — be the first!</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {swapRequests
                .filter(req => {
                  if (!exchange.wantedSkills || exchange.wantedSkills.length <= 1 || seekingTab === 0) return true;
                  const skillName = exchange.wantedSkills[seekingTab - 1]?.name?.toLowerCase() ?? '';
                  // Match against the responder's offering title (strips proficiency + description suffix)
                  const offeringTitle = (req.offering?.split(' — ')[0]?.split(' (')[0] ?? '').toLowerCase();
                  return offeringTitle.includes(skillName) || skillName.includes(offeringTitle);
                })
                .map(req => (
                  <Box
                    key={req._id}
                    onClick={() => navigate(`/exchanges/${req._id}`)}
                    sx={{ borderRadius: '0.75rem', border: '1.5px solid #E5E7EB', background: '#FAFAFA', cursor: 'pointer', transition: 'all 0.2s', overflow: 'hidden',
                      '&:hover': { borderColor: '#4F46E5', background: 'rgba(79,70,229,0.03)', transform: 'translateY(-2px)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', p: '1rem 1.25rem' }}>
                      <OnlineAvatar userId={req.requester._id} src={req.requester.avatar} isVerified={req.requester.isVerified} sx={{ width: 36, height: 36, fontSize: '0.8rem' }}>
                        {req.requester.name?.[0]}
                      </OnlineAvatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: '#1F2937' }}>{req.requester.name}</Typography>
                          {req.requester.rating > 0 && (
                            <Typography sx={{ fontSize: '0.75rem', color: '#D97706' }}>★ {req.requester.rating.toFixed(1)}</Typography>
                          )}
                          <Box sx={{ px: '0.45rem', py: '0.08rem', borderRadius: '0.375rem', fontSize: '0.7rem', fontWeight: 700,
                            background: req.status === 'open' ? 'rgba(16,185,129,0.1)' : req.status === 'completed' ? 'rgba(79,70,229,0.1)' : 'rgba(107,114,128,0.1)',
                            color: req.status === 'open' ? '#059669' : req.status === 'completed' ? '#4F46E5' : '#6B7280' }}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.78rem', color: '#6B7280', mt: '0.15rem' }}>
                          Offering: <Box component="span" sx={{ color: '#1F2937', fontWeight: 500 }}>{req.offering?.split(' — ')[0] ?? req.title}</Box>
                        </Typography>
                        {req.seeking && (
                          <Typography sx={{ fontSize: '0.75rem', color: '#4F46E5', mt: '0.1rem' }}>
                            For: {req.seeking}
                          </Typography>
                        )}
                      </Box>
                      <i className="fas fa-chevron-right" style={{ color: '#D1D5DB', fontSize: '0.8rem' }} />
                    </Box>
                  </Box>
                ))}
            </Box>
          )}
        </Box>
      )}


      {/* ── Skill Chain ─────────────────────────────────────────────────────── */}
      {!exchange.postId && chainsData && chainsData.chains.length > 0 && (
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', p: '1.5rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '1.25rem' }}>
            <Box sx={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg,#4F46E5,#10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fas fa-link" style={{ color: '#fff', fontSize: '0.875rem' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
              Skill Chain
            </Typography>
            <Box sx={{ ml: 0.5, background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff', borderRadius: '1rem', px: '0.55rem', py: '0.1rem', fontSize: '0.72rem', fontWeight: 700 }}>
              {chainsData.chains.length}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: 560, overflowY: 'auto', pr: '0.25rem',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { background: '#F3F4F6', borderRadius: 4 },
            '&::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: 4 },
          }}>
            {chainsData.chains.map(chain => {
              const getUid = (u: ChainMember['user']): string =>
                typeof u === 'string' ? u : String((u as { _id: string })._id ?? '');
              const getUser = (u: ChainMember['user']) =>
                u && typeof u === 'object' ? (u as { _id: string; name: string; avatar?: string; isVerified?: boolean }) : null;
              const getEx = (e: ChainMember['exchange']): ChainExchange | null =>
                e && typeof e === 'object' ? (e as ChainExchange) : null;
              const getExId = (e: ChainMember['exchange']): string =>
                typeof e === 'string' ? e : String((e as { _id: string })._id ?? '');

              const myMember = chain.members.find(m => {
                const uid = getUid(m.user);
                return uid === String(user?._id);
              });
              const allAccepted = chain.members.every(m => m.status === 'accepted');
              const anyDeclined = chain.members.some(m => m.status === 'declined');
              const statusColor  = allAccepted ? '#059669' : anyDeclined ? '#DC2626' : '#D97706';
              const statusBorder = allAccepted ? '#A7F3D0' : anyDeclined ? '#FECACA' : '#FDE68A';
              const statusLabel  = allAccepted ? 'Skill Chain Initiated! 🎉' : anyDeclined ? 'Chain Declined' : 'Potential Skill Chain';
              const statusIcon   = allAccepted ? 'fa-check-circle' : anyDeclined ? 'fa-times-circle' : 'fa-clock';

              return (
                <Box key={chain._id} sx={{ border: `1.5px solid ${statusBorder}`, borderRadius: '0.75rem', background: '#FFFFFF', flexShrink: 0, overflow: 'visible' }}>
                  {/* Status banner */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: '1rem', py: '0.6rem',
                    background: allAccepted ? 'rgba(5,150,105,0.07)' : anyDeclined ? 'rgba(220,38,38,0.05)' : 'rgba(253,246,178,0.5)',
                    borderBottom: `1px solid ${statusBorder}`, borderRadius: '0.65rem 0.65rem 0 0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <i className={`fas ${statusIcon}`} style={{ color: statusColor, fontSize: '0.85rem' }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.875rem', color: statusColor, fontFamily: 'Inter,sans-serif' }}>{statusLabel}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>
                      {chain.members.filter(m => m.status === 'accepted').length}/{chain.members.length} accepted
                    </Typography>
                  </Box>

                  {/* Member rows */}
                  {chain.members.map((m, idx) => {
                    const u    = getUser(m.user);
                    const uId  = getUid(m.user);
                    const ex   = getEx(m.exchange);
                    const exId = getExId(m.exchange);
                    const isMe = !!user?._id && uId === String(user._id);
                    const isLast = idx === chain.members.length - 1;
                    const mColor = m.status === 'accepted' ? '#059669' : m.status === 'declined' ? '#DC2626' : '#D97706';
                    const mLabel = m.status === 'accepted' ? 'Accepted' : m.status === 'declined' ? 'Declined' : 'Pending';

                    return (
                      <Box key={idx} sx={{
                        px: '1rem', py: '0.875rem',
                        background: isMe ? 'rgba(79,70,229,0.03)' : '#FFFFFF',
                        borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
                      }}>
                        {/* User row */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.625rem' }}>
                          {/* Step number */}
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: isMe ? 'linear-gradient(135deg,#4F46E5,#10B981)' : '#F3F4F6',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: isMe ? '#fff' : '#6B7280', lineHeight: 1 }}>{idx + 1}</Typography>
                          </Box>
                          {/* Avatar */}
                          <OnlineAvatar userId={uId} src={u?.avatar} isVerified={u?.isVerified}
                            sx={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0, cursor: 'pointer' }}
                            onClick={() => uId && navigate(`/profile/${uId}`)}>
                            {u?.name?.[0] ?? '?'}
                          </OnlineAvatar>
                          {/* Name */}
                          <Typography onClick={() => uId && navigate(`/profile/${uId}`)}
                            sx={{ flex: 1, fontSize: '0.83rem', fontWeight: 700, color: '#1F2937', cursor: 'pointer',
                              '&:hover': { color: '#4F46E5' }, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {isMe ? 'You' : (u?.name ?? 'Member')}
                          </Typography>
                          {/* Status chip */}
                          <Box sx={{ px: '0.45rem', py: '0.15rem', borderRadius: '999px', flexShrink: 0,
                            background: m.status === 'accepted' ? 'rgba(5,150,105,0.1)' : m.status === 'declined' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.1)' }}>
                            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: mColor, lineHeight: 1.4 }}>{mLabel}</Typography>
                          </Box>
                        </Box>

                        {/* Exchange card */}
                        <Box sx={{ ml: '3.375rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                          p: '0.5rem 0.75rem', cursor: 'pointer', transition: 'border-color 0.15s',
                          '&:hover': { borderColor: '#4F46E5', background: '#F5F3FF' } }}
                          onClick={() => navigate(`/exchanges/${exId}`)}>
                          {ex?.title && (
                            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937', mb: '0.25rem',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ex.title}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 600 }}>
                              ↑ {ex?.offering || m.offering}
                            </Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#4F46E5', fontWeight: 600 }}>
                              ↓ {ex?.seeking || m.seeking}
                            </Typography>
                          </Box>
                          {ex?.tags && ex.tags.length > 0 && (
                            <Box sx={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', mt: '0.35rem' }}>
                              {ex.tags.slice(0, 3).map(tag => (
                                <Box key={tag} sx={{ px: '0.35rem', py: '0.05rem', borderRadius: '999px',
                                  background: 'rgba(79,70,229,0.07)', fontSize: '0.6rem', color: '#4F46E5', fontWeight: 600 }}>
                                  #{tag}
                                </Box>
                              ))}
                            </Box>
                          )}

                          {/* Location / meeting link — revealed after all accept */}
                          {allAccepted ? (
                            <Box sx={{ mt: '0.5rem', p: '0.45rem 0.6rem', borderRadius: '0.4rem',
                              background: 'rgba(5,150,105,0.07)', border: '1px solid rgba(5,150,105,0.2)' }}
                              onClick={e => e.stopPropagation()}>
                              {ex?.onlineLink ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <i className="fas fa-video" style={{ color: '#059669', fontSize: '0.7rem', flexShrink: 0 }} />
                                  <Box component="a" href={ex.onlineLink} target="_blank" rel="noopener noreferrer"
                                    sx={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600, wordBreak: 'break-all',
                                      textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                                    {ex.onlineLink}
                                  </Box>
                                </Box>
                              ) : ex?.locationName ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  <i className="fas fa-map-marker-alt" style={{ color: '#059669', fontSize: '0.7rem', flexShrink: 0 }} />
                                  <Typography sx={{ fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
                                    {ex.locationName}
                                  </Typography>
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>
                                  No location set — coordinate via messages
                                </Typography>
                              )}
                            </Box>
                          ) : (ex?.locationName || ex?.onlineLink) ? (
                            <Box sx={{ mt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.62rem' }} />
                              <Typography sx={{ fontSize: '0.68rem', color: '#D97706', fontWeight: 500 }}>
                                Location revealed after all members accept
                              </Typography>
                            </Box>
                          ) : null}

                          <Typography sx={{ fontSize: '0.68rem', color: '#9CA3AF', mt: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <i className="fas fa-external-link-alt" style={{ fontSize: '0.58rem' }} />
                            View exchange
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}

                  {/* Accept / Decline */}
                  {myMember && myMember.status === 'pending' && !anyDeclined && (
                    <Box sx={{ px: '1rem', pb: '1rem', display: 'flex', gap: '0.625rem', borderTop: '1px solid #F3F4F6', pt: '0.75rem' }}>
                      <Box component="button"
                        disabled={chainRespondMutation.isPending}
                        onClick={() => chainRespondMutation.mutate({ chainId: chain._id, action: 'accept' })}
                        sx={{ flex: 1, background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff', border: 'none', borderRadius: '0.5rem', py: '0.5rem', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Inter,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', opacity: chainRespondMutation.isPending ? 0.65 : 1, '&:hover': { opacity: 0.9 } }}>
                        <i className="fas fa-check" /> Accept Chain
                      </Box>
                      <Box component="button"
                        disabled={chainRespondMutation.isPending}
                        onClick={() => chainRespondMutation.mutate({ chainId: chain._id, action: 'decline' })}
                        sx={{ px: '1rem', background: '#fff', color: '#DC2626', border: '1.5px solid rgba(220,38,38,0.3)', borderRadius: '0.5rem', py: '0.5rem', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'Inter,sans-serif', cursor: 'pointer', opacity: chainRespondMutation.isPending ? 0.65 : 1, '&:hover': { background: 'rgba(220,38,38,0.05)' } }}>
                        <i className="fas fa-times" /> Decline
                      </Box>
                    </Box>
                  )}

                  {/* Already responded — accepted: show undo button */}
                  {myMember && myMember.status === 'accepted' && (
                    <Box sx={{ px: '1rem', pb: '0.875rem', pt: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', borderTop: '1px solid #F3F4F6' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <i className="fas fa-check-circle" style={{ color: '#059669', fontSize: '0.85rem' }} />
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#059669', fontFamily: 'Inter,sans-serif' }}>
                          You accepted this chain
                        </Typography>
                      </Box>
                      <Box component="button"
                        disabled={chainUndoMutation.isPending}
                        onClick={() => chainUndoMutation.mutate(chain._id)}
                        sx={{
                          background: 'none', color: '#6B7280', border: '1px solid #D1D5DB',
                          borderRadius: '0.375rem', px: '0.75rem', py: '0.3rem',
                          fontFamily: 'Inter,sans-serif', fontSize: '0.75rem', fontWeight: 600,
                          cursor: chainUndoMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: chainUndoMutation.isPending ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', gap: '0.3rem',
                          transition: 'all 0.15s',
                          '&:hover': !chainUndoMutation.isPending ? { background: '#F9FAFB', color: '#374151' } : {},
                        }}
                      >
                        <i className="fas fa-undo" style={{ fontSize: '0.625rem' }} />
                        {chainUndoMutation.isPending ? 'Undoing…' : 'Undo'}
                      </Box>
                    </Box>
                  )}

                  {/* Already responded — declined */}
                  {myMember && myMember.status === 'declined' && (
                    <Box sx={{ px: '1rem', pb: '0.875rem', pt: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem', borderTop: '1px solid #F3F4F6' }}>
                      <i className="fas fa-times-circle" style={{ color: '#DC2626', fontSize: '0.85rem' }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#DC2626', fontFamily: 'Inter,sans-serif' }}>
                        You declined this chain
                      </Typography>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── Applications review (requester only) ────────────────────────────── */}
      {isRequester && exchange.applications && exchange.applications.length > 0 && (
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', p: '1.5rem', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <i className="fas fa-inbox" style={{ color: '#4F46E5', fontSize: '1.1rem' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>
                Applications
              </Typography>
            </Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', px: '0.625rem', py: '0.2rem', borderRadius: '2rem', background: 'rgba(79,70,229,0.08)', color: '#4F46E5', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
              {exchange.applications.filter(a => a.status === 'pending').length} pending
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            {exchange.applications.map((app) => {
              const applicantObj = typeof app.applicant === 'object' ? app.applicant as ExchangeApplication['applicant'] : null;
              const appName = applicantObj?.name ?? 'Unknown';
              const appAvatar = applicantObj?.avatar;
              const appId = applicantObj?._id ?? '';
              const appRating = applicantObj?.rating ?? 0;
              const appVerified = applicantObj?.isVerified ?? false;
              const isPending = app.status === 'pending';
              return (
                <Box key={app._id}
                  sx={{ display: 'flex', alignItems: 'center', gap: '0.875rem', p: '1rem', border: `1.5px solid ${isPending ? 'rgba(79,70,229,0.18)' : app.status === 'accepted' ? 'rgba(5,150,105,0.25)' : '#E5E7EB'}`, borderRadius: '0.75rem', background: isPending ? 'rgba(79,70,229,0.02)' : app.status === 'accepted' ? 'rgba(5,150,105,0.04)' : '#FAFAFA', flexWrap: 'wrap' }}>
                  {/* Applicant avatar */}
                  <OnlineAvatar userId={appId} src={appAvatar} isVerified={appVerified} sx={{ width: 44, height: 44, flexShrink: 0, cursor: 'pointer' }} onClick={() => navigate(`/profile/${appId}`)}>
                    {appName[0]}
                  </OnlineAvatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem', mb: '0.125rem', flexWrap: 'wrap' }}>
                      <Typography onClick={() => navigate(`/profile/${appId}`)} sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
                        {appName}
                      </Typography>
                      {appRating > 0 && (
                        <Typography sx={{ fontSize: '0.75rem', color: '#D97706', fontFamily: 'Inter,sans-serif' }}>★ {appRating.toFixed(1)}</Typography>
                      )}
                      {/* Type badge */}
                      <Box sx={{ px: '0.5rem', py: '0.15rem', borderRadius: '2rem', background: app.type === 'ceu' ? 'rgba(16,185,129,0.1)' : 'rgba(79,70,229,0.1)', color: app.type === 'ceu' ? '#059669' : '#4F46E5', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                        {app.type === 'ceu' ? 'CEU Offer' : 'Skill Swap'}
                      </Box>
                      {/* Status badge */}
                      <Box sx={{ px: '0.5rem', py: '0.15rem', borderRadius: '2rem', background: isPending ? 'rgba(217,119,6,0.1)' : app.status === 'accepted' ? 'rgba(5,150,105,0.1)' : 'rgba(156,163,175,0.15)', color: isPending ? '#D97706' : app.status === 'accepted' ? '#059669' : '#6B7280', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif', textTransform: 'capitalize' }}>
                        {app.status}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.type === 'ceu' ? `Offering ${app.ceuOffer} CEU` : app.skillOffer}
                    </Typography>
                  </Box>

                  {/* Actions (pending only) */}
                  {isPending && (
                    <Box sx={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <Box component="button"
                        disabled={reviewAppMutation.isPending}
                        onClick={() => reviewAppMutation.mutate({ appId: app._id, action: 'accept' })}
                        sx={{ background: '#059669', color: '#fff', border: 'none', borderRadius: '0.5rem', px: '0.875rem', py: '0.4375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: reviewAppMutation.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: reviewAppMutation.isPending ? 0.65 : 1, '&:hover': !reviewAppMutation.isPending ? { background: '#047857' } : {} }}>
                        <i className="fas fa-check" /> Accept
                      </Box>
                      <Box component="button"
                        disabled={reviewAppMutation.isPending}
                        onClick={() => reviewAppMutation.mutate({ appId: app._id, action: 'reject' })}
                        sx={{ background: 'none', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '0.5rem', px: '0.875rem', py: '0.4375rem', fontSize: '0.8125rem', fontWeight: 600, cursor: reviewAppMutation.isPending ? 'not-allowed' : 'pointer', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.3rem', opacity: reviewAppMutation.isPending ? 0.65 : 1, '&:hover': !reviewAppMutation.isPending ? { background: '#FEF2F2' } : {} }}>
                        <i className="fas fa-times" /> Reject
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* ── Messages section ────────────────────────────────────────────────── */}
      <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
        <Box sx={{ p: '1.5rem' }}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.25rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <i className="fas fa-comments" style={{ color: '#1F2937', fontSize: '1.125rem' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '1.0625rem', color: '#1F2937', fontFamily: 'Poppins,sans-serif' }}>Exchange Messages</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
              {exchange.messages?.length ?? 0} message{(exchange.messages?.length ?? 0) !== 1 ? 's' : ''}
            </Typography>
          </Box>

          {/* Composer / gates */}
          {!isPhoneVerified ? (
            <Box sx={{ mb: '1.5rem' }}>
              <PhoneVerificationGate feature="Messaging" description="Verify your mobile number to send messages in this exchange." compact />
            </Box>
          ) : isProtected && !isVideoVerified ? (
            <Box sx={{ mb: '1.5rem' }}>
              <VideoVerificationGate feature={exchange.type === 'skill' ? 'Skill Exchange' : exchange.type === 'tool' ? 'Tool Exchange' : 'Hybrid Exchange'} compact />
            </Box>
          ) : !canMessage ? (
            <Box sx={{ mb: '1.5rem', p: '0.875rem 1rem', background: '#F9FAFB', borderRadius: '0.625rem', border: '1px solid #E5E7EB', textAlign: 'center' }}>
              <Typography sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>
                {!user ? 'Sign in to send messages'
                  : !exchange.postId ? `Messaging is unavailable — exchange is ${exchange.status}`
                  : !isParty ? 'Join this exchange to send messages'
                  : `Messaging is unavailable — exchange is ${exchange.status}`}
              </Typography>
            </Box>
          ) : !composerOpen ? (
            <Box onClick={() => setComposerOpen(true)} sx={{ mb: '1.5rem', p: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '1.5rem', color: '#9CA3AF', cursor: 'text', fontSize: '0.9375rem', background: '#F9FAFB', fontFamily: 'Inter,sans-serif', '&:hover': { borderColor: '#4F46E5' } }}>
              Write a message…
            </Box>
          ) : (
            <Box sx={{ mb: '1.5rem', border: '1px solid #4F46E5', borderRadius: '0.625rem', overflow: 'hidden', boxShadow: '0 0 0 3px rgba(79,70,229,0.08)' }}>
              {(msgError || locationError) && (
                <Typography sx={{ fontSize: '0.75rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', px: '1rem', pt: '0.625rem' }}>
                  <i className="fas fa-exclamation-circle" style={{ marginRight: '0.25rem' }} />{msgError || locationError}
                </Typography>
              )}
              <Box component="textarea" autoFocus value={msgText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMsgText(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMsg(); } }}
                placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
                sx={{ width: '100%', minHeight: 100, p: '0.875rem 1rem', border: 'none', fontFamily: 'Inter,sans-serif', fontSize: '0.9375rem', color: '#1F2937', background: '#FFF', resize: 'none', outline: 'none', boxSizing: 'border-box', display: 'block' }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', p: '0.625rem 0.875rem', background: '#F9FAFB', borderTop: '1px solid #E5E7EB' }}>
                <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                  {isVideoVerified && (
                    <Box component="button" onClick={() => handleShareLocation()}
                      disabled={locationLoading || sendMsgMutation.isPending}
                      title="Share your current location"
                      sx={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.5rem', px: '0.75rem', py: '0.375rem', cursor: 'pointer', color: '#059669', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.375rem', '&:hover': { background: '#DCFCE7' } }}>
                      {locationLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-map-marker-alt" />}
                      Share Location
                    </Box>
                  )}
                  {!isVideoVerified && (
                    <Typography sx={{ fontSize: '0.72rem', color: '#D97706', fontFamily: 'Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <i className="fas fa-lock" />
                      <Box component="span" onClick={() => navigate('/profile/edit')} sx={{ textDecoration: 'underline', cursor: 'pointer' }}>Verify to share location</Box>
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                  <Box component="button" onClick={() => { setComposerOpen(false); setMsgText(''); setMsgError(''); }} sx={{ background: 'none', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6' } }}>Cancel</Box>
                  <Box component="button" onClick={() => handleSendMsg()}
                    disabled={!msgText.trim() || sendMsgMutation.isPending}
                    sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '1rem', py: '0.375rem', borderRadius: '1rem', cursor: !msgText.trim() ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'Inter,sans-serif', opacity: msgText.trim() ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    {sendMsgMutation.isPending ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                    Send
                  </Box>
                </Box>
              </Box>
            </Box>
          )}

          {/* Messages thread */}
          {(!exchange.messages || exchange.messages.length === 0) ? (
            <Box sx={{ textAlign: 'center', py: '2rem', color: '#9CA3AF' }}>
              <i className="fas fa-comment-dots" style={{ fontSize: '2rem', marginBottom: '0.75rem', display: 'block' }} />
              <Typography sx={{ fontSize: '0.9375rem', fontWeight: 500, fontFamily: 'Inter,sans-serif' }}>No messages yet</Typography>
              <Typography sx={{ fontSize: '0.8125rem', mt: '0.25rem', fontFamily: 'Inter,sans-serif' }}>Be the first to start the conversation!</Typography>
            </Box>
          ) : (() => {
            const allMsgs = exchange.messages;

            const MsgCard = ({ msg, depth = 0 }: { msg: typeof allMsgs[0]; depth?: number }) => {
              const [replyOpen, setReplyOpen] = React.useState(false);
              const [replyText, setReplyText] = React.useState('');
              const loc = parseLocation(msg.content);
              const senderName = getSenderName(msg.sender);
              const senderObj = msg.sender === exchange.requester._id ? exchange.requester : exchange.provider;
              const isOwn = msg.sender === user?._id;
              const msgId = msg._id ?? '';
              const menuOpen = openMsgMenu === msgId;
              const replies = allMsgs.filter(m => m.parentId && m.parentId === msgId);

              return (
                <Box sx={{ display: 'flex', gap: '0.625rem' }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <OnlineAvatar userId={senderObj?._id ?? ''} src={senderObj?.avatar} isVerified={false} sx={{ width: 32, height: 32, fontSize: '0.75rem', background: GRAD, cursor: 'pointer' }}
                      onClick={() => senderObj && navigate(`/profile/${senderObj._id}`)}>
                      {senderName[0]}
                    </OnlineAvatar>
                    {replies.length > 0 && (
                      <Box sx={{ flex: 1, width: 2, background: '#E5E7EB', mt: '0.375rem', borderRadius: 1, minHeight: 24 }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Meta */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem', flexWrap: 'wrap' }}>
                      <Typography onClick={() => senderObj && navigate(`/profile/${senderObj._id}`)} sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#1F2937', cursor: 'pointer', fontFamily: 'Inter,sans-serif', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}>{senderName}</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>• {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}</Typography>
                    </Box>
                    {/* Content */}
                    {loc ? (() => {
                      const LOCATION_EXPIRY_MS = 24 * 60 * 60 * 1000;
                      const msgAge = countdownNow - new Date(msg.timestamp).getTime();
                      const locationExpired = msgAge > LOCATION_EXPIRY_MS;

                      // Non-party users never see location coordinates
                      if (!isParty) {
                        return <Typography sx={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, wordBreak: 'break-word', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>📍 Location shared (visible to exchange parties only)</Typography>;
                      }
                      // Location expired after 24 h
                      if (locationExpired) {
                        return (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', p: '0.5rem 0.875rem', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '0.625rem', mb: '0.5rem' }}>
                            <i className="fas fa-clock" style={{ color: '#9CA3AF', fontSize: '0.75rem' }} />
                            <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>Location expired (24 h limit)</Typography>
                          </Box>
                        );
                      }
                      // Party + verified → show coordinates + Maps link
                      if (isVideoVerified) {
                        return (
                          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', p: '0.5rem 0.875rem', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.625rem', mb: '0.5rem' }}>
                            <i className="fas fa-map-marker-alt" style={{ color: '#059669' }} />
                            <Typography sx={{ fontSize: '0.875rem', color: '#065F46', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>📍 {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</Typography>
                            <Box component="a" href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noopener noreferrer"
                              sx={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, fontFamily: 'Inter,sans-serif', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>Open in Maps</Box>
                          </Box>
                        );
                      }
                      // Party + unverified → prompt to verify
                      return (
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', p: '0.5rem 0.875rem', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '0.625rem', mb: '0.5rem' }}>
                          <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.75rem' }} />
                          <Typography onClick={() => navigate('/profile/edit')} sx={{ fontSize: '0.8125rem', color: '#D97706', fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter,sans-serif', '&:hover': { textDecoration: 'underline' } }}>Verify to view location</Typography>
                        </Box>
                      );
                    })() : (
                      <Typography sx={{ fontSize: '0.9375rem', color: '#374151', lineHeight: 1.7, wordBreak: 'break-word', fontFamily: 'Inter,sans-serif', mb: '0.5rem' }}>{msg.content}</Typography>
                    )}
                    {/* Actions */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.125rem', mb: '0.5rem' }}>
                      {depth < 2 && (
                        <Box component="button" onClick={() => setReplyOpen(v => !v)}
                          sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                          <i className="fas fa-comment" style={{ fontSize: '0.75rem' }} /> Reply
                        </Box>
                      )}
                      <Box component="button" onClick={() => navigator.clipboard.writeText(window.location.href)}
                        sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                        <i className="fas fa-share" style={{ fontSize: '0.75rem' }} /> Share
                      </Box>
                      <Box sx={{ position: 'relative' }}>
                        <Box component="button" onClick={() => setOpenMsgMenu(menuOpen ? null : msgId)}
                          sx={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', px: '0.5rem', py: '0.3rem', borderRadius: '0.25rem', fontSize: '0.8125rem', '&:hover': { background: '#F3F4F6', color: '#1F2937' } }}>
                          <i className="fas fa-ellipsis-h" style={{ fontSize: '0.75rem' }} />
                        </Box>
                        {menuOpen && (
                          <Box sx={{ position: 'absolute', top: '110%', left: 0, zIndex: 50, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', minWidth: 120, py: '0.25rem', overflow: 'hidden' }}
                            onMouseLeave={() => setOpenMsgMenu(null)}>
                            {isOwn ? (
                              <Box component="button" onClick={() => { setOpenMsgMenu(null); if (msg._id) deleteMsgMutation.mutate(msg._id); }}
                                sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', background: 'none', border: 'none', px: '0.875rem', py: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#DC2626', fontFamily: 'Inter,sans-serif', fontWeight: 600, textAlign: 'left', '&:hover': { background: '#FEF2F2' } }}>
                                <i className="fas fa-trash-alt" style={{ fontSize: '0.75rem' }} /> Delete
                              </Box>
                            ) : (
                              <Box component="button" onClick={() => { setOpenMsgMenu(null); alert('Report submitted. Thank you for keeping the community safe.'); }}
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
                      <Box sx={{ mt: '0.5rem', mb: '0.75rem' }}>
                        <Box component="textarea" autoFocus value={replyText}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
                          placeholder={`Reply to ${senderName}…`}
                          sx={{ width: '100%', minHeight: 72, p: '0.625rem 0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', color: '#1F2937', resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }} />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', mt: '0.5rem' }}>
                          <Box component="button" onClick={() => { setReplyOpen(false); setReplyText(''); }}
                            sx={{ background: '#F3F4F6', border: 'none', color: '#6B7280', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>Cancel</Box>
                          <Box component="button"
                            onClick={() => { if (replyText.trim()) { sendMsgMutation.mutate({ content: replyText, parentId: msgId }); setReplyText(''); setReplyOpen(false); } }}
                            sx={{ background: '#1F2937', color: '#fff', border: 'none', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>Reply</Box>
                        </Box>
                      </Box>
                    )}
                    {/* Nested replies */}
                    {replies.length > 0 && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', pl: '0.25rem', borderLeft: '2px solid #E5E7EB', mt: '0.5rem' }}>
                        {replies.map(r => <MsgCard key={r._id} msg={r} depth={depth + 1} />)}
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            };

            const topLevel = allMsgs.filter(m => !m.parentId);
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {topLevel.map((msg, idx) => <MsgCard key={msg._id ?? idx} msg={msg} />)}
                <div ref={messagesEndRef} />
              </Box>
            );
          })()}
        </Box>
      </Box>
      {ceModalOpen && (
        <CreateExchange
          modal
          open={ceModalOpen}
          onClose={() => setCeModalOpen(false)}
          modalTitle={ceModalTitle}
          sourceExchangeId={exchange._id}
          sourceWantedSkills={exchange.wantedSkills}
          sourceSeeking={exchange.seeking}
          sourceProviderOffering={
            (exchange.title.split(' ↔ ')[0]?.trim()) ||
            (exchange.offering?.split(' — ')[0]?.split(' (')[0]?.trim()) ||
            ''
          }
          sourceWantedSkillImages={(() => {
            const allImgs: string[] = exchange.seekingImages ?? [];
            let cursor = 0;
            return (exchange.wantedSkills ?? []).map((sk: any) => {
              const count = sk.imageCount ?? 0;
              const slice = allImgs.slice(cursor, cursor + count);
              cursor += count;
              return slice;
            });
          })()}
          preSelectedSeekingSkill={
            exchange.wantedSkills && exchange.wantedSkills.length === 1
              ? exchange.wantedSkills[0].name
              : ceSelectedWantedSkill || undefined
          }
        />
      )}
    </Layout>
  );
};

export default ExchangeDetail;
