import React, { useMemo } from 'react';
import {
  Box, Typography, Avatar, Chip, Button, CircularProgress, Divider,
  Paper, Tooltip,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChainParticipant {
  _id: string;
  name: string;
  avatar?: string;
  trustScore: number;
}

interface ChainEdge {
  from: string;
  to: string;
  skillName: string;
  compatibilityScore: number;
  estimatedCEU: number;
}

interface ChainAcceptance {
  user: string;
  accepted: boolean | null;
  respondedAt?: string;
}

interface Chain {
  _id: string;
  participants: string[];
  participantDetails: ChainParticipant[];
  edges: ChainEdge[];
  status: 'proposed' | 'active' | 'completed' | 'declined' | 'expired';
  fairnessScore: number;
  successProbability: number;
  acceptances: ChainAcceptance[];
  completedEdgesCount: number;
  city?: string;
  neighbourhood?: string;
  expiresAt: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: Chain['status']): string {
  return {
    proposed:  '#F59E0B',
    active:    '#10B981',
    completed: '#8B5CF6',
    declined:  '#EF4444',
    expired:   '#9CA3AF',
  }[status] ?? '#9CA3AF';
}

function statusLabel(status: Chain['status']): string {
  return {
    proposed:  'Awaiting Opt-ins',
    active:    'Active',
    completed: 'Completed',
    declined:  'Declined',
    expired:   'Expired',
  }[status] ?? status;
}

function scoreBar(value: number, color: string): React.ReactNode {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ width: `${Math.round(value * 100)}%`, height: '100%', background: color, borderRadius: 3 }} />
      </Box>
      <Typography fontSize="0.75rem" color="#6B7280" sx={{ minWidth: 32 }}>
        {Math.round(value * 100)}%
      </Typography>
    </Box>
  );
}

// ─── Ring Diagram ─────────────────────────────────────────────────────────────

const RING_RADIUS = 120;
const AVATAR_SIZE = 54;
const SVG_SIZE    = (RING_RADIUS + AVATAR_SIZE) * 2 + 20;
const CENTER      = SVG_SIZE / 2;

interface RingDiagramProps {
  participants: ChainParticipant[];
  edges: ChainEdge[];
  acceptances: ChainAcceptance[];
}

