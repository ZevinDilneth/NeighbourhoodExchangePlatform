import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Box, Typography, Avatar } from '@mui/material';
import api from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────

type InboxType =
  | 'answer'
  | 'tool_discussion'
  | 'event_discussion'
  | 'skill_discussion'
  | 'post_comment'
  | 'exchange_message';

interface InboxItem {
  id: string;
  type: InboxType;
  author: { _id: string; name: string; avatar?: string } | null;
  preview: string;
  timestamp: string;
  postId?: string;
  postType?: string;
  postTitle?: string;
  exchangeId?: string;
  exchangeTitle?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LAST_SEEN_KEY = 'inboxLastSeen';

const readLastSeen = (): Date => {
  const s = localStorage.getItem(LAST_SEEN_KEY);
  return s ? new Date(s) : new Date(0);
};

const getRoute = (item: InboxItem): string => {
  if (item.type === 'exchange_message') return `/exchanges/${item.exchangeId}`;
  if (item.type === 'answer') return `/questions/${item.postId}`;
  if (item.type === 'tool_discussion') return `/tools/${item.postId}`;
  if (item.type === 'event_discussion') return `/events/${item.postId}`;
  if (item.type === 'skill_discussion') return `/skills/${item.postId}`;
  return `/posts/${item.postId}`;
};

const TYPE_META: Record<InboxType, { label: string; icon: string; color: string }> = {
  answer:           { label: 'Answer',           icon: 'fa-comment-dots', color: '#4F46E5' },
  tool_discussion:  { label: 'Tool Discussion',  icon: 'fa-wrench',       color: '#F59E0B' },
  event_discussion: { label: 'Event Discussion', icon: 'fa-calendar-alt', color: '#10B981' },
  skill_discussion: { label: 'Skill Discussion', icon: 'fa-star',         color: '#8B5CF6' },
  post_comment:     { label: 'Discussion',       icon: 'fa-comments',     color: '#6B7280' },
  exchange_message: { label: 'Exchange Message', icon: 'fa-exchange-alt', color: '#EF4444' },
};

const formatTime = (ts: string): string => {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ── Component ─────────────────────────────────────────────────────────────────

const MessagesDropdown: React.FC = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // badgeLastSeen: what was seen when the dropdown was last closed — drives the red dot count
  const [badgeLastSeen, setBadgeLastSeen] = useState<Date>(readLastSeen);

  // sessionLastSeen: the value of lastSeen captured at open time — drives per-item highlight
  const sessionLastSeenRef = useRef<Date>(readLastSeen());

  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: items = [] } = useQuery<InboxItem[]>({
    queryKey: ['inbox'],
    queryFn: () => api.get<InboxItem[]>('/users/me/inbox?limit=50').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const newCount = items.filter((it) => new Date(it.timestamp) > badgeLastSeen).length;

  const handleToggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    // Capture OLD lastSeen for per-item highlighting inside this session
    sessionLastSeenRef.current = badgeLastSeen;
    // Mark everything as seen
    const now = new Date();
    setBadgeLastSeen(now);
    localStorage.setItem(LAST_SEEN_KEY, now.toISOString());
    setOpen(true);
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        !btnRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        ref={btnRef}
        onClick={handleToggle}
        title="Messages"
        style={{
          position: 'relative',
          color: open ? '#4F46E5' : '#6B7280',
          background: open ? '#F0F0FF' : 'none',
          border: 'none',
          fontSize: '1.1rem',
          cursor: 'pointer',
          padding: '0.5rem',
          borderRadius: '0.375rem',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.background = '#F3F4F6';
            e.currentTarget.style.color = '#4F46E5';
          }
        }}
        onMouseLeave={(e) => {
          if (!open) {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = '#6B7280';
          }
        }}
      >
        <i className="fas fa-comment-alt" />
        {newCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: '#EF4444',
              color: '#fff',
              fontSize: '0.6rem',
              minWidth: 15,
              height: 15,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              padding: '0 3px',
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {newCount > 9 ? '9+' : newCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <Box
          ref={dropRef}
          sx={{
            position: { xs: 'fixed', sm: 'absolute' },
            top: { xs: '56px', sm: 'calc(100% + 8px)' },
            right: { xs: 8, sm: 0 },
            left: { xs: 8, sm: 'unset' },
            width: { xs: 'auto', sm: 360 },
            background: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '0.75rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            zIndex: 1300,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2,
              py: 1.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #F3F4F6',
            }}
          >
            <Typography fontWeight={700} fontSize="0.9rem" color="#1F2937">
              Messages
            </Typography>
            {newCount > 0 && (
              <Box
                sx={{
                  background: '#EEF2FF',
                  color: '#4F46E5',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  px: 1,
                  py: 0.25,
                  borderRadius: 2,
                }}
              >
                {newCount} new
              </Box>
            )}
          </Box>

          {/* List */}
          <Box sx={{
            maxHeight: 420, overflowY: 'auto',
            scrollbarWidth: 'thin', scrollbarColor: '#D1D5DB transparent',
            '&::-webkit-scrollbar': { width: 4 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { background: '#D1D5DB', borderRadius: 4 },
          }}>
            {items.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <i
                  className="fas fa-comment-slash"
                  style={{ fontSize: '1.5rem', color: '#D1D5DB', display: 'block', marginBottom: 8 }}
                />
                <Typography fontSize="0.875rem" color="text.secondary">
                  No messages yet
                </Typography>
              </Box>
            ) : (
              items.map((item) => {
                const isNew = new Date(item.timestamp) > sessionLastSeenRef.current;
                const meta = TYPE_META[item.type] ?? TYPE_META.post_comment;
                const ctx = item.postTitle || item.exchangeTitle;
                const contextLabel = ctx
                  ? `"${ctx.length > 35 ? ctx.slice(0, 35) + '…' : ctx}"`
                  : '';

                return (
                  <Box
                    key={item.id}
                    onClick={() => {
                      setOpen(false);
                      navigate(getRoute(item));
                    }}
                    sx={{
                      px: 2,
                      py: 1.25,
                      display: 'flex',
                      gap: 1.5,
                      alignItems: 'flex-start',
                      cursor: 'pointer',
                      background: isNew ? '#F5F3FF' : 'transparent',
                      borderBottom: '1px solid #F9FAFB',
                      transition: 'background 0.15s',
                      '&:hover': { background: isNew ? '#EDE9FE' : '#F9FAFB' },
                    }}
                  >
                    {/* Avatar with type badge */}
                    <Box sx={{ position: 'relative', flexShrink: 0 }}>
                      <Avatar
                        src={item.author?.avatar}
                        sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 600 }}
                      >
                        {item.author?.name?.[0]?.toUpperCase() ?? '?'}
                      </Avatar>
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1.5px solid #fff',
                        }}
                      >
                        <i
                          className={`fas ${meta.icon}`}
                          style={{ fontSize: '0.42rem', color: '#fff' }}
                        />
                      </Box>
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          mb: 0.25,
                        }}
                      >
                        <Typography
                          fontWeight={600}
                          fontSize="0.8rem"
                          color="#1F2937"
                          noWrap
                          sx={{ maxWidth: 180 }}
                        >
                          {item.author?.name ?? 'Unknown'}
                        </Typography>
                        <Typography
                          fontSize="0.68rem"
                          color="#9CA3AF"
                          sx={{ flexShrink: 0, ml: 1 }}
                        >
                          {formatTime(item.timestamp)}
                        </Typography>
                      </Box>
                      <Typography
                        fontSize="0.72rem"
                        sx={{ color: meta.color, fontWeight: 500, mb: 0.25 }}
                      >
                        {meta.label}
                        {contextLabel ? ` · ${contextLabel}` : ''}
                      </Typography>
                      <Typography fontSize="0.8rem" color="#4B5563" noWrap sx={{ lineHeight: 1.4 }}>
                        {item.preview}
                      </Typography>
                    </Box>

                    {/* New dot */}
                    {isNew && (
                      <Box
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: '#4F46E5',
                          flexShrink: 0,
                          mt: 0.75,
                        }}
                      />
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MessagesDropdown;
