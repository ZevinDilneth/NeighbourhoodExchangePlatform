import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  InputBase,
  Popover,
  TextField,
  List,
  ListItem,
  ListItemButton,
  InputAdornment,
} from '@mui/material';

// ─── Country data ─────────────────────────────────────────────────────────────
export interface Country {
  code: string;   // ISO 3166-1 alpha-2
  name: string;
  dial: string;   // e.g. '+1', '+44'
}

// Generates a flag emoji from an ISO-2 country code (works in all modern browsers)
export const flagEmoji = (iso2: string): string =>
  [...iso2.toUpperCase()].map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');

export const COUNTRIES: Country[] = [
  { code: 'AF', name: 'Afghanistan', dial: '+93' },
  { code: 'AL', name: 'Albania', dial: '+355' },
  { code: 'DZ', name: 'Algeria', dial: '+213' },
  { code: 'AD', name: 'Andorra', dial: '+376' },
  { code: 'AO', name: 'Angola', dial: '+244' },
  { code: 'AR', name: 'Argentina', dial: '+54' },
  { code: 'AM', name: 'Armenia', dial: '+374' },
  { code: 'AU', name: 'Australia', dial: '+61' },
  { code: 'AT', name: 'Austria', dial: '+43' },
  { code: 'AZ', name: 'Azerbaijan', dial: '+994' },
  { code: 'BS', name: 'Bahamas', dial: '+1' },
  { code: 'BH', name: 'Bahrain', dial: '+973' },
  { code: 'BD', name: 'Bangladesh', dial: '+880' },
  { code: 'BB', name: 'Barbados', dial: '+1' },
  { code: 'BY', name: 'Belarus', dial: '+375' },
  { code: 'BE', name: 'Belgium', dial: '+32' },
  { code: 'BZ', name: 'Belize', dial: '+501' },
  { code: 'BJ', name: 'Benin', dial: '+229' },
  { code: 'BT', name: 'Bhutan', dial: '+975' },
  { code: 'BO', name: 'Bolivia', dial: '+591' },
  { code: 'BA', name: 'Bosnia and Herzegovina', dial: '+387' },
  { code: 'BW', name: 'Botswana', dial: '+267' },
  { code: 'BR', name: 'Brazil', dial: '+55' },
  { code: 'BN', name: 'Brunei', dial: '+673' },
  { code: 'BG', name: 'Bulgaria', dial: '+359' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226' },
  { code: 'BI', name: 'Burundi', dial: '+257' },
  { code: 'KH', name: 'Cambodia', dial: '+855' },
  { code: 'CM', name: 'Cameroon', dial: '+237' },
  { code: 'CA', name: 'Canada', dial: '+1' },
  { code: 'CF', name: 'Central African Republic', dial: '+236' },
  { code: 'TD', name: 'Chad', dial: '+235' },
  { code: 'CL', name: 'Chile', dial: '+56' },
  { code: 'CN', name: 'China', dial: '+86' },
  { code: 'CO', name: 'Colombia', dial: '+57' },
  { code: 'CG', name: 'Congo', dial: '+242' },
  { code: 'CR', name: 'Costa Rica', dial: '+506' },
  { code: 'HR', name: 'Croatia', dial: '+385' },
  { code: 'CU', name: 'Cuba', dial: '+53' },
  { code: 'CY', name: 'Cyprus', dial: '+357' },
  { code: 'CZ', name: 'Czech Republic', dial: '+420' },
  { code: 'DK', name: 'Denmark', dial: '+45' },
  { code: 'DJ', name: 'Djibouti', dial: '+253' },
  { code: 'DO', name: 'Dominican Republic', dial: '+1' },
  { code: 'EC', name: 'Ecuador', dial: '+593' },
  { code: 'EG', name: 'Egypt', dial: '+20' },
  { code: 'SV', name: 'El Salvador', dial: '+503' },
  { code: 'EE', name: 'Estonia', dial: '+372' },
  { code: 'ET', name: 'Ethiopia', dial: '+251' },
  { code: 'FJ', name: 'Fiji', dial: '+679' },
  { code: 'FI', name: 'Finland', dial: '+358' },
  { code: 'FR', name: 'France', dial: '+33' },
  { code: 'GA', name: 'Gabon', dial: '+241' },
  { code: 'GM', name: 'Gambia', dial: '+220' },
  { code: 'GE', name: 'Georgia', dial: '+995' },
  { code: 'DE', name: 'Germany', dial: '+49' },
  { code: 'GH', name: 'Ghana', dial: '+233' },
  { code: 'GR', name: 'Greece', dial: '+30' },
  { code: 'GT', name: 'Guatemala', dial: '+502' },
  { code: 'GN', name: 'Guinea', dial: '+224' },
  { code: 'GY', name: 'Guyana', dial: '+592' },
  { code: 'HT', name: 'Haiti', dial: '+509' },
  { code: 'HN', name: 'Honduras', dial: '+504' },
  { code: 'HU', name: 'Hungary', dial: '+36' },
  { code: 'IS', name: 'Iceland', dial: '+354' },
  { code: 'IN', name: 'India', dial: '+91' },
  { code: 'ID', name: 'Indonesia', dial: '+62' },
  { code: 'IR', name: 'Iran', dial: '+98' },
  { code: 'IQ', name: 'Iraq', dial: '+964' },
  { code: 'IE', name: 'Ireland', dial: '+353' },
  { code: 'IL', name: 'Israel', dial: '+972' },
  { code: 'IT', name: 'Italy', dial: '+39' },
  { code: 'JM', name: 'Jamaica', dial: '+1' },
  { code: 'JP', name: 'Japan', dial: '+81' },
  { code: 'JO', name: 'Jordan', dial: '+962' },
  { code: 'KZ', name: 'Kazakhstan', dial: '+7' },
  { code: 'KE', name: 'Kenya', dial: '+254' },
  { code: 'KW', name: 'Kuwait', dial: '+965' },
  { code: 'KG', name: 'Kyrgyzstan', dial: '+996' },
  { code: 'LA', name: 'Laos', dial: '+856' },
  { code: 'LV', name: 'Latvia', dial: '+371' },
  { code: 'LB', name: 'Lebanon', dial: '+961' },
  { code: 'LY', name: 'Libya', dial: '+218' },
  { code: 'LT', name: 'Lithuania', dial: '+370' },
  { code: 'LU', name: 'Luxembourg', dial: '+352' },
  { code: 'MG', name: 'Madagascar', dial: '+261' },
  { code: 'MW', name: 'Malawi', dial: '+265' },
  { code: 'MY', name: 'Malaysia', dial: '+60' },
  { code: 'MV', name: 'Maldives', dial: '+960' },
  { code: 'ML', name: 'Mali', dial: '+223' },
  { code: 'MT', name: 'Malta', dial: '+356' },
  { code: 'MR', name: 'Mauritania', dial: '+222' },
  { code: 'MU', name: 'Mauritius', dial: '+230' },
  { code: 'MX', name: 'Mexico', dial: '+52' },
  { code: 'MD', name: 'Moldova', dial: '+373' },
  { code: 'MC', name: 'Monaco', dial: '+377' },
  { code: 'MN', name: 'Mongolia', dial: '+976' },
  { code: 'ME', name: 'Montenegro', dial: '+382' },
  { code: 'MA', name: 'Morocco', dial: '+212' },
  { code: 'MZ', name: 'Mozambique', dial: '+258' },
  { code: 'MM', name: 'Myanmar', dial: '+95' },
  { code: 'NA', name: 'Namibia', dial: '+264' },
  { code: 'NP', name: 'Nepal', dial: '+977' },
  { code: 'NL', name: 'Netherlands', dial: '+31' },
  { code: 'NZ', name: 'New Zealand', dial: '+64' },
  { code: 'NI', name: 'Nicaragua', dial: '+505' },
  { code: 'NE', name: 'Niger', dial: '+227' },
  { code: 'NG', name: 'Nigeria', dial: '+234' },
  { code: 'NO', name: 'Norway', dial: '+47' },
  { code: 'OM', name: 'Oman', dial: '+968' },
  { code: 'PK', name: 'Pakistan', dial: '+92' },
  { code: 'PA', name: 'Panama', dial: '+507' },
  { code: 'PG', name: 'Papua New Guinea', dial: '+675' },
  { code: 'PY', name: 'Paraguay', dial: '+595' },
  { code: 'PE', name: 'Peru', dial: '+51' },
  { code: 'PH', name: 'Philippines', dial: '+63' },
  { code: 'PL', name: 'Poland', dial: '+48' },
  { code: 'PT', name: 'Portugal', dial: '+351' },
  { code: 'QA', name: 'Qatar', dial: '+974' },
  { code: 'RO', name: 'Romania', dial: '+40' },
  { code: 'RU', name: 'Russia', dial: '+7' },
  { code: 'RW', name: 'Rwanda', dial: '+250' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966' },
  { code: 'SN', name: 'Senegal', dial: '+221' },
  { code: 'RS', name: 'Serbia', dial: '+381' },
  { code: 'SG', name: 'Singapore', dial: '+65' },
  { code: 'SK', name: 'Slovakia', dial: '+421' },
  { code: 'SI', name: 'Slovenia', dial: '+386' },
  { code: 'SO', name: 'Somalia', dial: '+252' },
  { code: 'ZA', name: 'South Africa', dial: '+27' },
  { code: 'SS', name: 'South Sudan', dial: '+211' },
  { code: 'ES', name: 'Spain', dial: '+34' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94' },
  { code: 'SD', name: 'Sudan', dial: '+249' },
  { code: 'SR', name: 'Suriname', dial: '+597' },
  { code: 'SE', name: 'Sweden', dial: '+46' },
  { code: 'CH', name: 'Switzerland', dial: '+41' },
  { code: 'SY', name: 'Syria', dial: '+963' },
  { code: 'TW', name: 'Taiwan', dial: '+886' },
  { code: 'TJ', name: 'Tajikistan', dial: '+992' },
  { code: 'TZ', name: 'Tanzania', dial: '+255' },
  { code: 'TH', name: 'Thailand', dial: '+66' },
  { code: 'TG', name: 'Togo', dial: '+228' },
  { code: 'TT', name: 'Trinidad and Tobago', dial: '+1' },
  { code: 'TN', name: 'Tunisia', dial: '+216' },
  { code: 'TR', name: 'Turkey', dial: '+90' },
  { code: 'TM', name: 'Turkmenistan', dial: '+993' },
  { code: 'UG', name: 'Uganda', dial: '+256' },
  { code: 'UA', name: 'Ukraine', dial: '+380' },
  { code: 'AE', name: 'United Arab Emirates', dial: '+971' },
  { code: 'GB', name: 'United Kingdom', dial: '+44' },
  { code: 'US', name: 'United States', dial: '+1' },
  { code: 'UY', name: 'Uruguay', dial: '+598' },
  { code: 'UZ', name: 'Uzbekistan', dial: '+998' },
  { code: 'VE', name: 'Venezuela', dial: '+58' },
  { code: 'VN', name: 'Vietnam', dial: '+84' },
  { code: 'YE', name: 'Yemen', dial: '+967' },
  { code: 'ZM', name: 'Zambia', dial: '+260' },
  { code: 'ZW', name: 'Zimbabwe', dial: '+263' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Find a country by ISO-2 code (case-insensitive). Falls back to US. */
export const findCountry = (code: string): Country =>
  COUNTRIES.find((c) => c.code === code.toUpperCase()) ?? COUNTRIES.find((c) => c.code === 'US')!;

/** Split an E.164 number into country + local parts. Returns US if no match. */
const parseE164 = (e164: string): { country: Country; local: string } => {
  if (!e164.startsWith('+')) return { country: findCountry('US'), local: e164 };

  // Try longest dial code first (up to 4 chars)
  for (let len = 4; len >= 1; len--) {
    const prefix = '+' + e164.slice(1, 1 + len);
    const match = COUNTRIES.find((c) => c.dial === prefix);
    if (match) return { country: match, local: e164.slice(1 + len) };
  }
  return { country: findCountry('US'), local: e164.slice(1) };
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface PhoneInputProps {
  value: string;                       // full E.164: '+447911123456' or ''
  onChange: (e164: string) => void;
  defaultCountry?: string;             // ISO-2 code for initial selection
  error?: boolean;
  helperText?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  defaultCountry = 'US',
  error = false,
  helperText,
  label = 'Phone Number',
  required = false,
  disabled = false,
}) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState('');

  // Derive country + local from value prop
  const { country: parsedCountry, local: parsedLocal } = value
    ? parseE164(value)
    : { country: findCountry(defaultCountry), local: '' };

  const [selectedCountry, setSelectedCountry] = useState<Country>(parsedCountry);
  const [localNumber, setLocalNumber]         = useState(parsedLocal);

  // Sync external value → internal state (e.g. when defaultCountry changes after IP detection)
  useEffect(() => {
    if (value) {
      const { country, local } = parseE164(value);
      setSelectedCountry(country);
      setLocalNumber(local);
    } else {
      setSelectedCountry(findCountry(defaultCountry));
      setLocalNumber('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountry]);

  // Build E.164 and notify parent whenever country or local changes
  const emit = useCallback(
    (country: Country, local: string) => {
      const digits = local.replace(/\D/g, '');
      const full   = digits ? `${country.dial}${digits}` : '';
      onChange(full);
    },
    [onChange],
  );

  const handleCountrySelect = (c: Country) => {
    setSelectedCountry(c);
    setOpen(false);
    setSearch('');
    emit(c, localNumber);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, spaces, dashes, parentheses
    const raw = e.target.value.replace(/[^0-9\s\-()]/g, '');
    setLocalNumber(raw);
    emit(selectedCountry, raw);
  };

  const filtered = search
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  // ── Style tokens ──────────────────────────────────────────────────────────
  const borderColor = error ? '#EF4444' : open ? '#4F46E5' : '#C4C4C4';
  const borderWidth = open || error ? 2 : 1;

  return (
    <Box>
      {/* Label */}
      {label && (
        <Typography
          component="label"
          sx={{
            display: 'block',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: error ? '#EF4444' : open ? '#4F46E5' : '#6B7280',
            mb: '0.25rem',
            ml: '0.125rem',
            transition: 'color 0.2s',
          }}
        >
          {label}{required && ' *'}
        </Typography>
      )}

      {/* Input container */}
      <Box
        ref={anchorRef}
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: '0.5rem',
          overflow: 'hidden',
          background: disabled ? '#F9FAFB' : '#fff',
          transition: 'border-color 0.2s, border-width 0.1s',
          height: 56,
          '&:hover': !disabled ? { borderColor: error ? '#EF4444' : '#4F46E5' } : {},
        }}
      >
        {/* ── Country selector button ── */}
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={() => { setOpen(!open); setSearch(''); }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            px: '0.875rem',
            background: 'transparent',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            borderRight: `1px solid ${borderColor}`,
            flexShrink: 0,
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
            '&:hover:not(:disabled)': { background: '#F5F3FF' },
          }}
        >
          <Typography sx={{ fontSize: '1.375rem', lineHeight: 1 }}>
            {flagEmoji(selectedCountry.code)}
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '0.875rem', color: '#374151', fontFamily: 'monospace' }}>
            {selectedCountry.dial}
          </Typography>
          <Typography sx={{ fontSize: '0.625rem', color: '#9CA3AF', mt: '1px' }}>▼</Typography>
        </Box>

        {/* ── Local number input ── */}
        <InputBase
          inputRef={inputRef}
          value={localNumber}
          onChange={handleLocalChange}
          disabled={disabled}
          placeholder="201-555-5555"
          inputProps={{ inputMode: 'tel', maxLength: 20 }}
          sx={{
            flex: 1,
            px: '0.875rem',
            fontSize: '0.9375rem',
            color: '#1F2937',
            '& input': {
              padding: 0,
              '&::placeholder': { color: '#9CA3AF' },
            },
          }}
        />
      </Box>

      {/* Helper text */}
      {helperText && (
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: error ? '#EF4444' : '#6B7280',
            mt: '0.25rem',
            ml: '0.875rem',
          }}
        >
          {helperText}
        </Typography>
      )}

      {/* ── Country dropdown ── */}
      <Popover
        open={open}
        anchorEl={anchorRef.current}
        onClose={() => { setOpen(false); setSearch(''); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            width: anchorRef.current?.offsetWidth ?? 320,
            maxHeight: 340,
            borderRadius: '0.75rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            mt: '0.25rem',
          },
        }}
      >
        {/* Search input */}
        <Box sx={{ p: '0.75rem', borderBottom: '1px solid #F3F4F6', flexShrink: 0 }}>
          <TextField
            fullWidth
            size="small"
            autoFocus
            placeholder="Search country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <i className="fas fa-search" style={{ color: '#9CA3AF', fontSize: '0.75rem' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': { borderRadius: '0.5rem', fontSize: '0.875rem' },
            }}
          />
        </Box>

        {/* Country list */}
        <List dense disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <ListItem>
              <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', py: 1 }}>No countries found</Typography>
            </ListItem>
          ) : (
            filtered.map((c) => {
              const isSelected = c.code === selectedCountry.code;
              return (
                <ListItemButton
                  key={c.code}
                  onClick={() => handleCountrySelect(c)}
                  selected={isSelected}
                  sx={{
                    py: '0.5rem',
                    px: '1rem',
                    gap: '0.75rem',
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                      '&:hover': { background: 'linear-gradient(135deg, #4F46E5, #10B981)' },
                      '& .country-name': { color: '#fff' },
                      '& .country-dial': { color: 'rgba(255,255,255,0.85)' },
                    },
                    '&:hover:not(.Mui-selected)': { background: '#F5F3FF' },
                  }}
                >
                  <Typography sx={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>
                    {flagEmoji(c.code)}
                  </Typography>
                  <Typography
                    className="country-name"
                    sx={{ flex: 1, fontSize: '0.875rem', color: '#1F2937', fontWeight: isSelected ? 600 : 400 }}
                  >
                    {c.name}
                  </Typography>
                  <Typography
                    className="country-dial"
                    sx={{ fontSize: '0.8125rem', color: '#6B7280', fontFamily: 'monospace', fontWeight: 500 }}
                  >
                    {c.dial}
                  </Typography>
                </ListItemButton>
              );
            })
          )}
        </List>
      </Popover>
    </Box>
  );
};

export default PhoneInput;
