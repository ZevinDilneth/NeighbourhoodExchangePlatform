import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Avatar, CircularProgress, Snackbar, Alert,
} from '@mui/material';
import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  videoIntro?: string;
  isVideoVerified?: boolean;
  isVerified?: boolean;
  role: string;
  isActive: boolean;
  createdAt: string;
}

const Admin: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; severity: 'success' | 'error' } | null>(null);

  // Redirect non-admins
  useEffect(() => {
    if (user && (user as unknown as { role?: string }).role !== 'admin') {
      navigate('/feed', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const t = setTimeout(() => search(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const { data } = await api.get<{ users: AdminUser[] }>(`/admin/users?q=${encodeURIComponent(q)}`);
      setUsers(data.users);
    } catch {
      setToast({ msg: 'Failed to load users', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleVideoVerified = async (u: AdminUser) => {
    setToggling(u._id);
    const newVal = !(u.isVideoVerified || !!u.videoIntro);
    try {
      await api.patch(`/admin/users/${u._id}/video-verified`, { verified: newVal });
      setUsers(prev =>
        prev.map(x => x._id === u._id ? { ...x, isVideoVerified: newVal } : x),
      );
      setToast({
        msg: `${u.name} video verification ${newVal ? 'granted' : 'revoked'}`,
        severity: 'success',
      });
    } catch {
      setToast({ msg: 'Update failed', severity: 'error' });
    } finally {
      setToggling(null);
    }
  };

  return (
    <Layout hideSidebar>
      <Box sx={{ maxWidth: 720, mx: 'auto', py: 2 }}>

        {/* Header */}
        <Box sx={{
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem',
          p: '1.5rem', mb: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1.25rem' }}>
            <Box sx={{
              width: 40, height: 40, borderRadius: '0.5rem', background: GRAD,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '1rem',
            }}>
              <i className="fas fa-shield-alt" />
            </Box>
            <Box>
              <Typography sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '1.1rem', color: '#1F2937' }}>
                Admin Panel
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#6B7280' }}>
                Manage user verification status
              </Typography>
            </Box>
          </Box>

          {/* Search */}
          <Box sx={{ position: 'relative' }}>
            <Box sx={{
              position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)',
              color: '#9CA3AF', fontSize: '0.875rem', pointerEvents: 'none',
            }}>
              <i className="fas fa-search" />
            </Box>
            <Box
              component="input"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              sx={{
                width: '100%', boxSizing: 'border-box',
                pl: '2.25rem', pr: '1rem', py: '0.625rem',
                border: '1.5px solid #E5E7EB', borderRadius: '0.5rem',
                fontSize: '0.875rem', fontFamily: 'Inter,sans-serif', color: '#1F2937',
                outline: 'none', background: '#F9FAFB',
                '&:focus': { borderColor: '#4F46E5', background: '#FFF', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
              }}
            />
          </Box>
        </Box>

        {/* Results */}
        <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {loading ? (
            <Box sx={{ py: 5, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={28} sx={{ color: '#4F46E5' }} />
            </Box>
          ) : users.length === 0 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <i className="fas fa-users" style={{ fontSize: '1.5rem', color: '#D1D5DB', display: 'block', marginBottom: 8 }} />
              <Typography fontSize="0.875rem" color="text.secondary">
                {query ? 'No users found' : 'Search for a user above'}
              </Typography>
            </Box>
          ) : (
            users.map((u, i) => {
              const videoVerified = u.isVideoVerified || !!u.videoIntro;
              const isLast = i === users.length - 1;
              return (
                <Box
                  key={u._id}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    px: '1.25rem', py: '0.875rem',
                    borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
                  }}
                >
                  {/* Avatar */}
                  <Avatar src={u.avatar} sx={{ width: 40, height: 40, flexShrink: 0, fontSize: '0.9rem', fontWeight: 700 }}>
                    {u.name[0]?.toUpperCase()}
                  </Avatar>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }} noWrap>
                        {u.name}
                      </Typography>
                      {u.role !== 'user' && (
                        <Box sx={{ fontSize: '0.65rem', fontWeight: 700, px: '0.5rem', py: '0.1rem', borderRadius: 8,
                          background: u.role === 'admin' ? '#EEF2FF' : '#F0FDF4',
                          color: u.role === 'admin' ? '#4F46E5' : '#16A34A',
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {u.role}
                        </Box>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6B7280' }} noWrap>{u.email}</Typography>
                  </Box>

                  {/* Video badge */}
                  <Box sx={{
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                    fontSize: '0.75rem', fontWeight: 600,
                    color: videoVerified ? '#10B981' : '#9CA3AF',
                    flexShrink: 0,
                    mr: '0.5rem',
                  }}>
                    <i className={`fas fa-${videoVerified ? 'video' : 'video-slash'}`} />
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                      {videoVerified ? 'Video Verified' : 'No Video'}
                    </Box>
                  </Box>

                  {/* Toggle button */}
                  <Box
                    component="button"
                    onClick={() => toggleVideoVerified(u)}
                    disabled={toggling === u._id}
                    sx={{
                      flexShrink: 0,
                      px: '0.875rem', py: '0.375rem',
                      border: '1.5px solid',
                      borderColor: videoVerified ? '#FCA5A5' : '#4F46E5',
                      borderRadius: '0.375rem',
                      background: videoVerified ? '#FEF2F2' : '#EEF2FF',
                      color: videoVerified ? '#EF4444' : '#4F46E5',
                      fontSize: '0.78rem', fontWeight: 600,
                      cursor: toggling === u._id ? 'not-allowed' : 'pointer',
                      fontFamily: 'Inter,sans-serif',
                      display: 'flex', alignItems: 'center', gap: '0.375rem',
                      opacity: toggling === u._id ? 0.6 : 1,
                      transition: 'all 0.15s',
                      '&:hover': toggling !== u._id ? { opacity: 0.8 } : {},
                    }}
                  >
                    {toggling === u._id
                      ? <CircularProgress size={12} sx={{ color: 'inherit' }} />
                      : <i className={`fas fa-${videoVerified ? 'times' : 'check'}`} />
                    }
                    {videoVerified ? 'Revoke' : 'Grant'}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>

      </Box>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast(null)} severity={toast?.severity} sx={{ borderRadius: '0.5rem' }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Layout>
  );
};

export default Admin;
