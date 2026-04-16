/**
 * PublicPlacePicker — smart entry point
 * ─────────────────────────────────────────────────────────────────────────────
 * Routing logic:
 *   • VITE_GOOGLE_MAPS_API_KEY present (with or without Mapbox)
 *       → MergedPlacePicker   (Google Maps renders the map; both Google Places
 *                              AND Mapbox Geocoding used for markers; merged)
 *   • Only VITE_MAPBOX_ACCESS_TOKEN present
 *       → MapboxPlacePicker   (Mapbox GL map + Mapbox Geocoding only)
 *   • Neither key configured
 *       → Friendly error message
 */
import React from 'react';
import { Box, Typography } from '@mui/material';
import GooglePlacePicker  from './GooglePlacePicker';
import MapboxPlacePicker  from './MapboxPlacePicker';

const HAS_GOOGLE = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
const HAS_MAPBOX = Boolean(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);

export interface StructuredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export interface PublicPlacePickerProps {
  value: string;
  onChange: (place: string) => void;
  /** GeoJSON order [lng, lat] from user.location.coordinates */
  userCoordinates?: [number, number];
  /** Hide the Park/Library/Cafe/Community legend. Default true. */
  showLegend?: boolean;
  /** Called with full place data (including coordinates) when a place is selected. */
  onStructuredSelect?: (place: StructuredPlace) => void;
}

const PublicPlacePicker: React.FC<PublicPlacePickerProps> = (props) => {
  // Google key → use the pure Google picker
  if (HAS_GOOGLE) return <GooglePlacePicker {...props} />;

  // Mapbox only
  if (HAS_MAPBOX) return <MapboxPlacePicker {...props} />;

  // Neither configured
  return (
    <Box sx={{
      padding: '2.5rem', textAlign: 'center', borderRadius: '0.875rem',
      background: '#F9FAFB', border: '1px dashed #E5E7EB',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
    }}>
      <i className="fas fa-map" style={{ color: '#D1D5DB', fontSize: '2rem' }} />
      <Typography sx={{ color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem', maxWidth: 360 }}>
        Map unavailable — add{' '}
        <code style={{ background: '#F3F4F6', padding: '0 4px', borderRadius: 3 }}>VITE_GOOGLE_MAPS_API_KEY</code>
        {' '}or{' '}
        <code style={{ background: '#F3F4F6', padding: '0 4px', borderRadius: 3 }}>VITE_MAPBOX_ACCESS_TOKEN</code>
        {' '}to <code style={{ background: '#F3F4F6', padding: '0 4px', borderRadius: 3 }}>client/.env</code>
      </Typography>
    </Box>
  );
};

export default PublicPlacePicker;
