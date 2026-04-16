import React, { useState } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Button,
  Grid,
  Skeleton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Group } from '../types';
import { formatDistanceToNow } from 'date-fns';

const CATEGORIES = ['All', 'Skills', 'Tools', 'Events', 'Gardening', 'Cooking', 'Tech', 'Sports'];

const CATEGORY_COLORS: Record<string, string> = {
  Skills: '#4F46E5',
  Tools: '#10B981',
  Events: '#F59E0B',
  Gardening: '#16A34A',
  Cooking: '#DC2626',
  Tech: '#2563EB',
  Sports: '#7C3AED',
};

const CATEGORY_ICONS: Record<string, string> = {
  Skills: 'fa-graduation-cap',
  Tools: 'fa-tools',
  Events: 'fa-calendar',
  Gardening: 'fa-seedling',
  Cooking: 'fa-utensils',
  Tech: 'fa-laptop-code',
  Sports: 'fa-running',
  All: 'fa-users',
};

const GroupCard: React.FC<{ group: Group; isMember?: boolean; onLeave?: () => void }> = ({
  group,
  isMember = false,
  onLeave,
}) => {
  const navigate = useNavigate();
  const categoryColor = CATEGORY_COLORS[group.category] || '#4F46E5';
  const categoryIcon = CATEGORY_ICONS[group.category] || 'fa-users';

  return (
    <Box
      sx={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '0.75rem',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: '#4F46E5',
          transform: 'translateY(-2px)',
          boxShadow: '0 8px 20px rgba(79,70,229,0.1)',
        },
      }}
    >
      {/* Card Header */}
      <Box
        sx={{
          background: '#F9FAFB',
          borderBottom: '1px solid #E5E7EB',
          p: '1.5rem',
          position: 'relative',
        }}
      >
        {/* Category + Privacy badges — flex row so they never overlap */}
        <Box sx={{ position: 'absolute', top: '0.75rem', right: '0.75rem', display: 'flex', gap: '0.375rem', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '60%' }}>
          {group.type !== 'public' && (
          <Box
            sx={{
              background: 'rgba(0,0,0,0.5)',
              color: '#FFFFFF',
              fontSize: '0.7rem',
              fontWeight: 600,
              px: 1,
              py: 0.375,
              borderRadius: '2rem',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              whiteSpace: 'nowrap',
            }}
          >
            <i className="fas fa-lock" style={{ fontSize: '0.65rem' }} />
            {group.type === 'private' ? 'Private' : 'Restricted'}
          </Box>
          )}
          <Box
            sx={{
              background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}CC)`,
              color: '#FFFFFF',
              fontSize: '0.7rem',
              fontWeight: 700,
              px: 1.25,
              py: 0.5,
              borderRadius: '2rem',
              letterSpacing: '0.02em',
              whiteSpace: 'nowrap',
            }}
          >
            {group.category}
          </Box>
        </Box>

        {/* Group Icon */}
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '0.75rem',
            background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}99)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: '1rem',
            boxShadow: `0 4px 12px ${categoryColor}40`,
          }}
        >
          {group.avatar ? (
            <Avatar src={group.avatar} sx={{ width: 64, height: 64, borderRadius: '0.75rem' }} />
          ) : (
            <i className={`fas ${categoryIcon}`} style={{ color: '#FFFFFF', fontSize: '1.5rem' }} />
          )}
        </Box>

        {/* Title */}
        <Typography
          sx={{
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#1F2937',
            fontFamily: 'Poppins, sans-serif',
            mb: 0.5,
            pr: 0,
          }}
        >
          {group.name}
        </Typography>

        {/* Description */}
        <Typography
          sx={{
            fontSize: '0.875rem',
            color: '#6B7280',
            mb: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.6,
          }}
        >
          {group.description}
        </Typography>

        {/* Meta Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <i className="fas fa-users" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}>
              {group.memberCount.toLocaleString()} members
            </Typography>
          </Box>
          {group.members?.[0]?.user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <i className="fas fa-user-shield" style={{ color: '#4F46E5', fontSize: '0.8rem' }} />
              <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                Admin: {group.admin.name}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* Card Body */}
      <Box sx={{ p: '1.5rem' }}>
        {/* Tags */}
        {group.tags && group.tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
            {group.tags.slice(0, 4).map((tag) => (
              <Box
                key={tag}
                sx={{
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '2rem',
                  fontSize: '0.75rem',
                  color: '#6B7280',
                  px: 1,
                  py: 0.25,
                  fontWeight: 500,
                }}
              >
                #{tag}
              </Box>
            ))}
          </Box>
        )}

        {/* Stats Grid */}
        <Grid container spacing={1}>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 0.75, background: '#F9FAFB', borderRadius: '0.5rem' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins, sans-serif' }}>
                {group.memberCount}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>Members</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 0.75, background: '#F9FAFB', borderRadius: '0.5rem' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#10B981', fontFamily: 'Poppins, sans-serif' }}>
                0
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>Exchanges</Typography>
            </Box>
          </Grid>
          <Grid item xs={4}>
            <Box sx={{ textAlign: 'center', p: 0.75, background: '#F9FAFB', borderRadius: '0.5rem' }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#F59E0B', fontFamily: 'Poppins, sans-serif' }}>
                0
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#6B7280' }}>Events</Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Card Footer */}
      <Box
        sx={{
          background: '#F9FAFB',
          borderTop: '1px solid #E5E7EB',
          p: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: group.type === 'public' ? '#10B981' : '#F59E0B',
              boxShadow: `0 0 0 2px ${group.type === 'public' ? '#ECFDF5' : '#FFFBEB'}`,
            }}
          />
          <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}>
            {group.type === 'public' ? 'Public group' : group.type === 'private' ? 'Private group' : 'Restricted'}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {isMember && onLeave && (
            <Button
              onClick={(e) => { e.stopPropagation(); onLeave(); }}
              size="small"
              sx={{
                color: '#DC2626',
                borderColor: '#FCA5A5',
                border: '1px solid',
                fontSize: '0.8125rem',
                fontWeight: 600,
                px: 1.25,
                py: 0.375,
                borderRadius: '0.5rem',
                textTransform: 'none',
                minWidth: 0,
                '&:hover': { background: '#FEF2F2', borderColor: '#DC2626' },
              }}
            >
              <i className="fas fa-sign-out-alt" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />
              Leave
            </Button>
          )}
          <Button
            onClick={() => navigate(`/groups/${group._id}`)}
            size="small"
            sx={{
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              color: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 600,
              px: 1.5,
              py: 0.375,
              borderRadius: '0.5rem',
              textTransform: 'none',
              minWidth: 0,
              '&:hover': { opacity: 0.9 },
            }}
          >
            <i className="fas fa-arrow-right" style={{ marginRight: '0.375rem', fontSize: '0.75rem' }} />
            Visit Group
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

const MyGroups: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('All');

  const { data: myGroups, isLoading: loadingMine } = useQuery({
    queryKey: ['myGroups'],
    queryFn: async () => {
      const res = await api.get('/groups/me');
      return res.data as Group[];
    },
  });

  const { data: discover, isLoading: loadingDiscover } = useQuery({
    queryKey: ['discoverGroups', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory !== 'All' ? `?category=${selectedCategory}` : '';
      const res = await api.get(`/groups${params}`);
      return res.data as { groups: Group[] };
    },
    enabled: activeTab === 1,
  });

  const createdByMe = myGroups?.filter((g) => g.type !== 'private') ?? [];

  const tabs = [
    { label: 'My Groups', icon: 'fa-users', count: myGroups?.length },
    { label: 'Discover Groups', icon: 'fa-compass' },
    { label: 'Created by Me', icon: 'fa-crown', count: createdByMe.length },
  ];

  return (
    <Layout>
      {/* Page Header Card */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          p: '1.5rem',
          mb: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '0.625rem',
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className="fas fa-users" style={{ color: '#FFFFFF', fontSize: '1.125rem' }} />
            </Box>
            <Typography
              sx={{
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 700,
                fontSize: '1.5rem',
                color: '#1F2937',
              }}
            >
              My Groups
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', color: '#6B7280' }}>
            Connect with your community and share skills across the neighbourhood
          </Typography>
        </Box>
        <Button
          onClick={() => navigate('/groups/create')}
          sx={{
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: '0.9375rem',
            px: 2.5,
            py: 1,
            borderRadius: '0.625rem',
            textTransform: 'none',
            '&:hover': { opacity: 0.9, boxShadow: '0 4px 12px rgba(79,70,229,0.3)' },
          }}
        >
          <i className="fas fa-plus" style={{ marginRight: '0.5rem' }} />
          Create Group
        </Button>
      </Box>

      {/* Custom Tabs */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          mb: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            borderBottom: '1px solid #E5E7EB',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab, idx) => (
            <Box
              key={tab.label}
              onClick={() => setActiveTab(idx)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                px: 2,
                py: 1.25,
                cursor: 'pointer',
                borderBottom: activeTab === idx ? '2px solid #4F46E5' : '2px solid transparent',
                color: activeTab === idx ? '#4F46E5' : '#6B7280',
                fontWeight: activeTab === idx ? 600 : 400,
                fontSize: '0.9375rem',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
                '&:hover': {
                  color: activeTab === idx ? '#4F46E5' : '#1F2937',
                  background: '#F9FAFB',
                },
              }}
            >
              <i className={`fas ${tab.icon}`} style={{ fontSize: '0.9rem' }} />
              {tab.label}
              {tab.count !== undefined && (
                <Box
                  sx={{
                    background: activeTab === idx ? '#EEF2FF' : '#F3F4F6',
                    color: activeTab === idx ? '#4F46E5' : '#6B7280',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    px: 0.875,
                    py: 0.125,
                    borderRadius: '2rem',
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {tab.count}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Category Filter (Discover tab) */}
        {activeTab === 1 && (
          <Box sx={{ p: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap', borderBottom: '1px solid #E5E7EB' }}>
            {CATEGORIES.map((cat) => (
              <Box
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  background: selectedCategory === cat ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#F9FAFB',
                  color: selectedCategory === cat ? '#FFFFFF' : '#6B7280',
                  border: `1px solid ${selectedCategory === cat ? 'transparent' : '#E5E7EB'}`,
                  fontWeight: selectedCategory === cat ? 600 : 400,
                  fontSize: '0.8125rem',
                  px: 1.25,
                  py: 0.5,
                  borderRadius: '2rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  '&:hover': {
                    background: selectedCategory === cat ? 'linear-gradient(135deg, #4F46E5, #10B981)' : '#F3F4F6',
                  },
                }}
              >
                <i
                  className={`fas ${CATEGORY_ICONS[cat] || 'fa-tag'}`}
                  style={{ fontSize: '0.75rem' }}
                />
                {cat}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Tab Content: My Groups */}
      {activeTab === 0 && (
        <>
          {loadingMine ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rounded" height={340} sx={{ borderRadius: '0.75rem' }} />
                </Grid>
              ))}
            </Grid>
          ) : myGroups?.length === 0 ? (
            <Box
              sx={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                p: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <i className="fas fa-users" style={{ fontSize: '2rem', color: '#D1D5DB' }} />
              </Box>
              <Typography
                sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.125rem', color: '#1F2937', mb: 0.75 }}
              >
                You haven&apos;t joined any groups yet
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5 }}>
                Discover groups in your neighborhood or create your own community!
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                <Button
                  onClick={() => setActiveTab(1)}
                  sx={{
                    border: '1px solid #E5E7EB',
                    color: '#1F2937',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    px: 2.5,
                    py: 1,
                    borderRadius: '0.625rem',
                    textTransform: 'none',
                    '&:hover': { background: '#F9FAFB' },
                  }}
                >
                  <i className="fas fa-compass" style={{ marginRight: '0.5rem' }} />
                  Discover Groups
                </Button>
                <Button
                  onClick={() => navigate('/groups/create')}
                  sx={{
                    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.9375rem',
                    px: 2.5,
                    py: 1,
                    borderRadius: '0.625rem',
                    textTransform: 'none',
                    '&:hover': { opacity: 0.9 },
                  }}
                >
                  <i className="fas fa-plus" style={{ marginRight: '0.5rem' }} />
                  Create Group
                </Button>
              </Box>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {myGroups?.map((group) => (
                <Grid item xs={12} sm={6} md={4} key={group._id}>
                  <GroupCard group={group} isMember />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Tab Content: Discover Groups */}
      {activeTab === 1 && (
        <>
          {loadingDiscover ? (
            <Grid container spacing={2}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rounded" height={340} sx={{ borderRadius: '0.75rem' }} />
                </Grid>
              ))}
            </Grid>
          ) : !discover?.groups?.length ? (
            <Box
              sx={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                p: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <i className="fas fa-search" style={{ fontSize: '2rem', color: '#D1D5DB', marginBottom: '0.75rem' }} />
              <Typography sx={{ color: '#6B7280', fontWeight: 500 }}>
                No groups found{selectedCategory !== 'All' ? ` in ${selectedCategory}` : ''}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {discover.groups.map((group) => (
                <Grid item xs={12} sm={6} md={4} key={group._id}>
                  <GroupCard group={group} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Tab Content: Created by Me */}
      {activeTab === 2 && (
        <>
          {loadingMine ? (
            <Grid container spacing={2}>
              {[1, 2].map((i) => (
                <Grid item xs={12} sm={6} md={4} key={i}>
                  <Skeleton variant="rounded" height={340} sx={{ borderRadius: '0.75rem' }} />
                </Grid>
              ))}
            </Grid>
          ) : !createdByMe.length ? (
            <Box
              sx={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                p: '3rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 2,
                }}
              >
                <i className="fas fa-crown" style={{ fontSize: '2rem', color: '#D1D5DB' }} />
              </Box>
              <Typography
                sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.125rem', color: '#1F2937', mb: 0.75 }}
              >
                You haven&apos;t created any groups yet
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '0.9375rem', mb: 2.5 }}>
                Start a community around a skill, interest, or neighborhood activity!
              </Typography>
              <Button
                onClick={() => navigate('/groups/create')}
                sx={{
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  px: 2.5,
                  py: 1,
                  borderRadius: '0.625rem',
                  textTransform: 'none',
                  '&:hover': { opacity: 0.9 },
                }}
              >
                <i className="fas fa-plus" style={{ marginRight: '0.5rem' }} />
                Create Your First Group
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {createdByMe.map((group) => (
                <Grid item xs={12} sm={6} md={4} key={group._id}>
                  <GroupCard group={group} isMember />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Recent Group Activity */}
      {myGroups && myGroups.length > 0 && (
        <Box
          sx={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '0.75rem',
            p: '1.5rem',
            mt: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1.5,
              pb: 1,
              borderBottom: '2px solid #F9FAFB',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <i className="fas fa-bolt" style={{ color: '#F59E0B', fontSize: '1rem' }} />
              <Typography
                sx={{
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  color: '#1F2937',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                Recent Group Activity
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {myGroups.slice(0, 5).map((group) => {
              const categoryColor = CATEGORY_COLORS[group.category] || '#4F46E5';
              const categoryIcon = CATEGORY_ICONS[group.category] || 'fa-users';
              return (
                <Box
                  key={group._id}
                  onClick={() => navigate(`/groups/${group._id}`)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    borderRadius: '0.625rem',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    '&:hover': { background: '#F9FAFB' },
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '0.625rem',
                      background: `linear-gradient(135deg, ${categoryColor}, ${categoryColor}99)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {group.avatar ? (
                      <Avatar src={group.avatar} sx={{ width: 40, height: 40, borderRadius: '0.625rem' }} />
                    ) : (
                      <i className={`fas ${categoryIcon}`} style={{ color: '#FFFFFF', fontSize: '0.9rem' }} />
                    )}
                  </Box>
                  <Box flex={1} minWidth={0}>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937', mb: 0.125 }} noWrap>
                      {group.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                        {group.memberCount} members
                      </Typography>
                      <Box
                        sx={{
                          background: `${categoryColor}15`,
                          color: categoryColor,
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          px: 0.75,
                          py: 0.125,
                          borderRadius: '2rem',
                        }}
                      >
                        {group.category}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280' }}>
                      {formatDistanceToNow(new Date(group.createdAt), { addSuffix: true })}
                    </Typography>
                    <i className="fas fa-chevron-right" style={{ color: '#D1D5DB', fontSize: '0.75rem' }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Layout>
  );
};

export default MyGroups;
