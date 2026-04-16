import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

interface Props {
  feature: string;
  description?: string;
  compact?: boolean;
}

const EmailVerificationGate: React.FC<Props> = ({ feature, description, compact = false }) => {
  const navigate = useNavigate();

  const defaultDesc = `${feature} requires a verified email address. Check your inbox for a verification link or resend it from Settings.`;

  if (compact) {
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: '0.875rem',
        background: '#EFF6FF', border: '1px solid #BFDBFE',
        borderRadius: '0.75rem', p: '0.875rem 1rem',
      }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg,rgba(79,70,229,0.15),rgba(16,185,129,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="fas fa-envelope" style={{ color: '#4F46E5', fontSize: '1rem' }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', mb: '0.125rem' }}>
            Email Verification Required
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#6B7280', lineHeight: 1.4 }}>
            {description ?? defaultDesc}
          </Typography>
        </Box>
        <Button
          onClick={() => navigate('/settings')}
          size="small"
          sx={{
            background: GRAD, color: '#fff', fontWeight: 600,
            textTransform: 'none', borderRadius: '0.5rem',
            px: '0.875rem', py: '0.375rem', fontSize: '0.8125rem',
            whiteSpace: 'nowrap', flexShrink: 0, '&:hover': { opacity: 0.9 },
          }}
        >
          Verify Now
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{
      background: '#fff', border: '1px solid #E5E7EB',
      borderRadius: '1rem', p: '2rem 1.5rem',
      textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      <Box sx={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg,rgba(79,70,229,0.1),rgba(16,185,129,0.1))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        mx: 'auto', mb: '1.25rem', position: 'relative',
      }}>
        <i className="fas fa-envelope" style={{ fontSize: '2rem', color: '#4F46E5' }} />
        <Box sx={{
          position: 'absolute', bottom: 0, right: 0,
          width: 24, height: 24, borderRadius: '50%',
          background: '#F59E0B', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          border: '2px solid #fff',
        }}>
          <i className="fas fa-lock" style={{ color: '#fff', fontSize: '0.625rem' }} />
        </Box>
      </Box>

      <Typography sx={{
        fontFamily: 'Poppins, sans-serif', fontWeight: 700,
        fontSize: '1.125rem', color: '#1F2937', mb: '0.5rem',
      }}>
        Email Verification Required
      </Typography>

      <Typography sx={{
        fontSize: '0.9375rem', color: '#6B7280', mb: '1.5rem',
        maxWidth: 420, mx: 'auto', lineHeight: 1.6,
      }}>
        {description ?? defaultDesc}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', mb: '1.75rem', flexWrap: 'wrap' }}>
        {[
          { icon: 'fa-inbox', label: 'Check your inbox' },
          { icon: 'fa-envelope-open-text', label: 'Click verify link' },
          { icon: 'fa-shield-alt', label: 'Access unlocked' },
        ].map((step, i) => (
          <Box key={i} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.375rem' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          background: GRAD, color: '#fff', fontWeight: 600,
          textTransform: 'none', borderRadius: '0.625rem',
          px: '1.75rem', py: '0.75rem', fontSize: '0.9375rem',
          boxShadow: '0 4px 15px rgba(79,70,229,0.3)',
          '&:hover': { opacity: 0.9, boxShadow: '0 6px 20px rgba(79,70,229,0.4)' },
        }}
      >
        <i className="fas fa-envelope" style={{ marginRight: '0.5rem' }} />
        Go to Settings to Verify
      </Button>
    </Box>
  );
};

export default EmailVerificationGate;