const RingDiagram: React.FC<RingDiagramProps> = ({ participants, edges, acceptances }) => {
  const n = participants.length;

  // Position each participant evenly around the ring
  const positions = participants.map((_, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2; // start from top
    return {
      x: CENTER + RING_RADIUS * Math.cos(angle),
      y: CENTER + RING_RADIUS * Math.sin(angle),
    };
  });

  const idToIndex = new Map(participants.map((p, i) => [p._id, i]));

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
      <svg
        width={SVG_SIZE}
        height={SVG_SIZE}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        style={{ maxWidth: '100%' }}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#4F46E5" />
          </marker>
        </defs>

        {/* Draw edges (arrows) */}
        {edges.map((edge, i) => {
          const fromIdx = idToIndex.get(edge.from);
          const toIdx   = idToIndex.get(edge.to);
          if (fromIdx === undefined || toIdx === undefined) return null;

          const from = positions[fromIdx];
          const to   = positions[toIdx];

          // Shorten line so it doesn't overlap avatars
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const offset = AVATAR_SIZE / 2 + 4;
          const sx = from.x + (dx / dist) * offset;
          const sy = from.y + (dy / dist) * offset;
          const ex = to.x   - (dx / dist) * (offset + 10);
          const ey = to.y   - (dy / dist) * (offset + 10);

          // Label mid-point
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2;

          return (
            <g key={i}>
              <line
                x1={sx} y1={sy} x2={ex} y2={ey}
                stroke="#4F46E5" strokeWidth={2}
                markerEnd="url(#arrow)"
                strokeDasharray={edge.compatibilityScore < 0.5 ? '5,3' : undefined}
              />
              {/* Skill label */}
              <rect x={mx - 40} y={my - 10} width={80} height={20} rx={4} fill="white" stroke="#E5E7EB" />
              <text x={mx} y={my + 4} textAnchor="middle" fontSize="9" fill="#4F46E5" fontWeight="600">
                {edge.skillName.length > 12 ? `${edge.skillName.slice(0, 11)}…` : edge.skillName}
              </text>
            </g>
          );
        })}

        {/* Draw participant nodes */}
        {participants.map((p, i) => {
          const { x, y } = positions[i];
          const acceptance = acceptances.find(a => a.user === p._id || a.user.toString() === p._id);
          const accepted   = acceptance?.accepted;

          const ringColor =
            accepted === true  ? '#10B981' :
            accepted === false ? '#EF4444' :
            '#E5E7EB';

          return (
            <g key={p._id}>
              {/* Ring indicator */}
              <circle cx={x} cy={y} r={AVATAR_SIZE / 2 + 4} fill={ringColor} opacity={0.2} />
              <circle cx={x} cy={y} r={AVATAR_SIZE / 2 + 4} fill="none" stroke={ringColor} strokeWidth={2} />

              {/* Avatar clipping */}
              <clipPath id={`clip-${i}`}>
                <circle cx={x} cy={y} r={AVATAR_SIZE / 2} />
              </clipPath>
              {p.avatar ? (
                <image
                  href={p.avatar}
                  x={x - AVATAR_SIZE / 2}
                  y={y - AVATAR_SIZE / 2}
                  width={AVATAR_SIZE}
                  height={AVATAR_SIZE}
                  clipPath={`url(#clip-${i})`}
                />
              ) : (
                <>
                  <circle cx={x} cy={y} r={AVATAR_SIZE / 2} fill="url(#grad)" />
                  <text x={x} y={y + 5} textAnchor="middle" fontSize="16" fill="white" fontWeight="700">
                    {p.name[0]?.toUpperCase() ?? '?'}
                  </text>
                </>
              )}

              {/* Name label below */}
              <text x={x} y={y + AVATAR_SIZE / 2 + 16} textAnchor="middle" fontSize="10" fill="#1F2937" fontWeight="600">
                {p.name.split(' ')[0]}
              </text>

              {/* Status icon */}
              {accepted === true && (
                <text x={x + AVATAR_SIZE / 2 - 4} y={y - AVATAR_SIZE / 2 + 12} fontSize="12" fill="#10B981">✓</text>
              )}
              {accepted === false && (
                <text x={x + AVATAR_SIZE / 2 - 6} y={y - AVATAR_SIZE / 2 + 12} fontSize="12" fill="#EF4444">✗</text>
              )}
            </g>
          );
        })}

        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4F46E5" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
      </svg>
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const SkillChainDetail: React.FC = () => {
  const { id }         = useParams<{ id: string }>();
  const navigate       = useNavigate();
  const { user }       = useAuth();
  const queryClient    = useQueryClient();

  const { data: chain, isLoading, error } = useQuery<Chain>({
    queryKey: ['chain', id],
    queryFn:  () => api.get(`/chains/${id}`).then(r => r.data as Chain),
    enabled:  !!id,
  });

  const myAcceptance = useMemo(() => {
    if (!chain || !user) return null;
    return chain.acceptances.find(a => a.user === user._id || a.user.toString() === user._id) ?? null;
  }, [chain, user]);

  const respondMutation = useMutation({
    mutationFn: ({ accepted }: { accepted: boolean }) =>
      api.post(`/chains/${id}/respond`, { accepted }).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chain', id] }),
  });

  const undoMutation = useMutation({
    mutationFn: () => api.post(`/chains/${id}/undo-accept`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chain', id] }),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !chain) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography color="error">Chain not found or you are not a participant.</Typography>
        <Button onClick={() => navigate(-1)} sx={{ mt: 2 }}>Go Back</Button>
      </Box>
    );
  }

  const isParticipant = chain.participants.some(p => p === user?._id || p.toString() === user?._id);
  const canRespond    = isParticipant && chain.status === 'proposed' && myAcceptance?.accepted === null;
  const pendingCount  = chain.acceptances.filter(a => a.accepted === null).length;
  const acceptedCount = chain.acceptances.filter(a => a.accepted === true).length;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', px: { xs: 2, sm: 3 }, py: 4, mt: 7 }}>
      {/* Back */}
      <Button
        startIcon={<i className="fas fa-arrow-left" />}
        onClick={() => navigate(-1)}
        sx={{ mb: 2, color: '#6B7280', textTransform: 'none', fontWeight: 500 }}
      >
        Back
      </Button>

      {/* Header */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #E5E7EB', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #4F46E5, #10B981)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-link" style={{ color: 'white', fontSize: '1rem' }} />
              </Box>
              <Typography variant="h5" fontWeight={700} color="#1F2937">
                Skill Chain
              </Typography>
            </Box>
            <Typography fontSize="0.875rem" color="#6B7280">
              {chain.participantDetails.length}-person circular skill exchange
              {chain.city ? ` · ${chain.neighbourhood ?? chain.city}` : ''}
            </Typography>
          </Box>
          <Chip
            label={statusLabel(chain.status)}
            sx={{ background: `${statusColor(chain.status)}18`, color: statusColor(chain.status), fontWeight: 700, borderRadius: 2 }}
          />
        </Box>

        {/* Scores */}
        <Box sx={{ mt: 2.5, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography fontSize="0.75rem" color="#6B7280" mb={0.5}>Fairness Score</Typography>
            {scoreBar(chain.fairnessScore, '#10B981')}
          </Box>
          <Box>
            <Typography fontSize="0.75rem" color="#6B7280" mb={0.5}>Success Probability</Typography>
            {scoreBar(chain.successProbability, '#4F46E5')}
          </Box>
        </Box>

        {/* Opt-in progress */}
        {chain.status === 'proposed' && (
          <Box sx={{ mt: 2, p: 1.5, background: '#FFF7ED', borderRadius: 2, border: '1px solid #FED7AA' }}>
            <Typography fontSize="0.8rem" color="#92400E" fontWeight={600}>
              <i className="fas fa-clock" style={{ marginRight: 6 }} />
              Waiting for {pendingCount} more participant{pendingCount !== 1 ? 's' : ''} to opt in ({acceptedCount}/{chain.acceptances.length} accepted)
            </Typography>
          </Box>
        )}
        {chain.status === 'active' && (
          <Box sx={{ mt: 2, p: 1.5, background: '#ECFDF5', borderRadius: 2, border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Typography fontSize="0.8rem" color="#065F46" fontWeight={600}>
              <i className="fas fa-check-circle" style={{ marginRight: 6 }} />
              All members agreed! Coordinate your exchanges below.
            </Typography>
            {isParticipant && myAcceptance?.accepted === true && (
              <Button
                size="small"
                disabled={undoMutation.isPending}
                onClick={() => undoMutation.mutate()}
                sx={{ color: '#92400E', borderColor: '#FDE68A', fontSize: '0.75rem', textTransform: 'none', fontWeight: 600, minWidth: 0 }}
                variant="outlined"
                startIcon={<i className="fas fa-undo" style={{ fontSize: '0.65rem' }} />}
              >
                {undoMutation.isPending ? 'Undoing…' : 'Undo Acceptance'}
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Ring Diagram */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #E5E7EB', mb: 3 }}>
        <Typography fontWeight={700} fontSize="0.95rem" color="#1F2937" mb={2}>
          Exchange Ring
        </Typography>
        <RingDiagram
          participants={chain.participantDetails}
          edges={chain.edges}
          acceptances={chain.acceptances}
        />
        <Typography fontSize="0.75rem" color="#9CA3AF" textAlign="center" mt={1}>
          Arrows show who teaches whom. Dashed = lower compatibility.
        </Typography>
      </Paper>

      {/* Participants & their status */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #E5E7EB', mb: 3 }}>
        <Typography fontWeight={700} fontSize="0.95rem" color="#1F2937" mb={2}>
          Participants
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {chain.participantDetails.map((p) => {
            const acc = chain.acceptances.find(a => a.user === p._id || a.user.toString() === p._id);
            return (
              <Box key={p._id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, borderRadius: 2, background: '#F9FAFB' }}>
                <Avatar src={p.avatar} alt={p.name} sx={{ width: 38, height: 38, background: 'linear-gradient(135deg, #4F46E5, #10B981)', fontSize: '0.9rem' }}>
                  {p.name[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography fontSize="0.875rem" fontWeight={600} color="#1F2937">
                    {p.name}
                    {p._id === user?._id && <Box component="span" sx={{ ml: 1, fontSize: '0.7rem', color: '#4F46E5', fontWeight: 400 }}>(you)</Box>}
                  </Typography>
                  <Typography fontSize="0.75rem" color="#6B7280">Trust: {p.trustScore}%</Typography>
                </Box>
                <Chip
                  size="small"
                  label={
                    acc?.accepted === true  ? 'Opted In' :
                    acc?.accepted === false ? 'Declined' :
                    'Pending'
                  }
                  sx={{
                    background:
                      acc?.accepted === true  ? '#ECFDF5' :
                      acc?.accepted === false ? '#FEF2F2' :
                      '#F3F4F6',
                    color:
                      acc?.accepted === true  ? '#065F46' :
                      acc?.accepted === false ? '#991B1B' :
                      '#374151',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                />
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Skill edges */}
      <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #E5E7EB', mb: 3 }}>
        <Typography fontWeight={700} fontSize="0.95rem" color="#1F2937" mb={2}>
          Exchange Flow
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {chain.edges.map((edge, i) => {
            const from = chain.participantDetails.find(p => p._id === edge.from || p._id.toString() === edge.from);
            const to   = chain.participantDetails.find(p => p._id === edge.to   || p._id.toString() === edge.to);
            return (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, background: '#F9FAFB', flexWrap: 'wrap' }}>
                <Typography fontSize="0.8rem" fontWeight={600} color="#1F2937">{from?.name ?? '—'}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, background: '#EEF2FF', borderRadius: '999px' }}>
                  <i className="fas fa-arrow-right" style={{ color: '#4F46E5', fontSize: '0.65rem' }} />
                  <Typography fontSize="0.75rem" color="#4F46E5" fontWeight={600}>{edge.skillName}</Typography>
                  <i className="fas fa-arrow-right" style={{ color: '#4F46E5', fontSize: '0.65rem' }} />
                </Box>
                <Typography fontSize="0.8rem" fontWeight={600} color="#1F2937">{to?.name ?? '—'}</Typography>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                  <Chip size="small" label={`~${edge.estimatedCEU} CEU`} sx={{ background: '#F0FDF4', color: '#166534', fontSize: '0.7rem', fontWeight: 600 }} />
                  <Chip size="small" label={`${Math.round(edge.compatibilityScore * 100)}% match`} sx={{ background: '#EEF2FF', color: '#3730A3', fontSize: '0.7rem' }} />
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>

      {/* Opt-in / Decline / Undo CTA — one card that changes state */}
      {isParticipant && chain.status === 'proposed' && (
        <>
          {canRespond && (
            <Paper sx={{ p: 3, borderRadius: 3, border: '2px solid #4F46E5', background: 'linear-gradient(135deg, #EEF2FF, #ECFDF5)', mb: 3 }}>
              <Typography fontWeight={700} fontSize="0.95rem" color="#1F2937" mb={0.5}>
                Do you want to join this skill chain?
              </Typography>
              <Typography fontSize="0.825rem" color="#6B7280" mb={2}>
                Once all participants opt in, a coordination thread will open for everyone.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ accepted: true })}
                  sx={{ background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: 'white', borderRadius: 2, textTransform: 'none', fontWeight: 600, px: 3 }}
                  startIcon={<i className="fas fa-check" />}
                >
                  {respondMutation.isPending ? 'Saving…' : "Yes, I'm In!"}
                </Button>
                <Button
                  variant="outlined"
                  disabled={respondMutation.isPending}
                  onClick={() => respondMutation.mutate({ accepted: false })}
                  sx={{ borderColor: '#EF4444', color: '#EF4444', borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                  startIcon={<i className="fas fa-times" />}
                >
                  Decline
                </Button>
              </Box>
              {respondMutation.isError && (
                <Typography fontSize="0.8rem" color="error" mt={1}>Failed to submit response. Please try again.</Typography>
              )}
            </Paper>
          )}

          {/* Accepted → show undo card in place of accept/decline */}
          {myAcceptance?.accepted === true && (
            <Paper sx={{ p: 3, borderRadius: 3, border: '2px solid #10B981', background: '#ECFDF5', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', background: '#10B981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-check" style={{ color: 'white', fontSize: '0.9rem' }} />
                </Box>
                <Box>
                  <Typography fontWeight={700} fontSize="0.95rem" color="#065F46">
                    You've accepted this chain!
                  </Typography>
                  <Typography fontSize="0.8rem" color="#047857">
                    Waiting for the other {chain.acceptances.filter(a => a.accepted === null).length} participant{chain.acceptances.filter(a => a.accepted === null).length !== 1 ? 's' : ''} to opt in.
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                disabled={undoMutation.isPending}
                onClick={() => undoMutation.mutate()}
                sx={{ borderColor: '#6B7280', color: '#374151', borderRadius: 2, textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' }}
                startIcon={<i className="fas fa-undo" />}
              >
                {undoMutation.isPending ? 'Undoing…' : 'Undo Acceptance'}
              </Button>
              {undoMutation.isError && (
                <Typography fontSize="0.8rem" color="error" mt={1}>Failed to undo. Please try again.</Typography>
              )}
            </Paper>
          )}

          {/* Declined state */}
          {myAcceptance?.accepted === false && (
            <Box sx={{ p: 2, borderRadius: 2, background: '#FEF2F2', border: '1px solid #FCA5A5', mb: 3 }}>
              <Typography fontSize="0.875rem" fontWeight={600} color="#991B1B">
                <i className="fas fa-times-circle" style={{ marginRight: 6 }} />
                You declined this chain.
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Expiry info */}
      <Typography fontSize="0.75rem" color="#9CA3AF" textAlign="center">
        This chain proposal expires {new Date(chain.expiresAt).toLocaleDateString()}
      </Typography>
    </Box>
  );
};

export default SkillChainDetail;
