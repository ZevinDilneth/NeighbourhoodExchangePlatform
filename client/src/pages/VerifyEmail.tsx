import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type Status = 'pending' | 'loading' | 'success' | 'error' | 'await-email';

// ── Shared page wrapper (logo + card) ────────────────────────────────────────
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box
    sx={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      p: 2,
    }}
  >
    <Box sx={{ width: '100%', maxWidth: 460 }}>
      {/* Brand logo */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            width: 56,
            height: 56,
            borderRadius: '0.75rem',
            mb: 1.5,
            boxShadow: '0 8px 16px rgba(79,70,229,0.2)',
          }}
        >
          <i className="fas fa-hands-helping" style={{ color: '#fff', fontSize: '1.5rem' }} />
        </Box>
        <Typography
          sx={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '1.5rem',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Neighborhood Exchange
        </Typography>
      </Box>

      {/* Card */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '1rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          p: 4,
          textAlign: 'center',
        }}
      >
        {children}
      </Box>
    </Box>
  </Box>
);

// ── Reusable alert banners ────────────────────────────────────────────────────
const SuccessBanner: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      background: '#ECFDF5',
      border: '1px solid #6EE7B7',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      mb: 2,
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      textAlign: 'left',
    }}
  >
    <i className="fas fa-check-circle" style={{ color: '#10B981', flexShrink: 0 }} />
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#065F46' }}>
      {message}
    </Typography>
  </Box>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <Box
    sx={{
      background: '#FEF2F2',
      border: '1px solid #FCA5A5',
      borderRadius: '0.5rem',
      padding: '0.75rem 1rem',
      mb: 2,
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      textAlign: 'left',
    }}
  >
    <i className="fas fa-exclamation-circle" style={{ color: '#EF4444', flexShrink: 0, marginTop: '0.1rem' }} />
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#991B1B' }}>
      {message}
    </Typography>
  </Box>
);

// ── Gradient CTA button ───────────────────────────────────────────────────────
const GradientBtn: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  mb?: number;
}> = ({ onClick, disabled, icon, label, mb = 0 }) => (
  <Box
    component="button"
    onClick={onClick}
    disabled={disabled}
    sx={{
      width: '100%',
      background: 'linear-gradient(135deg, #4F46E5, #10B981)',
      color: '#FFFFFF',
      border: 'none',
      padding: '0.75rem 1.5rem',
      borderRadius: '0.5rem',
      fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'Inter, sans-serif',
      fontSize: '0.9375rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      opacity: disabled ? 0.7 : 1,
      transition: 'opacity 0.15s',
      mb,
    }}
  >
    <i className={icon} />
    {label}
  </Box>
);

