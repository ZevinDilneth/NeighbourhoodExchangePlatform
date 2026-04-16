import React, { useState } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Exchange } from '../types';
import OnlineAvatar from '../components/OnlineAvatar';

const parseHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0.25, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
};
const PROF_MULT: Record<string, number> = { beginner: 0.8, intermediate: 1.0, expert: 1.5 };

const FAIRNESS_MINI: Record<string, { color: string; bg: string; border: string; emoji: string; label: string }> = {
  fair:             { color: '#059669', bg: 'rgba(5,150,105,0.08)',   border: 'rgba(5,150,105,0.25)',   emoji: '✅', label: 'Fair'        },
  needs_adjustment: { color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.25)',   emoji: '⚠️', label: 'Adjust'      },
  unfair:           { color: '#DC2626', bg: 'rgba(220,38,38,0.08)',  border: 'rgba(220,38,38,0.25)',   emoji: '❌', label: 'Unfair'      },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; icon: string }> = {
  open:      { color: '#4F46E5', bg: 'rgba(79,70,229,0.1)',   border: 'rgba(79,70,229,0.2)',   label: 'Open',      icon: 'fa-clock' },
  pending:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)',  label: 'Pending',   icon: 'fa-clock' },
  active:    { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.2)',  label: 'Active',    icon: 'fa-spinner fa-spin' },
  completed: { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)',  label: 'Completed', icon: 'fa-check-circle' },
  cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)',   label: 'Cancelled', icon: 'fa-times-circle' },
};

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  skill:   { icon: 'fa-chalkboard-teacher', label: 'Skill' },
  tool:    { icon: 'fa-tools',              label: 'Tool' },
  service: { icon: 'fa-handshake',          label: 'Service' },
};

const TAB_DEFS = [
  { label: 'All',       status: '',           icon: 'fa-exchange-alt' },
  { label: 'Open',      status: 'open',       icon: 'fa-bullhorn' },
  { label: 'Active',    status: 'active',     icon: 'fa-spinner' },
  { label: 'Pending',   status: 'pending',    icon: 'fa-clock' },
  { label: 'Completed', status: 'completed',  icon: 'fa-check-circle' },
  { label: 'Cancelled', status: 'cancelled',  icon: 'fa-times-circle' },
];

