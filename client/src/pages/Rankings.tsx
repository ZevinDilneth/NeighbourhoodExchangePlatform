import React, { useState } from 'react';
import { Box, Typography, Skeleton, Tooltip } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  UserRanking,
  RankingTier,
  RankingCategory,
  CategoryBreakdown,
  RankingMeta,
} from '../types';
import OnlineAvatar from '../components/OnlineAvatar';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GRAD   = 'linear-gradient(135deg, #4F46E5, #10B981)';
const INDIGO  = '#4F46E5';
const EMERALD = '#10B981';

// ─── Tier config ──────────────────────────────────────────────────────────────
const TIER_COLORS: Record<RankingTier, { bg: string; text: string; glow: string; bar: string }> = {
  diamond:  { bg: '#EFF6FF', text: '#1D4ED8', glow: 'rgba(29,78,216,0.2)',  bar: '#1D4ED8' },
  platinum: { bg: '#F5F3FF', text: '#6D28D9', glow: 'rgba(109,40,217,0.2)', bar: '#6D28D9' },
  gold:     { bg: '#FFFBEB', text: '#B45309', glow: 'rgba(180,83,9,0.2)',   bar: '#D97706' },
  silver:   { bg: '#F9FAFB', text: '#374151', glow: 'rgba(55,65,81,0.12)',  bar: '#9CA3AF' },
  bronze:   { bg: '#FFF7ED', text: '#92400E', glow: 'rgba(146,64,14,0.15)', bar: '#B45309' },
};

const TIER_EMOJI: Record<RankingTier, string> = {
  diamond: '💎', platinum: '🥇', gold: '⭐', silver: '🥈', bronze: '🥉',
};

// ─── Category tabs config ─────────────────────────────────────────────────────
const CATEGORY_TABS: { key: RankingCategory | 'overall'; label: string; icon: string }[] = [
  { key: 'overall',          label: 'Overall',    icon: 'fa-trophy'          },
  { key: 'skillExchange',    label: 'Skills',     icon: 'fa-graduation-cap'  },
  { key: 'toolSharing',      label: 'Tools',      icon: 'fa-tools'           },
  { key: 'qaParticipation',  label: 'Q&A',        icon: 'fa-question-circle' },
  { key: 'communityBuilding',label: 'Community',  icon: 'fa-users'           },
  { key: 'chainSuccess',     label: 'Chains',     icon: 'fa-link'            },
  { key: 'fairnessHistory',  label: 'Fairness',   icon: 'fa-balance-scale'   },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Tier badge pill */
const TierBadge: React.FC<{ tier: RankingTier; size?: 'sm' | 'md' | 'lg' }> = ({
  tier,
  size = 'md',
}) => {
  const cfg     = TIER_COLORS[tier];
  const fontSize = size === 'sm' ? '0.6875rem' : size === 'lg' ? '0.9375rem' : '0.8125rem';
  const px       = size === 'sm' ? '0.5rem' : size === 'lg' ? '0.875rem' : '0.625rem';
  const py       = size === 'sm' ? '0.125rem' : size === 'lg' ? '0.375rem' : '0.2rem';

  return (
    <Box
      component="span"
      sx={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        '0.25rem',
        background: cfg.bg,
        color:      cfg.text,
        borderRadius: '2rem',
        px, py,
        fontSize,
        fontWeight: 700,
        fontFamily: 'Inter, sans-serif',
        boxShadow:  `0 0 0 1px ${cfg.glow}`,
        whiteSpace: 'nowrap',
      }}
    >
      {TIER_EMOJI[tier]}
      {tier.charAt(0).toUpperCase() + tier.slice(1)}
    </Box>
  );
};