// ── Main component ────────────────────────────────────────────────────────────
const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user, updateUser, logout } = useAuth();

  const token = searchParams.get('token');
  // Email passed from Register via navigation state
  const registeredEmail = (location.state as { email?: string } | null)?.email;

  const [status, setStatus] = useState<Status>(token ? 'loading' : 'await-email');
  const [errorMsg, setErrorMsg] = useState('');

  // Resend state
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Change email
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);
  const [changeEmailError, setChangeEmailError] = useState('');

  // ── Auto-verify when token is present in URL ──────────────────────────────
  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        await api.get(`/auth/verify-email?token=${token}`);
        updateUser({ isVerified: true });
        setStatus('success');
      } catch (err: unknown) {
        // Handle email-client pre-fetch: if the user is already verified, show success
        if (isAuthenticated) {
          try {
            const { data } = await api.get('/auth/me');
            if (data.isVerified) {
              updateUser({ isVerified: true });
              setStatus('success');
              return;
            }
          } catch {
            // ignore — fall through to error state
          }
        }
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setErrorMsg(msg || 'Verification failed — this link is invalid, expired, or has already been used. Request a new one below.');
        setStatus('error');
      }
    };

    verify();
  }, [token, updateUser, isAuthenticated]);

  // ── Resend verification email ─────────────────────────────────────────────
  const handleResend = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setErrorMsg('');
    try {
      await api.post('/auth/resend-verification');
      setResendSuccess(true);
      setShowChangeEmail(false);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorMsg(msg || 'Resend failed — check your connection and try again.');
    } finally {
      setResendLoading(false);
    }
  };

  // ── Change email ──────────────────────────────────────────────────────────
  const handleChangeEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      setChangeEmailError('Enter a valid email address (e.g. name@example.com).');
      return;
    }
    setChangeEmailLoading(true);
    setChangeEmailError('');
    try {
      const { data } = await api.post('/auth/change-email', { email: newEmail });
      updateUser({ email: data.email });
      setResendSuccess(true);
      setShowChangeEmail(false);
      setNewEmail('');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setChangeEmailError(msg || 'Email not updated — check your connection and try again.');
    } finally {
      setChangeEmailLoading(false);
    }
  };

  // ── Continue to app — navigate directly (verification is optional, not a gate)
  const handleContinue = () => {
    navigate('/feed');
  };

  // ── Start over — logs out then navigates to register ──────────────────────
  const handleStartOver = async () => {
    if (isAuthenticated) {
      await logout();
    }
    navigate('/register');
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <Wrapper>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <i className="fas fa-spinner fa-spin" style={{ color: '#fff', fontSize: '1.5rem' }} />
        </Box>
        <Typography
          sx={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            fontSize: '1.2rem',
            color: '#1F2937',
            mb: 1,
          }}
        >
          Verifying your email…
        </Typography>
        <Typography
          sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7280' }}
        >
          Please wait a moment.
        </Typography>
      </Wrapper>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  if (status === 'success') {
    return (
      <Wrapper>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#ECFDF5',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '2rem' }} />
        </Box>
        <Typography
          sx={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '1.3rem',
            color: '#1F2937',
            mb: 1,
          }}
        >
          Email verified successfully!
        </Typography>
        <Typography
          sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7280', mb: 3 }}
        >
          Your email address has been confirmed. You're all set!
        </Typography>
        <GradientBtn
          onClick={() => navigate('/feed')}
          icon="fas fa-arrow-right"
          label="Go to your feed"
        />
      </Wrapper>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <Wrapper>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            background: '#FEF2F2',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 2,
          }}
        >
          <i className="fas fa-times-circle" style={{ color: '#EF4444', fontSize: '2rem' }} />
        </Box>
        <Typography
          sx={{
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 700,
            fontSize: '1.3rem',
            color: '#1F2937',
            mb: 2,
          }}
        >
          Verification failed
        </Typography>

        <ErrorBanner message={errorMsg} />

        {isAuthenticated ? (
          <>
            {resendSuccess && (
              <SuccessBanner message="A new verification link has been sent to your email." />
            )}
            <GradientBtn
              onClick={handleResend}
              disabled={resendLoading || resendSuccess}
              icon={resendLoading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'}
              label={resendLoading ? 'Sending…' : 'Resend verification email'}
            />
          </>
        ) : (
          <GradientBtn
            onClick={() => navigate('/login')}
            icon="fas fa-sign-in-alt"
            label="Sign in"
          />
        )}
      </Wrapper>
    );
  }

  // ── Await email (arrived from Register, no token in URL) ──────────────────
  return (
    <Wrapper>
      {/* Icon */}
      <Box
        sx={{
          width: 72,
          height: 72,
          borderRadius: '50%',
          background: '#EEF2FF',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        <i className="fas fa-envelope-open-text" style={{ color: '#4F46E5', fontSize: '2rem' }} />
      </Box>

      <Typography
        sx={{
          fontFamily: 'Poppins, sans-serif',
          fontWeight: 700,
          fontSize: '1.3rem',
          color: '#1F2937',
          mb: 1,
        }}
      >
        Check your inbox
      </Typography>
      <Typography
        sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7280', mb: 0.5 }}
      >
        We've sent a verification link to
      </Typography>
      {(user?.email || registeredEmail) && (
        <Typography
          sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, color: '#1F2937', mb: 2 }}
        >
          {user?.email || registeredEmail}
        </Typography>
      )}
      <Typography
        sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: '#6B7280', mb: 3 }}
      >
        Click the link in the email to verify your account. The link expires in 24 hours.
      </Typography>

      {/* Alert banners */}
      {resendSuccess && (
        <SuccessBanner message="A new verification link has been sent!" />
      )}
      {errorMsg && !resendSuccess && <ErrorBanner message={errorMsg} />}

      {/* Resend email button */}
      {isAuthenticated && (
        <Box
          component="button"
          onClick={handleResend}
          disabled={resendLoading || resendSuccess}
          sx={{
            width: '100%',
            background: 'transparent',
            color: '#4F46E5',
            border: '1px solid #4F46E5',
            padding: '0.6875rem 1.5rem',
            borderRadius: '0.5rem',
            fontWeight: 600,
            cursor: resendLoading || resendSuccess ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            mb: 1.5,
            opacity: resendLoading || resendSuccess ? 0.6 : 1,
            transition: 'background 0.15s',
            '&:hover': { background: '#EEF2FF' },
          }}
        >
          <i className={resendLoading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'} />
          {resendLoading ? 'Sending…' : "Didn't get it? Resend email"}
        </Box>
      )}

      {/* Change email section */}
      {isAuthenticated && !resendSuccess && (
        <Box sx={{ mb: 2 }}>
          <Box
            component="button"
            onClick={() => {
              setShowChangeEmail((v) => !v);
              setChangeEmailError('');
            }}
            sx={{
              background: 'none',
              border: 'none',
              color: '#6B7280',
              cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
              fontSize: '0.8125rem',
              textDecoration: 'underline',
              p: 0,
              '&:hover': { color: '#4F46E5' },
            }}
          >
            {showChangeEmail ? 'Cancel' : 'Wrong email? Change it'}
          </Box>

          {showChangeEmail && (
            <Box sx={{ mt: 1.5, textAlign: 'left' }}>
              <Typography
                component="label"
                sx={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#374151',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                New email address
              </Typography>
              <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                <Box
                  component="input"
                  type="email"
                  value={newEmail}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setNewEmail(e.target.value);
                    setChangeEmailError('');
                  }}
                  placeholder="new@email.com"
                  sx={{
                    flex: 1,
                    padding: '0.625rem 0.875rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #D1D5DB',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    color: '#1F2937',
                    outline: 'none',
                    '&:focus': {
                      borderColor: '#4F46E5',
                      boxShadow: '0 0 0 3px rgba(79,70,229,0.1)',
                    },
                  }}
                />
                <Box
                  component="button"
                  onClick={handleChangeEmail}
                  disabled={changeEmailLoading}
                  sx={{
                    background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                    color: '#fff',
                    border: 'none',
                    padding: '0.625rem 1rem',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    cursor: changeEmailLoading ? 'not-allowed' : 'pointer',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    opacity: changeEmailLoading ? 0.7 : 1,
                  }}
                >
                  {changeEmailLoading ? (
                    <i className="fas fa-spinner fa-spin" />
                  ) : (
                    'Update'
                  )}
                </Box>
              </Box>
              {changeEmailError && (
                <Typography
                  sx={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.75rem',
                    color: '#EF4444',
                    mt: 0.5,
                  }}
                >
                  {changeEmailError}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Continue to app */}
      <GradientBtn
        onClick={handleContinue}
        icon="fas fa-arrow-right"
        label="Continue to app"
        mb={2}
      />

      {/* Start over — logs out and goes to register */}
      <Typography
        sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: '#6B7280' }}
      >
        Wrong account?{' '}
        <Box
          component="button"
          onClick={handleStartOver}
          sx={{
            background: 'none',
            border: 'none',
            color: '#4F46E5',
            cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
            fontSize: '0.8125rem',
            fontWeight: 600,
            p: 0,
            textDecoration: 'underline',
            '&:hover': { color: '#4338CA' },
          }}
        >
          Start over
        </Box>
      </Typography>
    </Wrapper>
  );
};

export default VerifyEmail;