// ── Mini image slider ────────────────────────────────────────────────────────
const MiniSlider: React.FC<{ images: string[] }> = ({ images }) => {
  const [idx, setIdx] = useState(0);
  if (!images.length) return null;
  const isVideo = (u: string) => /\.(mp4|webm|ogg)$/i.test(u);
  return (
    <Box sx={{ position: 'relative', width: '100%', borderRadius: '0.5rem', overflow: 'hidden', mb: '0.75rem', aspectRatio: '16/9', background: '#000' }}>
      {isVideo(images[idx]) ? (
        <Box component="video" src={images[idx]} controls sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <Box component="img" src={images[idx]} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
      {images.length > 1 && (
        <>
          <Box component="button" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + images.length) % images.length); }}
            sx={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
            <i className="fas fa-chevron-left" />
          </Box>
          <Box component="button" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % images.length); }}
            sx={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
            <i className="fas fa-chevron-right" />
          </Box>
          <Box sx={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '4px' }}>
            {images.map((_, i) => (
              <Box key={i} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIdx(i); }}
                sx={{ width: i === idx ? 16 : 6, height: 6, borderRadius: '3px', background: i === idx ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer', transition: 'all 0.2s' }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

const ExchangeCard: React.FC<{ exchange: Exchange }> = ({ exchange }) => {
  const navigate = useNavigate();
  const status = STATUS_CONFIG[exchange.status] || STATUS_CONFIG.open;
  const type   = TYPE_CONFIG[exchange.type]    || TYPE_CONFIG.skill;

  return (
    <Box
      sx={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
        '&:hover': {
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* ── Card Header ── */}
      <Box sx={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', padding: '1.5rem' }}>

        {/* Row 1: type badge + ID + status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '0.75rem', flexWrap: 'wrap' }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.375rem 0.75rem',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#FFFFFF', borderRadius: '0.375rem',
            fontSize: '0.75rem', fontWeight: 500,
          }}>
            <i className={`fas ${type.icon}`} style={{ fontSize: '0.7rem' }} />
            {type.label}
          </Box>

          <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace' }}>
            #{exchange._id.slice(-6).toUpperCase()}
          </Box>

          <Box sx={{ flex: 1 }} />

          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.375rem 1rem',
            background: status.bg,
            color: status.color,
            border: `1px solid ${status.border}`,
            borderRadius: '2rem',
            fontSize: '0.75rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <i className={`fas ${status.icon}`} style={{ fontSize: '0.65rem' }} />
            {status.label}
          </Box>
        </Box>

        {/* Row 2: title */}
        <Box sx={{ fontSize: '1.25rem', fontWeight: 600, color: '#1F2937', mb: '0.75rem', lineHeight: 1.3 }}>
          {exchange.title || `${exchange.offering} ↔ ${exchange.seeking}`}
        </Box>

        {/* Row 3: participants */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <OnlineAvatar
            userId={exchange.requester._id}
            src={exchange.requester.avatar}
            isVerified={exchange.requester.isVerified}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${exchange.requester._id}`); }}
            sx={{ width: 32, height: 32, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)' }}
          >
            {exchange.requester.name[0]}
          </OnlineAvatar>
          <Box
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${exchange.requester._id}`); }}
            sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}
          >
            {exchange.requester.name}
          </Box>

          {exchange.provider ? (
            <>
              <i className="fas fa-exchange-alt" style={{ color: '#6B7280', fontSize: '0.8rem' }} />
              <OnlineAvatar
                userId={exchange.provider._id}
                src={exchange.provider.avatar}
                isVerified={exchange.provider.isVerified}
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${exchange.provider!._id}`); }}
                sx={{ width: 32, height: 32, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)' }}
              >
                {exchange.provider.name[0]}
              </OnlineAvatar>
              <Box
                onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${exchange.provider!._id}`); }}
                sx={{ fontSize: '0.875rem', color: '#1F2937', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}
              >
                {exchange.provider.name}
              </Box>
            </>
          ) : (
            <Box sx={{ fontSize: '0.875rem', color: '#9CA3AF', fontStyle: 'italic' }}>
              Waiting for a match...
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Card Body ── */}
      <Box sx={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto 1fr' }, gap: '1rem', alignItems: 'start' }}
           onClick={() => navigate(`/exchanges/${exchange._id}`)}>

        {/* OFFERING */}
        <Box sx={{ background: '#EEF2FF', borderRadius: '0.75rem', padding: '1rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem', mb: '0.625rem' }}>
            <i className="fas fa-gift" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Inter,sans-serif' }}>
              Offering
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', mb: '0.5rem', lineHeight: 1.3 }}>
            {exchange.offering}
          </Typography>
          {exchange.images && exchange.images.length > 0 && (
            <MiniSlider images={exchange.images} />
          )}
          {exchange.description && (
            <Typography sx={{ fontSize: '0.8125rem', color: '#4B5563', fontFamily: 'Inter,sans-serif', lineHeight: 1.6,
              display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {exchange.description}
            </Typography>
          )}
          {/* CEU breakdown */}
          {exchange.ceuValue > 0 && (() => {
            const hrs      = exchange.timeStart && exchange.timeEnd ? parseHours(exchange.timeStart, exchange.timeEnd) : 1;
            const sess     = Math.max(1, exchange.sessions ?? 1);
            const profTag  = exchange.tags?.find((t: string) => t in PROF_MULT) ?? 'intermediate';
            const profMult = PROF_MULT[profTag] ?? 1.0;
            const profLabel= profTag.charAt(0).toUpperCase() + profTag.slice(1);
            const perSess  = Math.max(1, Math.round(hrs * profMult));
            const calcCeu  = perSess * sess;
            const offered  = exchange.ceuValue;
            const isCeuEx  = /^\d+\s*CEU$/i.test(exchange.offering ?? '');
            const ratio    = calcCeu > 0 ? offered / calcCeu : 1;
            const isFair   = ratio >= 1.0;
            const isLow    = ratio >= 0.8 && ratio < 1.0;
            const isUnfair = ratio < 0.8;
            const fColor   = isUnfair ? '#DC2626' : isLow ? '#D97706' : '#059669';
            const fBg      = isUnfair ? 'rgba(220,38,38,0.07)' : isLow ? 'rgba(217,119,6,0.07)' : 'rgba(5,150,105,0.07)';
            const fIcon    = isUnfair ? 'fa-times-circle' : isLow ? 'fa-exclamation-triangle' : 'fa-check-circle';
            return (
              <Box sx={{ mt: '0.625rem', pt: '0.625rem', borderTop: '1px solid rgba(79,70,229,0.1)' }}>
                {/* compact formula line */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '0.375rem' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.6rem' }} />
                    <Typography sx={{ fontSize: '0.64rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                      {hrs.toFixed(1).replace(/\.0$/, '')}h × ×{profMult.toFixed(1)} ({profLabel}) × {sess}sess
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.64rem', color: '#4F46E5', fontFamily: 'Poppins,sans-serif', fontWeight: 700 }}>
                    = {calcCeu} CEU
                  </Typography>
                </Box>
                {/* offered + fairness */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <i className={`fas ${fIcon}`} style={{ color: fColor, fontSize: '0.6rem' }} />
                    <Typography sx={{ fontSize: '0.62rem', color: fColor, fontFamily: 'Inter,sans-serif', fontWeight: 600 }}>
                      {isCeuEx ? (isFair ? 'Fair offer' : isLow ? 'Slightly low' : 'Unfair offer') : 'Skill value'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', px: '0.5rem', py: '0.15rem', borderRadius: '2rem', background: isCeuEx && !isFair ? fBg : 'linear-gradient(135deg,#4F46E5,#10B981)', border: isCeuEx && !isFair ? `1px solid ${fColor}33` : 'none', color: isCeuEx && !isFair ? fColor : '#FFF', fontSize: '0.7rem', fontWeight: 700, fontFamily: 'Inter,sans-serif' }}>
                    <i className="fas fa-coins" style={{ fontSize: '0.6rem' }} />
                    {offered} CEU{isCeuEx && !isFair ? ` / ${calcCeu}` : ''}
                  </Box>
                </Box>
              </Box>
            );
          })()}
        </Box>

        {/* Separator — CEU + fairness */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', pt: '2.25rem', minWidth: 72 }}>
          <i className="fas fa-exchange-alt" style={{ color: '#9CA3AF', fontSize: '1rem' }} />

          {/* CEU value pill */}
          {exchange.ceuValue > 0 && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              px: '0.6rem', py: '0.2rem', borderRadius: '2rem',
              background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))',
              border: '1px solid rgba(79,70,229,0.2)',
              fontSize: '0.72rem', fontWeight: 700,
              color: '#4F46E5', fontFamily: 'Inter,sans-serif',
              whiteSpace: 'nowrap',
            }}>
              <i className="fas fa-coins" style={{ fontSize: '0.6rem' }} />
              {exchange.ceuValue} CEU
            </Box>
          )}

          {/* Fairness score badge */}
          {exchange.fairnessScore != null && (() => {
            const lbl = (exchange.fairnessLabel ?? 'fair') as keyof typeof FAIRNESS_MINI;
            const cfg = FAIRNESS_MINI[lbl] ?? FAIRNESS_MINI.fair;
            const pct = Math.round(exchange.fairnessScore * 100);
            return (
              <Box sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              }}>
                {/* Score bar */}
                <Box sx={{ width: 56, height: 4, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden' }}>
                  <Box sx={{ height: '100%', borderRadius: 2, background: cfg.color, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                </Box>
                {/* Label badge */}
                <Box sx={{
                  px: '0.5rem', py: '0.15rem', borderRadius: '2rem',
                  background: cfg.bg, border: `1px solid ${cfg.border}`,
                  fontSize: '0.65rem', fontWeight: 700, color: cfg.color,
                  fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: '0.2rem',
                }}>
                  {cfg.emoji} {pct}%
                </Box>
              </Box>
            );
          })()}
        </Box>

        {/* SEEKING */}
        <Box sx={{ background: '#ECFDF5', borderRadius: '0.75rem', padding: '1rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem', mb: '0.625rem' }}>
            <i className="fas fa-search" style={{ color: '#10B981', fontSize: '0.75rem' }} />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Inter,sans-serif' }}>
              Seeking
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', lineHeight: 1.3 }}>
            {exchange.seeking}
          </Typography>
        </Box>
      </Box>

      {/* ── Fairness alert strip — shown for non-fair labels ── */}
      {exchange.fairnessScore != null && exchange.fairnessLabel !== 'fair' && (() => {
        const lbl = (exchange.fairnessLabel ?? 'needs_adjustment') as keyof typeof FAIRNESS_MINI;
        const cfg = FAIRNESS_MINI[lbl] ?? FAIRNESS_MINI.needs_adjustment;
        const pct = Math.round(exchange.fairnessScore * 100);
        return (
          <Box sx={{
            px: '1.5rem', py: '0.625rem',
            background: cfg.bg, borderTop: `1px solid ${cfg.border}`,
            display: 'flex', alignItems: 'center', gap: '0.625rem',
          }}>
            <i className="fas fa-balance-scale" style={{ color: cfg.color, fontSize: '0.8rem', flexShrink: 0 }} />
            <Typography sx={{ fontSize: '0.8rem', color: cfg.color, fontFamily: 'Inter,sans-serif', fontWeight: 600, flex: 1 }}>
              {cfg.emoji} Fairness {cfg.label} — {pct}% score
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: cfg.color, fontFamily: 'Inter,sans-serif', opacity: 0.85 }}>
              View details →
            </Typography>
          </Box>
        );
      })()}

      {/* ── Card Footer ── */}
      <Box sx={{
        background: '#F9FAFB', borderTop: '1px solid #E5E7EB',
        padding: '1rem 1.5rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '0.75rem',
      }}>
        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {exchange.status === 'pending' && (
            <Box component="button" onClick={() => navigate(`/exchanges/${exchange._id}`)} sx={{
              background: '#10B981', color: '#FFFFFF', border: 'none',
              borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
              '&:hover': { background: '#0da271', transform: 'translateY(-2px)' },
            }}>
              <i className="fas fa-check" />
              Confirm
            </Box>
          )}
          {(exchange.status === 'active' || exchange.status === 'pending') && (
            <Box component="button" onClick={() => navigate(`/exchanges/${exchange._id}`)} sx={{
              background: '#F59E0B', color: '#FFFFFF', border: 'none',
              borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
              '&:hover': { background: '#d97706', transform: 'translateY(-2px)' },
            }}>
              <i className="fas fa-calendar-alt" />
              Reschedule
            </Box>
          )}
          {exchange.status !== 'completed' && exchange.status !== 'cancelled' && (
            <Box component="button" onClick={() => navigate(`/exchanges/${exchange._id}`)} sx={{
              background: '#EF4444', color: '#FFFFFF', border: 'none',
              borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
              fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
              transition: 'all 0.2s',
              '&:hover': { background: '#dc2626', transform: 'translateY(-2px)' },
            }}>
              <i className="fas fa-times" />
              Cancel
            </Box>
          )}
        </Box>

        {/* View / Chat button */}
        <Box component="button" onClick={() => navigate(`/exchanges/${exchange._id}`)} sx={{
          background: 'rgba(79,70,229,0.1)', color: '#4F46E5', border: 'none',
          borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
          fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          transition: 'all 0.2s',
          '&:hover': { background: 'rgba(79,70,229,0.2)', transform: 'translateY(-2px)' },
        }}>
          <i className="fas fa-comment-alt" />
          View Details
        </Box>
      </Box>
    </Box>
  );
};

const MyExchanges: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);

  // Fetch all exchanges once for counts + display
  const { data, isLoading } = useQuery({
    queryKey: ['myExchanges'],
    queryFn: async () => {
      const res = await api.get('/exchanges/me?limit=100');
      return res.data as { exchanges: Exchange[]; total: number };
    },
  });

  const allExchanges = data?.exchanges || [];

  // Count per status
  const counts: Record<string, number> = { '': allExchanges.length };
  allExchanges.forEach((ex) => {
    counts[ex.status] = (counts[ex.status] || 0) + 1;
  });

  // Filter by selected tab
  const tabStatus = TAB_DEFS[activeTab].status;
  const displayed = tabStatus
    ? allExchanges.filter((ex) => ex.status === tabStatus)
    : allExchanges;

  return (
    <Layout>
      {/* ── Page Header ── */}
      <Box sx={{ mb: '2rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '0.5rem' }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '0.75rem', flexShrink: 0,
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFFFFF', fontSize: '1.25rem',
          }}>
            <i className="fas fa-exchange-alt" />
          </Box>
          <Box>
            <Box sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700,
              fontSize: '2rem', color: '#1F2937', lineHeight: 1.2 }}>
              My Exchanges
            </Box>
            <Box sx={{ color: '#6B7280', fontSize: '1rem', mt: '0.25rem' }}>
              Manage all your skill and tool exchanges in one place
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Filter Tabs ── */}
      <Box sx={{
        background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)', mb: '2rem', overflow: 'hidden',
      }}>
        {/* Tab header row */}
        <Box sx={{
          background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
          display: 'flex', overflowX: 'auto',
          '&::-webkit-scrollbar': { height: 4 },
          '&::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: 2 },
        }}>
          {TAB_DEFS.map((tab, idx) => {
            const isActive = activeTab === idx;
            const count = counts[tab.status] ?? 0;
            return (
              <Box key={tab.label} component="button" onClick={() => setActiveTab(idx)} sx={{
                flex: '0 0 auto',
                background: 'none',
                border: 'none',
                borderBottom: isActive
                  ? '3px solid #4F46E5'
                  : '3px solid transparent',
                color: isActive ? '#4F46E5' : '#6B7280',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                padding: '1rem 2rem',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                fontFamily: 'Inter, sans-serif',
                '&:hover': { color: '#4F46E5', background: 'rgba(79,70,229,0.04)' },
              }}>
                <i className={`fas ${tab.icon}`} style={{ fontSize: '0.8rem' }} />
                {tab.label}
                {!isLoading && (
                  <Box component="span" sx={{
                    display: 'inline-block',
                    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                    color: '#FFFFFF',
                    borderRadius: '1rem',
                    padding: '0.125rem 0.5rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minWidth: 24,
                    textAlign: 'center',
                    lineHeight: 1.6,
                  }}>
                    {count}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>

        {/* New Exchange button row */}
        <Box sx={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <Box component="button" onClick={() => navigate('/exchanges/create')} sx={{
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#FFFFFF', border: 'none', borderRadius: '0.5rem',
            padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s',
            '&:hover': { opacity: 0.9, transform: 'translateY(-2px)' },
          }}>
            <i className="fas fa-plus-circle" />
            New Exchange
          </Box>
        </Box>
      </Box>

      {/* ── Content ── */}
      {isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: '1.5rem' }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={300} sx={{ borderRadius: '0.75rem' }} />
          ))}
        </Box>
      ) : displayed.length === 0 ? (
        <Box sx={{
          background: '#FFFFFF', border: '2px dashed #E5E7EB', borderRadius: '0.75rem',
          textAlign: 'center', padding: '4rem 2rem',
        }}>
          <Box sx={{ fontSize: '3rem', color: '#E5E7EB', mb: '1.5rem' }}>
            <i className="fas fa-exchange-alt" />
          </Box>
          <Box sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700,
            fontSize: '1.5rem', color: '#1F2937', mb: '0.75rem' }}>
            {tabStatus ? `No ${TAB_DEFS[activeTab].label} Exchanges` : 'No Exchanges Yet'}
          </Box>
          <Box sx={{ color: '#6B7280', fontSize: '0.875rem', mb: '1.5rem',
            maxWidth: 400, mx: 'auto', lineHeight: 1.6 }}>
            {tabStatus
              ? `You don't have any ${TAB_DEFS[activeTab].label.toLowerCase()} exchanges right now.`
              : 'Start swapping skills and tools with your neighbors!'}
          </Box>
          <Box component="button" onClick={() => navigate('/exchanges/create')} sx={{
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#FFFFFF', border: 'none', borderRadius: '0.5rem',
            padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            transition: 'all 0.2s', '&:hover': { opacity: 0.9 },
          }}>
            <i className="fas fa-search" />
            Find Exchange Opportunities
          </Box>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: '1.5rem' }}>
          {displayed.map((exchange) => (
            <ExchangeCard key={exchange._id} exchange={exchange} />
          ))}
        </Box>
      )}
    </Layout>
  );
};

export default MyExchanges;