/** Trend indicator */
const TrendBadge: React.FC<{ trend: UserRanking['trend']; delta?: number }> = ({ trend, delta }) => {
  const cfg = {
    rising:  { icon: 'fa-arrow-up',    color: '#059669', bg: 'rgba(5,150,105,0.08)'  },
    stable:  { icon: 'fa-minus',       color: '#6B7280', bg: 'rgba(107,114,128,0.08)'},
    falling: { icon: 'fa-arrow-down',  color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  }[trend];

  return (
    <Box
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
        background: cfg.bg, borderRadius: '2rem',
        px: '0.4rem', py: '0.1rem',
        fontSize: '0.6875rem', fontWeight: 600,
        fontFamily: 'Inter, sans-serif', color: cfg.color,
      }}
    >
      <i className={`fas ${cfg.icon}`} style={{ fontSize: '0.5rem' }} />
      {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : trend}
    </Box>
  );
};

/** Score ring (circular progress) */
const ScoreRing: React.FC<{ score: number; size?: number; tier: RankingTier }> = ({
  score,
  size = 72,
  tier,
}) => {
  const r      = (size - 8) / 2;
  const circ   = 2 * Math.PI * r;
  const dash   = (score / 100) * circ;
  const cfg    = TIER_COLORS[tier];

  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E7EB" strokeWidth={7} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={cfg.bar}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <Box
        sx={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: size > 60 ? '1.1rem' : '0.875rem', color: cfg.text, lineHeight: 1 }}>
          {score.toFixed(0)}
        </Typography>
        <Typography sx={{ fontSize: '0.55rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          /100
        </Typography>
      </Box>
    </Box>
  );
};

