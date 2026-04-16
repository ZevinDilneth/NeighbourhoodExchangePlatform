import React, { useState } from 'react';
import { Box, Avatar, Typography, Skeleton } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Chain,
  ChainParticipantDetail,
  ChainEdgeData,
  ChainAcceptance,
} from '../types';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const GRAD   = 'linear-gradient(135deg, #4F46E5, #10B981)';
const INDIGO = '#4F46E5';
const EMERALD = '#10B981';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CFG: Record<
  Chain['status'],
  { label: string; color: string; bg: string }
> = {
  proposed:  { label: 'Proposed',  color: '#D97706', bg: 'rgba(217,119,6,0.08)'  },
  active:    { label: 'Active',    color: '#059669', bg: 'rgba(5,150,105,0.08)'  },
  completed: { label: 'Completed', color: '#6B7280', bg: 'rgba(107,114,128,0.08)'},
  declined:  { label: 'Declined',  color: '#DC2626', bg: 'rgba(220,38,38,0.08)'  },
  expired:   { label: 'Expired',   color: '#9CA3AF', bg: 'rgba(156,163,175,0.08)'},
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated circular flow diagram: A → B → C → ... → A */
const ChainFlowDiagram: React.FC<{
  participants: ChainParticipantDetail[];
  edges: ChainEdgeData[];
  myId: string;
}> = ({ participants, edges, myId }) => {
  // Map participant id → detail
  const detailMap = new Map(participants.map(p => [p._id, p]));

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.25rem',
        py: '0.75rem',
        overflowX: 'auto',
      }}
    >
      {participants.map((p, idx) => {
        const edge      = edges[idx]; // edge from this participant to next
        const isMe      = p._id === myId;
        const initials  = p.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        return (
          <React.Fragment key={p._id}>
            {/* Participant node */}
            <Box
              sx={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            '0.375rem',
                minWidth:       60,
              }}
            >
              <Box
                sx={{
                  position: 'relative',
                  width:    48,
                  height:   48,
                  borderRadius: '50%',
                  border: `2px solid ${isMe ? INDIGO : EMERALD}`,
                  boxShadow: isMe ? `0 0 0 3px rgba(79,70,229,0.18)` : undefined,
                }}
              >
                <Avatar
                  src={p.avatar}
                  sx={{
                    width:      44,
                    height:     44,
                    fontSize:   '0.8125rem',
                    fontWeight: 700,
                    background: isMe ? '#EEF2FF' : '#ECFDF5',
                    color:      isMe ? INDIGO : EMERALD,
                    m:          '1px',
                  }}
                >
                  {initials}
                </Avatar>
                {isMe && (
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -3,
                      right:  -3,
                      width:  16,
                      height: 16,
                      borderRadius: '50%',
                      background: INDIGO,
                      border: '2px solid #fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <i className="fas fa-user" style={{ color: '#fff', fontSize: '0.4rem' }} />
                  </Box>
                )}
              </Box>
              <Typography
                sx={{
                  fontSize:   '0.6875rem',
                  fontWeight: isMe ? 700 : 500,
                  color:      isMe ? INDIGO : '#374151',
                  fontFamily: 'Inter, sans-serif',
                  textAlign:  'center',
                  maxWidth:   60,
                  overflow:   'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {isMe ? 'You' : p.name.split(' ')[0]}
              </Typography>
            </Box>

            {/* Arrow + skill label */}
            {edge && (
              <Box
                sx={{
                  display:       'flex',
                  flexDirection: 'column',
                  alignItems:    'center',
                  gap:           '0.125rem',
                  minWidth:      64,
                }}
              >
                <Typography
                  sx={{
                    fontSize:   '0.6rem',
                    color:      '#9CA3AF',
                    fontFamily: 'Inter, sans-serif',
                    textAlign:  'center',
                    maxWidth:   72,
                    overflow:   'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {edge.skillName}
                </Typography>
                <Box
                  sx={{
                    display:    'flex',
                    alignItems: 'center',
                    gap:        '0.25rem',
                    color:      '#9CA3AF',
                    fontSize:   '0.75rem',
                  }}
                >
                  <Box sx={{ flex: 1, height: 1, background: '#E5E7EB', minWidth: 20 }} />
                  <i className="fas fa-arrow-right" style={{ fontSize: '0.625rem' }} />
                </Box>
                <Box
                  sx={{
                    background: '#F5F3FF',
                    color:      '#7C3AED',
                    borderRadius: '0.75rem',
                    px:         '0.4rem',
                    py:         '0.1rem',
                    fontSize:   '0.6rem',
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ~{edge.estimatedCEU} CEU
                </Box>
              </Box>
            )}

            {/* Closing back-arrow to first node */}
            {idx === participants.length - 1 && (
              <Box sx={{ display: 'flex', alignItems: 'center', color: '#D1D5DB', fontSize: '0.75rem', mt: '-1.5rem' }}>
                <i className="fas fa-undo-alt" title="Returns to first participant" />
              </Box>
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
};

/** Fairness + probability score bar row */
const ChainScoreRow: React.FC<{
  fairnessScore: number;
  successProbability: number;
}> = ({ fairnessScore, successProbability }) => {
  const fairPct = Math.round(fairnessScore      * 100);
  const probPct = Math.round(successProbability * 100);

  const fairColor = fairPct >= 80 ? '#059669' : fairPct >= 70 ? '#D97706' : '#DC2626';
  const probColor = probPct >= 70 ? '#059669' : probPct >= 50 ? '#D97706' : '#DC2626';

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '0.75rem', mb: '0.75rem' }}>
      {([
        { label: 'Chain Fairness', pct: fairPct, color: fairColor, icon: 'fa-balance-scale' },
        { label: 'Success Probability', pct: probPct, color: probColor, icon: 'fa-chart-line' },
      ] as const).map(({ label, pct, color, icon }) => (
        <Box key={label}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: '0.25rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <i className={`fas ${icon}`} style={{ color, fontSize: '0.625rem' }} />
              <Typography sx={{ fontSize: '0.6875rem', color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                {label}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color, fontFamily: 'Inter, sans-serif' }}>
              {pct}%
            </Typography>
          </Box>
          <Box sx={{ height: 5, borderRadius: 3, background: '#E5E7EB', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', borderRadius: 3, background: color, width: `${pct}%`, transition: 'width 0.6s ease' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

/** Accept/decline status indicator per participant */
const AcceptanceRow: React.FC<{
  acceptances: ChainAcceptance[];
  participants: ChainParticipantDetail[];
  myId: string;
}> = ({ acceptances, participants, myId }) => {
  const detailMap = new Map(participants.map(p => [p._id, p]));

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
      {acceptances.map(a => {
        const detail = detailMap.get(a.user);
        const isMe   = a.user === myId;
        const icon   = a.accepted === true  ? 'fa-check-circle'
                     : a.accepted === false ? 'fa-times-circle'
                     :                        'fa-clock';
        const color  = a.accepted === true  ? '#059669'
                     : a.accepted === false ? '#DC2626'
                     :                        '#D97706';

        return (
          <Box
            key={a.user}
            sx={{
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              background: `${color}0D`, border: `1px solid ${color}30`,
              borderRadius: '1rem', px: '0.5rem', py: '0.2rem',
            }}
          >
            <i className={`fas ${icon}`} style={{ color, fontSize: '0.625rem' }} />
            <Typography sx={{ fontSize: '0.6875rem', fontFamily: 'Inter, sans-serif', color: '#374151', fontWeight: isMe ? 700 : 400 }}>
              {isMe ? 'You' : (detail?.name.split(' ')[0] ?? 'User')}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
};

/** Single chain card */
const ChainCard: React.FC<{
  chain: Chain;
  myId: string;
  onRespond: (chainId: string, accepted: boolean) => void;
  onUndo: (chainId: string) => void;
  isPending: boolean;
  isUndoing: boolean;
}> = ({ chain, myId, onRespond, onUndo, isPending, isUndoing }) => {
  const cfg = STATUS_CFG[chain.status] ?? STATUS_CFG.proposed;
  const myAcceptance   = chain.acceptances.find(a => a.user === myId);
  const hasResponded   = myAcceptance?.accepted !== null && myAcceptance?.accepted !== undefined;
  const canRespond     = chain.status === 'proposed' && !hasResponded;
  const chainLength    = chain.participants.length;
  const participants   = chain.participantDetails ?? [];

  // Build edges connecting back to first in ring
  const edges = chain.edges;

  return (
    <Box
      sx={{
        background: '#FFFFFF',
        border:     '1px solid #E5E7EB',
        borderRadius: '0.75rem',
        boxShadow:  '0 1px 3px rgba(0,0,0,0.08)',
        overflow:   'hidden',
        transition: 'box-shadow 0.2s',
        '&:hover':  { boxShadow: '0 4px 12px rgba(0,0,0,0.12)' },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          background: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          padding: '0.875rem 1.125rem',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}
      >
        {/* Chain icon */}
        <Box
          sx={{
            width: 38, height: 38, borderRadius: '0.625rem',
            background: GRAD,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FFF', fontSize: '0.9375rem', flexShrink: 0,
          }}
        >
          <i className="fas fa-link" />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.125rem' }}>
            <Typography
              sx={{
                fontFamily: 'Poppins, sans-serif', fontWeight: 700,
                fontSize: '0.9375rem', color: '#1F2937',
              }}
            >
              {chainLength}-Way Exchange Ring
            </Typography>
            <Box
              component="span"
              sx={{
                background: cfg.bg, color: cfg.color,
                borderRadius: '2rem', px: '0.5rem', py: '0.1rem',
                fontSize: '0.6875rem', fontWeight: 600,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {cfg.label}
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
            {chain.city ?? 'Your area'} · expires {formatDistanceToNow(new Date(chain.expiresAt), { addSuffix: true })}
          </Typography>
        </Box>
      </Box>

      {/* Flow diagram */}
      <Box sx={{ padding: '0.75rem 1.125rem 0.5rem' }}>
        {participants.length > 0 ? (
          <ChainFlowDiagram participants={participants} edges={edges} myId={myId} />
        ) : (
          <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif', py: '0.5rem' }}>
            Loading participants…
          </Typography>
        )}
      </Box>

      {/* Scores */}
      <Box sx={{ px: '1.125rem', pb: '0.5rem' }}>
        <ChainScoreRow
          fairnessScore={chain.fairnessScore}
          successProbability={chain.successProbability}
        />
      </Box>

      {/* Acceptance row */}
      <Box sx={{ px: '1.125rem', pb: '0.875rem' }}>
        <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6B7280', fontFamily: 'Inter, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.375rem' }}>
          Responses
        </Typography>
        <AcceptanceRow
          acceptances={chain.acceptances}
          participants={participants}
          myId={myId}
        />
      </Box>

      {/* Action row */}
      {canRespond && (
        <Box
          sx={{
            borderTop: '1px solid #E5E7EB',
            padding: '0.75rem 1.125rem',
            background: '#F9FAFB',
            display: 'flex', gap: '0.625rem',
          }}
        >
          <Box
            component="button"
            onClick={() => onRespond(chain._id, true)}
            disabled={isPending}
            sx={{
              flex: 1, background: GRAD, color: '#FFF',
              border: 'none', borderRadius: '0.5rem',
              py: '0.5rem', fontFamily: 'Inter, sans-serif',
              fontSize: '0.8125rem', fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
              transition: 'opacity 0.15s',
              '&:hover': !isPending ? { opacity: 0.88 } : {},
            }}
          >
            <i className="fas fa-check" />
            Join Chain
          </Box>
          <Box
            component="button"
            onClick={() => onRespond(chain._id, false)}
            disabled={isPending}
            sx={{
              background: 'none', color: '#DC2626',
              border: '1px solid #FCA5A5',
              borderRadius: '0.5rem', px: '1rem', py: '0.5rem',
              fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              transition: 'all 0.15s',
              '&:hover': !isPending ? { background: '#FEF2F2' } : {},
            }}
          >
            <i className="fas fa-times" />
            Decline
          </Box>
        </Box>
      )}

      {/* Already responded — accepted: show undo button */}
      {hasResponded && myAcceptance?.accepted === true && (chain.status === 'proposed' || chain.status === 'active') && (
        <Box
          sx={{
            borderTop: '1px solid #E5E7EB',
            padding: '0.625rem 1.125rem',
            background: 'rgba(5,150,105,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-check-circle" style={{ color: '#059669', fontSize: '0.875rem' }} />
            <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
              You accepted this chain
            </Typography>
          </Box>
          <Box
            component="button"
            onClick={() => onUndo(chain._id)}
            disabled={isUndoing}
            sx={{
              background: 'none', color: '#6B7280',
              border: '1px solid #D1D5DB',
              borderRadius: '0.375rem', px: '0.75rem', py: '0.3rem',
              fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', fontWeight: 600,
              cursor: isUndoing ? 'not-allowed' : 'pointer',
              opacity: isUndoing ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: '0.3rem',
              transition: 'all 0.15s',
              '&:hover': !isUndoing ? { background: '#F9FAFB', color: '#374151' } : {},
            }}
          >
            <i className="fas fa-undo" style={{ fontSize: '0.625rem' }} />
            {isUndoing ? 'Undoing…' : 'Undo'}
          </Box>
        </Box>
      )}

      {/* Already responded — declined */}
      {hasResponded && myAcceptance?.accepted === false && chain.status === 'proposed' && (
        <Box
          sx={{
            borderTop: '1px solid #E5E7EB',
            padding: '0.625rem 1.125rem',
            background: 'rgba(220,38,38,0.04)',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
          }}
        >
          <i className="fas fa-times-circle" style={{ color: '#DC2626', fontSize: '0.875rem' }} />
          <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
            You declined this chain.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'discover' | 'my-chains';

const ChainDiscovery: React.FC = () => {
  const { user }   = useAuth();
  const qc         = useQueryClient();
  const [tab, setTab] = useState<Tab>('discover');
  const [myTab, setMyTab] = useState<Chain['status'] | 'all'>('all');

  // ── Discover query ────────────────────────────────────────────────────────
  const {
    data:      discoverData,
    isLoading: isDiscovering,
    refetch:   runDiscover,
    isFetching,
  } = useQuery({
    queryKey: ['chains', 'discover'],
    queryFn:  async () => {
      const res = await api.get('/chains/discover');
      return res.data as { chains: Chain[]; fromCache: boolean };
    },
    enabled:  false, // only runs when user clicks "Find Chains"
    staleTime: 60 * 60 * 1000,
  });

  // ── My chains query ───────────────────────────────────────────────────────
  const { data: myData, isLoading: myLoading } = useQuery({
    queryKey: ['chains', 'me', myTab],
    queryFn:  async () => {
      const params = myTab !== 'all' ? `?status=${myTab}` : '';
      const res    = await api.get(`/chains/me${params}`);
      return res.data as { chains: Chain[] };
    },
  });

  // ── Respond mutation ──────────────────────────────────────────────────────
  const respondMutation = useMutation({
    mutationFn: ({ chainId, accepted }: { chainId: string; accepted: boolean }) =>
      api.post(`/chains/${chainId}/respond`, { accepted }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chains'] });
    },
  });

  // ── Undo acceptance mutation ───────────────────────────────────────────────
  const undoMutation = useMutation({
    mutationFn: (chainId: string) => api.post(`/chains/${chainId}/undo-accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chains'] });
    },
  });

  const myId = user?._id ?? '';

  const discoverChains  = discoverData?.chains ?? [];
  const myChains        = myData?.chains       ?? [];

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
        {/* Background pattern */}
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
                color: '#FFF', fontSize: '1.25rem',
              }}
            >
              <i className="fas fa-link" />
            </Box>
            <Typography
              sx={{
                fontFamily: 'Poppins, sans-serif', fontWeight: 700,
                fontSize: '1.375rem', color: '#FFF', lineHeight: 1.2,
              }}
            >
              Chain Discovery
            </Typography>
          </Box>
          <Typography
            sx={{
              fontSize: '0.9375rem', color: 'rgba(255,255,255,0.88)',
              fontFamily: 'Inter, sans-serif', lineHeight: 1.6, mb: '1.25rem',
              maxWidth: 560,
            }}
          >
            Find multi-user circular exchanges in your neighbourhood. You teach Alice guitar,
            Alice fixes Bob's bike, Bob tutors you in Spanish — everyone wins.
          </Typography>

          {/* Stats pills */}
          <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', mb: '1.25rem' }}>
            {[
              { icon: 'fa-users',         label: '3–6 Users',       hint: 'Ring size' },
              { icon: 'fa-balance-scale', label: 'Fairness Check',  hint: 'Every edge scored' },
              { icon: 'fa-map-marker-alt',label: 'Local Only',      hint: 'Same city/neighbourhood' },
              { icon: 'fa-chart-line',    label: 'ML Probability',  hint: 'Trust-score weighted' },
            ].map(({ icon, label, hint }) => (
              <Box
                key={label}
                sx={{
                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                  background: 'rgba(255,255,255,0.14)',
                  borderRadius: '2rem', px: '0.75rem', py: '0.3rem',
                }}
                title={hint}
              >
                <i className={`fas ${icon}`} style={{ color: '#FFF', fontSize: '0.75rem', opacity: 0.8 }} />
                <Typography sx={{ fontSize: '0.8125rem', color: '#FFF', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                  {label}
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
          { key: 'discover',  label: 'Discover',   icon: 'fa-search' },
          { key: 'my-chains', label: 'My Chains',  icon: 'fa-link' },
        ] as const).map(({ key, label, icon }) => (
          <Box
            key={key}
            component="button"
            onClick={() => setTab(key)}
            sx={{
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              background: tab === key ? '#FFFFFF' : 'transparent',
              border:     'none',
              borderRadius: '0.375rem',
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
            {key === 'my-chains' && (myChains.length > 0) && (
              <Box
                component="span"
                sx={{
                  background: INDIGO, color: '#FFF',
                  borderRadius: '2rem', px: '0.4rem',
                  fontSize: '0.625rem', fontWeight: 700,
                  fontFamily: 'Inter, sans-serif', lineHeight: '1.4',
                }}
              >
                {myChains.length}
              </Box>
            )}
          </Box>
        ))}
      </Box>

      {/* ── Discover tab ─────────────────────────────────────────────────────── */}
      {tab === 'discover' && (
        <Box>
          {/* Trigger button */}
          {!discoverData && !isDiscovering && (
            <Box
              sx={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                padding: '3rem 2rem',
                textAlign: 'center',
                mb: '1.5rem',
              }}
            >
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: '#EEF2FF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: '1rem',
                  fontSize: '1.5rem', color: INDIGO,
                }}
              >
                <i className="fas fa-search-location" />
              </Box>
              <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mb: '0.5rem' }}>
                Ready to find your exchange ring?
              </Typography>
              <Typography sx={{ fontSize: '0.875rem', color: '#6B7280', fontFamily: 'Inter, sans-serif', mb: '1.5rem', maxWidth: 400, mx: 'auto' }}>
                The algorithm will scan your neighbourhood for compatible skill-chains — 3 to 6 people who can form a circular exchange loop.
              </Typography>
              <Box
                component="button"
                onClick={() => runDiscover()}
                sx={{
                  background: GRAD, color: '#FFF', border: 'none',
                  borderRadius: '0.5rem', px: '2rem', py: '0.75rem',
                  fontSize: '0.9375rem', fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(79,70,229,0.35)',
                  transition: 'opacity 0.15s',
                  '&:hover': { opacity: 0.9 },
                }}
              >
                <i className="fas fa-search" />
                Find Exchange Chains
              </Box>
            </Box>
          )}

          {/* Loading skeleton */}
          {(isDiscovering || isFetching) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2, 3].map(i => (
                <Skeleton key={i} variant="rounded" height={240} sx={{ borderRadius: '0.75rem' }} />
              ))}
            </Box>
          )}

          {/* Results */}
          {discoverData && !isFetching && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: '1rem' }}>
                <Box>
                  <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>
                    {discoverChains.length === 0
                      ? 'No chains found'
                      : `${discoverChains.length} chain${discoverChains.length > 1 ? 's' : ''} discovered`}
                  </Typography>
                  {discoverData.fromCache && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
                      <i className="fas fa-bolt" style={{ marginRight: '0.25rem', color: '#D97706' }} />
                      Cached result · refreshes automatically in 60 min
                    </Typography>
                  )}
                </Box>
                <Box
                  component="button"
                  onClick={() => runDiscover()}
                  sx={{
                    background: 'none', border: '1px solid #E5E7EB',
                    borderRadius: '0.5rem', px: '0.875rem', py: '0.4rem',
                    fontSize: '0.8125rem', fontWeight: 600, color: INDIGO,
                    fontFamily: 'Inter, sans-serif', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    '&:hover': { background: '#F5F3FF' },
                  }}
                >
                  <i className="fas fa-sync-alt" />
                  Re-run
                </Box>
              </Box>

              {discoverChains.length === 0 ? (
                <Box
                  sx={{
                    background: '#FFFFFF', border: '1px solid #E5E7EB',
                    borderRadius: '0.75rem', padding: '3rem 2rem', textAlign: 'center',
                  }}
                >
                  <i className="fas fa-info-circle" style={{ color: '#9CA3AF', fontSize: '2rem', marginBottom: '0.75rem' }} />
                  <Typography sx={{ fontSize: '0.9375rem', fontFamily: 'Inter, sans-serif', color: '#6B7280', mb: '0.5rem' }}>
                    No compatible chains found in your area yet.
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', color: '#9CA3AF' }}>
                    Try adding more skills and interests to your profile, or check back as more neighbours join.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {discoverChains.map(chain => (
                    <ChainCard
                      key={chain._id}
                      chain={chain}
                      myId={myId}
                      onRespond={(id, accepted) => respondMutation.mutate({ chainId: id, accepted })}
                      onUndo={(id) => undoMutation.mutate(id)}
                      isPending={respondMutation.isPending}
                      isUndoing={undoMutation.isPending}
                    />
                  ))}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* ── My Chains tab ────────────────────────────────────────────────────── */}
      {tab === 'my-chains' && (
        <Box>
          {/* Status filter pills */}
          <Box sx={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', mb: '1.25rem' }}>
            {(['all', 'proposed', 'active', 'completed', 'declined'] as const).map(s => {
              const cfg = s === 'all'
                ? { label: 'All', color: INDIGO }
                : { label: STATUS_CFG[s].label, color: STATUS_CFG[s].color };
              return (
                <Box
                  key={s}
                  component="button"
                  onClick={() => setMyTab(s)}
                  sx={{
                    background: myTab === s ? cfg.color : '#F3F4F6',
                    color:      myTab === s ? '#FFF'    : '#6B7280',
                    border:     'none',
                    borderRadius: '2rem',
                    px: '0.875rem', py: '0.375rem',
                    fontSize: '0.8125rem', fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {cfg.label}
                </Box>
              );
            })}
          </Box>

          {myLoading && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2].map(i => (
                <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: '0.75rem' }} />
              ))}
            </Box>
          )}

          {!myLoading && myChains.length === 0 && (
            <Box
              sx={{
                background: '#FFFFFF', border: '1px solid #E5E7EB',
                borderRadius: '0.75rem', padding: '3rem 2rem', textAlign: 'center',
              }}
            >
              <i className="fas fa-link" style={{ color: '#9CA3AF', fontSize: '2rem', marginBottom: '0.75rem' }} />
              <Typography sx={{ fontSize: '0.9375rem', fontFamily: 'Inter, sans-serif', color: '#6B7280' }}>
                {myTab === 'all'
                  ? "You're not part of any chains yet. Discover and join one!"
                  : `No ${myTab} chains.`}
              </Typography>
            </Box>
          )}

          {!myLoading && myChains.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {myChains.map(chain => (
                <ChainCard
                  key={chain._id}
                  chain={chain}
                  myId={myId}
                  onRespond={(id, accepted) => respondMutation.mutate({ chainId: id, accepted })}
                  isPending={respondMutation.isPending}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Layout>
  );
};

export default ChainDiscovery;
