import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Avatar, Typography, Skeleton } from '@mui/material';
import OnlineAvatar from '../components/OnlineAvatar';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Group } from '../types';
import { useAuth } from '../context/AuthContext';

// ─── Style tokens ────────────────────────────────────────────────────────────

const V = {
  card:       { background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:'0.75rem', boxShadow:'0 1px 3px rgba(0,0,0,0.12)' } as React.CSSProperties,
  section:    { borderRadius:'0.75rem', padding:'1rem', marginBottom:'1rem', background:'#F9FAFB', border:'1px solid #E5E7EB' } as React.CSSProperties,
  sideTitle:  { fontSize:'0.75rem', fontWeight:600, color:'#6B7280', marginBottom:'0.75rem', textTransform:'uppercase' as const, letterSpacing:'0.05em', fontFamily:'Inter,sans-serif' },
  btn: {
    outlined: { border:'1px solid #E5E7EB', background:'transparent', color:'#1F2937', padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:500, cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s' } as React.CSSProperties,
    gradient: { background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white', border:'none', padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:600, cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s' } as React.CSSProperties,
    danger:   { border:'1px solid #FCA5A5', background:'transparent', color:'#EF4444', padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:500, cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s' } as React.CSSProperties,
    admin:    { background:'linear-gradient(135deg,#F59E0B,#EF4444)', color:'white', border:'none', padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:600, cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s' } as React.CSSProperties,
    sm:       { padding:'0.375rem 0.75rem', border:'1px solid #E5E7EB', background:'#FFFFFF', color:'#1F2937', borderRadius:'0.375rem', fontSize:'0.75rem', fontWeight:500, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'0.25rem', fontFamily:'Inter,sans-serif', transition:'all 0.2s' } as React.CSSProperties,
    smGrad:   { padding:'0.375rem 0.75rem', border:'none', background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white', borderRadius:'0.375rem', fontSize:'0.75rem', fontWeight:600, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'0.25rem', fontFamily:'Inter,sans-serif' } as React.CSSProperties,
  },
};

// ─── Leave Confirm Modal ──────────────────────────────────────────────────────

const LeaveConfirmModal: React.FC<{
  groupName: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ groupName, loading, onConfirm, onClose }) => (
  <Box sx={{ position:'fixed', inset:0, zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center',
    background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)' }} onClick={onClose}>
    <Box sx={{ background:'#fff', borderRadius:'0.875rem', p:3, width:'100%', maxWidth:400,
      boxShadow:'0 20px 60px rgba(0,0,0,0.2)', mx:2 }} onClick={e => e.stopPropagation()}>
      <Box sx={{ width:52, height:52, borderRadius:'50%', background:'#FEF2F2',
        display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:2 }}>
        <i className="fas fa-sign-out-alt" style={{ color:'#EF4444', fontSize:'1.25rem' }} />
      </Box>
      <Typography fontWeight={700} fontSize="1.125rem" color="#1F2937" textAlign="center" mb={0.75}>
        Leave group?
      </Typography>
      <Typography fontSize="0.875rem" color="#6B7280" textAlign="center" mb={2.5}>
        You'll lose access to <strong>{groupName}</strong> and will need to request to join again.
      </Typography>
      <Box sx={{ display:'flex', gap:1 }}>
        <button style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }} onClick={onClose}>
          Cancel
        </button>
        <button
          disabled={loading}
          style={{ flex:1, justifyContent:'center', border:'none', background:'#EF4444', color:'white',
            padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:600, cursor:'pointer',
            fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem',
            fontFamily:'Inter,sans-serif', opacity: loading ? 0.6 : 1 }}
          onClick={onConfirm}>
          {loading ? <><i className="fas fa-spinner fa-spin" />Leaving…</> : <><i className="fas fa-sign-out-alt" />Leave Group</>}
        </button>
      </Box>
    </Box>
  </Box>
);

// ─── Transfer Ownership Modal ─────────────────────────────────────────────────

const TransferOwnershipModal: React.FC<{
  group: Group;
  currentUserId: string;
  loading: boolean;
  onTransferAndLeave: (newOwnerId: string) => void;
  onClose: () => void;
}> = ({ group, currentUserId, loading, onTransferAndLeave, onClose }) => {
  const [selected, setSelected] = useState('');

  const candidates = group.members.filter(
    m => m.user._id !== currentUserId
  );

  return (
    <Box sx={{ position:'fixed', inset:0, zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center',
      background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)' }} onClick={onClose}>
      <Box sx={{ background:'#fff', borderRadius:'0.875rem', p:3, width:'100%', maxWidth:480,
        boxShadow:'0 20px 60px rgba(0,0,0,0.2)', mx:2, maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:2 }}>
          <Box>
            <Typography fontWeight={700} fontSize="1.125rem" color="#1F2937" mb={0.25}>
              Transfer Ownership
            </Typography>
            <Typography fontSize="0.8125rem" color="#6B7280">
              Choose a new owner before leaving. They'll get full admin rights.
            </Typography>
          </Box>
          <button style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer',
            fontSize:'1rem', padding:'0.25rem', flexShrink:0 }} onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </Box>

        {/* Warning banner */}
        <Box sx={{ background:'#FFFBEB', border:'1px solid #FCD34D', borderRadius:'0.5rem',
          p:1.25, mb:2, display:'flex', gap:1, alignItems:'flex-start' }}>
          <i className="fas fa-exclamation-triangle" style={{ color:'#F59E0B', marginTop:'2px', flexShrink:0 }} />
          <Typography fontSize="0.8125rem" color="#92400E">
            This action cannot be undone. You'll become a regular member and then be removed.
          </Typography>
        </Box>

        {/* Member list */}
        {candidates.length === 0 ? (
          <Box sx={{ p:3, textAlign:'center' }}>
            <Typography fontSize="0.875rem" color="#6B7280">
              No other members to transfer ownership to.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display:'flex', flexDirection:'column', gap:0.75, mb:2.5 }}>
            {candidates.map(m => (
              <Box key={m.user._id}
                onClick={() => setSelected(m.user._id)}
                sx={{ display:'flex', alignItems:'center', gap:1.25, p:1.25, borderRadius:'0.5rem',
                  border:`2px solid ${selected === m.user._id ? '#4F46E5' : '#E5E7EB'}`,
                  background: selected === m.user._id ? '#EEF2FF' : '#F9FAFB',
                  cursor:'pointer', transition:'all 0.15s' }}>
                <Avatar src={m.user.avatar}
                  sx={{ width:40, height:40, fontSize:'0.875rem', fontWeight:600,
                    background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white', flexShrink:0 }}>
                  {m.user.name[0]}
                </Avatar>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600} fontSize="0.875rem" color="#1F2937" noWrap>
                    {m.user.name}
                  </Typography>
                  <Typography fontSize="0.75rem"
                    color={m.role === 'moderator' ? '#4F46E5' : '#6B7280'}
                    sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <i className={m.role === 'moderator' ? 'fas fa-shield-alt' : 'fas fa-user'}
                      style={{ fontSize:'0.625rem' }} />
                    {m.role === 'moderator' ? 'Moderator' : 'Member'}
                  </Typography>
                </Box>
                {selected === m.user._id && (
                  <Box sx={{ width:20, height:20, borderRadius:'50%', background:'#4F46E5',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className="fas fa-check" style={{ color:'white', fontSize:'0.625rem' }} />
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display:'flex', gap:1 }}>
          <button style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }} onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!selected || loading}
            style={{ flex:1, justifyContent:'center', border:'none',
              background: selected ? 'linear-gradient(135deg,#EF4444,#DC2626)' : '#E5E7EB',
              color: selected ? 'white' : '#9CA3AF',
              padding:'0.5rem 1rem', borderRadius:'0.5rem', fontWeight:600, cursor: selected ? 'pointer' : 'not-allowed',
              fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem',
              fontFamily:'Inter,sans-serif', opacity: loading ? 0.6 : 1 }}
            onClick={() => selected && onTransferAndLeave(selected)}>
            {loading
              ? <><i className="fas fa-spinner fa-spin" />Processing…</>
              : <><i className="fas fa-exchange-alt" />Transfer &amp; Leave</>}
          </button>
        </Box>
      </Box>
    </Box>
  );
};

// ─── Right Sidebar ────────────────────────────────────────────────────────────

const RightSidebar: React.FC<{ group: Group }> = ({ group }) => {
  const navigate = useNavigate();
  const admins = group.members.filter(m => m.role === 'admin' || m.role === 'moderator');

  return (
    <Box>
      {/* Group Admins */}
      <div style={V.section}>
        <div style={V.sideTitle}>Group Admins</div>
        <Box sx={{ display:'flex', flexDirection:'column', gap:0.75 }}>
          {admins.slice(0,4).map(m => (
            <Box key={m.user._id} onClick={() => navigate(`/profile/${m.user._id}`)}
              sx={{ display:'flex', alignItems:'center', gap:1.25, p:1, borderRadius:'0.5rem',
                cursor:'pointer', border:'1px solid #E5E7EB', background:'#F9FAFB',
                transition:'all 0.2s', '&:hover':{ borderColor:'#4F46E5' } }}>
              <Avatar src={m.user.avatar}
                sx={{ width:36, height:36, fontSize:'0.75rem', fontWeight:600,
                  background: m.role==='admin' ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'linear-gradient(135deg,#4F46E5,#10B981)',
                  color:'white' }}>
                {m.user.name[0]}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography fontSize="0.8125rem" fontWeight={600} color="#1F2937" noWrap>{m.user.name}</Typography>
                <Typography fontSize="0.6875rem" color={m.role==='admin' ? '#F59E0B' : '#4F46E5'}
                  sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                  <i className={m.role==='admin' ? 'fas fa-crown' : 'fas fa-shield-alt'} style={{ fontSize:'0.625rem' }} />
                  {m.role==='admin' ? 'Group Owner' : 'Moderator'}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </div>


      {/* Group Stats */}
      <div style={V.section}>
        <div style={V.sideTitle}>Group Stats</div>
        <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'1fr', sm:'1fr 1fr' }, gap:0.75 }}>
          {[
            { value: group.memberCount,                                                    label:'Members',  icon:'fas fa-users' },
            { value: group.members.filter(m=>m.role==='moderator').length + 1,             label:'Admins',   icon:'fas fa-shield-alt' },
            { value: group.stats?.postsCount  ?? 0,                                        label:'Posts',    icon:'fas fa-newspaper' },
            { value: group.stats?.eventsCount ?? 0,                                        label:'Events',   icon:'fas fa-calendar-alt' },
            { value: group.stats?.messagesCount ?? 0,                                      label:'Messages', icon:'fas fa-comments' },
            { value: group.tags?.length || 0,                                              label:'Tags',     icon:'fas fa-tags' },
          ].map(s => (
            <Box key={s.label} sx={{ background:'linear-gradient(135deg,#4F46E5,#10B981)',
              borderRadius:'0.5rem', p:1.25, textAlign:'center', color:'white' }}>
              <i className={s.icon} style={{ fontSize:'0.875rem', opacity:0.85, marginBottom:'0.25rem', display:'block' }} />
              <Typography fontWeight={700} fontSize="1.125rem" color="white">{s.value}</Typography>
              <Typography fontSize="0.6875rem" sx={{ opacity:0.9 }} color="white">{s.label}</Typography>
            </Box>
          ))}
        </Box>
      </div>

      {/* Recent Activity */}
      <div style={V.section}>
        <div style={V.sideTitle}>Recent Activity</div>
        <Box sx={{ display:'flex', flexDirection:'column', gap:0.75 }}>
          {group.members.slice(0,3).map(m => (
            <Box key={m.user._id} sx={{ display:'flex', alignItems:'flex-start', gap:1,
              p:0.875, borderRadius:'0.5rem', background:'#F9FAFB', border:'1px solid #E5E7EB',
              transition:'all 0.2s', '&:hover':{ borderColor:'#4F46E5' } }}>
              <Avatar src={m.user.avatar}
                sx={{ width:28, height:28, fontSize:'0.6875rem', fontWeight:600,
                  background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white', flexShrink:0 }}>
                {m.user.name[0]}
              </Avatar>
              <Box flex={1} minWidth={0}>
                <Typography fontSize="0.8125rem" color="#1F2937" lineHeight={1.4}>
                  <strong style={{ color:'#4F46E5' }}>{m.user.name}</strong> joined the group
                </Typography>
                <Typography fontSize="0.6875rem" color="#6B7280" mt={0.25}>
                  {new Date(m.joinedAt).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </div>

      {/* Member Spotlight */}
      <div style={V.section}>
        <div style={V.sideTitle}>Member Spotlight</div>
        <Box sx={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.5rem', p:1.5, textAlign:'center' }}>
          <Avatar src={group.admin.avatar}
            sx={{ width:56, height:56, mx:'auto', mb:1, fontSize:'1.25rem', fontWeight:700,
              background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white' }}>
            {group.admin.name[0]}
          </Avatar>
          <Typography fontWeight={600} fontSize="0.875rem" color="#1F2937">{group.admin.name}</Typography>
          <Typography fontSize="0.75rem" color="#F59E0B" sx={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0.5, mb:1 }}>
            <i className="fas fa-crown" style={{ fontSize:'0.625rem' }} />Group Owner
          </Typography>
          <Box sx={{ display:'flex', justifyContent:'center', gap:2 }}>
            {[{ v: group.memberCount, l:'Members' }, { v: group.tags?.length||0, l:'Tags' }].map(s => (
              <Box key={s.l} sx={{ textAlign:'center' }}>
                <Typography fontWeight={700} fontSize="1rem" color="#4F46E5">{s.v}</Typography>
                <Typography fontSize="0.6875rem" color="#6B7280">{s.l}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </div>
    </Box>
  );
};

// ─── Feed Tab ─────────────────────────────────────────────────────────────────

const POST_TYPE_ICONS: Record<string, string> = {
  skill:    'fas fa-graduation-cap',
  tool:     'fas fa-tools',
  event:    'fas fa-calendar-alt',
  question: 'fas fa-question-circle',
};

const FeedTab: React.FC<{ group: Group }> = ({ group }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickQ, setQuickQ] = useState('');

  const quickPost = useMutation({
    mutationFn: (title: string) =>
      api.post('/posts', { type: 'question', title, content: title, tags: ['question'], bounty: 1, group: group._id }),
    onSuccess: () => {
      setQuickQ('');
      queryClient.invalidateQueries({ queryKey: ['group-posts', group._id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleQuickSubmit = () => {
    const trimmed = quickQ.trim();
    if (!trimmed || quickPost.isLoading) return;
    quickPost.mutate(trimmed);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['group-posts', group._id],
    queryFn: async () => {
      const res = await api.get(`/posts?group=${group._id}&sort=new&limit=50`);
      return res.data.posts as any[];
    },
  });

  const posts = data ?? [];

  const postTypes = [
    { icon:'fas fa-question-circle',    label:'Ask Question' },
    { icon:'fas fa-chalkboard-teacher', label:'Share Skill' },
    { icon:'fas fa-tools',              label:'List Tool' },
    { icon:'fas fa-calendar-alt',       label:'Create Event' },
  ];

  return (
    <Box>
      {/* Create Post */}
      <Box sx={{ ...V.card, p:1.5, mb:1.5 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:1.5 }}>
          <Avatar src={user?.avatar}
            sx={{ width:44, height:44, background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white', fontWeight:700 }}>
            {user?.name?.[0]}
          </Avatar>
          <Box component="input"
            placeholder={`Ask ${group.name} a question...`}
            value={quickQ}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickQ(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleQuickSubmit(); }}
            sx={{ flex:1, padding:'0.75rem 1rem', border:'1px solid #E5E7EB', borderRadius:'0.75rem',
              fontSize:'0.875rem', background:'#F9FAFB', fontFamily:'Inter,sans-serif',
              outline:'none', '&:hover':{ borderColor:'#4F46E5' }, '&:focus':{ borderColor:'#4F46E5', boxShadow:'0 0 0 3px rgba(79,70,229,0.1)' } }} />
          {quickQ.trim() && (
            <Box component="button" onClick={handleQuickSubmit}
              disabled={quickPost.isLoading}
              sx={{ width:40, height:40, borderRadius:'50%', border:'none',
                background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white',
                display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                flexShrink:0, transition:'all 0.2s', opacity: quickPost.isLoading ? 0.6 : 1,
                '&:hover':{ transform:'scale(1.05)' } }}>
              <i className={quickPost.isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'} style={{ fontSize:'0.875rem' }} />
            </Box>
          )}
        </Box>
        {quickQ.trim() && (
          <Typography sx={{ fontSize:'0.75rem', color:'#6B7280', mb:1, fontFamily:'Inter,sans-serif' }}>
            <i className="fas fa-question-circle" style={{ marginRight:4, color:'#4F46E5' }} />
            Posts as a question with 1 CEU bounty. Press Enter or click send.
          </Typography>
        )}
        {quickPost.isError && (
          <Typography sx={{ fontSize:'0.75rem', color:'#EF4444', mb:1, fontFamily:'Inter,sans-serif' }}>
            Failed to post — check your connection and try again.
          </Typography>
        )}
        <Box sx={{ display:'grid', gridTemplateColumns:{ xs:'repeat(2,1fr)', sm:'repeat(4,1fr)' }, gap:0.75 }}>
          {postTypes.map(pt => (
            <button key={pt.label} onClick={() => navigate(`/posts/create?group=${group._id}`)}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:'0.5rem', padding:'0.875rem 0.5rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem',
                background:'#FFFFFF', color:'#1F2937', fontSize:'0.8125rem', fontWeight:500,
                cursor:'pointer', transition:'all 0.2s', fontFamily:'Inter,sans-serif', minHeight:80 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.transform='translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.transform=''; }}>
              <i className={pt.icon} style={{ color:'#4F46E5', fontSize:'1.125rem' }} />
              {pt.label}
            </button>
          ))}
        </Box>
      </Box>

      {/* Posts */}
      {isLoading ? (
        <Box sx={{ display:'flex', flexDirection:'column', gap:1.5 }}>
          {[1,2].map(i => <Skeleton key={i} variant="rounded" height={160} />)}
        </Box>
      ) : posts.length === 0 ? (
        <Box sx={{ ...V.card, p:4, textAlign:'center' }}>
          <Box sx={{ width:64, height:64, borderRadius:'50%', background:'#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:2 }}>
            <i className="fas fa-newspaper" style={{ color:'#9CA3AF', fontSize:'1.75rem' }} />
          </Box>
          <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937" mb={0.75}>
            No posts yet
          </Typography>
          <Typography fontSize="0.875rem" color="#6B7280" mb={2.5}>
            Be the first to share something with {group.name}!
          </Typography>
          <button style={V.btn.gradient} onClick={() => navigate(`/posts/create?group=${group._id}`)}
            onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform='')}>
            <i className="fas fa-plus" />Create First Post
          </button>
        </Box>
      ) : (
        <Box sx={{ display:'flex', flexDirection:'column', gap:1.5 }}>
          {posts.map((post: any) => {
            const score = (post.upvotes?.length ?? 0) - (post.downvotes?.length ?? 0);
            const catIcon = POST_TYPE_ICONS[post.type] ?? 'fas fa-file-alt';
            const timeAgo = new Date(post.createdAt).toLocaleDateString();
            return (
              <Box key={post._id} sx={{ ...V.card, overflow:'hidden', cursor:'pointer' }}
                onClick={() => navigate(`/posts/${post._id}`)}>
                <Box sx={{ p:1.5, borderBottom:'1px solid #E5E7EB', background:'#F9FAFB' }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.75, mb:0.75 }}>
                    <Box component="span" sx={{ display:'inline-flex', alignItems:'center', gap:0.5,
                      px:1, py:0.375, background:'linear-gradient(135deg,#4F46E5,#10B981)',
                      color:'white', fontSize:'0.75rem', fontWeight:500, borderRadius:'0.375rem' }}>
                      <i className={catIcon} style={{ fontSize:'0.6875rem' }} />
                      {post.type?.charAt(0).toUpperCase() + post.type?.slice(1)}
                    </Box>
                    <Typography fontSize="0.875rem" color="#6B7280">
                      by <strong style={{ color:'#1F2937' }}>{post.author?.name}</strong>
                    </Typography>
                    <Typography fontSize="0.75rem" color="#6B7280">{timeAgo}</Typography>
                  </Box>
                  <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937" lineHeight={1.4}>
                    {post.title}
                  </Typography>
                </Box>
                <Box sx={{ p:1.5 }}>
                  <Typography fontSize="0.875rem" color="#1F2937" lineHeight={1.6}
                    sx={{ display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {post.content}
                  </Typography>
                </Box>
                <Box sx={{ p:'0.875rem 1.5rem', borderTop:'1px solid #E5E7EB', background:'#F9FAFB',
                  display:'flex', alignItems:'center', gap:1 }}>
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.5 }}>
                    <i className="fas fa-arrow-up" style={{ color:'#6B7280', fontSize:'0.875rem' }} />
                    <Typography fontWeight={600} fontSize="0.875rem" color="#1F2937">{score}</Typography>
                  </Box>
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.375, color:'#6B7280', fontSize:'0.875rem', ml:1 }}>
                    <i className="fas fa-comment" style={{ fontSize:'0.8125rem' }} />
                    <Typography fontSize="0.875rem" color="#6B7280">{post.commentCount ?? 0} Comments</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ─── Chats Tab ────────────────────────────────────────────────────────────────

const CHANNEL_ICONS = [
  { icon: 'fas fa-users',              label: 'Group' },
  { icon: 'fas fa-code',               label: 'Code' },
  { icon: 'fas fa-question-circle',    label: 'Help' },
  { icon: 'fas fa-project-diagram',    label: 'Project' },
  { icon: 'fas fa-microphone',         label: 'Voice' },
  { icon: 'fas fa-shield-alt',         label: 'Security' },
  { icon: 'fas fa-brain',              label: 'AI/ML' },
  { icon: 'fas fa-gamepad',            label: 'Gaming' },
  { icon: 'fas fa-palette',            label: 'Design' },
  { icon: 'fas fa-bullhorn',           label: 'Announce' },
  { icon: 'fas fa-lightbulb',          label: 'Ideas' },
  { icon: 'fas fa-book',               label: 'Learning' },
];

const CHANNEL_COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#14B8A6'];

const ChatsTab: React.FC<{ groupId: string; userRole: 'admin' | 'moderator' | 'member' }> = ({ groupId, userRole }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newIcon, setNewIcon] = useState('fas fa-comments');
  const [newIconFile, setNewIconFile] = useState<File | null>(null);
  const [newIconPreview, setNewIconPreview] = useState<string | null>(null);
  const iconInputRef = React.useRef<HTMLInputElement>(null);
  const [newColor, setNewColor] = useState('#4F46E5');
  const [newType, setNewType] = useState<'public' | 'private'>('public');

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['group-channels', groupId],
    queryFn: async () => {
      const res = await api.get(`/groups/${groupId}/channels`);
      return res.data as any[];
    },
  });

  const createMut = useMutation({
    mutationFn: () => {
      if (newIconFile) {
        const fd = new FormData();
        fd.append('name', newName.trim());
        fd.append('description', newDesc.trim());
        fd.append('icon', newIcon);
        fd.append('color', newColor);
        fd.append('type', newType);
        fd.append('iconImage', newIconFile);
        return api.post(`/groups/${groupId}/channels`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      return api.post(`/groups/${groupId}/channels`, {
        name: newName.trim(), description: newDesc.trim(), icon: newIcon, color: newColor, type: newType,
      });
    },
    onSuccess: () => {
      setNewName(''); setNewDesc(''); setNewIcon('fas fa-comments'); setNewColor('#4F46E5'); setNewType('public');
      setNewIconFile(null); setNewIconPreview(null);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ['group-channels', groupId] });
    },
  });

  const filtered = channels.filter((ch: any) =>
    ch.name.toLowerCase().includes(search.toLowerCase()) ||
    ch.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ ...V.card, p:1.5 }}>
      {/* Header: Search + actions */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5, flexWrap:'wrap', gap:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:0.75, padding:'0.5rem 1rem',
          background:'#FFFFFF', border:'1px solid #E5E7EB', borderRadius:'0.75rem', flex:'1 1 240px', maxWidth:400 }}>
          <i className="fas fa-search" style={{ color:'#6B7280', fontSize:'0.875rem' }} />
          <Box component="input" value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search chats..."
            sx={{ border:'none', background:'none', flex:1, outline:'none', fontSize:'0.875rem',
              color:'#1F2937', fontFamily:'Inter,sans-serif' }} />
        </Box>
        <Box sx={{ display:'flex', gap:0.75 }}>
          {userRole === 'admin' && (
            <button style={V.btn.outlined} onClick={() => setShowCreate(s => !s)}>
              <i className="fas fa-plus" />{showCreate ? 'Cancel' : 'New Chat'}
            </button>
          )}
          <button style={V.btn.gradient} onClick={() => navigate(`/groups/${groupId}/chat`)}>
            <i className="fas fa-comments" />Open Group Chat
          </button>
        </Box>
      </Box>

      {/* Create Channel Form */}
      {showCreate && (
        <Box sx={{ ...V.card, p:2, mb:1.5 }}>
          <Typography fontWeight={600} fontSize="1rem" color="#1F2937" mb={1.5}>Create New Chat</Typography>

          {/* Name */}
          <Box component="input" placeholder="Chat name *"
            value={newName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)}
            sx={{ width:'100%', padding:'0.625rem 0.875rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem',
              fontSize:'0.875rem', fontFamily:'Inter,sans-serif', outline:'none', mb:1,
              '&:focus':{ borderColor:'#4F46E5', boxShadow:'0 0 0 3px rgba(79,70,229,0.1)' } }} />

          {/* Description */}
          <Box component="textarea" placeholder="Description (optional)" rows={2}
            value={newDesc} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDesc(e.target.value)}
            sx={{ width:'100%', padding:'0.625rem 0.875rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem',
              fontSize:'0.875rem', fontFamily:'Inter,sans-serif', outline:'none', resize:'vertical', mb:1.5,
              '&:focus':{ borderColor:'#4F46E5', boxShadow:'0 0 0 3px rgba(79,70,229,0.1)' } }} />

          {/* Icon Picker */}
          <Typography fontSize="0.75rem" fontWeight={600} color="#6B7280" mb={0.75}
            sx={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>Icon</Typography>
          <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.75, mb:1.5, alignItems:'center' }}>
            {/* Upload custom icon */}
            <input ref={iconInputRef} type="file" accept="image/*" hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setNewIconFile(file);
                  setNewIconPreview(URL.createObjectURL(file));
                  setNewIcon('');
                }
              }} />
            <Box
              onClick={() => iconInputRef.current?.click()}
              sx={{ width:44, height:44, borderRadius:'0.5rem',
                border: newIconPreview ? '2px solid #4F46E5' : '2px dashed #D1D5DB',
                background: newIconPreview ? '#EEF2FF' : '#F9FAFB',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', transition:'all 0.15s', overflow:'hidden',
                '&:hover':{ borderColor:'#4F46E5' } }}>
              {newIconPreview ? (
                <img src={newIconPreview} alt="icon" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              ) : (
                <i className="fas fa-camera" style={{ color:'#9CA3AF', fontSize:'0.875rem' }} />
              )}
            </Box>
            {newIconPreview && (
              <Box onClick={() => { setNewIconFile(null); setNewIconPreview(null); setNewIcon('fas fa-comments'); }}
                sx={{ width:20, height:20, borderRadius:'50%', background:'#EF4444', color:'white',
                  display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer',
                  fontSize:'0.625rem', ml:-0.75, mt:-3, position:'relative', zIndex:1 }}>
                <i className="fas fa-times" />
              </Box>
            )}
            {/* Preset icons */}
            {CHANNEL_ICONS.map(ci => (
              <Box key={ci.icon}
                onClick={() => { setNewIcon(ci.icon); setNewIconFile(null); setNewIconPreview(null); }}
                sx={{ width:44, height:44, borderRadius:'0.5rem',
                  border: !newIconPreview && newIcon === ci.icon ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                  background: !newIconPreview && newIcon === ci.icon ? '#EEF2FF' : '#F9FAFB',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  cursor:'pointer', transition:'all 0.15s',
                  '&:hover':{ borderColor:'#4F46E5' } }}>
                <i className={ci.icon} style={{ color: !newIconPreview && newIcon === ci.icon ? '#4F46E5' : '#6B7280', fontSize:'1rem' }} />
              </Box>
            ))}
          </Box>

          {/* Color Picker */}
          <Typography fontSize="0.75rem" fontWeight={600} color="#6B7280" mb={0.75}
            sx={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>Color</Typography>
          <Box sx={{ display:'flex', gap:0.75, mb:1.5 }}>
            {CHANNEL_COLORS.map(c => (
              <Box key={c}
                onClick={() => setNewColor(c)}
                sx={{ width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer',
                  border: newColor === c ? '3px solid #1F2937' : '3px solid transparent',
                  transition:'all 0.15s', '&:hover':{ transform:'scale(1.15)' } }} />
            ))}
          </Box>

          {/* Privacy */}
          <Typography fontSize="0.75rem" fontWeight={600} color="#6B7280" mb={0.75}
            sx={{ textTransform:'uppercase', letterSpacing:'0.05em' }}>Privacy</Typography>
          <Box sx={{ display:'flex', gap:0.75, mb:2 }}>
            {(['public', 'private'] as const).map(t => (
              <button key={t} onClick={() => setNewType(t)}
                style={{ display:'flex', alignItems:'center', gap:'0.375rem',
                  padding:'0.5rem 1rem', borderRadius:'0.5rem', fontSize:'0.8125rem', fontWeight:500,
                  cursor:'pointer', fontFamily:'Inter,sans-serif', transition:'all 0.2s',
                  border: newType === t ? '2px solid #4F46E5' : '1px solid #E5E7EB',
                  background: newType === t ? '#EEF2FF' : '#FFFFFF',
                  color: newType === t ? '#4F46E5' : '#6B7280' }}>
                <i className={t === 'public' ? 'fas fa-globe' : 'fas fa-lock'} />
                {t === 'public' ? 'Public' : 'Private'}
              </button>
            ))}
          </Box>

          {/* Submit */}
          <Box sx={{ display:'flex', justifyContent:'flex-end', gap:0.75 }}>
            <button style={V.btn.outlined} onClick={() => setShowCreate(false)}>Cancel</button>
            <button style={{ ...V.btn.gradient, opacity: !newName.trim() || createMut.isLoading ? 0.5 : 1 }}
              disabled={!newName.trim() || createMut.isLoading}
              onClick={() => createMut.mutate()}>
              <i className={createMut.isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-plus'} />
              Create Chat
            </button>
          </Box>
        </Box>
      )}

      {/* Channel Cards Grid */}
      {isLoading ? (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:1.5 }}>
          {[1,2,3].map(i => <Skeleton key={i} variant="rounded" height={200} />)}
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ ...V.card, p:4, textAlign:'center' }}>
          <Box sx={{ width:64, height:64, borderRadius:'50%', background:'#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:2 }}>
            <i className="fas fa-comments" style={{ color:'#9CA3AF', fontSize:'1.75rem' }} />
          </Box>
          <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937" mb={0.75}>
            {search ? 'No chats found' : 'No chats yet'}
          </Typography>
          <Typography fontSize="0.875rem" color="#6B7280" mb={2}>
            {search ? 'Try a different search term.' : 'Create the first chat channel for this group!'}
          </Typography>
          {!search && !showCreate && (
            <button style={V.btn.gradient} onClick={() => setShowCreate(true)}>
              <i className="fas fa-plus" />New Chat
            </button>
          )}
        </Box>
      ) : (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px,1fr))', gap:1.5 }}>
          {filtered.map((ch: any) => (
            <Box key={ch._id} sx={{ ...V.card, p:2, display:'flex', flexDirection:'column', transition:'all 0.2s',
              '&:hover':{ borderColor:'#4F46E5', boxShadow:'0 4px 12px rgba(0,0,0,0.1)', transform:'translateY(-2px)' } }}>
              {/* Icon */}
              <Box sx={{ width:48, height:48, borderRadius:'0.625rem', overflow:'hidden',
                background: ch.iconImage ? 'transparent' : `linear-gradient(135deg, ${ch.color || '#4F46E5'}, ${ch.color === '#4F46E5' ? '#10B981' : ch.color + '99'})`,
                display:'flex', alignItems:'center', justifyContent:'center', mb:1.5, flexShrink:0 }}>
                {ch.iconImage ? (
                  <img src={ch.iconImage} alt={ch.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                ) : (
                  <i className={ch.icon || 'fas fa-comments'} style={{ color:'white', fontSize:'1.25rem' }} />
                )}
              </Box>

              {/* Title + new badge */}
              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.5 }}>
                <Typography fontWeight={700} fontSize="1.0625rem" color="#1F2937" sx={{ lineHeight:1.3 }}>
                  {ch.name}
                </Typography>
                {ch.messageCount > 0 && (
                  <Box sx={{ background:'linear-gradient(135deg,#10B981,#059669)', color:'white',
                    fontSize:'0.6875rem', fontWeight:700, padding:'0.125rem 0.5rem', borderRadius:'1rem', whiteSpace:'nowrap' }}>
                    {ch.messageCount} {ch.messageCount === 1 ? 'msg' : 'msgs'}
                  </Box>
                )}
              </Box>

              {/* Description */}
              <Typography fontSize="0.8125rem" color="#6B7280" mb={1.5}
                sx={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', lineHeight:1.5 }}>
                {ch.description || 'No description.'}
              </Typography>

              {/* Spacer */}
              <Box flex={1} />

              {/* Actions */}
              {ch.type === 'private' ? (
                <Box sx={{ display:'flex', gap:0.75 }}>
                  <button style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }}>
                    <i className="fas fa-lock" />Private
                  </button>
                  <button style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }}>
                    <i className="fas fa-envelope" />Request Access
                  </button>
                </Box>
              ) : (
                <button
                  onClick={() => navigate(`/groups/${groupId}/chat?channel=${ch._id}`)}
                  style={{ ...V.btn.gradient, width:'100%', justifyContent:'center' }}>
                  <i className="fas fa-comments" />Join Chat
                </button>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

// ─── Members Tab ──────────────────────────────────────────────────────────────

/* ─── Invite Modal ──────────────────────────────────────────────────────────── */
const InviteModal: React.FC<{ groupId: string; onClose: () => void }> = ({ groupId, onClose }) => {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<{ _id: string; name: string; avatar?: string }[]>([]);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const { data: results = [] } = useQuery<{ _id: string; name: string; avatar?: string; bio?: string }[]>({
    queryKey: ['invite-search', q, groupId],
    queryFn: async () => {
      if (q.trim().length < 2) return [];
      const res = await api.get('/groups/users/search', { params: { q, groupId } });
      return res.data;
    },
    enabled: q.trim().length >= 2,
  });

  const toggle = (u: { _id: string; name: string; avatar?: string }) => {
    setSelected(prev => prev.some(x => x._id === u._id) ? prev.filter(x => x._id !== u._id) : [...prev, u]);
  };

  const send = async () => {
    if (!selected.length) return;
    setSending(true);
    try {
      await api.post(`/groups/${groupId}/invite`, { userIds: selected.map(u => u._id) });
      setDone(true);
    } finally { setSending(false); }
  };

  const GRAD = 'linear-gradient(135deg,#4F46E5,#10B981)';
  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' };
  const modal: React.CSSProperties = { background:'#FFFFFF', borderRadius:'1rem', padding:'1.5rem', width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'85vh', display:'flex', flexDirection:'column' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'1.125rem', fontWeight:700, color:'#1F2937', display:'flex', alignItems:'center', gap:'0.5rem' }}>
            <i className="fas fa-user-plus" style={{ background:GRAD, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }} />
            Invite Members
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:'1.25rem' }}><i className="fas fa-times" /></button>
        </div>

        {done ? (
          <div style={{ textAlign:'center', padding:'2rem 0' }}>
            <i className="fas fa-check-circle" style={{ fontSize:'3rem', color:'#10B981', marginBottom:'0.75rem', display:'block' }} />
            <div style={{ fontWeight:600, fontSize:'1.125rem', color:'#1F2937' }}>Invitations sent!</div>
            <div style={{ color:'#6B7280', fontSize:'0.875rem', marginTop:'0.375rem' }}>{selected.length} neighbour{selected.length !== 1 ? 's' : ''} will receive an invite.</div>
            <button onClick={onClose} style={{ marginTop:'1.25rem', ...V.btn.gradient }}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'0.6rem 0.875rem', background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.625rem', marginBottom:'0.875rem' }}>
              <i className="fas fa-search" style={{ color:'#9CA3AF', fontSize:'0.875rem' }} />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or email…"
                style={{ flex:1, border:'none', background:'none', outline:'none', fontSize:'0.875rem', color:'#1F2937', fontFamily:'Inter,sans-serif' }} autoFocus />
            </div>

            {/* Selected chips */}
            {selected.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'0.375rem', marginBottom:'0.75rem' }}>
                {selected.map(u => (
                  <div key={u._id} style={{ display:'flex', alignItems:'center', gap:'0.3rem', padding:'0.25rem 0.5rem 0.25rem 0.375rem', background:'#EEF2FF', border:'1px solid #C7D2FE', borderRadius:'2rem', fontSize:'0.75rem', color:'#4F46E5', fontWeight:500 }}>
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4F46E5&color=fff&size=20`} alt={u.name} style={{ width:16, height:16, borderRadius:'50%', objectFit:'cover' }} />
                    {u.name}
                    <button onClick={() => toggle(u)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6366F1', padding:0, fontSize:'0.75rem', display:'flex', lineHeight:1 }}><i className="fas fa-times" /></button>
                  </div>
                ))}
              </div>
            )}

            {/* Results */}
            <div style={{ flex:1, overflowY:'auto', marginBottom:'1rem' }}>
              {q.trim().length < 2 && (
                <div style={{ textAlign:'center', padding:'2rem 0', color:'#9CA3AF', fontSize:'0.875rem' }}>
                  <i className="fas fa-search" style={{ fontSize:'1.5rem', marginBottom:'0.5rem', display:'block' }} />
                  Type 2+ characters to search
                </div>
              )}
              {results.map(u => {
                const isSelected = selected.some(x => x._id === u._id);
                return (
                  <div key={u._id} onClick={() => toggle(u)}
                    style={{ display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.6rem 0.5rem', borderRadius:'0.5rem', cursor:'pointer', background: isSelected ? '#EEF2FF' : 'transparent', transition:'background 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background='#F9FAFB'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background='transparent'; }}>
                    <img src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=4F46E5&color=fff&size=40`} alt={u.name}
                      style={{ width:36, height:36, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:600, fontSize:'0.875rem', color:'#1F2937' }}>{u.name}</div>
                      {u.bio && <div style={{ fontSize:'0.75rem', color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.bio}</div>}
                    </div>
                    <div style={{ width:20, height:20, borderRadius:'50%', border:`2px solid ${isSelected ? '#4F46E5' : '#D1D5DB'}`, background: isSelected ? '#4F46E5' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                      {isSelected && <i className="fas fa-check" style={{ color:'#FFFFFF', fontSize:'0.625rem' }} />}
                    </div>
                  </div>
                );
              })}
              {q.trim().length >= 2 && results.length === 0 && (
                <div style={{ textAlign:'center', padding:'1.5rem 0', color:'#9CA3AF', fontSize:'0.875rem' }}>No users found</div>
              )}
            </div>

            <button onClick={send} disabled={!selected.length || sending}
              style={{ ...V.btn.gradient, width:'100%', justifyContent:'center', opacity: selected.length ? 1 : 0.5 }}>
              {sending ? <><i className="fas fa-spinner fa-spin" />Sending…</> : <><i className="fas fa-paper-plane" />Send {selected.length > 0 ? `${selected.length} Invite${selected.length > 1 ? 's' : ''}` : 'Invites'}</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── Change Role Modal ─────────────────────────────────────────────────────── */
type MemberPerms = { canPost: boolean; canComment: boolean; canUploadFiles: boolean; canInvite: boolean; isMuted: boolean; mutedUntil: string };
const ChangeRoleModal: React.FC<{
  groupId: string;
  member: Group['members'][0];
  onClose: () => void;
  onSaved: () => void;
}> = ({ groupId, member, onClose, onSaved }) => {
  const [role, setRole] = useState<'admin' | 'moderator' | 'member'>(member.role as 'admin' | 'moderator' | 'member');
  const [perms, setPerms] = useState<MemberPerms>({
    canPost:        member.permissions?.canPost        ?? true,
    canComment:     member.permissions?.canComment     ?? true,
    canUploadFiles: member.permissions?.canUploadFiles ?? true,
    canInvite:      member.permissions?.canInvite      ?? false,
    isMuted:        member.permissions?.isMuted        ?? false,
    mutedUntil:     member.permissions?.mutedUntil     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setPerm = (key: keyof MemberPerms, val: boolean | string) =>
    setPerms(p => ({ ...p, [key]: val }));

  const save = async () => {
    setSaving(true); setError('');
    try {
      await api.patch(`/groups/${groupId}/members/${member.user._id}/role`, {
        role,
        permissions: { ...perms, mutedUntil: perms.mutedUntil || null },
      });
      onSaved();
      onClose();
    } catch { setError('Failed to save changes. Please try again.'); }
    finally { setSaving(false); }
  };

  const GRAD = 'linear-gradient(135deg,#4F46E5,#10B981)';
  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' };
  const modal: React.CSSProperties = { background:'#FFFFFF', borderRadius:'1rem', padding:'1.5rem', width:'100%', maxWidth:480, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' };
  const toggle: React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.75rem 0', borderBottom:'1px solid #F3F4F6' };

  const Switch: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
    <div onClick={() => onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, background: on ? '#4F46E5' : '#D1D5DB', cursor:'pointer', position:'relative', transition:'background 0.2s', flexShrink:0 }}>
      <div style={{ position:'absolute', top:3, left: on ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'#FFFFFF', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }} />
    </div>
  );

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div>
            <div style={{ fontSize:'1.125rem', fontWeight:700, color:'#1F2937' }}>Manage Member</div>
            <div style={{ fontSize:'0.8125rem', color:'#6B7280', marginTop:'0.125rem' }}>{member.user.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:'1.25rem' }}><i className="fas fa-times" /></button>
        </div>

        {/* Role picker */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>Role</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:'0.5rem' }}>
            {([
              { id:'admin',     label:'Admin',     icon:'fas fa-crown',      desc:'Full control',           color:'#F59E0B', bg:'#FFFBEB', border:'#FDE68A' },
              { id:'moderator', label:'Moderator', icon:'fas fa-shield-alt', desc:'Moderate members',        color:'#4F46E5', bg:'#EEF2FF', border:'#C7D2FE' },
              { id:'member',    label:'Member',    icon:'fas fa-user',       desc:'Standard access',        color:'#10B981', bg:'#ECFDF5', border:'#A7F3D0' },
            ] as const).map(r => (
              <div key={r.id} onClick={() => setRole(r.id)}
                style={{ padding:'0.625rem', borderRadius:'0.625rem', cursor:'pointer',
                  border:`2px solid ${role === r.id ? r.border : '#E5E7EB'}`,
                  background: role === r.id ? r.bg : '#FFFFFF', transition:'all 0.15s' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.375rem', marginBottom:'0.2rem' }}>
                  <i className={r.icon} style={{ color: role === r.id ? r.color : '#9CA3AF', fontSize:'0.8125rem' }} />
                  <span style={{ fontWeight:600, fontSize:'0.8125rem', color: role === r.id ? r.color : '#1F2937' }}>{r.label}</span>
                </div>
                <div style={{ fontSize:'0.625rem', color:'#6B7280' }}>{r.desc}</div>
              </div>
            ))}
          </div>
          {role === 'admin' && (
            <div style={{ marginTop:'0.5rem', padding:'0.5rem 0.75rem', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:'0.5rem', fontSize:'0.75rem', color:'#92400E', display:'flex', alignItems:'center', gap:'0.5rem' }}>
              <i className="fas fa-exclamation-triangle" />
              Admins have full access — they can manage group settings, create chats, and moderate all members.
            </div>
          )}
        </div>

        {/* Permissions — disabled/all-on for admin role */}
        <div style={{ marginBottom:'1.25rem', opacity: role === 'admin' ? 0.5 : 1, pointerEvents: role === 'admin' ? 'none' : 'auto' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>
            Permissions
            {role === 'admin' && <span style={{ marginLeft:'0.5rem', fontWeight:400, textTransform:'none', color:'#92400E' }}>— all granted for Admins</span>}
          </div>
          <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.625rem', padding:'0 0.875rem' }}>
            {([
              { key:'canPost',        label:'Can Post',          icon:'fas fa-edit',       desc:'Create posts in this group' },
              { key:'canComment',     label:'Can Comment',       icon:'fas fa-comment',    desc:'Reply to messages and posts' },
              { key:'canUploadFiles', label:'Can Upload Files',  icon:'fas fa-paperclip',  desc:'Share images and documents' },
              { key:'canInvite',      label:'Can Invite Others', icon:'fas fa-user-plus',  desc:'Invite new members to the group' },
            ] as { key: keyof MemberPerms; label: string; icon: string; desc: string }[]).map(p => (
              <div key={p.key} style={toggle}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                  <i className={p.icon} style={{ width:16, color:'#4F46E5', fontSize:'0.8125rem' }} />
                  <div>
                    <div style={{ fontSize:'0.875rem', fontWeight:500, color:'#1F2937' }}>{p.label}</div>
                    <div style={{ fontSize:'0.6875rem', color:'#9CA3AF' }}>{p.desc}</div>
                  </div>
                </div>
                <Switch on={role === 'admin' ? true : perms[p.key] as boolean} onChange={v => setPerm(p.key, v)} />
              </div>
            ))}
          </div>
        </div>

        {/* Mute — not applicable to admins */}
        {role !== 'admin' && (
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>Mute</div>
          <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.625rem', padding:'0 0.875rem' }}>
            <div style={toggle}>
              <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                <i className="fas fa-volume-mute" style={{ width:16, color:'#EF4444', fontSize:'0.8125rem' }} />
                <div>
                  <div style={{ fontSize:'0.875rem', fontWeight:500, color:'#1F2937' }}>Muted</div>
                  <div style={{ fontSize:'0.6875rem', color:'#9CA3AF' }}>Cannot send messages while muted</div>
                </div>
              </div>
              <Switch on={perms.isMuted} onChange={v => setPerm('isMuted', v)} />
            </div>
            {perms.isMuted && (
              <div style={{ paddingBottom:'0.75rem' }}>
                <div style={{ fontSize:'0.75rem', color:'#6B7280', marginBottom:'0.375rem' }}>Mute until (leave blank for indefinite)</div>
                <input type="datetime-local" value={perms.mutedUntil} onChange={e => setPerm('mutedUntil', e.target.value)}
                  style={{ width:'100%', padding:'0.5rem', border:'1px solid #E5E7EB', borderRadius:'0.375rem', fontSize:'0.8125rem', fontFamily:'Inter,sans-serif', background:'#FFFFFF', color:'#1F2937', outline:'none', boxSizing:'border-box' }} />
              </div>
            )}
          </div>
        </div>
        )}

        {error && <div style={{ color:'#DC2626', fontSize:'0.8125rem', marginBottom:'0.75rem', padding:'0.5rem 0.75rem', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'0.375rem' }}>{error}</div>}

        <div style={{ display:'flex', gap:'0.625rem' }}>
          <button onClick={onClose} style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ ...V.btn.gradient, flex:1, justifyContent:'center', opacity: saving ? 0.7 : 1 }}>
            {saving ? <><i className="fas fa-spinner fa-spin" />Saving…</> : <><i className="fas fa-check" />Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Remove Confirm Modal ──────────────────────────────────────────────────── */
const RemoveMemberModal: React.FC<{
  groupId: string;
  member: Group['members'][0];
  onClose: () => void;
  onRemoved: () => void;
}> = ({ groupId, member, onClose, onRemoved }) => {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setRemoving(true); setError('');
    try {
      await api.delete(`/groups/${groupId}/members/${member.user._id}`);
      onRemoved();
      onClose();
    } catch { setError('Failed to remove member. Please try again.'); }
    finally { setRemoving(false); }
  };

  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' };
  const modal: React.CSSProperties = { background:'#FFFFFF', borderRadius:'1rem', padding:'1.5rem', width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', gap:'0.75rem', marginBottom:'1.5rem' }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'#FEF2F2', border:'2px solid #FCA5A5', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <i className="fas fa-user-times" style={{ color:'#EF4444', fontSize:'1.375rem' }} />
          </div>
          <div style={{ fontSize:'1.125rem', fontWeight:700, color:'#1F2937' }}>Remove {member.user.name}?</div>
          <div style={{ fontSize:'0.875rem', color:'#6B7280', lineHeight:1.5 }}>
            They will lose access to this group and all its content. They can re-join if the group is public.
          </div>
        </div>
        {error && <div style={{ color:'#DC2626', fontSize:'0.8125rem', marginBottom:'0.75rem', padding:'0.5rem 0.75rem', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'0.375rem' }}>{error}</div>}
        <div style={{ display:'flex', gap:'0.625rem' }}>
          <button onClick={onClose} style={{ ...V.btn.outlined, flex:1, justifyContent:'center' }}>Cancel</button>
          <button onClick={confirm} disabled={removing}
            style={{ flex:1, justifyContent:'center', padding:'0.5rem 1rem', border:'none', background:'#EF4444', color:'#FFFFFF', borderRadius:'0.5rem', fontWeight:600, cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', opacity: removing ? 0.7 : 1 }}>
            {removing ? <><i className="fas fa-spinner fa-spin" />Removing…</> : <><i className="fas fa-user-times" />Remove</>}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Moderate Modal (for Moderators) ──────────────────────────────────────── */
const TIMEOUT_PRESETS = [
  { label: '1 hour',  minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours',minutes: 720 },
  { label: '1 day',   minutes: 1440 },
  { label: '3 days',  minutes: 4320 },
  { label: '7 days',  minutes: 10080 },
];

const ModerateModal: React.FC<{
  groupId: string;
  member: Group['members'][0];
  onClose: () => void;
  onSaved: () => void;
  onRemoved: () => void;
}> = ({ groupId, member, onClose, onSaved, onRemoved }) => {
  const p = member.permissions;
  const nowMuted    = p?.isMuted ?? false;
  const timedOutUntil = p?.mutedUntil ? new Date(p.mutedUntil) : null;
  const isTimedOut  = timedOutUntil ? timedOutUntil > new Date() : false;

  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState(false);
  const [banning, setBanning]   = useState(false);
  const [banReason, setBanReason] = useState('');
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [error, setError]       = useState('');
  const [customDate, setCustomDate] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [modPerms, setModPerms] = useState({
    canPost:        p?.canPost        ?? true,
    canComment:     p?.canComment     ?? true,
    canUploadFiles: p?.canUploadFiles ?? true,
    canInvite:      p?.canInvite      ?? false,
  });
  const [savingPerms, setSavingPerms] = useState(false);

  const ModSwitch: React.FC<{ on: boolean; onChange: (v: boolean) => void }> = ({ on, onChange }) => (
    <button onClick={() => onChange(!on)}
      style={{ width:44, height:24, borderRadius:12, border:'none', cursor:'pointer', padding:2, transition:'all 0.2s',
        background: on ? 'linear-gradient(135deg,#4F46E5,#10B981)' : '#D1D5DB', position:'relative', flexShrink:0 }}>
      <span style={{ display:'block', width:20, height:20, borderRadius:'50%', background:'#FFFFFF',
        transform: on ? 'translateX(20px)' : 'translateX(0)', transition:'transform 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }} />
    </button>
  );

  const savePermissions = async () => {
    setSavingPerms(true); setError('');
    try {
      await api.patch(`/groups/${groupId}/members/${member.user._id}/role`, { permissions: modPerms });
      onSaved(); onClose();
    } catch { setError('Failed to save permissions.'); }
    finally { setSavingPerms(false); }
  };

  const applyTimeout = async (minutes: number | null) => {
    setSaving(true); setError('');
    try {
      const mutedUntil = minutes
        ? new Date(Date.now() + minutes * 60_000).toISOString()
        : null;
      await api.patch(`/groups/${groupId}/members/${member.user._id}/role`, {
        permissions: { isMuted: false, mutedUntil },
      });
      onSaved(); onClose();
    } catch { setError('Failed to apply timeout.'); }
    finally { setSaving(false); }
  };

  const applyCustomTimeout = () => {
    if (!customDate) return;
    const ms = new Date(customDate).getTime() - Date.now();
    if (ms <= 0) { setError('Please pick a future date/time.'); return; }
    applyTimeout(Math.ceil(ms / 60_000));
  };

  const clearRestrictions = async () => {
    setSaving(true); setError('');
    try {
      await api.patch(`/groups/${groupId}/members/${member.user._id}/role`, {
        permissions: { isMuted: false, mutedUntil: null },
      });
      onSaved(); onClose();
    } catch { setError('Failed to clear restrictions.'); }
    finally { setSaving(false); }
  };

  const handleMuteIndefinite = async () => {
    setSaving(true); setError('');
    try {
      await api.patch(`/groups/${groupId}/members/${member.user._id}/role`, {
        permissions: { isMuted: true, mutedUntil: null },
      });
      onSaved(); onClose();
    } catch { setError('Failed to mute member.'); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    setRemoving(true); setError('');
    try {
      await api.delete(`/groups/${groupId}/members/${member.user._id}`);
      onRemoved(); onClose();
    } catch { setError('Failed to remove member.'); }
    finally { setRemoving(false); }
  };

  const handleBan = async () => {
    setBanning(true); setError('');
    try {
      await api.post(`/groups/${groupId}/members/${member.user._id}/ban`, { reason: banReason });
      onRemoved(); onClose();
    } catch { setError('Failed to ban member.'); }
    finally { setBanning(false); }
  };

  const overlay: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(2px)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' };
  const modal: React.CSSProperties   = { background:'#FFFFFF', borderRadius:'1rem', padding:'1.5rem', width:'100%', maxWidth:440, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' };

  const formatUntil = (d: Date) => d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
          <div>
            <div style={{ fontSize:'1.125rem', fontWeight:700, color:'#1F2937' }}>Moderate Member</div>
            <div style={{ fontSize:'0.8125rem', color:'#6B7280', marginTop:'0.125rem' }}>{member.user.name}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#6B7280', fontSize:'1.25rem' }}><i className="fas fa-times" /></button>
        </div>

        {/* Current status */}
        {(nowMuted || isTimedOut) && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.625rem 0.875rem', background: nowMuted ? '#FEF2F2' : '#FEF3C7', border:`1px solid ${nowMuted ? '#FCA5A5' : '#FDE68A'}`, borderRadius:'0.5rem', marginBottom:'1rem' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', fontSize:'0.8125rem', fontWeight:600, color: nowMuted ? '#DC2626' : '#92400E' }}>
              <i className={nowMuted ? 'fas fa-volume-mute' : 'fas fa-clock'} />
              {nowMuted ? 'Indefinitely muted' : `Timed out until ${formatUntil(timedOutUntil!)}`}
            </div>
            <button onClick={clearRestrictions} disabled={saving}
              style={{ fontSize:'0.75rem', padding:'0.2rem 0.5rem', border:`1px solid ${nowMuted ? '#FCA5A5' : '#FDE68A'}`, borderRadius:'0.375rem', background:'#FFFFFF', cursor:'pointer', color: nowMuted ? '#DC2626' : '#92400E', fontWeight:500 }}>
              Clear
            </button>
          </div>
        )}

        {/* Timeout presets */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>
            <i className="fas fa-clock" style={{ marginRight:'0.375rem' }} />Timeout
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(80px, 1fr))', gap:'0.375rem' }}>
            {TIMEOUT_PRESETS.map(p => (
              <button key={p.label} onClick={() => applyTimeout(p.minutes)} disabled={saving}
                style={{ padding:'0.5rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem', background:'#FFFFFF', fontSize:'0.8125rem', color:'#374151', cursor:'pointer', fontWeight:500, transition:'all 0.15s', fontFamily:'Inter,sans-serif' }}
                onMouseEnter={e => { e.currentTarget.style.background='#FEF3C7'; e.currentTarget.style.borderColor='#FDE68A'; e.currentTarget.style.color='#92400E'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.color='#374151'; }}>
                {p.label}
              </button>
            ))}
          </div>
          {/* Custom */}
          <div style={{ marginTop:'0.5rem' }}>
            {!showCustom ? (
              <button onClick={() => setShowCustom(true)}
                style={{ width:'100%', padding:'0.4rem', border:'1px dashed #D1D5DB', borderRadius:'0.5rem', background:'transparent', fontSize:'0.8125rem', color:'#6B7280', cursor:'pointer', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.color='#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#D1D5DB'; e.currentTarget.style.color='#6B7280'; }}>
                <i className="fas fa-calendar-alt" style={{ marginRight:'0.375rem' }} />Custom date & time
              </button>
            ) : (
              <div style={{ display:'flex', gap:'0.375rem' }}>
                <input type="datetime-local" value={customDate} onChange={e => setCustomDate(e.target.value)}
                  style={{ flex:1, padding:'0.4rem 0.625rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem', fontSize:'0.8125rem', fontFamily:'Inter,sans-serif', outline:'none', color:'#1F2937' }} />
                <button onClick={applyCustomTimeout} disabled={saving || !customDate}
                  style={{ padding:'0.4rem 0.75rem', border:'none', borderRadius:'0.5rem', background:'#F59E0B', color:'#FFFFFF', fontSize:'0.8125rem', fontWeight:600, cursor:'pointer', opacity: !customDate ? 0.5 : 1 }}>Apply</button>
              </div>
            )}
          </div>
        </div>

        {/* Indefinite mute */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>
            <i className="fas fa-volume-mute" style={{ marginRight:'0.375rem', color:'#EF4444' }} />Mute
          </div>
          <button onClick={handleMuteIndefinite} disabled={saving || nowMuted}
            style={{ width:'100%', padding:'0.5rem', border:'1px solid #FCA5A5', borderRadius:'0.5rem', background: nowMuted ? '#FEE2E2' : '#FFFFFF', fontSize:'0.8125rem', color:'#DC2626', cursor: nowMuted ? 'not-allowed' : 'pointer', fontWeight:500, transition:'all 0.15s', opacity: nowMuted ? 0.6 : 1, fontFamily:'Inter,sans-serif' }}
            onMouseEnter={e => { if (!nowMuted) e.currentTarget.style.background='#FEF2F2'; }}
            onMouseLeave={e => { if (!nowMuted) e.currentTarget.style.background='#FFFFFF'; }}>
            {nowMuted ? <><i className="fas fa-volume-mute" style={{ marginRight:'0.375rem' }} />Already muted indefinitely</> : <><i className="fas fa-volume-mute" style={{ marginRight:'0.375rem' }} />Mute indefinitely</>}
          </button>
        </div>

        {/* Permissions */}
        <div style={{ marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'0.75rem', fontWeight:600, color:'#6B7280', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'0.625rem' }}>
            <i className="fas fa-key" style={{ marginRight:'0.375rem', color:'#4F46E5' }} />Permissions
          </div>
          <div style={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.625rem', padding:'0 0.875rem' }}>
            {([
              { key:'canPost',        label:'Can Post',          icon:'fas fa-edit',       desc:'Create posts in this group' },
              { key:'canComment',     label:'Can Comment',       icon:'fas fa-comment',    desc:'Reply to messages and posts' },
              { key:'canUploadFiles', label:'Can Upload Files',  icon:'fas fa-paperclip',  desc:'Share images and documents' },
              { key:'canInvite',      label:'Can Invite Others', icon:'fas fa-user-plus',  desc:'Invite new members to the group' },
            ] as { key: keyof typeof modPerms; label: string; icon: string; desc: string }[]).map((pp, i, arr) => (
              <div key={pp.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'0.75rem 0', borderBottom: i < arr.length-1 ? '1px solid #F3F4F6' : 'none' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'0.625rem' }}>
                  <i className={pp.icon} style={{ width:16, color:'#4F46E5', fontSize:'0.8125rem' }} />
                  <div>
                    <div style={{ fontSize:'0.875rem', fontWeight:500, color:'#1F2937' }}>{pp.label}</div>
                    <div style={{ fontSize:'0.6875rem', color:'#9CA3AF' }}>{pp.desc}</div>
                  </div>
                </div>
                <ModSwitch on={modPerms[pp.key]} onChange={v => setModPerms(prev => ({ ...prev, [pp.key]: v }))} />
              </div>
            ))}
          </div>
          <button onClick={savePermissions} disabled={savingPerms}
            style={{ marginTop:'0.625rem', width:'100%', padding:'0.5rem', border:'none', borderRadius:'0.5rem',
              background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'#FFFFFF', fontSize:'0.8125rem',
              fontWeight:600, cursor:'pointer', opacity: savingPerms ? 0.7 : 1, fontFamily:'Inter,sans-serif' }}>
            {savingPerms ? <><i className="fas fa-spinner fa-spin" style={{ marginRight:'0.375rem' }} />Saving…</> : 'Save Permissions'}
          </button>
        </div>

        {/* Remove & Ban actions */}
        <div style={{ paddingTop:'1rem', borderTop:'1px solid #F3F4F6', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
          <button onClick={handleRemove} disabled={removing || banning}
            style={{ width:'100%', padding:'0.625rem', border:'1px solid #FCA5A5', borderRadius:'0.5rem', background:'#FFFFFF', color:'#EF4444', fontSize:'0.875rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity: (removing||banning) ? 0.7 : 1, transition:'opacity 0.15s', fontFamily:'Inter,sans-serif' }}
            onMouseEnter={e => { if (!removing&&!banning) e.currentTarget.style.background='#FEF2F2'; }}
            onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
            {removing ? <><i className="fas fa-spinner fa-spin" />Removing…</> : <><i className="fas fa-user-times" />Remove from group</>}
          </button>

          {/* Ban */}
          {!showBanConfirm ? (
            <button onClick={() => setShowBanConfirm(true)} disabled={removing || banning}
              style={{ width:'100%', padding:'0.625rem', border:'none', borderRadius:'0.5rem', background:'#7F1D1D', color:'#FFFFFF', fontSize:'0.875rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.5rem', opacity:(removing||banning)?0.7:1, transition:'opacity 0.15s', fontFamily:'Inter,sans-serif' }}
              onMouseEnter={e => { e.currentTarget.style.background='#991B1B'; }}
              onMouseLeave={e => { e.currentTarget.style.background='#7F1D1D'; }}>
              <i className="fas fa-ban" />Ban from group
            </button>
          ) : (
            <div style={{ border:'1px solid #FCA5A5', borderRadius:'0.5rem', padding:'0.75rem', background:'#FEF2F2' }}>
              <div style={{ fontSize:'0.8125rem', fontWeight:600, color:'#DC2626', marginBottom:'0.5rem', display:'flex', alignItems:'center', gap:'0.375rem' }}>
                <i className="fas fa-ban" />Confirm ban
              </div>
              <input
                placeholder="Reason (optional)"
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                style={{ width:'100%', padding:'0.375rem 0.625rem', border:'1px solid #FCA5A5', borderRadius:'0.375rem', fontSize:'0.8125rem', marginBottom:'0.5rem', outline:'none', fontFamily:'Inter,sans-serif', boxSizing:'border-box' }}
              />
              <div style={{ display:'flex', gap:'0.5rem' }}>
                <button onClick={() => setShowBanConfirm(false)}
                  style={{ flex:1, padding:'0.375rem', border:'1px solid #D1D5DB', borderRadius:'0.375rem', background:'#FFFFFF', fontSize:'0.8125rem', cursor:'pointer', color:'#374151', fontFamily:'Inter,sans-serif' }}>
                  Cancel
                </button>
                <button onClick={handleBan} disabled={banning}
                  style={{ flex:1, padding:'0.375rem', border:'none', borderRadius:'0.375rem', background:'#7F1D1D', color:'#FFFFFF', fontSize:'0.8125rem', fontWeight:600, cursor:'pointer', opacity:banning?0.7:1, fontFamily:'Inter,sans-serif' }}>
                  {banning ? <><i className="fas fa-spinner fa-spin" /> Banning…</> : 'Ban'}
                </button>
              </div>
            </div>
          )}
        </div>

        {error && <div style={{ color:'#DC2626', fontSize:'0.8125rem', padding:'0.5rem 0.75rem', background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'0.375rem', marginTop:'0.5rem' }}>{error}</div>}
      </div>
    </div>
  );
};

/* ─── Member status badge helper ──────────────────────────────────────────── */
const MemberStatusBadge: React.FC<{ permissions?: Group['members'][0]['permissions'] }> = ({ permissions }) => {
  if (!permissions) return null;
  const timedOut = permissions.mutedUntil ? new Date(permissions.mutedUntil) > new Date() : false;
  const remaining = timedOut && permissions.mutedUntil ? (() => {
    const ms = new Date(permissions.mutedUntil!).getTime() - Date.now();
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  })() : null;

  if (permissions.isMuted)
    return <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'2rem', padding:'0.1rem 0.4rem', fontSize:'0.6rem', color:'#DC2626', fontWeight:600, display:'inline-flex', alignItems:'center', gap:'0.2rem' }}><i className="fas fa-volume-mute" />Muted</div>;
  if (timedOut)
    return <div style={{ background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'2rem', padding:'0.1rem 0.4rem', fontSize:'0.6rem', color:'#92400E', fontWeight:600, display:'inline-flex', alignItems:'center', gap:'0.2rem' }}><i className="fas fa-clock" />Timeout · {remaining}</div>;
  return null;
};

/* ─── Members Tab ─────────────────────────────────────────────────────────── */
const MembersTab: React.FC<{ group: Group; userRole: 'admin' | 'moderator' | 'member'; isOwner: boolean }> = ({ group, userRole, isOwner }) => {
  const navigate   = useNavigate();
  const queryClient = useQueryClient();
  const { user }   = useAuth();
  const isAdmin    = userRole === 'admin';
  const isMod      = userRole === 'moderator';
  const canManage  = isAdmin || isMod;

  const [search, setSearch]                 = useState('');
  const [filter, setFilter]                 = useState('all');
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [showInvite, setShowInvite]         = useState(false);
  const [changeRoleMember, setChangeRoleMember] = useState<Group['members'][0] | null>(null);
  const [moderateMember, setModerateMember] = useState<Group['members'][0] | null>(null);
  const [removeMember, setRemoveMember]     = useState<Group['members'][0] | null>(null);

  const allMembers = group.members;
  const filtered   = allMembers.filter(m => {
    const matchSearch = m.user.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'admins')     return matchSearch && m.role === 'admin';
    if (filter === 'moderators') return matchSearch && m.role === 'moderator';
    if (filter === 'members')    return matchSearch && m.role === 'member';
    return matchSearch;
  });

  const filterTabs = [
    { id:'all',        label:`All (${group.memberCount})` },
    { id:'admins',     label:`Admins (${allMembers.filter(m=>m.role==='admin').length})` },
    { id:'moderators', label:`Moderators (${allMembers.filter(m=>m.role==='moderator').length})` },
    { id:'members',    label:`Members (${allMembers.filter(m=>m.role==='member').length})` },
  ];

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const selectedMembers  = allMembers.filter(m => selectedIds.has(m.user._id));
  // Owner can remove anyone except themselves. Co-admins can remove mods+members. Mods: only members.
  const bulkRemovable = selectedMembers.filter(m => {
    if (m.user._id === user?._id) return false;
    if (m.user._id === group.admin._id) return false; // never remove the owner
    if (isOwner)  return true;
    if (isAdmin)  return m.role !== 'admin'; // co-admin can't remove other admins
    if (isMod)    return m.role === 'member';
    return false;
  });

  const handleBulkRemove = async () => {
    if (!bulkRemovable.length) return;
    for (const m of bulkRemovable) {
      try { await api.delete(`/groups/${group._id}/members/${m.user._id}`); } catch { /* skip */ }
    }
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['group', group._id] });
  };

  const onSaved   = () => queryClient.invalidateQueries({ queryKey: ['group', group._id] });
  const onRemoved = () => { setSelectedIds(new Set()); queryClient.invalidateQueries({ queryKey: ['group', group._id] }); };

  return (
    <Box sx={{ ...V.card, p:1.5 }}>
      {/* Member Activity — top */}
      <Box sx={{ mb:1.5 }}>
        <Typography fontWeight={600} fontSize="0.9375rem" color="#1F2937" mb={1}
          sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
          <i className="fas fa-chart-line" style={{ color:'#4F46E5' }} />Member Activity
        </Typography>
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px,1fr))', gap:0.75 }}>
          {[
            { v: Math.floor(group.memberCount*0.6), l:'Active This Week',     c:'#4F46E5' },
            { v: group.memberCount,                  l:'New Posts This Month',  c:'#10B981' },
            { v: Math.floor(group.memberCount*0.07), l:'Inactive Members',      c:'#F59E0B' },
            { v: 0,                                  l:'Reported This Week',     c:'#EF4444' },
          ].map(s => (
            <Box key={s.l} sx={{ background:'#F9FAFB', p:1, borderRadius:'0.5rem', textAlign:'center',
              border:'1px solid #E5E7EB' }}>
              <Typography fontWeight={700} fontSize="1.25rem" color={s.c}>{s.v}</Typography>
              <Typography fontSize="0.6875rem" color="#6B7280">{s.l}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Header */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5, flexWrap:'wrap', gap:1 }}>
        <Box sx={{ display:'flex', alignItems:'center', gap:0.75, padding:'0.5rem 1rem',
          background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.75rem', flex:'1 1 220px', maxWidth:300 }}>
          <i className="fas fa-search" style={{ color:'#6B7280', fontSize:'0.8125rem' }} />
          <Box component="input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search members…"
            sx={{ border:'none', background:'none', flex:1, outline:'none', fontSize:'0.875rem',
              color:'#1F2937', fontFamily:'Inter,sans-serif' }} />
        </Box>
        {isAdmin && (
          <button style={V.btn.smGrad} onClick={() => setShowInvite(true)}>
            <i className="fas fa-user-plus" />Invite
          </button>
        )}
      </Box>

      {/* Filter tabs */}
      <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.625, mb:1.5 }}>
        {filterTabs.map(ft => (
          <button key={ft.id} onClick={() => setFilter(ft.id)}
            style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem',
              padding:'0.375rem 0.75rem', background: filter===ft.id ? 'transparent' : '#FFFFFF',
              border: filter===ft.id ? '1px solid #4F46E5' : '1px solid #E5E7EB',
              borderRadius:'2rem', fontSize:'0.75rem', color: filter===ft.id ? '#4F46E5' : '#6B7280',
              cursor:'pointer', fontWeight: filter===ft.id ? 600 : 400,
              transition:'all 0.2s', fontFamily:'Inter,sans-serif' }}>
            {ft.label}
          </button>
        ))}
      </Box>

      {/* Bulk actions bar — admin + moderator */}
      {canManage && selectedIds.size > 0 && (
        <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          mb:1.5, p:0.875, background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.5rem', flexWrap:'wrap', gap:1 }}>
          <Typography fontSize="0.75rem" color="#6B7280">{selectedIds.size} selected</Typography>
          <Box sx={{ display:'flex', gap:0.5 }}>
            {isAdmin && selectedMembers.length === 1 && selectedMembers[0].role !== 'admin' && (
              <button style={V.btn.sm} onClick={() => setChangeRoleMember(selectedMembers[0])}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.color='#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB';  e.currentTarget.style.color='#1F2937'; }}>
                <i className="fas fa-user-tag" />Change Role
              </button>
            )}
            {(isMod || isAdmin) && selectedMembers.length === 1 && selectedMembers[0].role !== 'admin' && (
              <button style={V.btn.sm} onClick={() => setModerateMember(selectedMembers[0])}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#F59E0B'; e.currentTarget.style.color='#D97706'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB';  e.currentTarget.style.color='#1F2937'; }}>
                <i className="fas fa-shield-alt" />Moderate
              </button>
            )}
            {bulkRemovable.length > 0 && (
              <button style={{ ...V.btn.sm, color:'#EF4444', borderColor:'#FCA5A5' }} onClick={handleBulkRemove}
                onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
                <i className="fas fa-user-times" />Remove ({bulkRemovable.length})
              </button>
            )}
          </Box>
        </Box>
      )}

      {/* Members Grid */}
      <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(175px,1fr))', gap:1, mb:2 }}>
        {filtered.map(m => {
          const isSelected   = selectedIds.has(m.user._id);
          // Who can manage this card
          // Owner manages everyone; co-admin manages mods + members; mod manages members only
          const isCardOwner    = m.user._id === group.admin._id;
          const adminCanManage = isAdmin && !isCardOwner && (isOwner || m.role !== 'admin');
          const modCanManage   = isMod && m.role === 'member';
          const hasBadge = m.permissions?.isMuted || (m.permissions?.mutedUntil && new Date(m.permissions.mutedUntil) > new Date());

          return (
            <Box key={m.user._id}
              sx={{ background: isSelected ? '#EEF2FF' : '#F9FAFB',
                border: isSelected ? '2px solid #4F46E5' : m.role==='admin' ? '1px solid #F59E0B' : m.role==='moderator' ? '1px solid #818CF8' : '1px solid #E5E7EB',
                borderRadius:'0.5rem', p:1, transition:'all 0.2s', position:'relative',
                '&:hover':{ boxShadow:'0 2px 6px rgba(0,0,0,0.1)' } }}>

              {/* Selection checkbox (admin + mod) */}
              {canManage && (
                <div style={{ position:'absolute', top:6, right:6 }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(m.user._id)}
                    style={{ width:14, height:14, accentColor:'#4F46E5', cursor:'pointer' }} />
                </div>
              )}

              {/* Status badge — visible to everyone */}
              {hasBadge && (
                <div style={{ marginBottom:'0.4rem' }}>
                  <MemberStatusBadge permissions={m.permissions} />
                </div>
              )}

              <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:0.75 }}>
                <OnlineAvatar userId={m.user._id} src={m.user.avatar}
                  onClick={() => navigate(`/profile/${m.user._id}`)}
                  sx={{ width:44, height:44, fontSize:'0.9375rem', fontWeight:600,
                    background:'linear-gradient(135deg,#4F46E5,#10B981)', cursor:'pointer',
                    border: m.role==='admin' ? '2px solid #F59E0B' : 'none' }}>
                  {m.user.name[0]}
                </OnlineAvatar>
                <Box flex={1} minWidth={0}>
                  <Typography fontWeight={600} fontSize="0.8125rem" color="#1F2937" noWrap
                    onClick={() => navigate(`/profile/${m.user._id}`)}
                    sx={{ cursor:'pointer', '&:hover':{ color:'#4F46E5' } }}>
                    {m.user.name}
                  </Typography>
                  <Typography fontSize="0.6875rem"
                    color={m.role==='admin' ? '#F59E0B' : m.role==='moderator' ? '#4F46E5' : '#6B7280'}
                    sx={{ display:'flex', alignItems:'center', gap:0.375 }}>
                    {m.role==='admin'     && <i className="fas fa-crown"      style={{ fontSize:'0.5625rem' }} />}
                    {m.role==='moderator' && <i className="fas fa-shield-alt" style={{ fontSize:'0.5625rem' }} />}
                    {m.role==='admin' ? 'Group Owner' : m.role==='moderator' ? 'Moderator' : 'Member'}
                  </Typography>
                </Box>
              </Box>

              {/* Restriction pills — visible to admins + mods */}
              {canManage && m.permissions && (
                (!m.permissions.canPost || !m.permissions.canComment || !m.permissions.canUploadFiles) && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'0.2rem', marginBottom:'0.5rem' }}>
                    {!m.permissions.canPost        && <span style={{ fontSize:'0.6rem', padding:'0.1rem 0.35rem', background:'#FEF3C7', color:'#92400E', borderRadius:'2rem', border:'1px solid #FDE68A' }}>No Post</span>}
                    {!m.permissions.canComment     && <span style={{ fontSize:'0.6rem', padding:'0.1rem 0.35rem', background:'#FEF3C7', color:'#92400E', borderRadius:'2rem', border:'1px solid #FDE68A' }}>No Comment</span>}
                    {!m.permissions.canUploadFiles && <span style={{ fontSize:'0.6rem', padding:'0.1rem 0.35rem', background:'#FEF3C7', color:'#92400E', borderRadius:'2rem', border:'1px solid #FDE68A' }}>No Upload</span>}
                  </div>
                )
              )}

              {/* Action buttons */}
              <Box sx={{ display:'flex', gap:0.5 }}>
                {/* View profile — everyone */}
                <button onClick={() => navigate(`/profile/${m.user._id}`)}
                  style={{ flex:1, padding:'0.3rem', border:'1px solid #E5E7EB', borderRadius:'0.375rem',
                    background:'#FFFFFF', color:'#6B7280', fontSize:'0.75rem', cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
                  title="View profile"
                  onMouseEnter={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#4F46E5'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF';  e.currentTarget.style.color='#6B7280'; }}>
                  <i className="fas fa-user" />
                </button>

                {/* Admin: Change Role + Moderate + Remove */}
                {adminCanManage && (
                  <>
                    <button onClick={() => setChangeRoleMember(m)}
                      style={{ flex:1, padding:'0.3rem', border:'1px solid #C7D2FE', borderRadius:'0.375rem',
                        background:'#FFFFFF', color:'#4F46E5', fontSize:'0.75rem', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
                      title="Change role / permissions"
                      onMouseEnter={e => { e.currentTarget.style.background='#EEF2FF'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
                      <i className="fas fa-user-cog" />
                    </button>
                    <button onClick={() => setModerateMember(m)}
                      style={{ flex:1, padding:'0.3rem', border:'1px solid #FDE68A', borderRadius:'0.375rem',
                        background:'#FFFFFF', color:'#92400E', fontSize:'0.75rem', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
                      title="Moderate (timeout / mute / ban)"
                      onMouseEnter={e => { e.currentTarget.style.background='#FEF3C7'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
                      <i className="fas fa-shield-alt" />
                    </button>
                    <button onClick={() => setRemoveMember(m)}
                      style={{ flex:1, padding:'0.3rem', border:'1px solid #FCA5A5', borderRadius:'0.375rem',
                        background:'#FFFFFF', color:'#EF4444', fontSize:'0.75rem', cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }}
                      title="Remove member"
                      onMouseEnter={e => { e.currentTarget.style.background='#FEF2F2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
                      <i className="fas fa-user-times" />
                    </button>
                  </>
                )}

                {/* Moderator: Moderate button (members only) */}
                {modCanManage && (
                  <button onClick={() => setModerateMember(m)}
                    style={{ flex:2, padding:'0.3rem', border:'1px solid #FDE68A', borderRadius:'0.375rem',
                      background:'#FFFFFF', color:'#92400E', fontSize:'0.75rem', cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', gap:'0.25rem', transition:'all 0.2s' }}
                    title="Moderate"
                    onMouseEnter={e => { e.currentTarget.style.background='#FEF3C7'; }}
                    onMouseLeave={e => { e.currentTarget.style.background='#FFFFFF'; }}>
                    <i className="fas fa-shield-alt" /><span style={{ fontSize:'0.7rem' }}>Moderate</span>
                  </button>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Modals */}
      {showInvite && <InviteModal groupId={group._id} onClose={() => setShowInvite(false)} />}
      {changeRoleMember && (
        <ChangeRoleModal groupId={group._id} member={changeRoleMember} onClose={() => setChangeRoleMember(null)} onSaved={onSaved} />
      )}
      {moderateMember && (
        <ModerateModal groupId={group._id} member={moderateMember} onClose={() => setModerateMember(null)} onSaved={onSaved} onRemoved={onRemoved} />
      )}
      {removeMember && (
        <RemoveMemberModal groupId={group._id} member={removeMember} onClose={() => setRemoveMember(null)} onRemoved={onRemoved} />
      )}
    </Box>
  );
};

// ─── Events Tab ───────────────────────────────────────────────────────────────

const EventsTab: React.FC<{ group: Group }> = ({ group }) => {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['group-events', group._id],
    queryFn: async () => {
      const res = await api.get(`/posts?group=${group._id}&type=event&sort=new&limit=50`);
      return res.data.posts as any[];
    },
  });

  const events = data ?? [];

  return (
    <Box sx={{ ...V.card, p:1.5 }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5 }}>
        <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937">Upcoming Events</Typography>
        <button style={V.btn.smGrad} onClick={() => navigate(`/posts/create?group=${group._id}`)}>
          <i className="fas fa-plus" />Create Event
        </button>
      </Box>

      {isLoading ? (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:1.5 }}>
          {[1,2].map(i => <Skeleton key={i} variant="rounded" height={180} />)}
        </Box>
      ) : events.length === 0 ? (
        <Box sx={{ p:4, textAlign:'center' }}>
          <Box sx={{ width:64, height:64, borderRadius:'50%', background:'#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:2 }}>
            <i className="fas fa-calendar-alt" style={{ color:'#9CA3AF', fontSize:'1.75rem' }} />
          </Box>
          <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937" mb={0.75}>No events yet</Typography>
          <Typography fontSize="0.875rem" color="#6B7280" mb={2.5}>
            Organise the first event for {group.name}!
          </Typography>
          <button style={V.btn.gradient} onClick={() => navigate(`/posts/create?group=${group._id}`)}
            onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform='')}>
            <i className="fas fa-plus" />Create Event
          </button>
        </Box>
      ) : (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px,1fr))', gap:1.5 }}>
          {events.map((ev: any) => {
            const date = new Date(ev.eventDate || ev.createdAt);
            const day   = date.getDate().toString();
            const month = date.toLocaleString('default', { month:'short' }).toUpperCase();
            const isVirtual = ev.locationType === 'virtual' || ev.locationName?.toLowerCase().includes('virtual');
            return (
              <Box key={ev._id}
                onClick={() => navigate(`/posts/${ev._id}`)}
                sx={{ background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.5rem',
                  p:1.5, transition:'all 0.2s', cursor:'pointer',
                  '&:hover':{ borderColor:'#4F46E5', boxShadow:'0 1px 3px rgba(0,0,0,0.12)' } }}>
                <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', mb:1 }}>
                  <Box sx={{ background:'linear-gradient(135deg,#4F46E5,#10B981)', color:'white',
                    px:1.25, py:0.75, borderRadius:'0.375rem', textAlign:'center', minWidth:64 }}>
                    <Typography fontWeight={700} fontSize="1.375rem" color="white" lineHeight={1}>{day}</Typography>
                    <Typography fontSize="0.6875rem" color="white" sx={{ opacity:0.9 }}>{month}</Typography>
                  </Box>
                  <Box component="span" sx={{ background: isVirtual ? '#EEF2FF' : '#ECFDF5',
                    color: isVirtual ? '#4F46E5' : '#10B981',
                    px:0.875, py:0.375, borderRadius:'1rem', fontSize:'0.6875rem', fontWeight:600 }}>
                    {isVirtual ? 'Virtual' : 'In-Person'}
                  </Box>
                </Box>
                <Typography fontWeight={600} fontSize="1rem" color="#1F2937" mb={0.75}>{ev.title}</Typography>
                <Box sx={{ display:'flex', flexDirection:'column', gap:0.5, mb:1 }}>
                  <Typography fontSize="0.8125rem" color="#6B7280" sx={{ display:'flex', alignItems:'center', gap:0.625 }}>
                    <i className="fas fa-user" style={{ color:'#4F46E5', fontSize:'0.75rem', width:12 }} />
                    {ev.author?.name}
                  </Typography>
                  {ev.locationName && (
                    <Typography fontSize="0.8125rem" color="#6B7280" sx={{ display:'flex', alignItems:'center', gap:0.625 }}>
                      <i className={isVirtual ? 'fas fa-video' : 'fas fa-map-marker-alt'} style={{ color:'#4F46E5', fontSize:'0.75rem', width:12 }} />
                      {ev.locationName}
                    </Typography>
                  )}
                  <Typography fontSize="0.8125rem" color="#6B7280" sx={{ display:'flex', alignItems:'center', gap:0.625 }}>
                    <i className="fas fa-users" style={{ color:'#4F46E5', fontSize:'0.75rem', width:12 }} />
                    {ev.rsvps?.length ?? 0} attending
                  </Typography>
                </Box>
                <Box sx={{ display:'flex', gap:0.75 }}>
                  <button style={V.btn.sm}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#4F46E5'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB'; }}>
                    Details
                  </button>
                  <button style={V.btn.smGrad}><i className="fas fa-check" />RSVP</button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ─── Resources Tab ────────────────────────────────────────────────────────────

interface GroupFileDoc {
  _id: string;
  name: string;
  url: string;
  key: string;
  size: number;
  mimeType: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'program' | 'other';
  uploader: { _id: string; name: string; avatar?: string };
  createdAt: string;
}

const FILE_FILTERS = [
  { id:'all',      label:'All',       icon:'fas fa-th-large' },
  { id:'image',    label:'Images',    icon:'fas fa-image' },
  { id:'video',    label:'Videos',    icon:'fas fa-film' },
  { id:'audio',    label:'Audio',     icon:'fas fa-music' },
  { id:'document', label:'Docs',      icon:'fas fa-file-alt' },
  { id:'program',  label:'Programs',  icon:'fas fa-terminal' },
  { id:'other',    label:'Other',     icon:'fas fa-file' },
];

const FILE_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  image:    { icon:'fas fa-image',    color:'#2563EB', bg:'#EFF6FF' },
  video:    { icon:'fas fa-film',     color:'#7C3AED', bg:'#F5F3FF' },
  audio:    { icon:'fas fa-music',    color:'#DB2777', bg:'#FDF2F8' },
  document: { icon:'fas fa-file-alt', color:'#D97706', bg:'#FFFBEB' },
  program:  { icon:'fas fa-terminal', color:'#059669', bg:'#ECFDF5' },
  other:    { icon:'fas fa-file',     color:'#6B7280', bg:'#F9FAFB' },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatFileDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

const ResourcesTab: React.FC<{ groupId: string; isMember: boolean; currentUserId?: string; isAdmin: boolean }> = ({
  groupId, isMember, currentUserId, isAdmin,
}) => {
  const [filter, setFilter]     = useState('all');
  const [search, setSearch]     = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout>>();
  const qc = useQueryClient();

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const { data: files = [], isLoading } = useQuery<GroupFileDoc[]>({
    queryKey: ['group-files', groupId, filter, debouncedSearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('category', filter);
      if (debouncedSearch)  params.set('search', debouncedSearch);
      return api.get(`/groups/${groupId}/files?${params}`).then(r => r.data);
    },
    enabled: isMember,
  });

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploadError('');
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        await api.post(`/groups/${groupId}/upload`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      qc.invalidateQueries({ queryKey: ['group-files', groupId] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Upload failed';
      setUploadError(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [groupId, qc]);

  const handleDelete = useCallback(async (fileId: string) => {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    setDeletingId(fileId);
    try {
      await api.delete(`/groups/${groupId}/files/${fileId}`);
      qc.invalidateQueries({ queryKey: ['group-files', groupId] });
    } finally {
      setDeletingId(null);
    }
  }, [groupId, qc]);

  return (
    <Box sx={{ ...V.card, p:1.5 }}>
      {/* Header */}
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5, flexWrap:'wrap', gap:1 }}>
        <Typography fontWeight={700} fontSize="1.125rem" color="#1F2937">Group Resources</Typography>
        {isMember && (
          <>
            <button
              style={{ ...V.btn.smGrad, opacity: uploading ? 0.7 : 1 }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}>
              {uploading
                ? <><i className="fas fa-spinner fa-spin" />Uploading…</>
                : <><i className="fas fa-upload" />Upload File</>}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display:'none' }}
              onChange={handleUpload}
            />
          </>
        )}
      </Box>

      {uploadError && (
        <Box sx={{ mb:1.5, p:1.25, background:'#FEF2F2', border:'1px solid #FCA5A5',
          borderRadius:'0.5rem', fontSize:'0.8125rem', color:'#DC2626', display:'flex', gap:0.75 }}>
          <i className="fas fa-exclamation-circle" style={{ marginTop:1 }} />
          {uploadError}
        </Box>
      )}

      {/* Search */}
      <Box sx={{ position:'relative', mb:1.25 }}>
        <i className="fas fa-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)',
          color:'#9CA3AF', fontSize:'0.8125rem', pointerEvents:'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search files…"
          style={{ width:'100%', paddingLeft:34, paddingRight:12, paddingTop:9, paddingBottom:9,
            border:'1px solid #E5E7EB', borderRadius:'0.5rem', fontSize:'0.875rem',
            fontFamily:'Inter,sans-serif', outline:'none', boxSizing:'border-box',
            background:'#F9FAFB', color:'#1F2937' }}
        />
      </Box>

      {/* Filter chips */}
      <Box sx={{ display:'flex', gap:0.75, flexWrap:'wrap', mb:2 }}>
        {FILE_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              border: filter === f.id ? 'none' : '1px solid #E5E7EB',
              background: filter === f.id ? 'linear-gradient(135deg,#4F46E5,#10B981)' : '#FFFFFF',
              color: filter === f.id ? '#FFFFFF' : '#6B7280',
              padding:'0.3rem 0.75rem', borderRadius:'999px', fontSize:'0.75rem',
              fontWeight: filter === f.id ? 600 : 500, cursor:'pointer',
              display:'inline-flex', alignItems:'center', gap:'0.3rem',
              fontFamily:'Inter,sans-serif', transition:'all 0.15s',
            }}>
            <i className={f.icon} style={{ fontSize:'0.6875rem' }} />{f.label}
          </button>
        ))}
      </Box>

      {/* Content */}
      {isLoading ? (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:1.5 }}>
          {[1,2,3,4,5,6].map(i => (
            <Box key={i} sx={{ borderRadius:'0.625rem', overflow:'hidden', border:'1px solid #E5E7EB' }}>
              <Skeleton variant="rectangular" height={110} />
              <Box sx={{ p:1 }}>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="50%" />
              </Box>
            </Box>
          ))}
        </Box>
      ) : files.length === 0 ? (
        <Box sx={{ py:5, textAlign:'center' }}>
          <Box sx={{ width:60, height:60, borderRadius:'50%', background:'#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:1.5 }}>
            <i className="fas fa-folder-open" style={{ color:'#9CA3AF', fontSize:'1.625rem' }} />
          </Box>
          <Typography fontWeight={600} fontSize="1rem" color="#1F2937" mb={0.5}>
            {search || filter !== 'all' ? 'No files match your search' : 'No files yet'}
          </Typography>
          <Typography fontSize="0.8125rem" color="#9CA3AF">
            {isMember ? 'Upload a file to get started.' : 'Files shared by members will appear here.'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:1.5 }}>
          {files.map(file => {
            const fi = FILE_ICONS[file.category] || FILE_ICONS.other;
            const canDelete = currentUserId === file.uploader._id || isAdmin;
            return (
              <Box key={file._id} sx={{ border:'1px solid #E5E7EB', borderRadius:'0.625rem',
                overflow:'hidden', background:'#FFFFFF', transition:'box-shadow 0.15s',
                '&:hover':{ boxShadow:'0 4px 12px rgba(0,0,0,0.1)' } }}>
                {/* Thumbnail / icon area */}
                <Box sx={{ height:110, position:'relative', overflow:'hidden',
                  background: file.category === 'image' ? '#000' : fi.bg,
                  display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {file.category === 'image' ? (
                    <Box component="img" src={file.url} alt={file.name}
                      sx={{ width:'100%', height:'100%', objectFit:'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  ) : file.category === 'video' ? (
                    <>
                      <i className={fi.icon} style={{ fontSize:'2.5rem', color: fi.color }} />
                      <Box sx={{ position:'absolute', bottom:6, right:6, background:'rgba(0,0,0,0.5)',
                        borderRadius:'999px', width:24, height:24, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="fas fa-play" style={{ color:'#FFF', fontSize:'0.6rem' }} />
                      </Box>
                    </>
                  ) : (
                    <i className={fi.icon} style={{ fontSize:'2.5rem', color: fi.color }} />
                  )}
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(file._id)}
                      disabled={deletingId === file._id}
                      title="Delete file"
                      style={{ position:'absolute', top:4, right:4, width:24, height:24,
                        borderRadius:'50%', background:'rgba(0,0,0,0.55)', border:'none',
                        cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                        color:'#FFF', fontSize:'0.625rem', opacity: deletingId === file._id ? 0.5 : 1 }}>
                      {deletingId === file._id
                        ? <i className="fas fa-spinner fa-spin" />
                        : <i className="fas fa-trash" />}
                    </button>
                  )}
                </Box>
                {/* Info */}
                <Box sx={{ p:'0.625rem' }}>
                  <Typography fontSize="0.75rem" fontWeight={600} color="#1F2937"
                    sx={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                    title={file.name}>
                    {file.name}
                  </Typography>
                  <Box sx={{ display:'flex', justifyContent:'space-between', mt:0.375 }}>
                    <Typography fontSize="0.6875rem" color="#9CA3AF">{formatBytes(file.size)}</Typography>
                    <Typography fontSize="0.6875rem" color="#9CA3AF">{formatFileDate(file.createdAt)}</Typography>
                  </Box>
                  <Box sx={{ display:'flex', alignItems:'center', gap:0.5, mt:0.625 }}>
                    <Avatar src={file.uploader.avatar} sx={{ width:16, height:16, fontSize:'0.5rem' }}>
                      {file.uploader.name[0]}
                    </Avatar>
                    <Typography fontSize="0.6875rem" color="#6B7280"
                      sx={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {file.uploader.name}
                    </Typography>
                  </Box>
                  <a
                    href={file.url}
                    download={file.name}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display:'inline-flex', alignItems:'center', gap:'0.25rem', marginTop:'0.5rem',
                      fontSize:'0.6875rem', fontWeight:600, color:'#4F46E5',
                      textDecoration:'none', fontFamily:'Inter,sans-serif' }}>
                    <i className="fas fa-download" style={{ fontSize:'0.625rem' }} />Download
                  </a>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

// ─── Rules Tab ────────────────────────────────────────────────────────────────

const RulesTab: React.FC<{ group: Group; isAdmin: boolean; onUpdate: (rules: string[]) => void }> = ({ group, isAdmin, onUpdate }) => {
  const [rules, setRules] = useState<string[]>(group.rules ?? []);
  const [newRule, setNewRule] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trimmed = newRule.trim();
    if (!trimmed) return;
    const updated = [...rules, trimmed];
    setRules(updated);
    setNewRule('');
    setSaving(true);
    try {
      await api.put(`/groups/${group._id}`, { rules: updated });
      onUpdate(updated);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (i: number) => {
    const updated = rules.filter((_, idx) => idx !== i);
    setRules(updated);
    setSaving(true);
    try {
      await api.put(`/groups/${group._id}`, { rules: updated });
      onUpdate(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ ...V.card, p:1.5 }}>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5 }}>
        <Typography fontWeight={600} fontSize="1.125rem" color="#1F2937"
          sx={{ display:'flex', alignItems:'center', gap:0.75 }}>
          <i className="fas fa-scroll" style={{ color:'#4F46E5' }} />Community Rules
        </Typography>
        {saving && <Typography fontSize="0.75rem" color="#6B7280">Saving…</Typography>}
      </Box>

      {rules.length === 0 ? (
        <Box sx={{ py:3, textAlign:'center' }}>
          <Box sx={{ width:56, height:56, borderRadius:'50%', background:'#F3F4F6',
            display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:1.5 }}>
            <i className="fas fa-scroll" style={{ color:'#9CA3AF', fontSize:'1.5rem' }} />
          </Box>
          <Typography fontWeight={600} fontSize="1rem" color="#1F2937" mb={0.5}>No rules set</Typography>
          <Typography fontSize="0.875rem" color="#6B7280">
            {isAdmin ? 'Add rules below to guide your community.' : 'The admin hasn\'t added any rules yet.'}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display:'flex', flexDirection:'column', gap:0.875, mb:1.5 }}>
          {rules.map((rule, i) => (
            <Box key={i} sx={{ display:'flex', gap:1.5, alignItems:'flex-start',
              p:1, background:'#F9FAFB', borderRadius:'0.5rem', border:'1px solid #E5E7EB' }}>
              <Box sx={{ width:28, height:28, borderRadius:'50%', background:'linear-gradient(135deg,#4F46E5,#10B981)',
                color:'white', fontWeight:700, fontSize:'0.8125rem',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {i + 1}
              </Box>
              <Typography fontSize="0.875rem" color="#1F2937" mt={0.375} lineHeight={1.5} flex={1}>{rule}</Typography>
              {isAdmin && (
                <button onClick={() => handleRemove(i)}
                  style={{ background:'none', border:'none', color:'#9CA3AF', cursor:'pointer',
                    padding:'0.25rem', borderRadius:'0.25rem', fontSize:'0.8125rem', flexShrink:0,
                    transition:'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color='#EF4444')}
                  onMouseLeave={e => (e.currentTarget.style.color='#9CA3AF')}>
                  <i className="fas fa-times" />
                </button>
              )}
            </Box>
          ))}
        </Box>
      )}

      {isAdmin && (
        <Box sx={{ display:'flex', gap:0.75, mt: rules.length > 0 ? 0 : 1.5 }}>
          <Box component="input" value={newRule} onChange={e => setNewRule(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="Add a new rule…"
            sx={{ flex:1, padding:'0.625rem 0.875rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem',
              fontSize:'0.875rem', fontFamily:'Inter,sans-serif', outline:'none',
              '&:focus':{ borderColor:'#4F46E5' } }} />
          <button style={V.btn.smGrad} onClick={handleAdd}>
            <i className="fas fa-plus" />Add
          </button>
        </Box>
      )}
    </Box>
  );
};

// ─── Settings Tab ─────────────────────────────────────────────────────────────

const SettingsTab: React.FC<{ groupId: string }> = ({ groupId }) => {
  const navigate = useNavigate();

  return (
    <Box sx={{ ...V.card, p:3, textAlign:'center' }}>
      <Box sx={{ width:56, height:56, borderRadius:'0.75rem', background:'linear-gradient(135deg,#F59E0B,#EF4444)',
        display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:1.5, color:'white', fontSize:'1.5rem' }}>
        <i className="fas fa-cog" />
      </Box>
      <Typography fontWeight={700} fontSize="1.125rem" color="#1F2937" mb={0.5}>Group Settings</Typography>
      <Typography fontSize="0.875rem" color="#6B7280" mb={2}>
        Manage your group name, description, privacy, features, moderation, and more.
      </Typography>
      <button style={V.btn.admin} onClick={() => navigate(`/groups/${groupId}/settings`)}
        onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
        onMouseLeave={e => (e.currentTarget.style.transform='')}>
        <i className="fas fa-cog" />Open Full Settings
      </button>
    </Box>
  );
};

// ─── Unban Request Form ───────────────────────────────────────────────────────

const UnbanRequestForm: React.FC<{ groupId: string }> = ({ groupId }) => {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      await api.post(`/groups/${groupId}/request-unban`, { reason });
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to submit request.');
    } finally { setSubmitting(false); }
  };

  if (submitted) {
    return (
      <Box sx={{ p:1.5, background:'#F0FDF4', border:'1px solid #A7F3D0', borderRadius:'0.5rem', fontSize:'0.875rem', color:'#065F46', fontWeight:500, mt:1.5 }}>
        <i className="fas fa-check-circle" style={{ marginRight:'0.5rem' }} />Unban request submitted! Moderators will review it.
      </Box>
    );
  }

  return (
    <Box sx={{ mt:2, textAlign:'left' }}>
      <Typography fontSize="0.8125rem" fontWeight={600} color="#374151" mb={0.75}>Appeal your ban</Typography>
      <textarea
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Explain why you should be unbanned…"
        rows={3}
        style={{ width:'100%', padding:'0.5rem 0.75rem', border:'1px solid #D1D5DB', borderRadius:'0.5rem', fontSize:'0.8125rem', fontFamily:'Inter,sans-serif', resize:'vertical', outline:'none', boxSizing:'border-box' }}
      />
      {error && <Typography fontSize="0.75rem" color="#DC2626" mt={0.5}>{error}</Typography>}
      <button onClick={handleSubmit} disabled={submitting || !reason.trim()}
        style={{ ...V.btn.gradient, marginTop:'0.5rem', width:'100%', justifyContent:'center', opacity: (!reason.trim()||submitting) ? 0.6 : 1 }}>
        {submitting ? <><i className="fas fa-spinner fa-spin" />Submitting…</> : <><i className="fas fa-paper-plane" />Submit Request</>}
      </button>
    </Box>
  );
};

// ─── Moderation Tab ───────────────────────────────────────────────────────────

interface BannedMemberEntry {
  _id: string;
  user: { _id: string; name: string; avatar?: string };
  bannedBy: { _id: string; name: string; avatar?: string };
  reason?: string;
  bannedAt: string;
  unbanRequest?: { status: 'pending' | 'approved' | 'denied' | null; reason?: string; requestedAt?: string };
}

const ModerationTab: React.FC<{ groupId: string; userRole: 'admin' | 'moderator' | 'member' }> = ({ groupId, userRole }) => {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'banned' | 'requests'>('banned');
  const [unbanningId, setUnbanningId] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ban-requests', groupId],
    queryFn: async () => {
      const res = await api.get(`/groups/${groupId}/ban-requests`);
      return res.data as { bannedMembers: BannedMemberEntry[] };
    },
  });

  const bannedMembers = data?.bannedMembers ?? [];
  const pendingRequests = bannedMembers.filter(b => b.unbanRequest?.status === 'pending');

  const handleUnban = async (userId: string) => {
    setUnbanningId(userId); setError('');
    try {
      await api.delete(`/groups/${groupId}/members/${userId}/ban`);
      queryClient.invalidateQueries({ queryKey: ['ban-requests', groupId] });
      refetch();
    } catch { setError('Failed to unban user.'); }
    finally { setUnbanningId(null); }
  };

  const handleResolve = async (userId: string, action: 'approved' | 'denied') => {
    setResolvingId(userId); setError('');
    try {
      await api.patch(`/groups/${groupId}/ban-requests/${userId}`, { action });
      queryClient.invalidateQueries({ queryKey: ['ban-requests', groupId] });
      refetch();
    } catch { setError('Failed to resolve request.'); }
    finally { setResolvingId(null); }
  };

  return (
    <Box sx={{ display:'flex', flexDirection:'column', gap:2 }}>
      {/* Section Tabs */}
      <Box sx={{ display:'flex', gap:1 }}>
        {[
          { id:'banned',   label:'Banned Members', icon:'fas fa-ban', count: bannedMembers.length },
          { id:'requests', label:'Unban Requests',  icon:'fas fa-envelope-open-text', count: pendingRequests.length },
        ].map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id as 'banned' | 'requests')}
            style={{ padding:'0.5rem 1rem', border:`1px solid ${activeSection===s.id ? '#4F46E5' : '#E5E7EB'}`,
              borderRadius:'0.5rem', background: activeSection===s.id ? '#EEF2FF' : '#FFFFFF',
              color: activeSection===s.id ? '#4F46E5' : '#6B7280', fontWeight: activeSection===s.id ? 600 : 400,
              cursor:'pointer', fontSize:'0.8125rem', display:'inline-flex', alignItems:'center', gap:'0.375rem', fontFamily:'Inter,sans-serif' }}>
            <i className={s.icon} />
            {s.label}
            {s.count > 0 && (
              <span style={{ background: activeSection===s.id ? '#4F46E5' : '#E5E7EB', color: activeSection===s.id ? '#FFFFFF' : '#6B7280',
                borderRadius:'1rem', padding:'0.1rem 0.45rem', fontSize:'0.6875rem', fontWeight:600 }}>{s.count}</span>
            )}
          </button>
        ))}
      </Box>

      {error && (
        <Box sx={{ p:1.25, background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'0.5rem', fontSize:'0.8125rem', color:'#DC2626' }}>{error}</Box>
      )}

      {isLoading ? (
        <Box sx={{ py:4, textAlign:'center', color:'#9CA3AF' }}><i className="fas fa-spinner fa-spin" /></Box>
      ) : activeSection === 'banned' ? (
        bannedMembers.length === 0 ? (
          <Box sx={{ ...V.card, p:3, textAlign:'center' }}>
            <Box sx={{ width:52, height:52, borderRadius:'50%', background:'#F3F4F6', display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:1.5 }}>
              <i className="fas fa-ban" style={{ color:'#9CA3AF', fontSize:'1.25rem' }} />
            </Box>
            <Typography fontWeight={600} fontSize="0.9375rem" color="#1F2937" mb={0.5}>No banned members</Typography>
            <Typography fontSize="0.8125rem" color="#6B7280">Users banned from this group will appear here.</Typography>
          </Box>
        ) : (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
            {bannedMembers.map(b => (
              <Box key={b._id} sx={{ ...V.card, p:1.5, display:'flex', alignItems:'center', gap:1.5 }}>
                <Avatar src={b.user.avatar} sx={{ width:40, height:40 }}>{b.user.name?.[0]}</Avatar>
                <Box sx={{ flex:1, minWidth:0 }}>
                  <Typography fontWeight={600} fontSize="0.875rem" color="#1F2937">{b.user.name}</Typography>
                  {b.reason && <Typography fontSize="0.75rem" color="#6B7280" noWrap>Reason: {b.reason}</Typography>}
                  <Typography fontSize="0.6875rem" color="#9CA3AF">
                    Banned {new Date(b.bannedAt).toLocaleDateString()} by {b.bannedBy.name}
                    {b.unbanRequest?.status === 'pending' && (
                      <span style={{ marginLeft:'0.5rem', color:'#F59E0B', fontWeight:600 }}>• Unban requested</span>
                    )}
                  </Typography>
                </Box>
                <button
                  onClick={() => handleUnban(b.user._id)}
                  disabled={unbanningId === b.user._id}
                  style={{ padding:'0.375rem 0.75rem', border:'1px solid #D1D5DB', borderRadius:'0.375rem', background:'#FFFFFF', color:'#374151', fontSize:'0.75rem', fontWeight:500, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:'0.25rem', fontFamily:'Inter,sans-serif', opacity: unbanningId===b.user._id ? 0.6 : 1 }}>
                  {unbanningId === b.user._id ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-user-check" />}
                  Unban
                </button>
              </Box>
            ))}
          </Box>
        )
      ) : (
        pendingRequests.length === 0 ? (
          <Box sx={{ ...V.card, p:3, textAlign:'center' }}>
            <Box sx={{ width:52, height:52, borderRadius:'50%', background:'#F0FDF4', display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:1.5 }}>
              <i className="fas fa-check-circle" style={{ color:'#10B981', fontSize:'1.25rem' }} />
            </Box>
            <Typography fontWeight={600} fontSize="0.9375rem" color="#1F2937" mb={0.5}>No pending requests</Typography>
            <Typography fontSize="0.8125rem" color="#6B7280">Unban requests from banned members will appear here.</Typography>
          </Box>
        ) : (
          <Box sx={{ display:'flex', flexDirection:'column', gap:1 }}>
            {pendingRequests.map(b => (
              <Box key={b._id} sx={{ ...V.card, p:1.5 }}>
                <Box sx={{ display:'flex', alignItems:'center', gap:1.5, mb:1 }}>
                  <Avatar src={b.user.avatar} sx={{ width:36, height:36 }}>{b.user.name?.[0]}</Avatar>
                  <Box sx={{ flex:1 }}>
                    <Typography fontWeight={600} fontSize="0.875rem" color="#1F2937">{b.user.name}</Typography>
                    <Typography fontSize="0.6875rem" color="#9CA3AF">Requested {b.unbanRequest?.requestedAt ? new Date(b.unbanRequest.requestedAt).toLocaleDateString() : '—'}</Typography>
                  </Box>
                </Box>
                {b.unbanRequest?.reason && (
                  <Box sx={{ p:1, background:'#F9FAFB', border:'1px solid #E5E7EB', borderRadius:'0.375rem', fontSize:'0.8125rem', color:'#374151', mb:1 }}>
                    "{b.unbanRequest.reason}"
                  </Box>
                )}
                <Box sx={{ display:'flex', gap:0.75 }}>
                  <button
                    onClick={() => handleResolve(b.user._id, 'approved')}
                    disabled={resolvingId === b.user._id}
                    style={{ flex:1, padding:'0.4rem', border:'none', borderRadius:'0.375rem', background:'#10B981', color:'#FFFFFF', fontSize:'0.8125rem', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.375rem', opacity: resolvingId===b.user._id ? 0.6 : 1, fontFamily:'Inter,sans-serif' }}>
                    <i className="fas fa-check" />Approve
                  </button>
                  <button
                    onClick={() => handleResolve(b.user._id, 'denied')}
                    disabled={resolvingId === b.user._id}
                    style={{ flex:1, padding:'0.4rem', border:'1px solid #E5E7EB', borderRadius:'0.375rem', background:'#FFFFFF', color:'#374151', fontSize:'0.8125rem', fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'0.375rem', opacity: resolvingId===b.user._id ? 0.6 : 1, fontFamily:'Inter,sans-serif' }}>
                    <i className="fas fa-times" />Deny
                  </button>
                </Box>
              </Box>
            ))}
          </Box>
        )
      )}
    </Box>
  );
};

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id:'feed',       label:'Feed',       icon:'fas fa-newspaper',    adminOnly:false, modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'chats',      label:'Chats',      icon:'fas fa-comments',     adminOnly:false, modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'members',    label:'Members',    icon:'fas fa-users',        adminOnly:false, modOnly:false, dynamic:true,  danger:false, badge:null },
  { id:'events',     label:'Events',     icon:'fas fa-calendar-alt', adminOnly:false, modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'resources',  label:'Resources',  icon:'fas fa-folder-open',  adminOnly:false, modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'rules',      label:'Rules',      icon:'fas fa-scroll',       adminOnly:false, modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'settings',   label:'Settings',   icon:'fas fa-cog',          adminOnly:true,  modOnly:false, dynamic:false, danger:false, badge:null },
  { id:'moderation', label:'Moderation', icon:'fas fa-shield-alt',   adminOnly:false, modOnly:true,  dynamic:false, danger:true,  badge:null },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const GroupDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab]         = useState('feed');
  const [showLeaveConfirm, setShowLeaveConfirm]     = useState(false);
  const [showTransferModal, setShowTransferModal]   = useState(false);

  const { data: group, isLoading, refetch } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => { const res = await api.get(`/groups/${id}`); return res.data as Group; },
  });

  // Derive muted state from current user's mutedGroups list (syncs on user load)
  const [notifMuted, setNotifMuted] = useState(() => user?.mutedGroups?.includes(id!) ?? false);
  useEffect(() => { setNotifMuted(user?.mutedGroups?.includes(id!) ?? false); }, [user, id]);

  const joinMutation  = useMutation({ mutationFn: () => api.post(`/groups/${id}/join`),  onSuccess: () => refetch() });
  const leaveMutation = useMutation({
    mutationFn: () => api.post(`/groups/${id}/leave`),
    onSuccess: () => { setShowLeaveConfirm(false); navigate('/groups'); },
  });
  const transferMutation = useMutation({
    mutationFn: (newOwnerId: string) => api.post(`/groups/${id}/transfer`, { newOwnerId }),
    onSuccess: async () => {
      // After transfer, leave the group
      await api.post(`/groups/${id}/leave`);
      setShowTransferModal(false);
      navigate('/groups');
    },
  });
  const notifMutation = useMutation({
    mutationFn: () => api.post(`/groups/${id}/notifications`),
    onSuccess: (res) => setNotifMuted(res.data.muted),
  });

  if (isLoading) return (
    <Layout>
      <Skeleton variant="rounded" height={200} sx={{ mb:1 }} />
      <Skeleton variant="rounded" height={120} sx={{ mb:1 }} />
      <Skeleton variant="rounded" height={400} />
    </Layout>
  );
  if (!group) return null;

  // Check if current user is banned
  const myBanEntry = group.bannedMembers?.find(b => b.user._id === user?._id);
  if (myBanEntry) {
    return (
      <Layout>
        <Box sx={{ maxWidth:600, mx:'auto', mt:6, px:2 }}>
          <Box sx={{ ...V.card, p:4, textAlign:'center' }}>
            <Box sx={{ width:72, height:72, borderRadius:'50%', background:'#FEF2F2', display:'flex', alignItems:'center', justifyContent:'center', mx:'auto', mb:2 }}>
              <i className="fas fa-ban" style={{ color:'#EF4444', fontSize:'2rem' }} />
            </Box>
            <Typography fontWeight={700} fontSize="1.25rem" color="#1F2937" mb={1}>
              You've been banned from this group
            </Typography>
            {myBanEntry.reason && (
              <Typography fontSize="0.875rem" color="#6B7280" mb={1.5}>
                Reason: {myBanEntry.reason}
              </Typography>
            )}
            <Typography fontSize="0.875rem" color="#6B7280" mb={3}>
              You can submit a request to appeal your ban. The group moderators will review it.
            </Typography>
            {myBanEntry.unbanRequest?.status === 'pending' ? (
              <Box sx={{ p:1.5, background:'#FEF3C7', border:'1px solid #FDE68A', borderRadius:'0.5rem', fontSize:'0.875rem', color:'#92400E', fontWeight:500 }}>
                <i className="fas fa-clock" style={{ marginRight:'0.5rem' }} />Your unban request is pending review.
              </Box>
            ) : myBanEntry.unbanRequest?.status === 'denied' ? (
              <Box sx={{ p:1.5, background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:'0.5rem', fontSize:'0.875rem', color:'#DC2626', fontWeight:500, mb:1.5 }}>
                <i className="fas fa-times-circle" style={{ marginRight:'0.5rem' }} />Your unban request was denied.
              </Box>
            ) : null}
            {(!myBanEntry.unbanRequest || myBanEntry.unbanRequest.status === 'denied') && (
              <UnbanRequestForm groupId={id!} />
            )}
            <button onClick={() => navigate('/groups')} style={{ ...V.btn.outlined, marginTop:'1rem' }}>
              <i className="fas fa-arrow-left" />Back to Groups
            </button>
          </Box>
        </Box>
      </Layout>
    );
  }

  const isMember = group.members.some(m => m.user._id === user?._id);
  const isOwner  = group.admin._id === user?._id;
  const isAdmin  = isOwner || group.members.some(m => m.user._id === user?._id && m.role === 'admin');
  const isModerator = !isAdmin && group.members.some(m => m.user._id === user?._id && m.role === 'moderator');
  const userRole: 'admin' | 'moderator' | 'member' = isAdmin ? 'admin' : isModerator ? 'moderator' : 'member';

  const bannerBg = group.color
    ? `linear-gradient(135deg, ${group.color}CC, ${group.color}88)`
    : 'linear-gradient(135deg, #3B82F6, #8B5CF6)';

  const visibleTabs = TABS.filter(t => {
    if (t.adminOnly) return isAdmin;
    if (t.modOnly)   return isAdmin || isModerator;
    return true;
  });

  return (
    <Layout rightPanel={<RightSidebar group={group} />}>
      {/* Back */}
      <Box component="button" onClick={() => navigate('/groups')}
        sx={{ display:'inline-flex', alignItems:'center', gap:'0.375rem', mb:1.5,
          background:'transparent', border:'none', color:'#6B7280', fontSize:'0.875rem',
          fontWeight:500, cursor:'pointer', fontFamily:'Inter,sans-serif', padding:'0.25rem 0',
          '&:hover':{ color:'#4F46E5' } }}>
        <i className="fas fa-arrow-left" style={{ fontSize:'0.75rem' }} />Groups
      </Box>

      {/* Group Card */}
      <Box sx={{ ...V.card, mb:0 }}>
        {/* Banner */}
        <Box sx={{ height:200, background:bannerBg, position:'relative', overflow:'hidden' }}>
          {group.coverImage && (
            <Box component="img" src={group.coverImage}
              sx={{ width:'100%', height:'100%', objectFit:'cover' }} />
          )}
        </Box>

        {/* Group info */}
        <Box sx={{ px:{ xs:2, sm:'2rem' }, pb:0 }}>
          <Box sx={{ display:'flex', alignItems:'flex-start', gap:2, mt:'-40px', mb:1.5, flexWrap:'wrap' }}>
            {/* Logo */}
            <Avatar src={group.avatar}
              sx={{ width:80, height:80, border:'4px solid #FFFFFF',
                bgcolor: group.color || '#4F46E5', fontSize:'2rem', fontWeight:700,
                borderRadius:'0.75rem', boxShadow:'0 4px 6px -1px rgba(0,0,0,0.1)', flexShrink:0 }}>
              {group.name[0]}
            </Avatar>

            <Box flex={1} mt="42px" minWidth={0}>
              <Typography fontFamily="Poppins,sans-serif" fontWeight={700} fontSize="1.625rem"
                color="#1F2937" lineHeight={1.2} mb={0.75}>{group.name}</Typography>
              <Box sx={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                {[
                  { icon:'fas fa-users',        text:`${group.memberCount} Members` },
                  { icon:'fas fa-comment',       text:`${group.members.length} Online` },
                  { icon:'fas fa-calendar-alt',  text:'3 Events This Month' },
                  { icon:'fas fa-tag',           text: group.category },
                ].map(s => (
                  <Box key={s.text} sx={{ display:'flex', alignItems:'center', gap:0.625, fontSize:'0.875rem', color:'#6B7280' }}>
                    <i className={s.icon} style={{ color:'#4F46E5', fontSize:'0.8125rem' }} />{s.text}
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Actions */}
            <Box sx={{ display:'flex', gap:0.75, mt:'42px', flexWrap:'wrap' }}>
              {isMember && !isAdmin && (
                <button style={{ ...V.btn.gradient, opacity: joinMutation.isPending ? 0.7 : 1 }}
                  onClick={() => navigate(`/groups/${id}/chat`)}>
                  <i className="fas fa-comment-alt" />Chat
                </button>
              )}
              {isMember && (
                <button
                  disabled={notifMutation.isPending}
                  style={{ ...V.btn.outlined,
                    background: notifMuted ? '#FEF2F2' : 'transparent',
                    color: notifMuted ? '#EF4444' : '#1F2937',
                    opacity: notifMutation.isPending ? 0.6 : 1 }}
                  onClick={() => notifMutation.mutate()}
                  onMouseEnter={e => (e.currentTarget.style.background = notifMuted ? '#FEE2E2' : '#F3F4F6')}
                  onMouseLeave={e => (e.currentTarget.style.background = notifMuted ? '#FEF2F2' : 'transparent')}>
                  <i className={notifMuted ? 'fas fa-bell-slash' : 'fas fa-bell'} />
                  {notifMuted ? 'Muted' : 'Notifications'}
                </button>
              )}
              {isAdmin && (
                <button style={V.btn.admin} onClick={() => navigate(`/groups/${id}/settings`)}
                  onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform='')}>
                  <i className="fas fa-cog" />Admin Tools
                </button>
              )}
              {isMember ? (
                <button
                  style={{ ...V.btn.danger }}
                  onClick={() => isAdmin ? setShowTransferModal(true) : setShowLeaveConfirm(true)}>
                  <i className="fas fa-sign-out-alt" />Leave Group
                </button>
              ) : (
                <button style={{ ...V.btn.gradient, opacity: joinMutation.isPending ? 0.7 : 1 }}
                  onClick={() => joinMutation.mutate()} disabled={joinMutation.isPending}
                  onMouseEnter={e => (e.currentTarget.style.transform='translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform='')}>
                  <i className="fas fa-plus" />Join Group
                </button>
              )}
            </Box>
          </Box>

          {/* Description */}
          <Typography fontSize="0.875rem" color="#6B7280" mb={1.25}>{group.description}</Typography>

          {/* Tags */}
          {group.tags?.length > 0 && (
            <Box sx={{ display:'flex', flexWrap:'wrap', gap:0.75, mb:1.5 }}>
              {group.tags.map(tag => (
                <Box key={tag} component="span" sx={{ px:1, py:0.375, background:'#F9FAFB',
                  border:'1px solid #E5E7EB', borderRadius:'1rem', fontSize:'0.75rem', color:'#6B7280' }}>
                  {tag}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Tab bar */}
        <Box sx={{ borderTop:'1px solid #E5E7EB', px:1, display:'flex', overflowX:'auto',
          '&::-webkit-scrollbar':{ height:0 } }}>
          {visibleTabs.map(tab => (
            <Box key={tab.id} component="button"
              onClick={() => setActiveTab(tab.id)}
              sx={{ background:'transparent', border:'none',
                borderBottom: activeTab===tab.id
                  ? `3px solid ${tab.danger ? '#EF4444' : '#4F46E5'}`
                  : '3px solid transparent',
                color: tab.danger
                  ? '#EF4444'
                  : activeTab===tab.id ? '#4F46E5' : '#6B7280',
                fontFamily:'Inter,sans-serif', fontSize:'0.875rem',
                fontWeight: activeTab===tab.id ? 600 : 500,
                padding:'1rem 1.125rem', cursor:'pointer',
                transition:'all 0.2s', whiteSpace:'nowrap',
                display:'flex', alignItems:'center', gap:'0.5rem',
                '&:hover':{ color: tab.danger ? '#EF4444' : '#4F46E5', background:'#F3F4F6' } }}>
              <i className={tab.icon} style={{ fontSize:'0.8125rem' }} />
              {tab.label}
              {tab.dynamic && (
                <Box component="span" sx={{ background:'linear-gradient(135deg,#4F46E5,#10B981)',
                  color:'white', fontSize:'0.6875rem', fontWeight:600, px:0.75, borderRadius:'1rem' }}>
                  {group.memberCount}
                </Box>
              )}
              {tab.badge && !tab.dynamic && (
                <Box component="span" sx={{
                  background: tab.danger ? '#EF4444' : 'linear-gradient(135deg,#4F46E5,#10B981)',
                  color:'white', fontSize:'0.6875rem', fontWeight:600, px:0.75, borderRadius:'1rem' }}>
                  {tab.badge}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tab Content */}
      <Box sx={{ mt:2 }}>
        {activeTab==='feed'       && <FeedTab       group={group} />}
        {activeTab==='chats'      && <ChatsTab       groupId={id!} userRole={userRole} />}
        {activeTab==='members'    && <MembersTab     group={group} userRole={userRole} isOwner={isOwner} />}
        {activeTab==='events'     && <EventsTab group={group} />}
        {activeTab==='resources'  && <ResourcesTab groupId={id!} isMember={isMember} currentUserId={user?._id} isAdmin={isAdmin} />}
        {activeTab==='rules'      && <RulesTab group={group} isAdmin={isAdmin} onUpdate={() => refetch()} />}
        {activeTab==='settings'   && isAdmin && <SettingsTab groupId={id!} />}
        {activeTab==='moderation' && (isAdmin || isModerator) && <ModerationTab groupId={id!} userRole={userRole} />}
      </Box>

      {/* Leave confirm (non-admin) */}
      {showLeaveConfirm && (
        <LeaveConfirmModal
          groupName={group.name}
          loading={leaveMutation.isPending}
          onConfirm={() => leaveMutation.mutate()}
          onClose={() => setShowLeaveConfirm(false)}
        />
      )}

      {/* Transfer ownership + leave (admin) */}
      {showTransferModal && user && (
        <TransferOwnershipModal
          group={group}
          currentUserId={user._id}
          loading={transferMutation.isPending}
          onTransferAndLeave={(newOwnerId) => transferMutation.mutate(newOwnerId)}
          onClose={() => setShowTransferModal(false)}
        />
      )}
    </Layout>
  );
};

export default GroupDetail;
