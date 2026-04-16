import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  InputAdornment,
  IconButton,
  Alert,
  Link,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Field-level errors
  const [pwError, setPwError] = useState('');
  const [confirmError, setConfirmError] = useState('');

  const validatePassword = (val: string) => {
    if (val.length < 6) return 'Password must be at least 6 characters';
    if (val.length > 128) return 'Password must be 128 characters or fewer';
    return '';
  };

  const validateConfirm = (val: string, pw = password) => {
    if (val !== pw) return 'Passwords do not match';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const pwErr = validatePassword(password);
    const confErr = validateConfirm(confirmPassword);
    setPwError(pwErr);
    setConfirmError(confErr);
    if (pwErr || confErr) return;

    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Password reset failed - check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const Logo = () => (
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
  );

  // No token in URL
  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #4F46E510, #10B98110)', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
        <Box sx={{ width: '100%', maxWidth: 440 }}>
          <Logo />
          <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 3, textAlign: 'center' }}>
              <ErrorOutlineIcon sx={{ fontSize: 52, color: '#EF4444', mb: 1.5 }} />
              <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize="1.2rem" mb={1}>
                Invalid reset link
              </Typography>
              <Typography color="text.secondary" variant="body2" mb={3}>
                This password reset link is missing or invalid. Please request a new one.
              </Typography>
              <Button component={RouterLink} to="/forgot-password" variant="contained" fullWidth sx={{ mb: 1.5, py: 1.25 }}>
                Request new reset link
              </Button>
              <Link component={RouterLink} to="/login" color="text.secondary" variant="body2" underline="hover" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <ArrowBackIcon fontSize="small" /> Back to sign in
              </Link>
            </CardContent>
          </Card>
        </Box>
      </Box>
    );
  }

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
        <Logo />

        <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 3 }}>
            {!success ? (
              <>
                <Typography fontFamily="Poppins, sans-serif" fontWeight={600} fontSize="1.25rem" mb={0.5}>
                  Set a new password
                </Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>
                  Choose a strong password for your account.
                </Typography>

                {error && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 1.5 }}>
                    {error}
                    {error.toLowerCase().includes('expired') && (
                      <>
                        {' '}
                        <Link component={RouterLink} to="/forgot-password" underline="hover" fontWeight={600}>
                          Request a new link
                        </Link>
                      </>
                    )}
                  </Alert>
                )}

                <Box component="form" onSubmit={handleSubmit}>
                  <TextField
                    fullWidth
                    label="New password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (pwError) setPwError(validatePassword(e.target.value));
                      if (confirmError) setConfirmError(validateConfirm(confirmPassword, e.target.value));
                    }}
                    onBlur={() => setPwError(validatePassword(password))}
                    error={!!pwError}
                    helperText={pwError || 'Minimum 6 characters'}
                    required
                    autoFocus
                    sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPassword(!showPassword)}>
                            {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Confirm new password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (confirmError) setConfirmError(validateConfirm(e.target.value));
                    }}
                    onBlur={() => setConfirmError(validateConfirm(confirmPassword))}
                    error={!!confirmError}
                    helperText={confirmError}
                    required
                    sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowConfirm(!showConfirm)}>
                            {showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
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
                    {loading ? 'Saving...' : 'Set new password'}
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
              /* Success */
              <Box sx={{ textAlign: 'center', py: 1 }}>
                <CheckCircleIcon sx={{ fontSize: 56, color: '#10B981', mb: 2 }} />
                <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize="1.25rem" mb={1}>
                  Password updated!
                </Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>
                  Your password has been changed successfully. Sign in with your new password.
                </Typography>
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="contained"
                  fullWidth
                  size="large"
                  sx={{ py: 1.25 }}
                >
                  Sign in now
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default ResetPassword;
