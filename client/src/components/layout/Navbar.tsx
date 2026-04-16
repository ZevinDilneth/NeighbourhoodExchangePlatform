import React, { useState, useEffect, useRef } from 'react';
import MessagesDropdown from './MessagesDropdown';
import {
  Box,
  InputBase,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Typography,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { GroupInvitation } from '../../types';

const SearchBar = styled('div')(() => ({
  display: 'flex',
  alignItems: 'center',
  background: '#F9FAFB',
  border: '1px solid #E5E7EB',
  borderRadius: '0.75rem',
  padding: '0.5rem 1rem',
  transition: 'all 0.2s',
  flex: 1,
  maxWidth: 600,
  margin: '0 2rem',
  '&:focus-within': {
    borderColor: '#4F46E5',
    boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)',
  },
  '& i': { color: '#6B7280', marginRight: '0.75rem' },
}));

const StyledInput = styled(InputBase)(() => ({
  flex: 1,
  '& .MuiInputBase-input': {
    fontSize: '0.875rem',
    color: '#1F2937',
    '&::placeholder': { color: '#6B7280' },
  },
}));

const NavIconBtn = styled('button')(() => ({
  position: 'relative',
  color: '#6B7280',
  background: 'none',
  border: 'none',
  fontSize: '1.1rem',
  cursor: 'pointer',
  padding: '0.5rem',
  borderRadius: '0.375rem',
  transition: 'all 0.2s',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': { background: '#F3F4F6', color: '#4F46E5' },
}));

const NotifBadge = styled('span')(() => ({
  position: 'absolute',
  top: 0,
  right: 0,
  background: '#EF4444',
  color: 'white',
  fontSize: '0.625rem',
  width: 16,
  height: 16,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: 'none',
}));

/* ── Invitation Panel ─────────────────────────────────────────────────────── */

interface InvitationPanelProps {
  invitations: GroupInvitation[];
  onAccept: (groupId: string) => void;
  onDecline: (groupId: string) => void;
  pendingId: string | null;
}

