import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

interface Props {
  /** Short name of the locked feature — shown in the heading. */
  feature: string;
  /** Optional description override. */
  description?: string;
  /** Render inline (compact card) instead of full-width block */
  compact?: boolean;
}

/**
 * Shown whenever a user without a verified phone attempts a phone-verified-only action.
 * Directs them to Edit Profile to verify their number.
 */
const PhoneVerificationGate: React.FC<Props> = ({ feature, description, compact = false }) => {
  const navigate = useNavigate();

  const defaultDesc = `${feature} requires a verified mobile number. Go to Settings to verify your number and unlock this feature.`;

  if (compact) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.875rem',
          background: '#F0FDF4',
          border: '1px solid #BBF7D0',
          borderRadius: '0.75rem',
          p: '0.875rem 1rem',
        }}
      >
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.15))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <i className="fas fa-mobile-alt" style={{ color: '#10B981', fontSize: '1rem' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', mb: '0.125rem' }}>
            Phone Verification Required
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.4 }}>
            {description ?? defaultDesc}
          </Typography>
        </Box>
        <Button
          onClick={() => navigate('/settings')}
          size="small"
          sx={{
            background: GRAD,
            color: '#fff',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '0.5rem',
            px: '0.875rem',
            py: '0.375rem',
            fontSize: '0.8125rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            '&:hover': { opacity: 0.9 },
          }}
        >
          Verify Now
        </Button>
      </Box>
    );
  }

  // Full-width block
  return (
    <Box
      sx={{
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: '1rem',
        p: '2rem 1.5rem',
        textAlign: 'center',
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(79,70,229,0.1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: '1.25rem',
          position: 'relative',
        }}
      >
        <i className="fas fa-mobile-alt" style={{ fontSize: '2rem', color: '#4F46E5' }} />
        {/* Lock badge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid #fff',
          }}
        >
          <i className="fas fa-lock" style={{ color: '#fff', fontSize: '0.625rem' }} />
        </Box>
      </Box>

      <Typography
        sx={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 700,
          fontSize: '1.125rem',
          color: '#1F2937',
          mb: '0.5rem',
        }}
      >
        Phone Verification Required
      </Typography>

      <Typography
        sx={{
          fontSize: '0.9375rem',
          color: '#6B7280',
          mb: '1.5rem',
          maxWidth: 420,
          mx: 'auto',
          lineHeight: 1.6,
        }}
      >
        {description ?? defaultDesc}
      </Typography>

      {/* Steps */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1.5rem',
          mb: '1.75rem',
          flexWrap: 'wrap',
        }}
      >
        {[
          { icon: 'fa-cog', label: 'Go to Settings' },
          { icon: 'fa-mobile-alt', label: 'Find Phone section' },
          { icon: 'fa-shield-alt', label: 'Verify your number' },
        ].map((step, i) => (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: GRAD,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <i className={`fas ${step.icon}`} style={{ color: '#fff', fontSize: '0.875rem' }} />
            </Box>
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', textAlign: 'center', maxWidth: 80 }}>
              {step.label}
            </Typography>
          </Box>
        ))}
      </Box>

      <Button
        onClick={() => navigate('/settings')}
        sx={{
          background: GRAD,
          color: '#fff',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: '0.625rem',
          px: '1.75rem',
          py: '0.75rem',
          fontSize: '0.9375rem',
          boxShadow: '0 4px 15px rgba(79,70,229,0.3)',
          '&:hover': { opacity: 0.9, boxShadow: '0 6px 20px rgba(79,70,229,0.4)' },
        }}
      >
        <i className="fas fa-mobile-alt" style={{ marginRight: '0.5rem' }} />
        Go to Settings to Verify
      </Button>
    </Box>
  );
};

export default PhoneVerificationGate;
