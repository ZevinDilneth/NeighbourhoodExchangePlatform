import React, { useState } from 'react';
import { Box, Typography, Button, Chip, CircularProgress, LinearProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// ── Curated tag catalogue, grouped by category ──────────────────────────────
const TAG_CATEGORIES: { label: string; icon: string; color: string; tags: string[] }[] = [
  {
    label: 'Skills & Learning',
    icon: 'fas fa-graduation-cap',
    color: '#4F46E5',
    tags: [
      'cooking', 'baking', 'photography', 'music', 'guitar', 'piano', 'singing',
      'languages', 'art', 'drawing', 'painting', 'writing', 'yoga', 'fitness',
      'meditation', 'dance', 'acting', 'sewing', 'knitting', 'crafts',
    ],
  },
  {
    label: 'Technology',
    icon: 'fas fa-laptop-code',
    color: '#7C3AED',
    tags: [
      'coding', 'web-development', 'programming', 'ui-design', 'graphic-design',
      'video-editing', 'social-media', '3d-printing', 'electronics', 'robotics',
      'data-science', 'ai', 'cybersecurity', 'gaming',
    ],
  },
  {
    label: 'Home & DIY',
    icon: 'fas fa-tools',
    color: '#D97706',
    tags: [
      'gardening', 'plumbing', 'carpentry', 'electrical', 'painting-walls',
      'decorating', 'cleaning', 'repairs', 'upcycling', 'composting',
      'home-brewing', 'beekeeping', 'urban-farming',
    ],
  },
  {
    label: 'Community & Wellbeing',
    icon: 'fas fa-heart',
    color: '#DC2626',
    tags: [
      'childcare', 'tutoring', 'pet-care', 'elderly-care', 'volunteering',
      'mentoring', 'events', 'sustainability', 'mental-health', 'nutrition',
      'first-aid', 'cycling', 'running', 'hiking', 'swimming',
    ],
  },
  {
    label: 'Tools & Equipment',
    icon: 'fas fa-wrench',
    color: '#059669',
    tags: [
      'power-tools', 'garden-tools', 'kitchen-equipment', 'sports-equipment',
      'camping-gear', 'musical-instruments', 'art-supplies', 'bikes',
      'photography-gear', 'sewing-machines',
    ],
  },
  {
    label: 'Food & Drink',
    icon: 'fas fa-utensils',
    color: '#EA580C',
    tags: [
      'baking', 'vegan', 'vegetarian', 'bread-making', 'fermentation',
      'preserving', 'coffee', 'tea', 'cocktails', 'wine', 'cheese-making',
      'meal-prep', 'nutrition',
    ],
  },
];

const MIN_TAGS = 3;
const GRADIENT = 'linear-gradient(135deg, #4F46E5, #10B981)';

// ────────────────────────────────────────────────────────────────────────────

const OnboardingTags: React.FC = () => {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: (tags: string[]) => api.put('/users/me/tags', { tags }),
    onSuccess: (_data, tags) => {
      updateUser({ preferredTags: tags });
      navigate('/profile/edit');
    },
    onError: () => navigate('/profile/edit'), // Don't block — tags can be edited in Settings later
  });

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  const handleSubmit = () => {
    mutation.mutate([...selected]);
  };

  const count = selected.size;
  const canSubmit = count >= MIN_TAGS;
  const progress = Math.min(100, (count / MIN_TAGS) * 100);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #F0F0FF 0%, #F0FFF8 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* ── Header ── */}
      <Box
        sx={{
          width: '100%',
          borderBottom: '1px solid #E5E7EB',
          bgcolor: '#fff',
          py: 1.5,
          px: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              background: GRADIENT,
              borderRadius: 1.5,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <i className="fas fa-hands-helping" style={{ color: '#fff', fontSize: '1rem' }} />
          </Box>
          <Typography
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: '1.1rem',
              background: GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Neighborhood Exchange
          </Typography>
        </Box>

        {/* Step indicator */}
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          {[1, 2, 3].map((step) => (
            <Box
              key={step}
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: step <= 2 ? GRADIENT : 'transparent',
                color: step <= 2 ? '#fff' : '#9CA3AF',
                border: step === 3 ? '2px solid' : 'none',
                borderColor: '#4F46E5',
              }}
            >
              {step <= 2 ? <i className="fas fa-check" style={{ fontSize: '0.65rem' }} /> : 3}
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Body ── */}
      <Box sx={{ width: '100%', maxWidth: 860, px: { xs: 2, sm: 4 }, py: 4, pb: 14 }}>

        {/* Title */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: GRADIENT,
              width: 64,
              height: 64,
              borderRadius: 3,
              mb: 2,
              boxShadow: '0 8px 20px rgba(79,70,229,0.25)',
            }}
          >
            <i className="fas fa-tags" style={{ color: '#fff', fontSize: '1.75rem' }} />
          </Box>

          <Typography
            sx={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: 700,
              fontSize: { xs: '1.5rem', sm: '2rem' },
              color: '#111827',
              mb: 0.75,
            }}
          >
            What are you into?
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Pick at least <strong>{MIN_TAGS} interests</strong> and we'll personalise your feed to show
            the most relevant skills, tools, and events in your neighbourhood.
          </Typography>
        </Box>

        {/* ── Tag categories ── */}
        {TAG_CATEGORIES.map((cat) => (
          <Box key={cat.label} sx={{ mb: 3.5 }}>
            {/* Category heading */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 30,
                  height: 30,
                  borderRadius: 1.5,
                  bgcolor: cat.color + '18',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <i className={cat.icon} style={{ color: cat.color, fontSize: '0.8rem' }} />
              </Box>
              <Typography
                sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}
              >
                {cat.label}
              </Typography>
            </Box>

            {/* Tag chips */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {cat.tags.map((tag) => {
                const active = selected.has(tag);
                return (
                  <Chip
                    key={tag}
                    label={tag.replace(/-/g, ' ')}
                    onClick={() => toggle(tag)}
                    icon={
                      active
                        ? <i className="fas fa-check" style={{ fontSize: '0.65rem', color: '#fff', paddingLeft: 4 }} />
                        : undefined
                    }
                    sx={{
                      fontWeight: active ? 700 : 500,
                      fontSize: '0.8rem',
                      height: 34,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      background: active ? GRADIENT : '#fff',
                      color: active ? '#fff' : '#374151',
                      border: active ? 'none' : '1.5px solid #D1D5DB',
                      boxShadow: active
                        ? '0 2px 8px rgba(79,70,229,0.25)'
                        : '0 1px 3px rgba(0,0,0,0.06)',
                      '&:hover': {
                        background: active ? GRADIENT : '#F3F4F6',
                        boxShadow: active
                          ? '0 4px 12px rgba(79,70,229,0.35)'
                          : '0 2px 6px rgba(0,0,0,0.1)',
                        transform: 'translateY(-1px)',
                      },
                      '& .MuiChip-label': { px: active ? 1 : 1.5 },
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Sticky bottom bar ── */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          bgcolor: '#fff',
          borderTop: '1px solid #E5E7EB',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          px: { xs: 2, sm: 4 },
          py: 2,
          zIndex: 20,
        }}
      >
        <Box sx={{ maxWidth: 860, mx: 'auto' }}>
          {/* Progress bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
            <Box sx={{ flex: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: '#E5E7EB',
                  '& .MuiLinearProgress-bar': {
                    background: GRADIENT,
                    borderRadius: 3,
                  },
                }}
              />
            </Box>
            <Typography
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                minWidth: 70,
                color: canSubmit ? '#059669' : '#6B7280',
              }}
            >
              {count} selected{count >= MIN_TAGS ? ' ✓' : ` / ${MIN_TAGS} min`}
            </Typography>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Button
              variant="text"
              size="small"
              onClick={() => navigate('/profile/edit')}
              sx={{ color: '#9CA3AF', minWidth: 80, fontSize: '0.8rem', '&:hover': { color: '#6B7280' } }}
            >
              Skip for now
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained"
              size="large"
              disabled={!canSubmit || mutation.isLoading}
              onClick={handleSubmit}
              startIcon={
                mutation.isLoading
                  ? <CircularProgress size={16} color="inherit" />
                  : <i className="fas fa-arrow-right" style={{ fontSize: '0.85rem' }} />
              }
              sx={{
                background: canSubmit ? GRADIENT : undefined,
                px: 4,
                py: 1.25,
                fontWeight: 600,
                fontSize: '0.95rem',
                borderRadius: 2,
                boxShadow: canSubmit ? '0 4px 14px rgba(79,70,229,0.3)' : undefined,
                '&:hover': {
                  background: canSubmit ? GRADIENT : undefined,
                  opacity: 0.92,
                },
              }}
            >
              {mutation.isLoading ? 'Saving…' : 'Continue to Profile'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default OnboardingTags;
