import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

interface GuestBannerProps {
  message?: string;
}

const GuestBanner: React.FC<GuestBannerProps> = ({
  message = 'Join the community to comment, vote, and request skills.',
}) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        p: '1rem 1.25rem',
        background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))',
        border: '1px solid rgba(79,70,229,0.15)',
        borderRadius: '0.625rem',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <i className="fas fa-lock" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
        <Typography sx={{ fontSize: '0.875rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
          {message}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: '0.5rem' }}>
        <Box
          component="button"
          onClick={() => navigate('/login')}
          sx={{
            background: 'none', border: '1px solid #4F46E5', color: '#4F46E5',
            px: '1rem', py: '0.375rem', borderRadius: '0.5rem', cursor: 'pointer',
            fontFamily: 'Inter,sans-serif', fontSize: '0.8125rem', fontWeight: 600,
            '&:hover': { background: 'rgba(79,70,229,0.07)' },
          }}
        >
          Log In
        </Box>
        <Box
          component="button"
          onClick={() => navigate('/register')}
          sx={{
            background: 'linear-gradient(135deg,#4F46E5,#10B981)', border: 'none', color: '#fff',
            px: '1rem', py: '0.375rem', borderRadius: '0.5rem', cursor: 'pointer',
            fontFamily: 'Inter,sans-serif', fontSize: '0.8125rem', fontWeight: 600,
            '&:hover': { opacity: 0.9 },
          }}
        >
          Sign Up Free
        </Box>
      </Box>
    </Box>
  );
};

export default GuestBanner;