/** Sub-dimension bar row (Quantity, Quality, Consistency, Diversity) */
const SubDimensionBars: React.FC<{ breakdown: CategoryBreakdown; tier: RankingTier }> = ({
  breakdown,
  tier,
}) => {
  const cfg = TIER_COLORS[tier];
  const dims = [
    { key: 'quantity',    label: 'Quantity',    icon: 'fa-chart-bar' },
    { key: 'quality',     label: 'Quality',     icon: 'fa-star' },
    { key: 'consistency', label: 'Consistency', icon: 'fa-calendar-check' },
    { key: 'diversity',   label: 'Diversity',   icon: 'fa-th' },
  ] as const;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {dims.map(({ key, label, icon }) => {
        const val = breakdown[key];
        return (
          <Box key={key}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '0.2rem' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <i className={`fas ${icon}`} style={{ fontSize: '0.625rem', color: '#9CA3AF' }} />
                <Typography sx={{ fontSize: '0.6875rem', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                  {label}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: cfg.text, fontFamily: 'Inter, sans-serif' }}>
                {val.toFixed(0)}
              </Typography>
            </Box>
            <Box sx={{ height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
              <Box sx={{ height: '100%', borderRadius: 3, background: cfg.bar, width: `${val}%`, transition: 'width 0.6s ease' }} />
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

/** Leaderboard row */
const LeaderboardRow: React.FC<{
  ranking: UserRanking;
  position: number;
  isMe: boolean;
  category: RankingCategory | 'overall';
  meta: RankingMeta;
}> = ({ ranking, position, isMe, category, meta }) => {
  const score    = category === 'overall'
    ? ranking.overallScore
    : ranking.categories[category]?.score ?? 0;
  const cfg      = TIER_COLORS[ranking.tier];
  const initials = ranking.user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const medalColor = position === 1 ? '#F59E0B' : position === 2 ? '#9CA3AF' : position === 3 ? '#B45309' : undefined;

  return (
    <Box
      sx={{
        display:   'flex',
        alignItems: 'center',
        gap:        '0.875rem',
        padding:    '0.75rem 1.125rem',
        background: isMe ? '#F5F3FF' : '#FFFFFF',
        borderBottom: '1px solid #F3F4F6',
        transition: 'background 0.15s',
        '&:hover':  { background: isMe ? '#EDE9FE' : '#FAFAFA' },
        '&:last-child': { borderBottom: 'none' },
      }}
    >
      {/* Position */}
      <Box sx={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
        {position <= 3 ? (
          <Box sx={{ fontSize: '1.125rem', lineHeight: 1 }}>
            {position === 1 ? '🥇' : position === 2 ? '🥈' : '🥉'}
          </Box>
        ) : (
          <Typography
            sx={{
              fontFamily: 'Poppins, sans-serif', fontWeight: 700,
              fontSize: '0.9375rem', color: '#9CA3AF',
            }}
          >
            {position}
          </Typography>
        )}
      </Box>

      {/* Avatar */}
      <OnlineAvatar
        userId={ranking.user._id}
        src={ranking.user.avatar}
        sx={{
          width: 40, height: 40, flexShrink: 0,
          fontSize: '0.8125rem', fontWeight: 700,
          background: cfg.bg, color: cfg.text,
          border: isMe ? `2px solid ${INDIGO}` : undefined,
        }}
      >
        {initials}
      </OnlineAvatar>

      {/* Name + tier */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' }}>
          <Typography
            sx={{
              fontFamily: 'Inter, sans-serif', fontWeight: isMe ? 700 : 600,
              fontSize: '0.9375rem', color: isMe ? INDIGO : '#1F2937',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {isMe ? `${ranking.user.name} (You)` : ranking.user.name}
          </Typography>
          <TierBadge tier={ranking.tier} size="sm" />
        </Box>
        <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
          {ranking.user.location?.city ?? 'Unknown area'} · Rank #{ranking.rank}
        </Typography>
      </Box>

      {/* Score */}
      <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
        <Typography
          sx={{
            fontFamily: 'Poppins, sans-serif', fontWeight: 800,
            fontSize: '1.25rem', color: cfg.text, lineHeight: 1,
          }}
        >
          {score.toFixed(1)}
        </Typography>
        <TrendBadge trend={ranking.trend} delta={ranking.overallScore - ranking.previousScore} />
      </Box>
    </Box>
  );
};

/** My ranking breakdown card */
const MyRankingCard: React.FC<{
  ranking: UserRanking;
  meta: RankingMeta;
  onRecalculate: () => void;
  isRecalculating: boolean;
}> = ({ ranking, meta, onRecalculate, isRecalculating }) => {
  const [activeCategory, setActiveCategory] = useState<RankingCategory>('skillExchange');
  const cfg = TIER_COLORS[ranking.tier];
  const delta = ranking.overallScore - ranking.previousScore;

  const orderedCats = Object.keys(meta.CATEGORY_META) as RankingCategory[];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hero card */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: `1px solid ${cfg.glow}`,
          borderRadius: '0.875rem',
          boxShadow: `0 4px 16px ${cfg.glow}`,
          overflow: 'hidden',
        }}
      >
        {/* Top gradient stripe */}
        <Box sx={{ height: 4, background: cfg.bar }} />

        <Box sx={{ padding: '1.25rem 1.5rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1.25rem', mb: '1.25rem' }}>
            <ScoreRing score={ranking.overallScore} tier={ranking.tier} size={80} />

            <Box sx={{ flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem', flexWrap: 'wrap' }}>
                <TierBadge tier={ranking.tier} size="lg" />
                <TrendBadge trend={ranking.trend} delta={delta} />
              </Box>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.75rem', color: cfg.text, lineHeight: 1, mb: '0.25rem' }}>
                #{ranking.rank}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                <i className="fas fa-fire" style={{ color: '#F59E0B', marginRight: '0.3rem' }} />
                {ranking.streakDays > 0
                  ? `${ranking.streakDays}-day streak`
                  : 'No active streak'} ·{' '}
                Updated {formatDistanceToNow(new Date(ranking.lastCalculatedAt), { addSuffix: true })}
              </Typography>
            </Box>

            {/* Recalculate button */}
            <Box
              component="button"
              onClick={onRecalculate}
              disabled={isRecalculating}
              sx={{
                background: isRecalculating ? '#F3F4F6' : '#EEF2FF',
                border: 'none', borderRadius: '0.5rem',
                px: '0.875rem', py: '0.5rem',
                color: isRecalculating ? '#9CA3AF' : INDIGO,
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.8125rem', fontWeight: 600,
                cursor: isRecalculating ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                transition: 'all 0.15s',
                '&:hover': !isRecalculating ? { background: '#E0E7FF' } : {},
              }}
              title="Recalculate my ranking now"
            >
              <i className={`fas fa-sync-alt ${isRecalculating ? 'fa-spin' : ''}`} style={{ fontSize: '0.75rem' }} />
              {isRecalculating ? 'Calculating…' : 'Refresh'}
            </Box>
          </Box>

          {/* Category score row */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)' },
              gap: '0.5rem',
            }}
          >
            {orderedCats.map(cat => {
              const catMeta = meta.CATEGORY_META[cat];
              const bd      = ranking.categories[cat];
              const isActive = cat === activeCategory;
              return (
                <Box
                  key={cat}
                  component="button"
                  onClick={() => setActiveCategory(cat)}
                  sx={{
                    background: isActive ? cfg.bg : '#F9FAFB',
                    border: `1px solid ${isActive ? cfg.bar : '#E5E7EB'}`,
                    borderRadius: '0.625rem',
                    padding: '0.625rem 0.5rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    '&:hover': { background: cfg.bg },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', mb: '0.375rem' }}>
                    <i className={`fas ${catMeta.icon}`} style={{ color: isActive ? cfg.text : '#9CA3AF', fontSize: '0.625rem' }} />
                    <Typography sx={{ fontSize: '0.625rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {(catMeta.weight * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif', mb: '0.2rem', lineHeight: 1.2 }}>
                    {catMeta.label}
                  </Typography>
                  <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1.125rem', color: isActive ? cfg.text : '#1F2937', lineHeight: 1 }}>
                    {bd.score.toFixed(0)}
                  </Typography>
                  {/* Mini bar */}
                  <Box sx={{ height: 3, borderRadius: 2, background: '#E5E7EB', overflow: 'hidden', mt: '0.375rem' }}>
                    <Box sx={{ height: '100%', borderRadius: 2, background: cfg.bar, width: `${bd.score}%` }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* Selected category breakdown */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.875rem',
          padding: '1.25rem 1.5rem',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', mb: '1rem' }}>
          <Box
            sx={{
              width: 40, height: 40, borderRadius: '0.625rem',
              background: cfg.bg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: cfg.text, fontSize: '1rem',
            }}
          >
            <i className={`fas ${meta.CATEGORY_META[activeCategory].icon}`} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.25rem' }}>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
                {meta.CATEGORY_META[activeCategory].label}
              </Typography>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: '1rem', color: cfg.text }}>
                {ranking.categories[activeCategory].score.toFixed(0)}/100
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {meta.CATEGORY_META[activeCategory].description}
            </Typography>
          </Box>
        </Box>

        <SubDimensionBars breakdown={ranking.categories[activeCategory]} tier={ranking.tier} />

        {/* Weight info */}
        <Box
          sx={{
            mt: '0.875rem',
            background: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '0.5rem',
            px: '0.75rem', py: '0.5rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <i className="fas fa-info-circle" style={{ color: '#9CA3AF', fontSize: '0.75rem' }} />
          <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
            This category contributes{' '}
            <strong>{(meta.CATEGORY_META[activeCategory].weight * 100).toFixed(0)}%</strong>{' '}
            to your overall score. Category score = Quantity (30%) + Quality (35%) + Consistency (20%) + Diversity (15%).
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

const Rankings: React.FC = () => {
  const { user } = useAuth();
  const qc       = useQueryClient();
  const [tab,         setTab]         = useState<'leaderboard' | 'my-ranking'>('leaderboard');
  const [activeSort,  setActiveSort]  = useState<RankingCategory | 'overall'>('overall');
  const [tierFilter,  setTierFilter]  = useState<RankingTier | 'all'>('all');

  // ── Leaderboard query ─────────────────────────────────────────────────────
  const { data: lbData, isLoading: lbLoading } = useQuery({
    queryKey: ['rankings', 'leaderboard', activeSort, tierFilter],
    queryFn:  async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (activeSort !== 'overall') params.set('category', activeSort);
      if (tierFilter !== 'all')     params.set('tier', tierFilter);
      const res = await api.get(`/rankings/leaderboard?${params}`);
      return res.data as {
        rankings: UserRanking[];
        total: number;
        meta: RankingMeta;
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── My ranking query ──────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['rankings', 'me'],
    queryFn:  async () => {
      const res = await api.get('/rankings/me');
      return res.data as { ranking: UserRanking | null; meta: RankingMeta };
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Recalculate mutation ──────────────────────────────────────────────────
  const recalcMutation = useMutation({
    mutationFn: () => api.post('/rankings/recalculate'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rankings'] });
    },
  });

  const myId = user?._id ?? '';
  const rankings = lbData?.rankings ?? [];
  const lbMeta   = lbData?.meta;
  const myRanking = myData?.ranking;
  const myMeta    = myData?.meta;

  const tiers: (RankingTier | 'all')[] = ['all', 'diamond', 'platinum', 'gold', 'silver', 'bronze'];

  return (
    <Layout>
      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          background: GRAD,
          borderRadius: '0.75rem',
          padding: '1.75rem 2rem',
          mb: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute', inset: 0, opacity: 0.06,
            backgroundImage: `radial-gradient(circle, #fff 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '0.625rem' }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: '0.75rem',
                background: 'rgba(255,255,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFF', fontSize: '1.375rem',
              }}
            >
              <i className="fas fa-trophy" />
            </Box>
            <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#FFF', lineHeight: 1.2 }}>
              Community Rankings
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.88)', fontFamily: 'Inter, sans-serif', lineHeight: 1.6, mb: '1.125rem', maxWidth: 560 }}>
            Scores are calculated across 6 dimensions — skill exchanges, tool sharing, Q&A, community building, chain success, and fairness history.
          </Typography>

          {/* Tier legend pills */}
          <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {(['diamond', 'platinum', 'gold', 'silver', 'bronze'] as RankingTier[]).map(tier => (
              <Box
                key={tier}
                sx={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: 'rgba(255,255,255,0.14)',
                  borderRadius: '2rem', px: '0.625rem', py: '0.25rem',
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#FFF', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  {TIER_EMOJI[tier]}{' '}
                  {lbMeta ? `${lbMeta.TIER_THRESHOLDS[tier].min}+` : tier}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ── Tab bar ──────────────────────────────────────────────────────────── */}
      <Box
        sx={{
          display: 'flex', gap: '0.25rem', mb: '1.25rem',
          background: '#F3F4F6', borderRadius: '0.625rem', padding: '0.25rem',
          width: 'fit-content',
        }}
      >
        {([
          { key: 'leaderboard', label: 'Leaderboard', icon: 'fa-list-ol' },
          { key: 'my-ranking',  label: 'My Ranking',  icon: 'fa-user-chart' },
        ] as const).map(({ key, label, icon }) => (
          <Box
            key={key}
            component="button"
            onClick={() => setTab(key)}
            sx={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              background: tab === key ? '#FFFFFF' : 'transparent',
              border: 'none', borderRadius: '0.375rem',
              px: '1rem', py: '0.5rem',
              fontSize: '0.875rem', fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
              color: tab === key ? INDIGO : '#6B7280',
              cursor: 'pointer',
              boxShadow: tab === key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <i className={`fas ${icon}`} style={{ fontSize: '0.75rem' }} />
            {label}
          </Box>
        ))}
      </Box>

      {/* ── Leaderboard tab ──────────────────────────────────────────────────── */}
      {tab === 'leaderboard' && (
        <Box>
          {/* Category sort tabs */}
          <Box sx={{ display: 'flex', gap: '0.25rem', mb: '0.875rem', overflowX: 'auto', pb: '0.25rem' }}>
            {CATEGORY_TABS.map(({ key, label, icon }) => (
              <Box
                key={key}
                component="button"
                onClick={() => setActiveSort(key)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  background: activeSort === key ? INDIGO : '#F3F4F6',
                  color:      activeSort === key ? '#FFF'  : '#6B7280',
                  border:     'none', borderRadius: '0.5rem',
                  px: '0.75rem', py: '0.4rem',
                  fontSize: '0.8125rem', fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s',
                }}
              >
                <i className={`fas ${icon}`} style={{ fontSize: '0.625rem' }} />
                {label}
              </Box>
            ))}
          </Box>

          {/* Tier filter */}
          <Box sx={{ display: 'flex', gap: '0.375rem', mb: '1rem', flexWrap: 'wrap' }}>
            {tiers.map(t => {
              const emoji = t === 'all' ? '🏅' : TIER_EMOJI[t];
              const label = t === 'all' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1);
              return (
                <Box
                  key={t}
                  component="button"
                  onClick={() => setTierFilter(t)}
                  sx={{
                    background: tierFilter === t ? (t === 'all' ? INDIGO : TIER_COLORS[t as RankingTier].bg) : '#F3F4F6',
                    color:      tierFilter === t ? (t === 'all' ? '#FFF'  : TIER_COLORS[t as RankingTier].text) : '#6B7280',
                    border:     'none', borderRadius: '2rem',
                    px: '0.75rem', py: '0.3rem',
                    fontSize: '0.8125rem', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {emoji} {label}
                </Box>
              );
            })}
          </Box>

          {/* Table */}
          <Box
            sx={{
              background: '#FFFFFF',
              border:     '1px solid #E5E7EB',
              borderRadius: '0.875rem',
              overflow:   'hidden',
              boxShadow:  '0 1px 3px rgba(0,0,0,0.06)',
            }}
          >
            {lbLoading && (
              <Box sx={{ p: '1rem' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} height={64} sx={{ mb: '0.25rem', borderRadius: '0.5rem' }} />
                ))}
              </Box>
            )}

            {!lbLoading && rankings.length === 0 && (
              <Box sx={{ padding: '3rem', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.9375rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                  No rankings yet. Be the first to calculate yours!
                </Typography>
              </Box>
            )}

            {!lbLoading && rankings.map((r, idx) => (
              <LeaderboardRow
                key={r._id}
                ranking={r}
                position={idx + 1}
                isMe={r.user._id === myId}
                category={activeSort}
                meta={lbMeta!}
              />
            ))}
          </Box>

          {!lbLoading && lbData && (
            <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', textAlign: 'center', mt: '0.75rem' }}>
              Showing {rankings.length} of {lbData.total} ranked users
            </Typography>
          )}
        </Box>
      )}

      {/* ── My Ranking tab ───────────────────────────────────────────────────── */}
      {tab === 'my-ranking' && (
        <>
          {myLoading && (
            <Box>
              <Skeleton variant="rounded" height={280} sx={{ borderRadius: '0.875rem', mb: '1rem' }} />
              <Skeleton variant="rounded" height={200} sx={{ borderRadius: '0.875rem' }} />
            </Box>
          )}

          {!myLoading && !myRanking && (
            <Box
              sx={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: '0.875rem', padding: '3rem 2rem', textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%', background: '#EEF2FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: '1rem', fontSize: '1.5rem', color: INDIGO,
                }}
              >
                <i className="fas fa-trophy" />
              </Box>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mb: '0.5rem' }}>
                No ranking yet
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter, sans-serif', mb: '1.5rem', maxWidth: 380, mx: 'auto' }}>
                Calculate your ranking to see how you compare across all six dimensions.
              </Typography>
              <Box
                component="button"
                onClick={() => recalcMutation.mutate()}
                disabled={recalcMutation.isPending}
                sx={{
                  background: GRAD, color: '#FFF', border: 'none',
                  borderRadius: '0.5rem', px: '2rem', py: '0.75rem',
                  fontSize: '0.9375rem', fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: recalcMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: recalcMutation.isPending ? 0.6 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
                }}
              >
                <i className={`fas fa-calculator ${recalcMutation.isPending ? 'fa-spin' : ''}`} />
                {recalcMutation.isPending ? 'Calculating…' : 'Calculate My Ranking'}
              </Box>
            </Box>
          )}

          {!myLoading && myRanking && myMeta && (
            <MyRankingCard
              ranking={myRanking}
              meta={myMeta}
              onRecalculate={() => recalcMutation.mutate()}
              isRecalculating={recalcMutation.isPending}
            />
          )}
        </>
      )}
    </Layout>
  );
};

export default Rankings;
