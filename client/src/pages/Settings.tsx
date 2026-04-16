import React, { useState, useEffect } from 'react';
import {
  Box, Snackbar, Alert, Skeleton, CircularProgress, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, InputAdornment,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Layout from '../components/layout/Layout';
import PhoneInput, { COUNTRIES, findCountry } from '../components/PhoneInput';
import OnlineAvatar from '../components/OnlineAvatar';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface NotificationPrefs {
  exchangeRequests: boolean;
  messages: boolean;
  groupActivity: boolean;
  newFollowers: boolean;
  marketingEmails: boolean;
  newsletter: boolean;
}

interface PrivacyPrefs {
  profileVisibility: 'public' | 'community' | 'private';
  showOnlineStatus: boolean;
  allowExchangeRequests: boolean;
}

interface BlockedUser {
  _id: string;
  name: string;
  avatar?: string;
  email: string;
}

interface SettingsData {
  notifications: NotificationPrefs;
  preferences: PrivacyPrefs;
  blockedUsers: BlockedUser[];
  suspendedUntil: string | null;
}

// ─── Location constants ──────────────────────────────────────────────────────
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;
const LETTERS_SPACES = /^[a-zA-Z\u00C0-\u024F\s\-'\.]+$/;
const ALPHANUMERIC   = /^[a-zA-Z0-9\s\-]+$/;
const locationValidators: Record<string, (v: string) => string> = {
  city:          (v) => (!v ? '' : !LETTERS_SPACES.test(v) ? 'Letters only' : v.length > 100 ? 'Max 100 chars' : ''),
  neighbourhood: (v) => (!v ? '' : !LETTERS_SPACES.test(v) ? 'Letters only' : v.length > 100 ? 'Max 100 chars' : ''),
  postcode:      (v) => (!v ? '' : v.trim().length > 20 ? 'Max 20 chars' : !ALPHANUMERIC.test(v.trim()) ? 'Letters & numbers only' : ''),
  country:       (v) => (!v ? '' : !LETTERS_SPACES.test(v) ? 'Letters only' : v.length > 100 ? 'Max 100 chars' : ''),
  address:       (v) => (!v ? '' : v.length > 200 ? 'Max 200 chars' : ''),
};
const MAPBOX_TYPES: Record<string, string> = {
  city: 'place', country: 'country', postcode: 'postcode', neighbourhood: 'neighborhood',
};

// ─── Location field row ──────────────────────────────────────────────────────
const FieldRow: React.FC<{ children: React.ReactNode; cols?: 1 | 2 }> = ({ children, cols = 1 }) => (
  <Box sx={{ display: 'grid', gridTemplateColumns: cols === 2 ? { xs: '1fr', sm: '1fr 1fr' } : '1fr', gap: '1rem', mb: '1rem' }}>
    {children}
  </Box>
);

// ─── Design tokens ─────────────────────────────────────────────────────────
const GRAD = 'linear-gradient(135deg, #4F46E5, #10B981)';
const CARD: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '0.75rem',
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  overflow: 'hidden',
};

// ─── Reusable components ────────────────────────────────────────────────────

const SectionCard: React.FC<{
  icon: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, danger, children }) => (
  <Box sx={{ ...CARD, mb: '1.5rem' }}>
    <Box sx={{
      background: danger ? 'rgba(239,68,68,0.04)' : '#F9FAFB',
      borderBottom: '1px solid #E5E7EB',
      padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: '0.75rem',
    }}>
      <Box sx={{
        width: 40, height: 40, borderRadius: '0.5rem', flexShrink: 0,
        background: danger ? 'rgba(239,68,68,0.1)' : GRAD,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: danger ? '#EF4444' : '#FFFFFF', fontSize: '1rem',
      }}>
        <i className={`fas ${icon}`} />
      </Box>
      <Box>
        <Box sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '1rem',
          color: danger ? '#EF4444' : '#1F2937' }}>
          {title}
        </Box>
        {subtitle && (
          <Box sx={{ fontSize: '0.8rem', color: '#6B7280', mt: '0.125rem' }}>{subtitle}</Box>
        )}
      </Box>
    </Box>
    <Box sx={{ padding: '1.5rem' }}>{children}</Box>
  </Box>
);

const Toggle: React.FC<{
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, sublabel, checked, onChange }) => (
  <Box sx={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.875rem 0',
    borderBottom: '1px solid #F3F4F6',
    '&:last-child': { borderBottom: 'none' },
  }}>
    <Box>
      <Box sx={{ fontSize: '0.9rem', fontWeight: 500, color: '#1F2937' }}>{label}</Box>
      {sublabel && <Box sx={{ fontSize: '0.78rem', color: '#6B7280', mt: '0.125rem' }}>{sublabel}</Box>}
    </Box>
    <Box
      onClick={() => onChange(!checked)}
      sx={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: checked ? '#4F46E5' : '#D1D5DB',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s',
        '&::after': {
          content: '""',
          position: 'absolute',
          width: 18, height: 18,
          borderRadius: '50%',
          background: '#FFFFFF',
          top: 3,
          left: checked ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        },
      }}
    />
  </Box>
);

const InputField: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}> = ({ label, type = 'text', value, onChange, placeholder, error }) => (
  <Box sx={{ mb: '1rem' }}>
    <Box sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151',
      textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.375rem' }}>
      {label}
    </Box>
    <Box
      component="input"
      type={type}
      value={value}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{
        width: '100%', padding: '0.75rem 1rem',
        border: error ? '1px solid #EF4444' : '1px solid #E5E7EB',
        borderRadius: '0.5rem', fontSize: '0.875rem', color: '#1F2937',
        outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif',
        transition: 'border-color 0.2s',
        '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
        '&::placeholder': { color: '#9CA3AF' },
      }}
    />
    {error && <Box sx={{ fontSize: '0.78rem', color: '#EF4444', mt: '0.25rem' }}>{error}</Box>}
  </Box>
);

const PrimaryBtn: React.FC<{
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}> = ({ onClick, loading, children, danger, disabled }) => (
  <Box component="button" onClick={onClick} disabled={disabled || loading} sx={{
    background: danger ? '#EF4444' : GRAD,
    color: '#FFFFFF', border: 'none', borderRadius: '0.5rem',
    padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 600,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    opacity: disabled || loading ? 0.7 : 1,
    transition: 'all 0.2s', fontFamily: 'Inter,sans-serif',
    '&:hover': (!disabled && !loading) ? { opacity: 0.9, transform: 'translateY(-1px)' } : {},
  }}>
    {loading ? <i className="fas fa-spinner fa-spin" /> : null}
    {children}
  </Box>
);

const OutlineBtn: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
}> = ({ onClick, children }) => (
  <Box component="button" onClick={onClick} sx={{
    background: '#FFFFFF', color: '#4F46E5',
    border: '1px solid #E5E7EB', borderRadius: '0.5rem',
    padding: '0.75rem 1.5rem', fontSize: '0.875rem', fontWeight: 500,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
    transition: 'all 0.2s', fontFamily: 'Inter,sans-serif',
    '&:hover': { background: '#F3F4F6', borderColor: '#4F46E5' },
  }}>
    {children}
  </Box>
);

