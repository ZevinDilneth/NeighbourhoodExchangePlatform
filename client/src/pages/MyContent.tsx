import React, { useState } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';

const TYPE_FA_ICONS: Record<string, string> = {
  skill: 'fas fa-star',
  tool: 'fas fa-wrench',
  event: 'fas fa-calendar-alt',
  question: 'fas fa-question-circle',
  general: 'fas fa-bullhorn',
};

const TABS = [
  { label: 'All Posts', value: 'all' },
  { label: 'Skills', value: 'skill' },
  { label: 'Tools', value: 'tool' },
  { label: 'Events', value: 'event' },
  { label: 'Questions', value: 'question' },
];

const MyContent: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['myContent', user?._id],
    queryFn: async () => {
      const res = await api.get(`/users/${user?._id}/posts`);
      return res.data as { posts: Post[]; total: number };
    },
    enabled: !!user,
  });

  const allPosts = data?.posts ?? [];
  const filteredPosts =
    activeTab === 'all' ? allPosts : allPosts.filter((p) => p.type === activeTab);

  const countFor = (tab: string) =>
    tab === 'all' ? allPosts.length : allPosts.filter((p) => p.type === tab).length;

  return (
    <Layout>
      {/* Page header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        {/* Left: icon + title + subtitle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <i className="fas fa-file-alt" style={{ color: '#FFFFFF', fontSize: '1.25rem' }} />
          </Box>
          <Box>
            <Typography
              sx={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '1.375rem',
                color: '#1F2937',
                lineHeight: 1.2,
              }}
            >
              My Content
            </Typography>
            <Typography
              sx={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                color: '#6B7280',
              }}
            >
              Everything you've shared with the community
            </Typography>
          </Box>
        </Box>

        {/* Right: gradient Create Post button */}
        <Box
          component="button"
          onClick={() => navigate('/create')}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#FFFFFF',
            border: 'none',
            padding: '0.75rem 1.5rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            '&:hover': { opacity: 0.92 },
          }}
        >
          <i className="fas fa-plus" style={{ fontSize: '0.75rem' }} />
          Create Post
        </Box>
      </Box>

      {/* Tab bar */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          mb: '1.5rem',
          display: 'flex',
          overflow: 'hidden',
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.value;
          const count = countFor(tab.value);
          return (
            <Box
              key={tab.value}
              component="button"
              onClick={() => setActiveTab(tab.value)}
              sx={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '2px solid #4F46E5'
                  : '2px solid transparent',
                padding: '0.75rem 0.5rem',
                cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#4F46E5' : '#6B7280',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s, border-color 0.15s',
                '&:hover': { color: '#4F46E5', background: '#F9FAFB' },
              }}
            >
              {tab.label}
              {!isLoading && (
                <Box
                  component="span"
                  sx={{
                    ml: '0.375rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isActive ? '#EEF2FF' : '#F3F4F6',
                    color: isActive ? '#4F46E5' : '#6B7280',
                    borderRadius: '1rem',
                    padding: '0 0.4rem',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    minWidth: '1.25rem',
                    lineHeight: '1.25rem',
                  }}
                >
                  {count}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Content */}
      {isLoading ? (
        <>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={120} sx={{ mb: '0.875rem', borderRadius: '0.75rem' }} />
          ))}
        </>
      ) : filteredPosts.length === 0 ? (
        /* Empty state */
        <Box
          sx={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            textAlign: 'center',
            padding: '4rem 2rem',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '1rem',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '1rem',
            }}
          >
            <i className="fas fa-file-alt" style={{ color: '#FFFFFF', fontSize: '1.5rem' }} />
          </Box>
          <Typography
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 600,
              fontSize: '1.125rem',
              color: '#1F2937',
              mb: '0.5rem',
            }}
          >
            No content yet
          </Typography>
          <Typography
            sx={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              color: '#6B7280',
              mb: '1.5rem',
            }}
          >
            Share your skills, tools, and ideas with the community!
          </Typography>
          <Box
            component="button"
            onClick={() => navigate('/create')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.875rem',
              '&:hover': { opacity: 0.92 },
            }}
          >
            <i className="fas fa-plus" style={{ fontSize: '0.75rem' }} />
            Create Your First Post
          </Box>
        </Box>
      ) : (
        filteredPosts.map((post) => (
          <Box
            key={post._id}
            onClick={() => navigate(`/posts/${post._id}`)}
            sx={{
              background: '#FFFFFF',
              border: '1px solid #E5E7EB',
              borderRadius: '0.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              overflow: 'hidden',
              mb: '0.875rem',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
              '&:hover': { borderColor: '#4F46E5' },
            }}
          >
            {/* Header zone */}
            <Box
              sx={{
                background: '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              {/* Type badge — gradient */}
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  color: '#FFFFFF',
                  borderRadius: '2rem',
                  padding: '0.2rem 0.65rem',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  textTransform: 'capitalize',
                  flexShrink: 0,
                }}
              >
                <i className={TYPE_FA_ICONS[post.type] ?? 'fas fa-circle'} style={{ fontSize: '0.6rem' }} />
                {post.type}
              </Box>

              <Typography
                sx={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '0.9375rem',
                  color: '#1F2937',
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {post.title}
              </Typography>
            </Box>

            {/* Content zone */}
            <Box sx={{ background: '#FFFFFF', padding: '0.875rem 1.25rem' }}>
              <Typography
                sx={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.875rem',
                  color: '#6B7280',
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {post.content}
              </Typography>
            </Box>

            {/* Footer zone */}
            <Box
              sx={{
                background: '#F9FAFB',
                borderTop: '1px solid #E5E7EB',
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                flexWrap: 'wrap',
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.75rem',
                  color: '#6B7280',
                  flex: 1,
                }}
              >
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                {' '}•{' '}
                <Box component="span" sx={{ fontWeight: 600, color: '#1F2937' }}>
                  {post.upvotes.length - post.downvotes.length} points
                </Box>
                {' '}•{' '}
                <i className="fas fa-comment" style={{ fontSize: '0.65rem', marginRight: '0.25rem' }} />
                {post.commentCount}
              </Typography>

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                <Box
                  component="button"
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/posts/${post._id}`); }}
                  sx={{
                    border: '1px solid #E5E7EB',
                    background: 'transparent',
                    color: '#1F2937',
                    padding: '0.375rem 0.875rem',
                    borderRadius: '0.5rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.75rem',
                    '&:hover': { background: '#F3F4F6' },
                  }}
                >
                  View
                </Box>
              </Box>
            </Box>
          </Box>
        ))
      )}
    </Layout>
  );
};

export default MyContent;
