import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

interface Props {
  /**
   * Short name of the locked feature — shown in the heading.
   * e.g. "Skill Exchange", "Tool Exchange", "Location Sharing"
   */
  feature: string;
  /**
   * Optional description override. Defaults to a generic message.
   */
  description?: string;
  /** Render inline (compact card) instead of full-width block */
  compact?: boolean;
}

/**
 * Shown whenever a user without a Video Introduction attempts a verified-only action.
 * Directs them to Edit Profile to record their video.
 */
const VideoVerificationGate: React.FC<Props> = ({ feature, description, compact = false }) => {
  const navigate = useNavigate();

  const defaultDesc = `${feature} requires Video Verification. Recording a short video introduction proves you're a real person and unlocks full platform features.`;

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          background: '#FFF7ED',
          border: '1px solid #FED7AA',
          borderRadius: '0.75rem',
          p: '0.875rem 1rem',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,rgba(251,146,60,0.15),rgba(239,68,68,0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <i className="fas fa-video-slash" style={{ color: '#F97316', fontSize: '0.9rem' }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1F2937', mb: '0.125rem' }}>
            Video Verification Required
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', lineHeight: 1.4 }}>
            Add a Video Introduction to unlock <strong>{feature}</strong>.
          </Typography>
        </Box>
        <Button
          size="small"
          onClick={() => navigate('/profile/edit')}
          sx={{
            background: GRAD,
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.75rem',
            textTransform: 'none',
            borderRadius: '0.375rem',
            px: '0.875rem',
            py: '0.375rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            '&:hover': { opacity: 0.88 },
          }}
        >
          Verify Now
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        background: '#FFFBEB',
        border: '2px solid #FDE68A',
        borderRadius: '1rem',
        p: '2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(251,146,60,0.15),rgba(239,68,68,0.12))',
          border: '2px solid #FED7AA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: '1.25rem',
        }}
      >
        <i className="fas fa-video-slash" style={{ color: '#F97316', fontSize: '1.5rem' }} />
      </Box>

      {/* Lock badge */}
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          background: '#FEF3C7',
          border: '1px solid #FDE68A',
          borderRadius: '2rem',
          px: '0.875rem',
          py: '0.25rem',
          mb: '1rem',
        }}
      >
        <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.6875rem' }} />
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#D97706', letterSpacing: '0.04em' }}>
          VERIFIED USERS ONLY
        </Typography>
      </Box>

      <Typography
        sx={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 700,
          fontSize: '1.125rem',
          color: '#1F2937',
          mb: '0.625rem',
        }}
      >
        Video Verification Required for {feature}
      </Typography>

      <Typography
        sx={{
          fontSize: '0.875rem',
          color: '#6B7280',
          lineHeight: 1.7,
          maxWidth: 420,
          mx: 'auto',
          mb: '1.5rem',
        }}
      >
        {description ?? defaultDesc}
      </Typography>

      {/* What you unlock */}
      <Box
        sx={{
          display: 'inline-flex',
          flexDirection: 'column',
          gap: '0.5rem',
          textAlign: 'left',
          mb: '1.75rem',
          background: '#FFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          p: '1rem 1.25rem',
          minWidth: 260,
        }}
      >
        {[
          'Create Skill & Tool exchanges',
          'Respond to Skill & Tool exchanges',
          'Message other verified users',
          'Share & view meeting locations',
        ].map((item) => (
          <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '0.8125rem' }} />
            <Typography sx={{ fontSize: '0.8125rem', color: '#374151' }}>{item}</Typography>
          </Box>
        ))}
      </Box>

      {/* CTA */}
      <Box sx={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          onClick={() => navigate('/profile/edit')}
          sx={{
            background: GRAD,
            color: '#fff',
            fontWeight: 700,
            textTransform: 'none',
            borderRadius: '0.5rem',
            px: '1.75rem',
            py: '0.625rem',
            fontSize: '0.9375rem',
            boxShadow: '0 3px 14px rgba(79,70,229,0.3)',
            '&:hover': { opacity: 0.9 },
          }}
        >
          <i className="fas fa-video" style={{ marginRight: '0.5rem', fontSize: '0.875rem' }} />
          Add Video Introduction
        </Button>
        <Button
          onClick={() => window.history.back()}
          sx={{
            border: '1px solid #E5E7EB',
            color: '#6B7280',
            textTransform: 'none',
            borderRadius: '0.5rem',
            px: '1.5rem',
            py: '0.625rem',
            fontWeight: 500,
            '&:hover': { borderColor: '#9CA3AF', color: '#374151' },
          }}
        >
          Go Back
        </Button>
      </Box>
    </Box>
  );
};

export default VideoVerificationGate;
