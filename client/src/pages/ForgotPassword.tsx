import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  Alert,
  Link,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [devLink, setDevLink] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email address is required — enter the email linked to your account.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address (e.g. name@example.com).'); return; }

    setLoading(true);
    try {
      const res = await api.post<{ message: string; devResetLink?: string }>(
        '/auth/forgot-password',
        { email: email.trim() }
      );
      if (res.data.devResetLink) setDevLink(res.data.devResetLink);
      setSent(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Reset email not sent — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #4F46E510, #10B98110)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, #4F46E5, #10B981)',
              width: 56,
              height: 56,
              borderRadius: 2,
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

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            {!sent ? (
              <>
                <Typography fontFamily="Poppins, sans-serif" fontWeight={600} fontSize="1.25rem" mb={0.5}>
                  Forgot your password?
                </Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>
                  No worries! Enter your email and we'll send you a reset link.
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                    {error}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="Email address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    sx={{ mb: 2.5 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={loading}
                    sx={{ mb: 2, py: 1.25 }}
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </Button>

                  <Box sx={{ textAlign: 'center' }}>
                    <Link
                      component={RouterLink}
                      to="/login"
                      color="text.secondary"
                      variant="body2"
                      underline="hover"
                      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                      <ArrowBackIcon fontSize="small" />
                      Back to sign in
                    </Link>
                  </Box>
                </Box>
              </>
            ) : (
              /* Success state */
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <MarkEmailReadIcon sx={{ fontSize: 56, color: '#10B981', mb: 2 }} />
                <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize="1.25rem" mb={1}>
                  Check your inbox
                </Typography>
                <Typography color="text.secondary" variant="body2" mb={0.5}>
                  If an account exists for
                </Typography>
                <Typography fontWeight={600} color="text.primary" mb={2}>
                  {email}
                </Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>
                  you'll receive a password reset link shortly. The link expires in 1 hour.
                </Typography>


                <Alert severity="info" sx={{ mb: 3, borderRadius: 1.5, textAlign: 'left' }}>
                  Don't see it? Check your spam folder or{' '}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={() => { setSent(false); setEmail(''); setDevLink(null); }}
                    underline="hover"
                    sx={{ fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', p: 0 }}
                  >
                    try a different email
                  </Link>
                  .
                </Alert>

                <Link
                  component={RouterLink}
                  to="/login"
                  color="text.secondary"
                  variant="body2"
                  underline="hover"
                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                >
                  <ArrowBackIcon fontSize="small" />
                  Back to sign in
                </Link>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ForgotPassword;