// ─── Verification code dialog ────────────────────────────────────────────────
const VerificationCodeDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  target: string;
  code: string;
  setCode: (v: string) => void;
  codeError: string;
  setCodeError: (v: string) => void;
  loading: boolean;
  onConfirm: () => void;
  devCode?: string | null;
  smsError?: string | null;
}> = ({ open, onClose, title, description, target, code, setCode, codeError, setCodeError, loading, onConfirm, devCode, smsError }) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
    PaperProps={{ sx: { borderRadius: '0.875rem', overflow: 'hidden' } }}>
    <DialogTitle sx={{ p: 0 }}>
      <Box sx={{
        background: GRAD, padding: '1.25rem 1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.875rem',
      }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '0.5rem',
          background: 'rgba(255,255,255,0.2)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '1.1rem', flexShrink: 0,
        }}>
          <i className="fas fa-shield-alt" />
        </Box>
        <Box sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 600, fontSize: '1rem', color: '#FFF' }}>
          {title}
        </Box>
      </Box>
    </DialogTitle>
    <DialogContent sx={{ padding: '1.5rem !important' }}>
      {smsError && (
        <Alert severity="error" sx={{ mb: '0.75rem', borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          <strong>Twilio Error:</strong> {smsError}
        </Alert>
      )}
      {smsError && (
        <Alert severity="warning" sx={{ mb: '1rem', borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
          I am too broke to pay for an OTP service
        </Alert>
      )}
      <Box sx={{ fontSize: '0.875rem', color: '#6B7280', mb: '1.25rem', lineHeight: 1.6 }}>
        {description}{' '}<strong style={{ color: '#1F2937' }}>{target}</strong>.
        <br />Enter the 6-digit code below to confirm.
      </Box>
      <TextField
        fullWidth
        size="small"
        label="6-digit code"
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setCodeError(''); }}
        error={!!codeError}
        helperText={codeError}
        inputProps={{ inputMode: 'numeric', maxLength: 6 }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
      />
    </DialogContent>
    <DialogActions sx={{ padding: '0.75rem 1.5rem 1.25rem', gap: '0.75rem' }}>
      <Box component="button" onClick={onClose} sx={{
        background: 'none', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
        padding: '0.625rem 1.25rem', fontSize: '0.875rem', fontWeight: 500,
        color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter,sans-serif',
        '&:hover': { background: '#F9FAFB' },
      }}>
        Cancel
      </Box>
      <PrimaryBtn onClick={onConfirm} loading={loading} disabled={code.length !== 6}>
        <i className="fas fa-check" /> Confirm Code
      </PrimaryBtn>
    </DialogActions>
  </Dialog>
);

// ─── Sidebar nav ────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'account',       icon: 'fa-user-circle',     label: 'Account' },
  { id: 'notifications', icon: 'fa-bell',             label: 'Notifications' },
  { id: 'privacy',       icon: 'fa-shield-alt',       label: 'Privacy' },
  { id: 'blocked',       icon: 'fa-ban',              label: 'Blocked Users' },
  { id: 'security',      icon: 'fa-lock',             label: 'Security' },
  { id: 'danger',        icon: 'fa-exclamation-triangle', label: 'Danger Zone' },
];

// ─── Main Settings component ─────────────────────────────────────────────────

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const qc = useQueryClient();

  const [section, setSection] = useState('account');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Fetch settings ──────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  // ── Local state mirrors ─────────────────────────────────────────────────
  const [notifs, setNotifs] = useState<NotificationPrefs>({
    exchangeRequests: true, messages: true, groupActivity: true,
    newFollowers: true, marketingEmails: false, newsletter: true,
  });
  const [prefs, setPrefs] = useState<PrivacyPrefs>({
    profileVisibility: 'public', showOnlineStatus: true, allowExchangeRequests: true,
  });

  // Location
  const [location, setLocation] = useState({ address: '', neighbourhood: '', city: '', postcode: '', country: '' });
  const [locErrors, setLocErrors]   = useState<Record<string, string>>({});
  const [locLoading, setLocLoading] = useState<Record<string, boolean>>({});
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError]     = useState('');
  const [locSaving, setLocSaving]   = useState(false);
  const [locSaved, setLocSaved]     = useState(false);

  // Email verification
  const [emailResending, setEmailResending] = useState(false);

  // Password change
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState<Record<string, string>>({});

  // Suspend
  const [suspendDays, setSuspendDays] = useState('7');

  // Delete account
  const [delPassword, setDelPassword] = useState('');
  const [delConfirm, setDelConfirm] = useState('');
  const [delErr, setDelErr] = useState('');

  // Block user search
  const [blockSearch, setBlockSearch] = useState('');
  const [blockResult, setBlockResult] = useState<BlockedUser | null>(null);
  const [blockErr, setBlockErr] = useState('');

  // Phone verification (initial — for unverified users)
  const [phoneVerifyStep, setPhoneVerifyStep] = useState<'idle' | 'sent' | 'done'>('idle');
  const [phoneCode, setPhoneCode]             = useState('');
  const [phoneCodeError, setPhoneCodeError]   = useState('');
  const [phoneSending, setPhoneSending]       = useState(false);
  const [phoneVerifying, setPhoneVerifying]   = useState(false);
  const [devPhoneCode, setDevPhoneCode]       = useState<string | null>(null);

  // IP-based country detection
  const [ipCountry, setIpCountry] = useState('US');

  // Phone change (for already-verified users)
  const [phoneChangeMode, setPhoneChangeMode]       = useState(false);
  const [newPhoneInput, setNewPhoneInput]           = useState('');
  const [newPhoneError, setNewPhoneError]           = useState('');
  const [phoneChangeSending, setPhoneChangeSending] = useState(false);
  // Phone change dialog
  const [showPhoneDialog, setShowPhoneDialog]       = useState(false);
  const [phoneDialogCode, setPhoneDialogCode]       = useState('');
  const [phoneDialogError, setPhoneDialogError]     = useState('');
  const [phoneDialogLoading, setPhoneDialogLoading] = useState(false);
  const [devPhoneChangeCode, setDevPhoneChangeCode] = useState<string | null>(null);
  const [phoneChangeSmsError, setPhoneChangeSmsError] = useState<string | null>(null);

  // Change email
  const [emailForm, setEmailForm]                   = useState({ newEmail: '', password: '' });
  const [emailErr, setEmailErr]                     = useState<Record<string, string>>({});
  const [emailRequestLoading, setEmailRequestLoading] = useState(false);
  // Email verify dialog
  const [showEmailDialog, setShowEmailDialog]       = useState(false);
  const [emailDialogCode, setEmailDialogCode]       = useState('');
  const [emailDialogError, setEmailDialogError]     = useState('');
  const [emailDialogLoading, setEmailDialogLoading] = useState(false);
  const [devEmailCode, setDevEmailCode]             = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setNotifs(settings.notifications);
      setPrefs(settings.preferences);
    }
  }, [settings]);

  useEffect(() => {
    if (user) {
      setLocation({
        address:       (user as unknown as { location?: { address?: string } }).location?.address       ?? '',
        neighbourhood: (user as unknown as { location?: { neighbourhood?: string } }).location?.neighbourhood ?? '',
        city:          (user as unknown as { location?: { city?: string } }).location?.city          ?? '',
        postcode:      (user as unknown as { location?: { postcode?: string } }).location?.postcode      ?? '',
        country:       (user as unknown as { location?: { country?: string } }).location?.country       ?? '',
      });
    }
  }, [user]);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((d: { country_code?: string }) => { if (d.country_code) setIpCountry(d.country_code); })
      .catch(() => {/* silently fall back to US */});
  }, []);

  const ok = (msg: string) => setToast({ msg, type: 'success' });
  const err = (msg: string) => setToast({ msg, type: 'error' });

  // ── Location helpers ─────────────────────────────────────────────────────
  const setLocField = (field: string, value: string) => {
    setLocation((prev) => ({ ...prev, [field]: value }));
    if (locErrors[field]) setLocErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateLocField = async (field: string, value: string) => {
    const fmtErr = locationValidators[field]?.(value) ?? '';
    if (fmtErr) { setLocErrors((prev) => ({ ...prev, [field]: fmtErr })); return; }
    const mbType = MAPBOX_TYPES[field];
    if (mbType && value.trim() && MAPBOX_TOKEN) {
      setLocLoading((prev) => ({ ...prev, [field]: true }));
      try {
        const res  = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value.trim())}.json?types=${mbType}&access_token=${MAPBOX_TOKEN}&limit=1`);
        if (res.ok) {
          const data = await res.json();
          setLocErrors((prev) => ({ ...prev, [field]: data.features?.length === 0 ? `"${value.trim()}" doesn't look like a valid ${field}` : '' }));
        }
      } catch { /* fail silently */ }
      finally { setLocLoading((prev) => ({ ...prev, [field]: false })); }
    } else {
      setLocErrors((prev) => ({ ...prev, [field]: fmtErr }));
    }
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
    setGeoLoading(true); setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const res  = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&language=en`);
          if (!res.ok) throw new Error();
          const data = await res.json();
          if (data.status === 'OK' && data.results?.length > 0) {
            type GComp = { types: string[]; long_name: string };
            const get = (type: string): string => {
              for (const result of data.results as { address_components: GComp[] }[]) {
                const comp = result.address_components.find((c) => c.types.includes(type));
                if (comp) return comp.long_name;
              }
              return '';
            };
            setLocation({
              address:       [get('street_number'), get('route')].filter(Boolean).join(' '),
              neighbourhood: get('neighborhood') || get('sublocality_level_1') || get('sublocality'),
              city:          get('locality') || get('postal_town') || get('administrative_area_level_2'),
              postcode:      get('postal_code'),
              country:       get('country'),
            });
            setLocErrors({});
          } else {
            setGeoError('No address found. Please fill in manually.');
          }
        } catch { setGeoError('Could not look up your address. Enter manually.'); }
        finally { setGeoLoading(false); }
      },
      () => { setGeoLoading(false); setGeoError('Location denied. Enter manually.'); },
      { timeout: 10000 }
    );
  };

  const handleResendVerification = async () => {
    setEmailResending(true);
    try {
      await api.post('/auth/resend-verification');
      ok('Verification email sent — check your inbox');
    } catch {
      err('Could not send verification email. Try again later.');
    } finally {
      setEmailResending(false);
    }
  };

  const handleSaveLocation = async () => {
    if (Object.values(locErrors).some(Boolean)) { err('Fix location errors before saving.'); return; }
    if (Object.values(locLoading).some(Boolean)) { err('Still verifying location — please wait.'); return; }
    setLocSaving(true);
    try {
      const { data: updated } = await api.put('/users/me', {
        location: {
          type: 'Point',
          coordinates: (user as unknown as { location?: { coordinates?: number[] } }).location?.coordinates ?? [0, 0],
          address:       location.address.trim(),
          neighbourhood: location.neighbourhood.trim(),
          city:          location.city.trim(),
          postcode:      location.postcode.trim(),
          country:       location.country.trim(),
        },
      });
      updateUser(updated);
      setLocSaved(true);
      ok('Location saved');
      setTimeout(() => setLocSaved(false), 3000);
    } catch { err('Failed to save location'); }
    finally { setLocSaving(false); }
  };

  // ── Mutations ───────────────────────────────────────────────────────────
  const saveNotifs = useMutation({
    mutationFn: () => api.put('/settings/notifications', notifs),
    onSuccess: () => ok('Notification preferences saved'),
    onError: () => err('Failed to save notifications'),
  });

  const savePrefs = useMutation({
    mutationFn: () => api.put('/settings/preferences', prefs),
    onSuccess: () => ok('Privacy settings saved'),
    onError: () => err('Failed to save privacy settings'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: () =>
      api.put('/settings/password', { currentPassword: pwForm.current, newPassword: pwForm.next }),
    onSuccess: () => {
      ok('Password changed successfully');
      setPwForm({ current: '', next: '', confirm: '' });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      err(msg || 'Failed to change password');
    },
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/settings/block/${userId}`),
    onSuccess: () => { ok('User unblocked'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => err('Failed to unblock user'),
  });

  const blockMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/settings/block/${userId}`),
    onSuccess: () => {
      ok('User blocked');
      setBlockResult(null);
      setBlockSearch('');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => err('Failed to block user'),
  });

  const suspendMutation = useMutation({
    mutationFn: () => api.post('/settings/suspend', { duration: Number(suspendDays) }),
    onSuccess: (res) => {
      ok(res.data.message);
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      err(msg || 'Failed to suspend account');
    },
  });

  const cancelSuspensionMutation = useMutation({
    mutationFn: () => api.delete('/settings/suspend'),
    onSuccess: () => { ok('Suspension cancelled'); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: () => err('Failed to cancel suspension'),
  });

  const deleteAccountMutation = useMutation({
    mutationFn: () => api.delete('/settings/account', { data: { password: delPassword, confirmation: delConfirm } }),
    onSuccess: () => {
      ok('Account deleted');
      setTimeout(() => { logout(); navigate('/'); }, 1500);
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setDelErr(msg || 'Failed to delete account');
    },
  });

  // ── Password validation ─────────────────────────────────────────────────
  const handleChangePassword = () => {
    const errs: Record<string, string> = {};
    if (!pwForm.current) errs.current = 'Required';
    if (!pwForm.next || pwForm.next.length < 6) errs.next = 'At least 6 characters';
    if (pwForm.next !== pwForm.confirm) errs.confirm = 'Passwords do not match';
    setPwErr(errs);
    if (Object.keys(errs).length === 0) changePasswordMutation.mutate();
  };

  // ── Phone verification ──────────────────────────────────────────────────
  const handleSendPhoneCode = async () => {
    setPhoneSending(true);
    setPhoneCodeError('');
    setDevPhoneCode(null);
    try {
      const { data } = await api.post<{ message: string; devCode?: string }>('/phone/send-code');
      setPhoneVerifyStep('sent');
      if (data.devCode) setDevPhoneCode(data.devCode);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPhoneCodeError(msg || 'Failed to send code. Please try again.');
    } finally {
      setPhoneSending(false);
    }
  };

  const handleVerifyPhoneCode = async () => {
    if (!phoneCode || phoneCode.length !== 6) {
      setPhoneCodeError('Enter the 6-digit code you received.');
      return;
    }
    setPhoneVerifying(true);
    setPhoneCodeError('');
    try {
      await api.post('/phone/verify', { code: phoneCode });
      setPhoneVerifyStep('done');
      updateUser({ isPhoneVerified: true } as Record<string, unknown>);
      ok('Phone number verified successfully!');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPhoneCodeError(msg || 'Incorrect code. Please try again.');
    } finally {
      setPhoneVerifying(false);
    }
  };

  // ── Add phone number (no phone on file) ────────────────────────────────
  const handleAddPhone = async () => {
    const cleaned = newPhoneInput.trim().replace(/\s/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      setNewPhoneError('Use international format, e.g. +447911123456');
      return;
    }
    setPhoneChangeSending(true);
    setNewPhoneError('');
    try {
      await api.put('/phone/number', { phone: cleaned });
      updateUser({ phone: cleaned, isPhoneVerified: false } as Record<string, unknown>);
      const { data: sendData } = await api.post<{ message: string; devCode?: string }>('/phone/send-code');
      if (sendData.devCode) setDevPhoneCode(sendData.devCode);
      setPhoneVerifyStep('sent');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNewPhoneError(msg || 'Failed to save phone number. Please try again.');
    } finally {
      setPhoneChangeSending(false);
    }
  };

  // ── Phone change — saves as pending, sends OTP to new number ──────────
  const handleChangePhoneNumber = async () => {
    const cleaned = newPhoneInput.trim().replace(/\s/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      setNewPhoneError('Use international format, e.g. +447911123456');
      return;
    }
    setPhoneChangeSending(true);
    setNewPhoneError('');
    setDevPhoneChangeCode(null);
    setPhoneChangeSmsError(null);
    try {
      // Store as pendingPhone — current phone stays active until new one is verified
      const { data: changeData } = await api.post<{ message: string; devCode?: string; smsError?: string }>('/phone/change-request', { phone: cleaned });
      if (changeData.devCode) setDevPhoneChangeCode(changeData.devCode);
      if (changeData.smsError) setPhoneChangeSmsError(changeData.smsError);
      setPhoneDialogCode('');
      setPhoneDialogError('');
      setShowPhoneDialog(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setNewPhoneError(msg || 'Failed to send verification code. Please try again.');
    } finally {
      setPhoneChangeSending(false);
    }
  };

  const handleConfirmPhoneChange = async () => {
    if (phoneDialogCode.length !== 6) { setPhoneDialogError('Enter the 6-digit code.'); return; }
    setPhoneDialogLoading(true);
    setPhoneDialogError('');
    try {
      const { data } = await api.post<{ phone?: string }>('/phone/verify', { code: phoneDialogCode });
      // server returns the promoted phone; update context with new number + verified status
      updateUser({ phone: data.phone ?? newPhoneInput, isPhoneVerified: true } as Record<string, unknown>);
      setShowPhoneDialog(false);
      setPhoneChangeMode(false);
      setNewPhoneInput('');
      ok('Phone number changed and verified!');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setPhoneDialogError(msg || 'Incorrect code. Please try again.');
    } finally {
      setPhoneDialogLoading(false);
    }
  };

  const handleClosePhoneDialog = () => {
    setShowPhoneDialog(false);
    setPhoneDialogCode('');
    setPhoneDialogError('');
    setPhoneChangeMode(false);
  };

  // ── Change email (two-step: request code → verify code) ─────────────────
  const handleRequestEmailChange = async () => {
    const errs: Record<string, string> = {};
    if (!emailForm.newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail))
      errs.newEmail = 'Enter a valid email address';
    if (!emailForm.password) errs.password = 'Required';
    setEmailErr(errs);
    if (Object.keys(errs).length) return;

    setEmailRequestLoading(true);
    setDevEmailCode(null);
    try {
      const { data } = await api.post<{ message: string; devCode?: string }>(
        '/settings/email/request',
        { newEmail: emailForm.newEmail, password: emailForm.password },
      );
      if (data.devCode) setDevEmailCode(data.devCode);
      setEmailDialogCode('');
      setEmailDialogError('');
      setShowEmailDialog(true);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      err(msg || 'Failed to send verification code. Please try again.');
    } finally {
      setEmailRequestLoading(false);
    }
  };

  const handleConfirmEmailChange = async () => {
    if (emailDialogCode.length !== 6) { setEmailDialogError('Enter the 6-digit code.'); return; }
    setEmailDialogLoading(true);
    setEmailDialogError('');
    try {
      const { data } = await api.post<{ message: string; email: string }>(
        '/settings/email/verify',
        { code: emailDialogCode },
      );
      updateUser({ email: data.email } as Record<string, unknown>);
      setShowEmailDialog(false);
      setEmailForm({ newEmail: '', password: '' });
      setEmailErr({});
      setDevEmailCode(null);
      ok('Email address updated successfully!');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setEmailDialogError(msg || 'Incorrect code. Please try again.');
    } finally {
      setEmailDialogLoading(false);
    }
  };

  // ── Block user search ───────────────────────────────────────────────────
  const handleSearchBlock = async () => {
    setBlockErr('');
    setBlockResult(null);
    if (!blockSearch.trim()) return;
    try {
      const res = await api.get(`/users?search=${encodeURIComponent(blockSearch)}&limit=1`);
      const users = res.data.users || [];
      if (!users.length) setBlockErr('No user found with that name or email');
      else setBlockResult(users[0]);
    } catch {
      setBlockErr('Search failed');
    }
  };

  // ── Suspension label ────────────────────────────────────────────────────
  const isSuspended = settings?.suspendedUntil && new Date(settings.suspendedUntil) > new Date();
  const suspendLabel = isSuspended
    ? `Suspended until ${new Date(settings!.suspendedUntil!).toLocaleDateString()}`
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {/* ── Page Header ── */}
      <Box sx={{ mb: '2rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Box sx={{
            width: 48, height: 48, borderRadius: '0.75rem',
            background: GRAD, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#FFF', fontSize: '1.25rem', flexShrink: 0,
          }}>
            <i className="fas fa-cog" />
          </Box>
          <Box>
            <Box sx={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, fontSize: '2rem',
              color: '#1F2937', lineHeight: 1.2 }}>
              Settings
            </Box>
            <Box sx={{ color: '#6B7280', fontSize: '1rem', mt: '0.25rem' }}>
              Manage your account, privacy, and preferences
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, gap: '1.5rem', alignItems: 'start' }}>

        {/* ── Left nav ── */}
        <Box sx={{
          background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
          position: { md: 'sticky' }, top: { md: '80px' },
        }}>
          <Box sx={{ padding: '1rem 0.75rem', background: '#F9FAFB',
            borderBottom: '1px solid #E5E7EB', fontSize: '0.7rem', fontWeight: 700,
            color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em',
            paddingLeft: '1rem' }}>
            Settings Menu
          </Box>
          {NAV_ITEMS.map((item) => {
            const active = section === item.id;
            const isDanger = item.id === 'danger';
            return (
              <Box key={item.id} onClick={() => setSection(item.id)} sx={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.85rem 1rem',
                background: active ? (isDanger ? 'rgba(239,68,68,0.06)' : 'rgba(79,70,229,0.07)') : 'transparent',
                borderLeft: active ? `3px solid ${isDanger ? '#EF4444' : '#4F46E5'}` : '3px solid transparent',
                color: active ? (isDanger ? '#EF4444' : '#4F46E5') : (isDanger ? '#EF4444' : '#374151'),
                fontWeight: active ? 600 : 400,
                fontSize: '0.875rem', cursor: 'pointer',
                transition: 'all 0.15s',
                borderBottom: '1px solid #F3F4F6',
                '&:last-child': { borderBottom: 'none' },
                '&:hover': { background: isDanger ? 'rgba(239,68,68,0.05)' : '#F9FAFB' },
              }}>
                <i className={`fas ${item.icon}`} style={{ width: 16, textAlign: 'center',
                  color: active ? (isDanger ? '#EF4444' : '#4F46E5') : (isDanger ? '#EF4444' : '#6B7280') }} />
                {item.label}
              </Box>
            );
          })}
        </Box>

        {/* ── Main content ── */}
        <Box>
          {isLoading ? (
            <Box>
              {[1, 2].map((i) => (
                <Skeleton key={i} variant="rounded" height={200} sx={{ mb: 2, borderRadius: '0.75rem' }} />
              ))}
            </Box>
          ) : (
            <>
              {/* ══════════════════════════════════════ ACCOUNT */}
              {section === 'account' && (
                <>
                  {/* Profile info card */}
                  <SectionCard icon="fa-user-circle" title="Account Info" subtitle="Your basic account details">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.5rem',
                      padding: '1rem', background: '#F9FAFB', borderRadius: '0.5rem' }}>
                      <OnlineAvatar userId={user?._id ?? ''} src={user?.avatar} isVerified={user?.isVerified} sx={{ width: 56, height: 56, fontWeight: 700,
                        background: GRAD, fontSize: '1.25rem' }}>
                        {user?.name?.[0]}
                      </OnlineAvatar>
                      <Box>
                        <Box sx={{ fontWeight: 700, fontSize: '1rem', color: '#1F2937' }}>{user?.name}</Box>
                        <Box sx={{ fontSize: '0.875rem', color: '#6B7280', mt: '0.125rem' }}>{user?.email}</Box>
                        <Box sx={{ mt: '0.375rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                          padding: '0.25rem 0.625rem', background: GRAD,
                          color: '#FFF', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600 }}>
                          <i className="fas fa-coins" />
                          {(user?.ceuBalance ?? 0).toLocaleString()} CEU
                        </Box>
                      </Box>
                    </Box>
                    <OutlineBtn onClick={() => navigate('/profile/edit')}>
                      <i className="fas fa-edit" /> Edit Profile
                    </OutlineBtn>
                  </SectionCard>

                  {/* Location */}
                  <SectionCard icon="fa-map-marker-alt" title="Location" subtitle="Helps connect you with nearby neighbours — all optional">
                    <Button fullWidth variant="outlined" onClick={handleGeolocate} disabled={geoLoading}
                      sx={{ mb: geoError ? '0.875rem' : '1.25rem', py: '0.625rem', borderRadius: '0.5rem', borderColor: '#E5E7EB', color: '#374151', textTransform: 'none', fontWeight: 500, '&:hover': { borderColor: '#4F46E5', color: '#4F46E5', background: '#F5F3FF' } }}>
                      {geoLoading
                        ? <><CircularProgress size={14} sx={{ mr: '0.5rem', color: '#6B7280' }} />Detecting location…</>
                        : <><i className="fas fa-location-arrow" style={{ marginRight: '0.5rem', fontSize: '0.875rem' }} />Use my current location</>}
                    </Button>
                    {geoError && <Alert severity="warning" sx={{ mb: '1.25rem', borderRadius: '0.5rem' }}>{geoError}</Alert>}
                    <FieldRow>
                      <TextField fullWidth label="Street address" placeholder="e.g. 42 Baker Street"
                        value={location.address}
                        onChange={(e) => setLocField('address', e.target.value)}
                        onBlur={() => validateLocField('address', location.address)}
                        error={!!locErrors.address} helperText={locErrors.address}
                        InputProps={{ startAdornment: <InputAdornment position="start"><i className="fas fa-home" style={{ color: '#9CA3AF', fontSize: '0.875rem' }} /></InputAdornment> }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                      />
                    </FieldRow>
                    <FieldRow cols={2}>
                      <TextField fullWidth label="Neighbourhood / Area" placeholder="e.g. Shoreditch"
                        value={location.neighbourhood}
                        onChange={(e) => setLocField('neighbourhood', e.target.value)}
                        onBlur={() => validateLocField('neighbourhood', location.neighbourhood)}
                        error={!locLoading.neighbourhood && !!locErrors.neighbourhood}
                        helperText={locLoading.neighbourhood ? '⏳ Checking…' : locErrors.neighbourhood}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                      />
                      <TextField fullWidth label="City / Town" placeholder="e.g. London"
                        value={location.city}
                        onChange={(e) => setLocField('city', e.target.value)}
                        onBlur={() => validateLocField('city', location.city)}
                        error={!locLoading.city && !!locErrors.city}
                        helperText={locLoading.city ? '⏳ Checking…' : locErrors.city}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                      />
                    </FieldRow>
                    <FieldRow cols={2}>
                      <TextField fullWidth label="Postcode / ZIP" placeholder="e.g. EC1A 1BB"
                        value={location.postcode}
                        onChange={(e) => setLocField('postcode', e.target.value.toUpperCase())}
                        onBlur={() => validateLocField('postcode', location.postcode)}
                        error={!locLoading.postcode && !!locErrors.postcode}
                        helperText={locLoading.postcode ? '⏳ Checking…' : locErrors.postcode}
                        sx={{ mb: 0, '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                      />
                      <TextField fullWidth label="Country" placeholder="e.g. United Kingdom"
                        value={location.country}
                        onChange={(e) => setLocField('country', e.target.value)}
                        onBlur={() => validateLocField('country', location.country)}
                        error={!locLoading.country && !!locErrors.country}
                        helperText={locLoading.country ? '⏳ Checking…' : locErrors.country}
                        sx={{ mb: 0, '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                      />
                    </FieldRow>
                    <Box sx={{ mt: '1.25rem' }}>
                      <Button
                        onClick={handleSaveLocation}
                        disabled={locSaving}
                        sx={{ background: GRAD, color: '#fff', px: '1.5rem', py: '0.625rem', borderRadius: '0.5rem', fontWeight: 600, textTransform: 'none', '&:hover': { opacity: 0.9 }, '&:disabled': { opacity: 0.6 } }}>
                        {locSaving ? <><CircularProgress size={14} sx={{ mr: '0.5rem', color: '#fff' }} />Saving…</> : locSaved ? <><i className="fas fa-check" style={{ marginRight: '0.5rem' }} />Saved!</> : 'Save Location'}
                      </Button>
                    </Box>
                  </SectionCard>

                  {/* Phone verification */}
                  {(() => {
                    const userPhone = (user as unknown as { phone?: string | null })?.phone;
                    const isVerified = (user as unknown as { isPhoneVerified?: boolean })?.isPhoneVerified ?? false;
                    const alreadyDone = isVerified || phoneVerifyStep === 'done';
                    return (
                      <SectionCard icon="fa-mobile-alt" title="Phone Verification"
                        subtitle="Verify your mobile number to unlock messaging, posts, and events">

                        {/* Current phone + status row */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.25rem',
                          p: '0.875rem 1rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.625rem' }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            background: alreadyDone ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F59E0B,#D97706)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <i className={`fas ${alreadyDone ? 'fa-check' : 'fa-mobile-alt'}`} style={{ color: '#fff', fontSize: '1rem' }} />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>
                              {userPhone || 'No phone number on file'}
                            </Box>
                            <Box sx={{ fontSize: '0.8125rem', color: alreadyDone ? '#10B981' : '#F59E0B', fontWeight: 500 }}>
                              {alreadyDone ? '✓ Verified' : 'Not verified'}
                            </Box>
                          </Box>
                          {/* Not-verified + no change mode: Verify Now button */}
                          {!alreadyDone && userPhone && !phoneChangeMode && (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                              <Box component="button" onClick={handleSendPhoneCode}
                                disabled={phoneSending || phoneVerifyStep === 'sent'}
                                sx={{
                                  background: GRAD, color: '#fff', border: 'none',
                                  borderRadius: '0.5rem', padding: '0.5rem 1rem',
                                  fontSize: '0.8125rem', fontWeight: 600,
                                  cursor: phoneSending || phoneVerifyStep === 'sent' ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                                  opacity: phoneSending || phoneVerifyStep === 'sent' ? 0.7 : 1,
                                  whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif',
                                  '&:hover': { opacity: 0.9 },
                                }}>
                                {phoneSending
                                  ? <><CircularProgress size={13} sx={{ mr: '0.25rem', color: '#fff' }} />Sending…</>
                                  : phoneVerifyStep === 'sent' ? 'Code Sent' : 'Verify Now'}
                              </Box>
                              {phoneCodeError && phoneVerifyStep === 'idle' && (
                                <Box sx={{ fontSize: '0.75rem', color: '#EF4444', textAlign: 'right' }}>{phoneCodeError}</Box>
                              )}
                            </Box>
                          )}
                          {/* Any user with a phone: Change Number button */}
                          {userPhone && !phoneChangeMode && (
                            <Box component="button"
                              onClick={() => { setPhoneChangeMode(true); setNewPhoneInput(''); setNewPhoneError(''); }}
                              sx={{
                                background: 'none', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                                padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600,
                                color: '#4F46E5', cursor: 'pointer', display: 'flex', alignItems: 'center',
                                gap: '0.375rem', whiteSpace: 'nowrap', fontFamily: 'Inter,sans-serif',
                                '&:hover': { background: 'rgba(79,70,229,0.06)', borderColor: '#4F46E5' },
                              }}>
                              <i className="fas fa-edit" /> Change Number
                            </Box>
                          )}
                        </Box>

                        {/* OTP code entry — initial verification (not-verified users) */}
                        {phoneVerifyStep === 'sent' && !alreadyDone && (
                          <Box sx={{ mb: '1rem' }}>
                            {devPhoneCode && (
                              <Alert severity="info" sx={{ mb: '0.875rem', borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                                <strong>[Dev mode]</strong> Your code is:{' '}
                                <strong style={{ letterSpacing: '0.15em', fontFamily: 'monospace' }}>{devPhoneCode}</strong>
                              </Alert>
                            )}
                            <Box sx={{ fontSize: '0.8125rem', color: '#6B7280', mb: '0.875rem' }}>
                              Enter the 6-digit code sent to <strong>{userPhone}</strong>
                            </Box>
                            <Box sx={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <TextField
                                size="small" label="6-digit code"
                                value={phoneCode}
                                onChange={(e) => { setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setPhoneCodeError(''); }}
                                error={!!phoneCodeError} helperText={phoneCodeError}
                                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                                sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: '0.5rem' } }}
                              />
                              <Box component="button" onClick={handleVerifyPhoneCode}
                                disabled={phoneVerifying || phoneCode.length !== 6}
                                sx={{
                                  background: GRAD, color: '#fff', border: 'none',
                                  borderRadius: '0.5rem', padding: '0.5625rem 1.25rem',
                                  fontSize: '0.875rem', fontWeight: 600,
                                  cursor: phoneVerifying || phoneCode.length !== 6 ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '0.375rem',
                                  opacity: phoneVerifying || phoneCode.length !== 6 ? 0.6 : 1,
                                  fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap',
                                }}>
                                {phoneVerifying
                                  ? <><CircularProgress size={13} sx={{ mr: '0.25rem', color: '#fff' }} />Verifying…</>
                                  : 'Confirm Code'}
                              </Box>
                              <Box component="button" onClick={handleSendPhoneCode} disabled={phoneSending}
                                sx={{
                                  background: 'none', border: 'none', color: '#6B7280',
                                  fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
                                  padding: '0.5rem 0', fontFamily: 'Inter,sans-serif',
                                  '&:hover': { color: '#4F46E5' },
                                }}>
                                Resend
                              </Box>
                            </Box>
                          </Box>
                        )}

                        {/* Change Number form — shown when any user with a phone clicks "Change Number" */}
                        {userPhone && phoneChangeMode && (
                          <Box sx={{ mb: '1rem', p: '1rem', background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: '0.625rem' }}>
                            <Box sx={{ fontSize: '0.8125rem', color: '#4338CA', fontWeight: 600, mb: '0.875rem' }}>
                              <i className="fas fa-info-circle" style={{ marginRight: '0.375rem' }} />
                              Enter your new phone number. A verification code will be sent to it.
                            </Box>
                            <Box sx={{ mb: '1rem' }}>
                              <PhoneInput
                                label="New phone number"
                                value={newPhoneInput}
                                onChange={(e164) => { setNewPhoneInput(e164); setNewPhoneError(''); }}
                                defaultCountry={ipCountry}
                                error={!!newPhoneError}
                                helperText={newPhoneError}
                              />
                            </Box>
                            <Box sx={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                              <PrimaryBtn onClick={handleChangePhoneNumber} loading={phoneChangeSending}>
                                <i className="fas fa-paper-plane" /> Send Verification Code
                              </PrimaryBtn>
                              <OutlineBtn onClick={() => { setPhoneChangeMode(false); setNewPhoneInput(''); setNewPhoneError(''); }}>
                                Cancel
                              </OutlineBtn>
                            </Box>
                          </Box>
                        )}

                        {/* Success state */}
                        {alreadyDone && !phoneChangeMode && !phoneVerifyStep.includes('sent') && (
                          <Alert severity="success" icon={<i className="fas fa-shield-alt" />}
                            sx={{ borderRadius: '0.5rem', fontSize: '0.8125rem' }}>
                            Your phone number is verified. You can now create posts, send messages, and access all platform features.
                          </Alert>
                        )}

                        {/* No phone on file — inline add form */}
                        {!userPhone && phoneVerifyStep !== 'sent' && (
                          <Box sx={{ p: '1rem', background: '#F0F4FF', border: '1px solid #C7D2FE', borderRadius: '0.625rem' }}>
                            <Box sx={{ fontSize: '0.8125rem', color: '#4338CA', fontWeight: 600, mb: '0.875rem' }}>
                              <i className="fas fa-plus-circle" style={{ marginRight: '0.375rem' }} />
                              Enter your phone number to get started with verification.
                            </Box>
                            <Box sx={{ mb: '1rem' }}>
                              <PhoneInput
                                label="Mobile number"
                                value={newPhoneInput}
                                onChange={(e164) => { setNewPhoneInput(e164); setNewPhoneError(''); }}
                                defaultCountry={ipCountry}
                                error={!!newPhoneError}
                                helperText={newPhoneError}
                              />
                            </Box>
                            <PrimaryBtn onClick={handleAddPhone} loading={phoneChangeSending}>
                              <i className="fas fa-paper-plane" /> Save & Send Code
                            </PrimaryBtn>
                          </Box>
                        )}
                      </SectionCard>
                    );
                  })()}

                  {/* Change email */}
                  <SectionCard icon="fa-envelope" title="Change Email" subtitle="Update the email address on your account">
                    {/* Current email + verification status */}
                    {(() => {
                      const emailVerified = (user as unknown as { isVerified?: boolean })?.isVerified ?? false;
                      return (
                        <>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1.25rem',
                            p: '0.875rem 1rem', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.625rem' }}>
                            <Box sx={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                              background: emailVerified ? 'linear-gradient(135deg,#10B981,#059669)' : 'linear-gradient(135deg,#F59E0B,#D97706)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <i className={`fas ${emailVerified ? 'fa-check' : 'fa-envelope'}`} style={{ color: '#fff', fontSize: '1rem' }} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                              <Box sx={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1F2937' }}>{user?.email}</Box>
                              <Box sx={{ fontSize: '0.8125rem', color: emailVerified ? '#10B981' : '#F59E0B', fontWeight: 500 }}>
                                {emailVerified ? '✓ Verified' : 'Not verified'}
                              </Box>
                            </Box>
                          </Box>
                          {!emailVerified && (
                            <>
                              <Alert severity="warning" sx={{ borderRadius: '0.5rem', mb: '1.25rem' }}>
                                Your email is not yet verified. Check your inbox for a verification link, or resend it below.
                              </Alert>
                              <Box component="button" onClick={handleResendVerification} disabled={emailResending}
                                sx={{
                                  background: GRAD, color: '#fff', border: 'none',
                                  borderRadius: '0.5rem', padding: '0.625rem 1.25rem',
                                  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  opacity: emailResending ? 0.7 : 1, mb: '1.5rem',
                                }}>
                                {emailResending
                                  ? <><CircularProgress size={14} sx={{ color: '#fff' }} /> Sending…</>
                                  : <><i className="fas fa-paper-plane" /> Resend Verification Email</>}
                              </Box>
                              <Box sx={{ borderTop: '1px solid #E5E7EB', pt: '1.25rem', mb: '0.25rem',
                                fontSize: '0.8125rem', color: '#6B7280', fontWeight: 500 }}>
                                Change email address
                              </Box>
                            </>
                          )}
                        </>
                      );
                    })()}
                    <InputField label="New email address" type="email"
                      value={emailForm.newEmail} onChange={(v) => setEmailForm(f => ({ ...f, newEmail: v }))}
                      placeholder="you@example.com" error={emailErr.newEmail} />
                    <InputField label="Confirm your password" type="password"
                      value={emailForm.password} onChange={(v) => setEmailForm(f => ({ ...f, password: v }))}
                      placeholder="Required to confirm the change" error={emailErr.password} />
                    <PrimaryBtn onClick={handleRequestEmailChange} loading={emailRequestLoading}>
                      <i className="fas fa-paper-plane" /> Send Verification Code
                    </PrimaryBtn>
                  </SectionCard>

                  {/* Change password */}
                  <SectionCard icon="fa-key" title="Change Password" subtitle="Update your login password">
                    <InputField label="Current password" type="password"
                      value={pwForm.current} onChange={(v) => setPwForm(p => ({ ...p, current: v }))}
                      placeholder="Enter current password" error={pwErr.current} />
                    <InputField label="New password" type="password"
                      value={pwForm.next} onChange={(v) => setPwForm(p => ({ ...p, next: v }))}
                      placeholder="At least 6 characters" error={pwErr.next} />
                    <InputField label="Confirm new password" type="password"
                      value={pwForm.confirm} onChange={(v) => setPwForm(p => ({ ...p, confirm: v }))}
                      placeholder="Repeat new password" error={pwErr.confirm} />
                    <PrimaryBtn onClick={handleChangePassword} loading={changePasswordMutation.isPending}>
                      <i className="fas fa-save" /> Save Password
                    </PrimaryBtn>
                  </SectionCard>
                </>
              )}

              {/* ══════════════════════════════════════ NOTIFICATIONS */}
              {section === 'notifications' && (
                <SectionCard icon="fa-bell" title="Notification Preferences"
                  subtitle="Choose what you want to be notified about">
                  <Toggle label="Exchange Requests" sublabel="When someone wants to start an exchange with you"
                    checked={notifs.exchangeRequests}
                    onChange={(v) => setNotifs(n => ({ ...n, exchangeRequests: v }))} />
                  <Toggle label="Messages" sublabel="Private and group messages"
                    checked={notifs.messages}
                    onChange={(v) => setNotifs(n => ({ ...n, messages: v }))} />
                  <Toggle label="Group Activity" sublabel="Posts and updates in your groups"
                    checked={notifs.groupActivity}
                    onChange={(v) => setNotifs(n => ({ ...n, groupActivity: v }))} />
                  <Toggle label="New Followers" sublabel="When someone follows your profile"
                    checked={notifs.newFollowers}
                    onChange={(v) => setNotifs(n => ({ ...n, newFollowers: v }))} />
                  <Toggle label="Marketing Emails" sublabel="Promotions and feature announcements"
                    checked={notifs.marketingEmails}
                    onChange={(v) => setNotifs(n => ({ ...n, marketingEmails: v }))} />
                  <Toggle label="Newsletter" sublabel="Weekly community digest"
                    checked={notifs.newsletter}
                    onChange={(v) => setNotifs(n => ({ ...n, newsletter: v }))} />
                  <Box sx={{ mt: '1.5rem' }}>
                    <PrimaryBtn onClick={() => saveNotifs.mutate()} loading={saveNotifs.isPending}>
                      <i className="fas fa-save" /> Save Preferences
                    </PrimaryBtn>
                  </Box>
                </SectionCard>
              )}

              {/* ══════════════════════════════════════ PRIVACY */}
              {section === 'privacy' && (
                <SectionCard icon="fa-shield-alt" title="Privacy Settings"
                  subtitle="Control who can see your profile and interact with you">

                  <Box sx={{ mb: '1.25rem' }}>
                    <Toggle label="Show Online Status"
                      sublabel="Let others see when you're active on the platform"
                      checked={prefs.showOnlineStatus}
                      onChange={(v) => setPrefs(p => ({ ...p, showOnlineStatus: v }))} />
                    <Toggle label="Allow Exchange Requests"
                      sublabel="Let other users send you exchange requests"
                      checked={prefs.allowExchangeRequests}
                      onChange={(v) => setPrefs(p => ({ ...p, allowExchangeRequests: v }))} />
                  </Box>

                  <PrimaryBtn onClick={() => savePrefs.mutate()} loading={savePrefs.isPending}>
                    <i className="fas fa-save" /> Save Privacy Settings
                  </PrimaryBtn>
                </SectionCard>
              )}

              {/* ══════════════════════════════════════ BLOCKED USERS */}
              {section === 'blocked' && (
                <SectionCard icon="fa-ban" title="Blocked Users"
                  subtitle="Blocked users cannot message you or view your profile">

                  {/* Search to block */}
                  <Box sx={{ mb: '1.5rem', padding: '1rem', background: '#F9FAFB',
                    borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                    <Box sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151',
                      textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.5rem' }}>
                      Block a User
                    </Box>
                    <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                      <Box
                        component="input"
                        value={blockSearch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBlockSearch(e.target.value)}
                        onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearchBlock()}
                        placeholder="Search by name or email..."
                        sx={{
                          flex: 1, padding: '0.625rem 0.875rem',
                          border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                          fontSize: '0.875rem', outline: 'none', fontFamily: 'Inter,sans-serif',
                          '&:focus': { borderColor: '#4F46E5' },
                        }}
                      />
                      <Box component="button" onClick={handleSearchBlock} sx={{
                        background: GRAD, color: '#FFF', border: 'none',
                        borderRadius: '0.5rem', padding: '0.625rem 1rem',
                        cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        '&:hover': { opacity: 0.9 },
                      }}>
                        <i className="fas fa-search" /> Search
                      </Box>
                    </Box>
                    {blockErr && <Box sx={{ fontSize: '0.8rem', color: '#EF4444', mt: '0.5rem' }}>{blockErr}</Box>}
                    {blockResult && (
                      <Box sx={{ mt: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.75rem', background: '#FFFFFF', borderRadius: '0.5rem',
                        border: '1px solid #E5E7EB' }}>
                        <OnlineAvatar userId={blockResult._id} src={blockResult.avatar} sx={{ width: 36, height: 36, background: GRAD, fontWeight: 700 }}>
                          {blockResult.name[0]}
                        </OnlineAvatar>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ fontWeight: 600, fontSize: '0.875rem' }}>{blockResult.name}</Box>
                          <Box sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{blockResult.email}</Box>
                        </Box>
                        <Box component="button" onClick={() => blockMutation.mutate(blockResult._id)} sx={{
                          background: '#EF4444', color: '#FFF', border: 'none',
                          borderRadius: '0.375rem', padding: '0.5rem 1rem',
                          fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '0.375rem',
                          '&:hover': { background: '#dc2626' },
                        }}>
                          <i className="fas fa-ban" /> Block
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {/* Blocked list */}
                  {!settings?.blockedUsers?.length ? (
                    <Box sx={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#9CA3AF' }}>
                      <Box sx={{ fontSize: '2.5rem', mb: '0.75rem' }}><i className="fas fa-ban" /></Box>
                      <Box sx={{ fontWeight: 500 }}>No blocked users</Box>
                      <Box sx={{ fontSize: '0.8rem', mt: '0.25rem' }}>Users you block will appear here</Box>
                    </Box>
                  ) : (
                    <Box>
                      {settings.blockedUsers.map((bu) => (
                        <Box key={bu._id} sx={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.875rem 0',
                          borderBottom: '1px solid #F3F4F6',
                          '&:last-child': { borderBottom: 'none' },
                        }}>
                          <OnlineAvatar userId={bu._id} src={bu.avatar} sx={{ width: 40, height: 40, background: GRAD, fontWeight: 700 }}>
                            {bu.name[0]}
                          </OnlineAvatar>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>{bu.name}</Box>
                            <Box sx={{ fontSize: '0.78rem', color: '#6B7280' }}>{bu.email}</Box>
                          </Box>
                          <Box component="button" onClick={() => unblockMutation.mutate(bu._id)}
                            disabled={unblockMutation.isPending} sx={{
                              background: '#F3F4F6', color: '#4F46E5',
                              border: '1px solid #E5E7EB', borderRadius: '0.375rem',
                              padding: '0.5rem 1rem', fontSize: '0.8rem', fontWeight: 500,
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.375rem',
                              '&:hover': { background: '#E5E7EB' },
                            }}>
                            <i className="fas fa-unlock" /> Unblock
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  )}
                </SectionCard>
              )}

              {/* ══════════════════════════════════════ SECURITY */}
              {section === 'security' && (
                <>
                  <SectionCard icon="fa-lock" title="Security" subtitle="Protect your account">
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '1rem',
                      padding: '1rem', background: 'rgba(79,70,229,0.05)',
                      borderRadius: '0.5rem', mb: '1rem', border: '1px solid rgba(79,70,229,0.15)' }}>
                      <i className="fas fa-info-circle" style={{ color: '#4F46E5', marginTop: 2 }} />
                      <Box sx={{ fontSize: '0.875rem', color: '#374151' }}>
                        Your account is protected with a password. We recommend using a strong,
                        unique password and keeping it private. Two-factor authentication (2FA)
                        is coming soon.
                      </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: '1rem' }}>
                      {[
                        { icon: 'fa-key', label: 'Password', value: '●●●●●●●●', color: '#10B981' },
                        { icon: 'fa-mobile-alt', label: 'Two-Factor Auth', value: 'Coming Soon', color: '#F59E0B' },
                        { icon: 'fa-history', label: 'Last Login', value: 'Just now', color: '#3B82F6' },
                        { icon: 'fa-check-circle', label: 'Email Verified', value: user?.isVerified ? 'Yes ✓' : 'No', color: user?.isVerified ? '#10B981' : '#EF4444' },
                      ].map((item) => (
                        <Box key={item.label} sx={{ padding: '1rem', background: '#F9FAFB',
                          borderRadius: '0.5rem', border: '1px solid #E5E7EB' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.375rem' }}>
                            <i className={`fas ${item.icon}`} style={{ color: item.color, fontSize: '0.85rem' }} />
                            <Box sx={{ fontSize: '0.75rem', color: '#6B7280', fontWeight: 600,
                              textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {item.label}
                            </Box>
                          </Box>
                          <Box sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937' }}>
                            {item.value}
                          </Box>
                        </Box>
                      ))}
                    </Box>

                    <Box sx={{ mt: '1.5rem' }}>
                      <OutlineBtn onClick={() => setSection('account')}>
                        <i className="fas fa-key" /> Change Password
                      </OutlineBtn>
                    </Box>
                  </SectionCard>
                </>
              )}

              {/* ══════════════════════════════════════ DANGER ZONE */}
              {section === 'danger' && (
                <>
                  {/* Suspend account */}
                  <SectionCard icon="fa-pause-circle" title="Suspend Account"
                    subtitle="Temporarily disable your account for a set period" danger>

                    {suspendLabel && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem',
                        padding: '0.875rem 1rem', background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.25)', borderRadius: '0.5rem', mb: '1rem' }}>
                        <i className="fas fa-clock" style={{ color: '#F59E0B' }} />
                        <Box sx={{ flex: 1, fontSize: '0.875rem', color: '#92400E', fontWeight: 500 }}>
                          {suspendLabel}
                        </Box>
                        <Box component="button" onClick={() => cancelSuspensionMutation.mutate()} sx={{
                          background: '#F59E0B', color: '#FFF', border: 'none',
                          borderRadius: '0.375rem', padding: '0.5rem 0.875rem',
                          fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer',
                          '&:hover': { background: '#d97706' },
                        }}>
                          Cancel Suspension
                        </Box>
                      </Box>
                    )}

                    <Box sx={{ mb: '1rem', fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.6 }}>
                      While suspended, you won't be able to post, exchange, or interact with
                      the community. Your profile and data will be preserved.
                    </Box>

                    <Box sx={{ mb: '1rem' }}>
                      <Box sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151',
                        textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.375rem' }}>
                        Suspension Duration
                      </Box>
                      <Box component="select" value={suspendDays}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSuspendDays(e.target.value)}
                        sx={{
                          width: '100%', padding: '0.75rem 1rem',
                          border: '1px solid #E5E7EB', borderRadius: '0.5rem',
                          fontSize: '0.875rem', color: '#1F2937',
                          background: '#FFFFFF', cursor: 'pointer', outline: 'none',
                          fontFamily: 'Inter,sans-serif',
                          '&:focus': { borderColor: '#4F46E5' },
                        }}>
                        <option value="7">1 Week</option>
                        <option value="14">2 Weeks</option>
                        <option value="30">1 Month</option>
                        <option value="90">3 Months</option>
                        <option value="180">6 Months</option>
                        <option value="365">1 Year</option>
                      </Box>
                    </Box>

                    <PrimaryBtn onClick={() => suspendMutation.mutate()}
                      loading={suspendMutation.isPending} danger>
                      <i className="fas fa-pause" /> Suspend Account
                    </PrimaryBtn>
                  </SectionCard>

                  {/* Delete account */}
                  <SectionCard icon="fa-trash-alt" title="Delete Account"
                    subtitle="Permanently remove your account and all associated data" danger>

                    <Box sx={{ padding: '1rem', background: 'rgba(239,68,68,0.05)',
                      border: '1px solid rgba(239,68,68,0.2)', borderRadius: '0.5rem', mb: '1.25rem' }}>
                      <Box sx={{ fontWeight: 600, color: '#EF4444', mb: '0.5rem', fontSize: '0.875rem' }}>
                        ⚠️ This action is irreversible
                      </Box>
                      <Box sx={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.6 }}>
                        Deleting your account will permanently remove your profile, skills, exchanges,
                        and all other data. Your CEU balance will be forfeited and cannot be recovered.
                      </Box>
                    </Box>

                    <InputField label="Confirm your password" type="password"
                      value={delPassword} onChange={setDelPassword}
                      placeholder="Enter your current password" />

                    <Box sx={{ mb: '1rem' }}>
                      <Box sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151',
                        textTransform: 'uppercase', letterSpacing: '0.05em', mb: '0.375rem' }}>
                        Type <span style={{ color: '#EF4444', fontFamily: 'monospace' }}>DELETE</span> to confirm
                      </Box>
                      <Box component="input" value={delConfirm}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDelConfirm(e.target.value)}
                        placeholder="Type DELETE here"
                        sx={{
                          width: '100%', padding: '0.75rem 1rem',
                          border: `1px solid ${delConfirm === 'DELETE' ? '#10B981' : '#E5E7EB'}`,
                          borderRadius: '0.5rem', fontSize: '0.875rem',
                          color: '#1F2937', outline: 'none', boxSizing: 'border-box',
                          fontFamily: 'monospace',
                          '&:focus': { borderColor: '#EF4444', boxShadow: '0 0 0 3px rgba(239,68,68,0.1)' },
                        }} />
                    </Box>

                    {delErr && (
                      <Box sx={{ fontSize: '0.8rem', color: '#EF4444', mb: '1rem',
                        padding: '0.625rem', background: 'rgba(239,68,68,0.05)',
                        borderRadius: '0.375rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                        {delErr}
                      </Box>
                    )}

                    <PrimaryBtn
                      onClick={() => {
                        setDelErr('');
                        if (delConfirm !== 'DELETE') { setDelErr('Please type DELETE to confirm'); return; }
                        if (!delPassword) { setDelErr('Password is required'); return; }
                        deleteAccountMutation.mutate();
                      }}
                      loading={deleteAccountMutation.isPending}
                      disabled={delConfirm !== 'DELETE'}
                      danger>
                      <i className="fas fa-trash-alt" /> Delete My Account
                    </PrimaryBtn>
                  </SectionCard>
                </>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── Phone Change Dialog ── */}
      <VerificationCodeDialog
        open={showPhoneDialog}
        onClose={handleClosePhoneDialog}
        title="Verify New Phone Number"
        description="We sent a 6-digit code to your new number"
        target={newPhoneInput}
        code={phoneDialogCode}
        setCode={setPhoneDialogCode}
        codeError={phoneDialogError}
        setCodeError={setPhoneDialogError}
        loading={phoneDialogLoading}
        onConfirm={handleConfirmPhoneChange}
        devCode={devPhoneChangeCode}
        smsError={phoneChangeSmsError}
      />

      {/* ── Email Change Dialog ── */}
      <VerificationCodeDialog
        open={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        title="Verify New Email Address"
        description="We sent a 6-digit code to"
        target={emailForm.newEmail}
        code={emailDialogCode}
        setCode={setEmailDialogCode}
        codeError={emailDialogError}
        setCodeError={setEmailDialogError}
        loading={emailDialogLoading}
        onConfirm={handleConfirmEmailChange}
      />

      {/* ── Toast ── */}
      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.type || 'success'} onClose={() => setToast(null)}
          sx={{ borderRadius: '0.5rem', fontFamily: 'Inter,sans-serif' }}>
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Layout>
  );
};

export default Settings;
