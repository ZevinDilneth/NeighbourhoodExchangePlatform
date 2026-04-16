import React from 'react';
import { Box, Typography } from '@mui/material';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// ── Sidebar Section Wrapper ─────────────────────────────────────────────────
const SidebarSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box
    sx={{
      borderRadius: '0.75rem',
      p: '1rem',
      mb: '1.5rem',
      background: '#F9FAFB',
      border: '1px solid #E5E7EB',
    }}
  >
    <Typography
      sx={{
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#6B7280',
        mb: '0.75rem',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

// ── Action Button ────────────────────────────────────────────────────────────
interface ActionBtnProps {
  icon: string;
  label: string;
  primary?: boolean;
  onClick?: () => void;
}
const ActionBtn: React.FC<ActionBtnProps> = ({ icon, label, primary, onClick }) => (
  <Box
    component="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem',
      borderRadius: '0.5rem',
      textDecoration: 'none',
      color: primary ? 'white' : '#1F2937',
      background: primary ? 'linear-gradient(135deg, #4F46E5, #10B981)' : 'transparent',
      border: 'none',
      width: '100%',
      fontSize: '0.875rem',
      fontWeight: primary ? 600 : 500,
      fontFamily: 'Inter, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'left',
      '&:hover': {
        background: primary
          ? 'linear-gradient(135deg, #3730A3, #059669)'
          : '#F3F4F6',
        transform: 'translateX(2px)',
      },
      '& i': {
        width: 18,
        textAlign: 'center',
        color: primary ? 'white' : '#4F46E5',
        fontSize: '0.9rem',
      },
    }}
  >
    <i className={icon} />
    {label}
  </Box>
);

// ── Nav Link ────────────────────────────────────────────────────────────────
interface NavLinkProps {
  icon: string;
  label: string;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}
const NavLink: React.FC<NavLinkProps> = ({ icon, label, active, badge, onClick }) => (
  <Box
    component="button"
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.625rem 0.75rem',
      borderRadius: '0.5rem',
      color: active ? '#4F46E5' : '#1F2937',
      background: active ? '#F3F4F6' : 'transparent',
      border: 'none',
      width: '100%',
      fontSize: '0.875rem',
      fontWeight: active ? 600 : 500,
      fontFamily: 'Inter, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'left',
      mb: '0.125rem',
      '&:hover': {
        background: '#F3F4F6',
        color: '#4F46E5',
      },
      '& i': {
        width: 18,
        textAlign: 'center',
        color: active ? '#4F46E5' : '#6B7280',
        fontSize: '0.875rem',
      },
    }}
  >
    <i className={icon} />
    <Box component="span" sx={{ flex: 1 }}>{label}</Box>
    {badge !== undefined && (
      <Box
        component="span"
        sx={{
          background: '#E5E7EB',
          color: '#6B7280',
          fontSize: '0.7rem',
          fontWeight: 600,
          px: '0.4rem',
          py: '0.1rem',
          borderRadius: '0.75rem',
          minWidth: 20,
          textAlign: 'center',
        }}
      >
        {badge}
      </Box>
    )}
  </Box>
);

// ── Tag ──────────────────────────────────────────────────────────────────────
const Tag: React.FC<{ label: string; count: number }> = ({ label, count }) => (
  <Box
    component="button"
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.375rem 0.75rem',
      borderRadius: '2rem',
      background: '#FFFFFF',
      border: '1px solid #E5E7EB',
      fontSize: '0.75rem',
      color: '#6B7280',
      cursor: 'pointer',
      width: '100%',
      fontFamily: 'Inter, sans-serif',
      transition: 'all 0.2s',
      mb: '0.375rem',
      '&:hover': {
        background: '#F3F4F6',
        borderColor: '#4F46E5',
        color: '#4F46E5',
      },
    }}
  >
    <span>{label}</span>
    <Box
      component="span"
      sx={{
        background: '#E5E7EB',
        color: '#6B7280',
        fontSize: '0.65rem',
        fontWeight: 600,
        px: '0.4rem',
        py: '0.1rem',
        borderRadius: '0.75rem',
      }}
    >
      {count}
    </Box>
  </Box>
);

// ── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const go = (path: string) => {
    navigate(path);
    onClose?.();
  };

  const isActive = (path: string) => location.pathname === path;

  // Derive which feed nav link is active from URL params
  const urlSort = searchParams.get('sort');
  const urlFilter = searchParams.get('filter');
  const urlType = searchParams.get('type');
  const onFeed = location.pathname === '/feed';
  const isPopular = onFeed && urlSort === 'hot';
  const isLatest = onFeed && urlSort === 'new';
  const isNearby = onFeed && urlFilter === 'nearby';
  const isEvents = onFeed && urlType === 'event';
  const isHomeFeed = onFeed && !urlSort && !urlFilter && !urlType;

  const { data: tags = [] } = useQuery<{ label: string; count: number }[]>({
    queryKey: ['post-tags'],
    queryFn: async () => {
      const res = await api.get('/posts/tags');
      return res.data;
    },
    staleTime: 60_000, // refetch at most once per minute
  });

  return (
    <Box
      component="aside"
      sx={{
        position: 'sticky',
        top: 56,
        height: 'calc(100vh - 56px)',
        overflowY: 'auto',
        padding: '1.5rem 1rem',
        background: '#FFFFFF',
        borderRight: '1px solid #E5E7EB',
        boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
        '&::-webkit-scrollbar': { width: 6 },
        '&::-webkit-scrollbar-track': { background: '#F9FAFB', borderRadius: 4 },
        '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 },
        '&::-webkit-scrollbar-thumb:hover': { background: '#6B7280' },
      }}
    >
      {/* Quick Actions (authenticated) or Join CTA (guest) */}
      {isAuthenticated ? (
        <SidebarSection title="Quick Actions">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <ActionBtn icon="fas fa-plus-circle" label="Create Post" primary onClick={() => go('/create')} />
            <ActionBtn icon="fas fa-exchange-alt" label="Start Exchange" onClick={() => go('/exchanges/create')} />
            <ActionBtn icon="fas fa-gift" label="Gift Tool/Item" onClick={() => go('/gift/create')} />
          </Box>
        </SidebarSection>
      ) : (
        /* Guest CTA */
        <Box
          sx={{
            borderRadius: '0.75rem',
            p: '1.25rem',
            mb: '1.5rem',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          <Typography sx={{ fontSize: '1.5rem', mb: '0.5rem' }}>🤝</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: '0.375rem', fontFamily: 'Poppins, Inter, sans-serif' }}>
            Join the Community
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', opacity: 0.9, mb: '1rem', lineHeight: 1.5 }}>
            Share skills, borrow tools and connect with your neighbours.
          </Typography>
          <Box
            component="button"
            onClick={() => go('/register')}
            sx={{
              display: 'block',
              width: '100%',
              py: '0.6rem',
              px: '1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#fff',
              color: '#4F46E5',
              fontWeight: 700,
              fontSize: '0.875rem',
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              mb: '0.5rem',
              transition: 'opacity 0.2s',
              '&:hover': { opacity: 0.9 },
            }}
          >
            Join Free
          </Box>
          <Box
            component="button"
            onClick={() => go('/login')}
            sx={{
              display: 'block',
              width: '100%',
              py: '0.6rem',
              px: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid rgba(255,255,255,0.5)',
              background: 'transparent',
              color: '#fff',
              fontWeight: 500,
              fontSize: '0.875rem',
              fontFamily: 'Inter, sans-serif',
              cursor: 'pointer',
              transition: 'background 0.2s',
              '&:hover': { background: 'rgba(255,255,255,0.15)' },
            }}
          >
            Sign In
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <SidebarSection title="Navigation">
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <NavLink icon="fas fa-home" label="Home Feed" active={isHomeFeed} onClick={() => go('/feed')} />
          <NavLink icon="fas fa-fire" label="Popular" active={isPopular} onClick={() => go('/feed?sort=hot')} />
          <NavLink icon="fas fa-clock" label="Latest" active={isLatest} onClick={() => go('/feed?sort=new')} />
          <NavLink icon="fas fa-map-marker-alt" label="Nearby" active={isNearby} onClick={() => go('/feed?filter=nearby')} />
          <NavLink icon="fas fa-calendar-alt" label="Events" active={isEvents} onClick={() => go('/feed?type=event')} />
          <NavLink
            icon="fas fa-users"
            label="My Groups"
            active={isActive('/groups')}
            onClick={() => go('/groups')}
          />
          <NavLink
            icon="fas fa-exchange-alt"
            label="My Exchanges"
            active={isActive('/my-exchanges')}
            onClick={() => go('/my-exchanges')}
          />
          <NavLink
            icon="fas fa-file-alt"
            label="My Content"
            active={isActive('/my-content')}
            onClick={() => go('/my-content')}
          />
          <NavLink icon="fas fa-chart-line" label="Rankings" onClick={() => go('/rankings')} />
          <NavLink icon="fas fa-cog" label="Settings" active={isActive('/settings')} onClick={() => go('/settings')} />
        </Box>
      </SidebarSection>

      {/* Trending Tags — populated from real post tags */}
      <SidebarSection title="Trending Tags">
        {tags.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: '1rem' }}>
            <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', lineHeight: 1.5 }}>
              No tags yet — add tags when creating a post!
            </Typography>
          </Box>
        ) : (
          tags.map((tag) => (
            <Tag key={tag.label} label={tag.label} count={tag.count} />
          ))
        )}
      </SidebarSection>
    </Box>
  );
};

export default Sidebar;