const InvitationPanel: React.FC<InvitationPanelProps> = ({ invitations, onAccept, onDecline, pendingId }) => {
  if (invitations.length === 0) {
    return (
      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9CA3AF' }}>
        <i className="fas fa-bell-slash" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.875rem' }}>No pending invitations</div>
      </div>
    );
  }

  return (
    <div>
      {invitations.map(inv => {
        const groupColor = inv.group.color || '#4F46E5';
        const isPending = pendingId === inv.group._id;
        return (
          <div key={inv._id} style={{ padding: '0.875rem 1rem', borderBottom: '1px solid #F3F4F6' }}>
            {/* Group banner strip */}
            <div style={{
              height: 6, borderRadius: '999px', background: groupColor, marginBottom: '0.75rem',
            }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '0.5rem', background: groupColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: '1rem', flexShrink: 0,
              }}>
                <i className="fas fa-users" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Inter, sans-serif' }}>
                  {inv.group.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', marginBottom: '0.625rem' }}>
                  <Avatar src={inv.invitedBy.avatar} sx={{ width: 14, height: 14, display: 'inline-flex', verticalAlign: 'middle', mr: '0.25rem', fontSize: '0.5rem' }}>
                    {inv.invitedBy.name?.charAt(0)}
                  </Avatar>
                  Invited by <strong>{inv.invitedBy.name}</strong> &nbsp;·&nbsp;
                  {inv.group.memberCount ?? 0} member{inv.group.memberCount !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => onAccept(inv.group._id)}
                    disabled={!!pendingId}
                    style={{
                      flex: 1, padding: '0.4rem', borderRadius: '0.375rem',
                      border: 'none', background: groupColor, color: '#fff',
                      fontSize: '0.8rem', fontWeight: 600, cursor: pendingId ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif', opacity: pendingId && !isPending ? 0.6 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
                    }}
                  >
                    {isPending ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <i className="fas fa-check" />}
                    {isPending ? 'Joining...' : 'Accept'}
                  </button>
                  <button
                    onClick={() => onDecline(inv.group._id)}
                    disabled={!!pendingId}
                    style={{
                      flex: 1, padding: '0.4rem', borderRadius: '0.375rem',
                      border: '1px solid #E5E7EB', background: '#fff', color: '#6B7280',
                      fontSize: '0.8rem', fontWeight: 500, cursor: pendingId ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter, sans-serif', opacity: pendingId ? 0.6 : 1,
                    }}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ── Main Navbar ──────────────────────────────────────────────────────────── */

interface NavbarProps {
  onMenuClick?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const queryClient = useQueryClient();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 280);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close search dropdown on outside click
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setSearchHighlight(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [searchOpen]);

  const commitSearch = (value: string) => {
    if (!value.trim()) return;
    setSearchOpen(false);
    setSearchHighlight(-1);
    navigate(`/feed?q=${encodeURIComponent(value.trim())}`);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchHighlight >= 0 && searchHighlight < searchItems.length) {
        const item = searchItems[searchHighlight];
        setSearchOpen(false); setSearchQuery(''); setSearchHighlight(-1);
        navigate(item.href);
      } else {
        commitSearch(searchQuery);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearchHighlight(h => Math.min(h + 1, searchItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchHighlight(h => Math.max(h - 1, -1));
    } else if (e.key === 'Escape') {
      setSearchOpen(false); setSearchHighlight(-1);
    }
  };

  // ── Search dropdown queries ───────────────────────────────────────────────
  const { data: allTagsData } = useQuery<{ tags: { tag: string; count: number }[] }>({
    queryKey: ['all-tags'],
    queryFn: () => api.get('/posts/tags').then(r => r.data),
    staleTime: 60_000,
    enabled: isAuthenticated,
  });

  const { data: searchPostsData } = useQuery<{ posts: { _id: string; title: string; type: string }[] }>({
    queryKey: ['search-posts', debouncedSearch],
    queryFn: () => api.get(`/posts?q=${encodeURIComponent(debouncedSearch)}&limit=5`).then(r => r.data),
    enabled: debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const { data: searchExchangesData } = useQuery<{ exchanges: { _id: string; title: string; onlineLink?: string }[] }>({
    queryKey: ['search-exchanges', debouncedSearch],
    queryFn: () => api.get(`/exchanges?q=${encodeURIComponent(debouncedSearch)}&limit=5`).then(r => r.data),
    enabled: debouncedSearch.length >= 2,
    staleTime: 10_000,
  });

  const matchingTags = debouncedSearch.length >= 1
    ? (allTagsData?.tags ?? []).filter(t => t.tag.toLowerCase().includes(debouncedSearch.toLowerCase())).slice(0, 6)
    : [];

  type SearchItem = { type: 'tag' | 'post' | 'exchange'; label: string; sub?: string; href: string };
  const searchItems: SearchItem[] = [
    ...matchingTags.map(t => ({ type: 'tag' as const, label: t.tag, href: `/feed?q=${encodeURIComponent(t.tag)}` })),
    ...(searchPostsData?.posts ?? []).map(p => ({ type: 'post' as const, label: p.title, sub: p.type, href: `/posts/${p._id}` })),
    ...(searchExchangesData?.exchanges ?? []).map(e => ({ type: 'exchange' as const, label: e.title, sub: e.onlineLink ? 'Online' : 'In-person', href: `/exchanges/${e._id}` })),
  ];

  // ── Interest-match notifications ──────────────────────────────────────────
  const { data: notifsData } = useQuery<{ notifications: { _id: string; type: string; title: string; body: string; link?: string; read: boolean; createdAt: string }[]; unreadCount: number }>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications?limit=50').then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const handleNotifClick = (notif: { _id: string; link?: string; read: boolean }) => {
    if (!notif.read) markReadMutation.mutate(notif._id);
    setNotifOpen(false);
    if (notif.link) navigate(notif.link);
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close notification panel on outside click
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  // Fetch pending invitations
  const { data: invitations = [] } = useQuery<GroupInvitation[]>({
    queryKey: ['groupInvitations'],
    queryFn: () => api.get('/groups/invitations').then(r => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const pendingCount = invitations.length;
  const unreadNotifCount = notifsData?.unreadCount ?? 0;
  const totalBadgeCount = pendingCount + unreadNotifCount;

  const acceptMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/groups/invitations/${groupId}/accept`),
    onMutate: (groupId) => setPendingInviteId(groupId),
    onSuccess: (res) => {
      const groupId: string = res.data.groupId;
      queryClient.invalidateQueries({ queryKey: ['groupInvitations'] });
      queryClient.invalidateQueries({ queryKey: ['myGroups'] });
      setPendingInviteId(null);
      setNotifOpen(false);
      navigate(`/groups/${groupId}`);
    },
    onError: () => setPendingInviteId(null),
  });

  const declineMutation = useMutation({
    mutationFn: (groupId: string) => api.post(`/groups/invitations/${groupId}/decline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupInvitations'] });
    },
  });

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    handleMenuClose();
    await logout();
    navigate('/');
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <Box
      component="header"
      sx={{
        background: scrolled ? 'rgba(255,255,255,0.9)' : '#FFFFFF',
        backdropFilter: scrolled ? 'blur(10px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(10px)' : 'none',
        borderBottom: '1px solid #E5E7EB',
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 1200,
        boxShadow: scrolled ? '0 4px 20px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.08)',
        gridColumn: '1 / -1',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.25s ease',
      }}
    >
      <Box sx={{ width: '100%', px: 2, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

        {/* Hamburger — mobile only */}
        <NavIconBtn
          onClick={onMenuClick}
          title="Menu"
          sx={{ display: { xs: 'flex', md: 'none' }, mr: 0.5 }}
        >
          <i className="fas fa-bars" />
        </NavIconBtn>

        {/* Logo */}
        <Box component="a" href="/feed" sx={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          textDecoration: 'none', color: '#1F2937',
          transition: 'transform 0.2s', flexShrink: 0,
          '&:hover': { transform: 'translateY(-2px)' },
        }}>
          <Box sx={{
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '1.25rem',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)', flexShrink: 0,
          }}>
            <i className="fas fa-hands-helping" />
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.1rem', lineHeight: 1.2, color: '#1F2937' }}>
              Neighborhood Exchange
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1 }}>
              Share Skills • Build Community
            </Typography>
          </Box>
        </Box>

        {/* Search Bar */}
        {!isMobile && (
          <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 600, margin: '0 2rem' }}>
            <SearchBar style={{ margin: 0, maxWidth: 'none', flex: 1, width: '100%' }}>
              <i className="fas fa-search" style={{ fontSize: '0.875rem' }} />
              <StyledInput
                placeholder="Search skills, tools, tags, online…"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); setSearchHighlight(-1); }}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchQuery && setSearchOpen(true)}
              />
              {searchQuery && (
                <i className="fas fa-times"
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); setSearchHighlight(-1); }}
                  style={{ fontSize: '0.75rem', cursor: 'pointer', color: '#9CA3AF', marginLeft: '0.25rem', flexShrink: 0 }} />
              )}
            </SearchBar>

            {/* Search dropdown */}
            {searchOpen && debouncedSearch.length >= 1 && (matchingTags.length > 0 || (searchPostsData?.posts ?? []).length > 0 || (searchExchangesData?.exchanges ?? []).length > 0) && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 1400, overflow: 'hidden' }}>

                {/* Tags */}
                {matchingTags.length > 0 && (
                  <div>
                    <div style={{ padding: '0.5rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-tag" style={{ marginRight: '0.375rem' }} />Tags
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.625rem 1rem' }}>
                      {matchingTags.map((t, i) => (
                        <div key={t.tag}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(`/feed?q=${encodeURIComponent(t.tag)}`); }}
                          style={{ padding: '0.25rem 0.625rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', background: searchHighlight === i ? '#EEF2FF' : 'rgba(79,70,229,0.08)', color: '#4F46E5', border: '1px solid rgba(79,70,229,0.2)' }}>
                          #{t.tag}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Posts */}
                {(searchPostsData?.posts ?? []).length > 0 && (
                  <div>
                    <div style={{ padding: '0.5rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-file-alt" style={{ marginRight: '0.375rem' }} />Posts
                    </div>
                    {(searchPostsData?.posts ?? []).map((p, i) => {
                      const typeIconMap: Record<string, string> = { skill: 'fa-star', tool: 'fa-wrench', event: 'fa-calendar', question: 'fa-question-circle' };
                      const gIdx = matchingTags.length + i;
                      return (
                        <div key={p._id}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(`/posts/${p._id}`); }}
                          style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem', background: searchHighlight === gIdx ? '#F5F3FF' : '#fff' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className={`fas ${typeIconMap[p.type] ?? 'fa-file-alt'}`} style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                            <div style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{p.type}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Exchanges */}
                {(searchExchangesData?.exchanges ?? []).length > 0 && (
                  <div>
                    <div style={{ padding: '0.5rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <i className="fas fa-exchange-alt" style={{ marginRight: '0.375rem' }} />Exchanges
                    </div>
                    {(searchExchangesData?.exchanges ?? []).map((e, i) => {
                      const gIdx = matchingTags.length + (searchPostsData?.posts ?? []).length + i;
                      return (
                        <div key={e._id}
                          onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(`/exchanges/${e._id}`); }}
                          style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem', background: searchHighlight === gIdx ? '#F5F3FF' : '#fff' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fas fa-exchange-alt" style={{ color: '#10B981', fontSize: '0.7rem' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                            <div style={{ fontSize: '0.7rem', color: e.onlineLink ? '#10B981' : '#6B7280' }}>
                              <i className={`fas ${e.onlineLink ? 'fa-globe' : 'fa-map-marker-alt'}`} style={{ marginRight: '0.25rem', fontSize: '0.6rem' }} />
                              {e.onlineLink ? 'Online' : 'In-person'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Footer */}
                <div
                  onClick={() => commitSearch(debouncedSearch)}
                  style={{ padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderTop: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.8rem', color: '#4F46E5', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
                  <i className="fas fa-search" style={{ fontSize: '0.75rem' }} />
                  Search all results for "{debouncedSearch}"
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mobile search overlay */}
        {isMobile && searchOpen && (
          <Box sx={{
            position: 'fixed', top: 56, left: 0, right: 0, zIndex: 1250,
            background: '#fff', borderBottom: '1px solid #E5E7EB',
            p: '0.625rem 0.75rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          }}>
            <div ref={searchRef} style={{ position: 'relative' }}>
              <SearchBar style={{ margin: 0, maxWidth: 'none', flex: 1, width: '100%' }}>
                <i className="fas fa-search" style={{ fontSize: '0.875rem' }} />
                <StyledInput
                  placeholder="Search skills, tools, tags…"
                  value={searchQuery}
                  autoFocus
                  onChange={e => { setSearchQuery(e.target.value); setSearchHighlight(-1); }}
                  onKeyDown={handleSearchKeyDown}
                />
                <i className="fas fa-times"
                  onClick={() => { setSearchQuery(''); setSearchOpen(false); setSearchHighlight(-1); }}
                  style={{ fontSize: '0.875rem', cursor: 'pointer', color: '#9CA3AF', marginLeft: '0.25rem', flexShrink: 0 }} />
              </SearchBar>
              {debouncedSearch.length >= 1 && (matchingTags.length > 0 || (searchPostsData?.posts ?? []).length > 0 || (searchExchangesData?.exchanges ?? []).length > 0) && (
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: '#fff', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 10px 40px rgba(0,0,0,0.12)', zIndex: 1400, overflow: 'hidden' }}>
                  {matchingTags.length > 0 && (
                    <div>
                      <div style={{ padding: '0.5rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB', fontSize: '0.7rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <i className="fas fa-tag" style={{ marginRight: '0.375rem' }} />Tags
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.625rem 1rem' }}>
                        {matchingTags.map((t, i) => (
                          <div key={t.tag}
                            onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(`/feed?q=${encodeURIComponent(t.tag)}`); }}
                            style={{ padding: '0.25rem 0.625rem', borderRadius: '999px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, fontFamily: 'Inter,sans-serif', background: searchHighlight === i ? '#EEF2FF' : 'rgba(79,70,229,0.08)', color: '#4F46E5', border: '1px solid rgba(79,70,229,0.2)' }}>
                            #{t.tag}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(searchPostsData?.posts ?? []).map((p, i) => {
                    const typeIconMap: Record<string, string> = { skill: 'fa-star', tool: 'fa-wrench', event: 'fa-calendar', question: 'fa-question-circle' };
                    const gIdx = matchingTags.length + i;
                    return (
                      <div key={p._id} onClick={() => { setSearchOpen(false); setSearchQuery(''); navigate(`/posts/${p._id}`); }}
                        style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.625rem', background: searchHighlight === gIdx ? '#F5F3FF' : '#fff' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(79,70,229,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <i className={`fas ${typeIconMap[p.type] ?? 'fa-file-alt'}`} style={{ color: '#4F46E5', fontSize: '0.7rem' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 500, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9CA3AF', textTransform: 'capitalize' }}>{p.type}</div>
                        </div>
                      </div>
                    );
                  })}
                  <div onClick={() => commitSearch(debouncedSearch)}
                    style={{ padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', borderTop: '1px solid #E5E7EB', background: '#F9FAFB', fontSize: '0.8rem', color: '#4F46E5', fontWeight: 600, fontFamily: 'Inter,sans-serif' }}>
                    <i className="fas fa-search" style={{ fontSize: '0.75rem' }} />
                    Search all results for "{debouncedSearch}"
                  </div>
                </div>
              )}
            </div>
          </Box>
        )}

        {/* Nav Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          {isMobile && (
            <NavIconBtn onClick={() => setSearchOpen(o => !o)}><i className="fas fa-search" /></NavIconBtn>
          )}

          <NavIconBtn onClick={() => navigate('/feed')} title="Home Feed" sx={{ display: { xs: 'none', sm: 'flex' } }}>
            <i className="fas fa-home" style={{ color: location.pathname === '/feed' ? '#4F46E5' : undefined }} />
          </NavIconBtn>

          {isAuthenticated && (
            <>
              <NavIconBtn onClick={() => navigate('/create')} title="Create Post" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <i className="fas fa-plus" />
              </NavIconBtn>

              <NavIconBtn onClick={() => navigate('/groups')} title="My Groups" sx={{ display: { xs: 'none', sm: 'flex' } }}>
                <i className="fas fa-users" />
              </NavIconBtn>

              <MessagesDropdown />

              {/* Notification Bell */}
              <div ref={notifRef} style={{ position: 'relative' }}>
                <NavIconBtn
                  title="Notifications"
                  onClick={() => setNotifOpen(o => !o)}
                  sx={{ mr: '0.5rem', color: notifOpen ? '#4F46E5' : undefined }}
                >
                  <i className="fas fa-bell" style={{ color: notifOpen ? '#4F46E5' : undefined }} />
                  {totalBadgeCount > 0 && (
                    <NotifBadge>{totalBadgeCount > 9 ? '9+' : totalBadgeCount}</NotifBadge>
                  )}
                </NavIconBtn>

                {/* Notification dropdown */}
                {notifOpen && (
                  <div style={{
                    position: 'fixed',
                    top: 56 + 8,
                    right: isMobile ? 8 : 0,
                    left: isMobile ? 8 : 'auto',
                    width: isMobile ? 'auto' : 320,
                    background: '#FFFFFF',
                    border: '1px solid #E5E7EB', borderRadius: '0.75rem',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                    zIndex: 1300, overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <div style={{
                      padding: '0.875rem 1rem', borderBottom: '1px solid #E5E7EB',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1F2937', fontFamily: 'Poppins, sans-serif' }}>
                        Notifications
                        {totalBadgeCount > 0 && (
                          <span style={{
                            marginLeft: '0.5rem', background: '#EF4444', color: '#fff',
                            fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                            borderRadius: '999px',
                          }}>
                            {totalBadgeCount}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {unreadNotifCount > 0 && (
                          <button
                            onClick={() => markAllReadMutation.mutate()}
                            style={{ background: 'none', border: 'none', color: '#4F46E5', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', padding: '0.25rem 0.375rem', borderRadius: '0.375rem' }}
                          >
                            Mark all read
                          </button>
                        )}
                        <button
                          onClick={() => setNotifOpen(false)}
                          style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: '0.875rem' }}
                        >
                          <i className="fas fa-times" />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      maxHeight: 420, overflowY: 'auto',
                      scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB transparent',
                    }}>
                      {/* Group Invitations */}
                      {pendingCount > 0 && (
                        <>
                          <div style={{ padding: '0.5rem 1rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              <i className="fas fa-user-plus" style={{ marginRight: '0.375rem' }} />
                              Group Invitations
                            </span>
                          </div>
                          <InvitationPanel
                            invitations={invitations}
                            onAccept={(groupId) => acceptMutation.mutate(groupId)}
                            onDecline={(groupId) => declineMutation.mutate(groupId)}
                            pendingId={pendingInviteId}
                          />
                        </>
                      )}

                      {/* Notification history */}
                      {(notifsData?.notifications ?? []).length > 0 && (
                        <>
                          {(notifsData?.notifications ?? []).map(notif => {
                            const iconMap: Record<string, { icon: string; bg: string }> = {
                              interest_match:       { icon: 'fa-tags',           bg: 'linear-gradient(135deg,#4F46E5,#10B981)' },
                              exchange_request:     { icon: 'fa-exchange-alt',   bg: '#F59E0B' },
                              exchange_accepted:    { icon: 'fa-check-circle',   bg: '#10B981' },
                              exchange_completed:   { icon: 'fa-star',           bg: '#8B5CF6' },
                              exchange_message:     { icon: 'fa-comment-alt',    bg: '#3B82F6' },
                              skill_swap_request:   { icon: 'fa-handshake',      bg: '#EC4899' },
                              chain_proposed:       { icon: 'fa-link',           bg: '#6366F1' },
                              chain_accepted:       { icon: 'fa-link',           bg: '#10B981' },
                              chain_declined:       { icon: 'fa-link',           bg: '#EF4444' },
                              chain_active:         { icon: 'fa-link',           bg: '#4F46E5' },
                              general:              { icon: 'fa-bell',           bg: '#6B7280' },
                            };
                            const meta = iconMap[notif.type] ?? iconMap.general;
                            const timeAgo = (() => {
                              const diff = Date.now() - new Date(notif.createdAt).getTime();
                              const m = Math.floor(diff / 60_000);
                              if (m < 1) return 'just now';
                              if (m < 60) return `${m}m ago`;
                              const h = Math.floor(m / 60);
                              if (h < 24) return `${h}h ago`;
                              return `${Math.floor(h / 24)}d ago`;
                            })();
                            return (
                              <div
                                key={notif._id}
                                onClick={() => handleNotifClick(notif)}
                                style={{
                                  padding: '0.75rem 1rem',
                                  borderBottom: '1px solid #F3F4F6',
                                  cursor: notif.link ? 'pointer' : 'default',
                                  background: notif.read ? '#fff' : 'rgba(79,70,229,0.04)',
                                  display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => { if (notif.link) (e.currentTarget as HTMLDivElement).style.background = '#F5F3FF'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = notif.read ? '#fff' : 'rgba(79,70,229,0.04)'; }}
                              >
                                <div style={{
                                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                  background: meta.bg,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <i className={`fas ${meta.icon}`} style={{ color: '#fff', fontSize: '0.75rem' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '0.8125rem', fontWeight: notif.read ? 400 : 600, color: '#1F2937', lineHeight: 1.4, marginBottom: '0.125rem' }}>
                                    {notif.body}
                                  </div>
                                  <div style={{ fontSize: '0.6875rem', color: '#9CA3AF' }}>{timeAgo}</div>
                                </div>
                                {!notif.read && (
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4F46E5', flexShrink: 0, marginTop: 4 }} />
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}

                      {pendingCount === 0 && (notifsData?.notifications ?? []).length === 0 && (
                        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#9CA3AF' }}>
                          <i className="fas fa-bell-slash" style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.5rem' }} />
                          <div style={{ fontSize: '0.875rem' }}>No notifications yet</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {isAuthenticated ? (
            <Box onClick={handleMenuOpen} sx={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.25rem 0.5rem', borderRadius: '0.75rem',
              cursor: 'pointer', transition: 'background 0.2s',
              '&:hover': { background: '#F3F4F6' },
            }}>
              <Avatar src={user?.avatar} alt={user?.name} sx={{
                width: 32, height: 32,
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                fontSize: '0.875rem', fontWeight: 600,
              }}>
                {initials}
              </Avatar>
              <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, lineHeight: 1.2, color: '#1F2937' }}>
                  {user?.name?.split(' ')[0] || 'User'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <i className="fas fa-coins" style={{ color: '#10B981', fontSize: '0.7rem' }} />
                  {(user?.ceuBalance ?? 0).toLocaleString()} CEU
                </Typography>
              </Box>
              <i className="fas fa-chevron-down" style={{ color: '#6B7280', fontSize: '0.75rem' }} />
            </Box>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', ml: '0.25rem' }}>
              <Box component="button" onClick={() => navigate('/login')} sx={{
                px: { xs: '0.75rem', sm: '1rem' }, py: '0.4rem',
                borderRadius: '0.5rem', border: '1px solid #E5E7EB',
                background: '#fff', color: '#374151',
                fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif', transition: 'all 0.2s',
                '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5', color: '#4F46E5' },
              }}>
                Sign In
              </Box>
              <Box component="button" onClick={() => navigate('/register')} sx={{
                px: { xs: '0.75rem', sm: '1rem' }, py: '0.4rem',
                borderRadius: '0.5rem', border: 'none',
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                color: '#fff', fontSize: '0.875rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                transition: 'opacity 0.2s', '&:hover': { opacity: 0.9 },
                display: { xs: 'none', sm: 'block' },
              }}>
                Join Free
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {isAuthenticated && (
        <Menu
          anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ sx: { mt: 1, minWidth: 200, borderRadius: 2, border: '1px solid #E5E7EB', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' } }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography fontWeight={600} fontSize="0.9rem" color="#1F2937">{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { handleMenuClose(); navigate(`/profile/${user?._id}`); }}>
            <i className="fas fa-user" style={{ marginRight: 10, color: '#4F46E5', width: 16 }} />
            My Profile
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); navigate('/my-exchanges'); }}>
            <i className="fas fa-exchange-alt" style={{ marginRight: 10, color: '#4F46E5', width: 16 }} />
            My Exchanges
          </MenuItem>
          <MenuItem onClick={() => { handleMenuClose(); navigate('/my-content'); }}>
            <i className="fas fa-file-alt" style={{ marginRight: 10, color: '#4F46E5', width: 16 }} />
            My Content
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout} sx={{ color: '#EF4444' }}>
            <i className="fas fa-sign-out-alt" style={{ marginRight: 10, width: 16 }} />
            Sign Out
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

export default Navbar;
