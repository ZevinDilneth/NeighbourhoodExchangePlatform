/**
 * MergedPlacePicker
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders Google Maps and fetches public places from BOTH APIs simultaneously:
 *   • Google Places API  — nearbySearch for parks/libraries/cafes/community centres
 *   • Mapbox Geocoding   — REST queries for the same categories
 *
 * Centre-point priority (highest → lowest):
 *   1. userCoordinates prop  (saved profile location [lng,lat] GeoJSON)
 *   2. Browser Geolocation API  (current GPS position)
 *   3. World centre at zoom 2  (prompts user to search/pan)
 *
 * Results are merged and deduplicated by proximity (<80 m).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getIpLocation } from '../utils/getIpLocation';
import {
  GoogleMap,
  Marker,
  OverlayView,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Box, Typography, CircularProgress, Chip } from '@mui/material';

// ─── Env ─────────────────────────────────────────────────────────────────────
const GOOGLE_KEY   = import.meta.env.VITE_GOOGLE_MAPS_API_KEY  as string | undefined;
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN  as string | undefined;

const LIBRARIES: ('places')[] = ['places'];

// World centre — neutral fallback so we never drop someone into the wrong country
const WORLD_CENTER: google.maps.LatLngLiteral = { lat: 20, lng: 0 };
const WORLD_ZOOM = 2;
const NEARBY_ZOOM = 14;

// ─── Place categories ─────────────────────────────────────────────────────────
const GOOGLE_TYPES  = [
  'park', 'library', 'cafe', 'community_center',
  'restaurant', 'school', 'grocery_or_supermarket', 'pharmacy', 'gym',
] as const;
const MAPBOX_QUERIES = [
  'park', 'library', 'cafe', 'community center',
  'restaurant', 'school', 'supermarket', 'pharmacy', 'gym',
] as const;

const CATEGORY_ICON: Record<string, string> = {
  park: '🌳', library: '📚', cafe: '☕',
  community_center: '🏛️', community: '🏛️', coffee: '☕',
  restaurant: '🍽️', school: '🏫',
  grocery_or_supermarket: '🛒', supermarket: '🛒',
  pharmacy: '💊', gym: '🏋️',
  search: '📍',
};
const iconFor = (cat: string) =>
  CATEGORY_ICON[cat] ??
  CATEGORY_ICON[Object.keys(CATEGORY_ICON).find(k => cat.includes(k)) ?? ''] ??
  '📍';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  source: 'google' | 'mapbox';
}

// 'browser'  — GPS succeeded
// 'profile'  — GPS failed/unavailable; profile location used as fallback
// 'ip'       — GPS + profile unavailable; approximate IP geolocation used
// 'none'     — all sources failed; world centre shown
type LocationSource = 'browser' | 'profile' | 'ip' | 'none';

export interface StructuredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export interface MergedPlacePickerProps {
  value: string;
  onChange: (place: string) => void;
  /** GeoJSON order [lng, lat] — from user.location.coordinates */
  userCoordinates?: [number, number];
  /** Hide the Park/Library/Cafe/Community legend row. Default true. */
  showLegend?: boolean;
  onStructuredSelect?: (place: StructuredPlace) => void;
}

// ─── Haversine distance (metres) ─────────────────────────────────────────────
const distM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R  = 6_371_000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

// ─── Check if coordinates are a real location (not [0, 0]) ───────────────────
const isRealCoord = (c?: [number, number]): c is [number, number] =>
  Boolean(c && (Math.abs(c[0]) > 0.001 || Math.abs(c[1]) > 0.001));

// ─── Convert [lng, lat] (GeoJSON) → Google LatLngLiteral ─────────────────────
const geoToLatLng = (c: [number, number]): google.maps.LatLngLiteral => ({
  lat: c[1],
  lng: c[0],
});

// ─── Filters to ensure only genuinely public places are shown ────────────────

// Maki icon identifiers Mapbox assigns to public places
const PUBLIC_MAKI = new Set([
  'park', 'garden', 'playground', 'pitch',
  'library', 'town-hall', 'community-education',
  'cafe', 'coffee', 'restaurant',
  'school', 'college', 'university',
  'grocery', 'supermarket', 'convenience',
  'pharmacy', 'hospital', 'medical',
  'gym', 'fitness', 'sports',
]);

// Regex that matches private-company legal suffixes in a place name.
// Any result whose name contains these is almost certainly a business, not a public place.
const BUSINESS_NAME_RE =
  /\b(ltd|pvt|inc|corp|co\.|llc|plc|gmbh|pty|sdn|bhd|n\.?v|b\.?v|a\.?g|s\.a\.|s\.r\.l\.|limited|incorporated|corporation|packaging|industries|manufacturer|factory|warehouse)\b/i;

const isPublicPlace = (name: string, maki?: string): boolean => {
  if (BUSINESS_NAME_RE.test(name)) return false;            // business name → reject
  if (maki && maki !== '' && !PUBLIC_MAKI.has(maki)) return false; // wrong maki → reject
  return true;
};

// ─── Mapbox geocoding helper ──────────────────────────────────────────────────
const fetchMapboxPlaces = async (
  query: string,
  center: google.maps.LatLngLiteral,
): Promise<Place[]> => {
  if (!MAPBOX_TOKEN) return [];
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_TOKEN}&types=poi&proximity=${center.lng},${center.lat}&limit=8&language=en`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const data: {
      features?: {
        id: string; text: string; place_name: string;
        geometry: { coordinates: [number, number] };
        properties?: { maki?: string; category?: string };
      }[];
    } = await r.json();
    return (data.features ?? [])
      .filter((f) => isPublicPlace(f.text, f.properties?.maki))
      .map((f) => ({
        id:       `mb-${f.id}`,
        name:     f.text,
        address:  f.place_name,
        lat:      f.geometry.coordinates[1],
        lng:      f.geometry.coordinates[0],
        category: query.replace(' ', '_'),
        source:   'mapbox',
      }));
  } catch { return []; }
};

// ─── Merge + deduplicate by proximity ────────────────────────────────────────
const mergePlaces = (gPlaces: Place[], mbPlaces: Place[]): Place[] => {
  const all = [...gPlaces];
  for (const mb of mbPlaces) {
    if (!all.some((g) => distM(g, mb) < 80)) all.push(mb);
  }
  return all;
};

// ─── Marker SVG ──────────────────────────────────────────────────────────────
const markerSvg = (emoji: string, selected: boolean, source: 'google' | 'mapbox') => {
  const ring = selected ? '#4F46E5' : source === 'mapbox' ? '#10B981' : '#9CA3AF';
  const bg   = selected ? '#4F46E5' : '#FFFFFF';
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
      <circle cx="20" cy="20" r="18" fill="${bg}" stroke="${ring}" stroke-width="2.5"/>
      <text x="20" y="27" text-anchor="middle" font-size="18">${emoji}</text>
      <polygon points="16,36 20,48 24,36" fill="${ring}"/>
    </svg>
  `)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
const MergedPlacePicker: React.FC<MergedPlacePickerProps> = ({
  value,
  onChange,
  userCoordinates,
  showLegend = true,
  onStructuredSelect,
}) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_KEY ?? '',
    libraries: LIBRARIES,
  });

  const mapRef      = useRef<google.maps.Map | null>(null);
  const serviceRef  = useRef<google.maps.places.PlacesService | null>(null);
  const acRef       = useRef<google.maps.places.AutocompleteService | null>(null);

  // ── Centre state ───────────────────────────────────────────────────────────
  // Resolved after checking: profile coords → browser GPS → world fallback
  const [resolvedCenter,  setResolvedCenter]  = useState<google.maps.LatLngLiteral | null>(null);
  const [resolvedZoom,    setResolvedZoom]    = useState(NEARBY_ZOOM);
  const [locationSource,  setLocationSource]  = useState<LocationSource>('none');
  const [geoLoading,      setGeoLoading]      = useState(false);
  const [geoError,        setGeoError]        = useState('');

  // ── Places ─────────────────────────────────────────────────────────────────
  const [places,       setPlaces]      = useState<Place[]>([]);
  const [fetchLoading, setFetchLoading]= useState(false);
  const [googleCount,  setGoogleCount] = useState(0);
  const [mapboxCount,  setMapboxCount] = useState(0);
  const [selected,     setSelected]    = useState<Place | null>(null);
  const [hovered,      setHovered]     = useState<Place | null>(null);

  // ── Search ─────────────────────────────────────────────────────────────────
  const [query,       setQuery]       = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searching,   setSearching]   = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Step 1: Resolve the centre ─────────────────────────────────────────────
  //
  //  Priority (highest → lowest):
  //    1. Browser GPS        (most accurate — current physical position)
  //    2. Profile location   (user's saved neighbourhood)
  //    3. IP geolocation     (approximate city-level from public IP)
  //    4. World centre zoom-2 (last resort)
  //
  useEffect(() => {
    let cancelled = false;

    const applyIpFallback = async () => {
      const ipLoc = await getIpLocation();
      if (cancelled) return;
      if (ipLoc) {
        setResolvedCenter({ lat: ipLoc.lat, lng: ipLoc.lng });
        setResolvedZoom(NEARBY_ZOOM);
        setLocationSource('ip');
        setGeoError(`Showing places near your approximate location${ipLoc.city ? ` (${ipLoc.city})` : ''} based on your IP address.`);
      } else {
        setResolvedCenter(WORLD_CENTER);
        setResolvedZoom(WORLD_ZOOM);
        setLocationSource('none');
        setGeoError('Could not determine your location — search or pan the map to find public places near you.');
      }
    };

    // No Geolocation API at all → skip to profile → IP → world
    if (!navigator.geolocation) {
      if (isRealCoord(userCoordinates)) {
        setResolvedCenter(geoToLatLng(userCoordinates));
        setResolvedZoom(NEARBY_ZOOM);
        setLocationSource('profile');
      } else {
        applyIpFallback();
      }
      return () => { cancelled = true; };
    }

    // Try GPS
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      // ✅ GPS succeeded
      (pos) => {
        if (cancelled) return;
        setGeoLoading(false);
        setResolvedCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setResolvedZoom(NEARBY_ZOOM);
        setLocationSource('browser');
      },
      // ❌ GPS denied / timed out → profile → IP → world
      () => {
        if (cancelled) return;
        setGeoLoading(false);
        if (isRealCoord(userCoordinates)) {
          setGeoError("Location access denied — using your saved neighbourhood instead.");
          setResolvedCenter(geoToLatLng(userCoordinates));
          setResolvedZoom(NEARBY_ZOOM);
          setLocationSource('profile');
        } else {
          applyIpFallback();
        }
      },
      { timeout: 8_000, maximumAge: 60_000 },
    );

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // ── When profile coords load/change AFTER mount ────────────────────────────
  // Only apply the profile update when GPS is NOT already being used,
  // so we don't override a successful GPS fix with a less-accurate saved location.
  const coordKey = isRealCoord(userCoordinates)
    ? `${userCoordinates[0].toFixed(5)},${userCoordinates[1].toFixed(5)}`
    : 'none';

  useEffect(() => {
    if (!isRealCoord(userCoordinates)) return;
    // Don't override a live GPS fix
    if (locationSource === 'browser') return;

    const c = geoToLatLng(userCoordinates);
    setResolvedCenter(c);
    setResolvedZoom(NEARBY_ZOOM);
    setLocationSource('profile');
    if (mapRef.current) {
      mapRef.current.panTo(c);
      mapRef.current.setZoom(NEARBY_ZOOM);
      fetchNearby(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordKey, locationSource]);

  // ── Fetch from both APIs ───────────────────────────────────────────────────
  const fetchNearby = useCallback(async (center: google.maps.LatLngLiteral) => {
    setFetchLoading(true);
    setPlaces([]);

    // Google Places
    const googlePlaces: Place[] = [];
    const googlePromise = new Promise<Place[]>((resolve) => {
      if (!serviceRef.current) { resolve([]); return; }
      const latLng = new google.maps.LatLng(center.lat, center.lng);
      let remaining = GOOGLE_TYPES.length;
      GOOGLE_TYPES.forEach((type) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        serviceRef.current!.nearbySearch({ location: latLng, radius: 2500, type } as any, (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            results.slice(0, 6).forEach((r) => {
              if (r.place_id && r.name && r.geometry?.location && isPublicPlace(r.name)) {
                googlePlaces.push({
                  id:       `g-${r.place_id}`,
                  name:     r.name,
                  address:  r.vicinity ?? r.formatted_address ?? '',
                  lat:      r.geometry.location.lat(),
                  lng:      r.geometry.location.lng(),
                  category: type,
                  source:   'google',
                });
              }
            });
          }
          remaining -= 1;
          if (remaining === 0) resolve(googlePlaces);
        });
      });
    });

    // Mapbox (parallel)
    const mapboxPromise = Promise.all(
      MAPBOX_QUERIES.map((q) => fetchMapboxPlaces(q, center)),
    ).then((arrs) => {
      const flat = arrs.flat();
      const seen = new Set<string>();
      return flat.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
    });

    const [gPlaces, mbPlaces] = await Promise.all([googlePromise, mapboxPromise]);
    setGoogleCount(gPlaces.length);
    setMapboxCount(mbPlaces.length);

    const merged = mergePlaces(gPlaces, mbPlaces);
    const seen = new Set<string>();
    setPlaces(merged.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
    setFetchLoading(false);
  }, []);

  // ── When map loads — create service instances + initial fetch ──────────────
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current    = map;
    serviceRef.current = new google.maps.places.PlacesService(map);
    acRef.current      = new google.maps.places.AutocompleteService();
    // If resolvedCenter is already known (profile coords were available before map load), fetch now
    if (resolvedCenter && locationSource !== 'none') {
      fetchNearby(resolvedCenter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedCenter, locationSource]);

  // ── Fetch once resolvedCenter is set (handles GPS async resolution) ────────
  useEffect(() => {
    if (!resolvedCenter || locationSource === 'none') return;
    if (!serviceRef.current) return; // map not loaded yet — onMapLoad will call fetchNearby
    fetchNearby(resolvedCenter);
    if (mapRef.current) {
      mapRef.current.panTo(resolvedCenter);
      mapRef.current.setZoom(resolvedZoom);
    }
  }, [resolvedCenter, locationSource, fetchNearby, resolvedZoom]);

  // ── Search autocomplete ────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !acRef.current) { setSuggestions([]); setDropOpen(false); return; }

    const searchCenter = resolvedCenter ?? WORLD_CENTER;
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      acRef.current!.getPlacePredictions(
        { input: query, location: new google.maps.LatLng(searchCenter.lat, searchCenter.lng), radius: 20_000 },
        (preds, status) => {
          setSearching(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
            setSuggestions(preds.slice(0, 8)); setDropOpen(true);
          } else {
            setSuggestions([]); setDropOpen(false);
          }
        },
      );
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, resolvedCenter]);

  // ── Pick autocomplete suggestion → resolve full details ────────────────────
  const pickSuggestion = (pred: google.maps.places.AutocompletePrediction) => {
    setDropOpen(false);
    setQuery(pred.structured_formatting.main_text);
    if (!serviceRef.current) return;
    serviceRef.current.getDetails(
      { placeId: pred.place_id, fields: ['name', 'formatted_address', 'geometry'] },
      (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
          pickPlace({
            id: `s-${pred.place_id}`, name: result.name ?? pred.structured_formatting.main_text,
            address: result.formatted_address ?? pred.description,
            lat: result.geometry.location.lat(), lng: result.geometry.location.lng(),
            category: 'search', source: 'google',
          });
        }
      },
    );
  };

  // ── Pick a place ───────────────────────────────────────────────────────────
  const pickPlace = (place: Place) => {
    setSelected(place);
    onChange(`${place.name} — ${place.address}`);
    onStructuredSelect?.({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, category: place.category });
    setQuery(place.name);
    setDropOpen(false);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: place.lat, lng: place.lng });
      mapRef.current.setZoom(16);
    }
  };

  const clearPlace = () => {
    setSelected(null); onChange(''); setQuery('');
    if (mapRef.current && resolvedCenter) {
      mapRef.current.panTo(resolvedCenter);
      mapRef.current.setZoom(resolvedZoom);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <Box sx={{ p: '2rem', textAlign: 'center', color: '#EF4444', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem' }}>
        <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem' }} />
        Failed to load Google Maps — check <code>VITE_GOOGLE_MAPS_API_KEY</code>
      </Box>
    );
  }

  const mapInitCenter = resolvedCenter ?? WORLD_CENTER;
  const mapInitZoom   = resolvedCenter ? resolvedZoom : WORLD_ZOOM;

  // ─── Result count chips (reused across banners) ───────────────────────────
  const CountChips = () => (
    <>
      {googleCount > 0 && <Chip label={`${googleCount} Google`} size="small" sx={{ fontSize: '0.6rem', height: 18, background: 'rgba(79,70,229,0.12)', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }} />}
      {mapboxCount > 0 && <Chip label={`${mapboxCount} Mapbox`}  size="small" sx={{ fontSize: '0.6rem', height: 18, background: 'rgba(16,185,129,0.12)', color: '#10B981', fontFamily: 'Inter,sans-serif' }} />}
    </>
  );

  // ─── Status banner ────────────────────────────────────────────────────────
  const renderBanner = () => {
    // Detecting GPS…
    if (geoLoading) return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem', padding: '0.5rem 0.875rem', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '0.5rem' }}>
        <CircularProgress size={13} sx={{ color: '#4F46E5' }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
          Detecting your location…
        </Typography>
      </Box>
    );

    // GPS success — current position
    if (locationSource === 'browser') return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '0.75rem', padding: '0.5rem 0.875rem', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.22)', borderRadius: '0.5rem' }}>
        <i className="fas fa-location-arrow" style={{ color: '#10B981', fontSize: '0.8rem', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#10B981', fontFamily: 'Inter,sans-serif', flex: 1 }}>
          Showing public places near your current location
        </Typography>
        {!fetchLoading && places.length > 0 && <Box sx={{ display: 'flex', gap: '0.25rem' }}><CountChips /></Box>}
      </Box>
    );

    // GPS blocked → using profile location as fallback
    if (locationSource === 'profile' && geoError) return (
      <Box sx={{ mb: '0.75rem', borderRadius: '0.5rem', overflow: 'hidden', border: '1px solid rgba(245,158,11,0.3)' }}>
        {/* amber notice */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.4rem 0.875rem', background: 'rgba(245,158,11,0.08)' }}>
          <i className="fas fa-lock" style={{ color: '#D97706', fontSize: '0.72rem', marginTop: '2px', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.73rem', color: '#92400E', fontFamily: 'Inter,sans-serif' }}>
            {geoError}
          </Typography>
        </Box>
        {/* indigo row — profile location active */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.4rem 0.875rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.07), rgba(16,185,129,0.07))' }}>
          <i className="fas fa-home" style={{ color: '#4F46E5', fontSize: '0.8rem', flexShrink: 0 }} />
          <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>
            Showing public places near your saved neighbourhood
          </Typography>
          {!fetchLoading && places.length > 0 && <Box sx={{ display: 'flex', gap: '0.25rem' }}><CountChips /></Box>}
        </Box>
      </Box>
    );

    // Profile location available — no GPS error (geolocation not supported on device)
    if (locationSource === 'profile') return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '0.75rem', padding: '0.5rem 0.875rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.07), rgba(16,185,129,0.07))', border: '1px solid rgba(79,70,229,0.22)', borderRadius: '0.5rem' }}>
        <i className="fas fa-home" style={{ color: '#4F46E5', fontSize: '0.8rem', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>
          Showing public places near your saved neighbourhood
        </Typography>
        {!fetchLoading && places.length > 0 && <Box sx={{ display: 'flex', gap: '0.25rem' }}><CountChips /></Box>}
      </Box>
    );

    // IP geolocation used
    if (locationSource === 'ip') return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '0.75rem', padding: '0.5rem 0.875rem', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: '0.5rem' }}>
        <i className="fas fa-globe" style={{ color: '#4F46E5', fontSize: '0.8rem', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>
          {geoError || 'Showing places near your approximate IP-based location'}
        </Typography>
        {!fetchLoading && places.length > 0 && <Box sx={{ display: 'flex', gap: '0.25rem' }}><CountChips /></Box>}
      </Box>
    );

    // Neither GPS nor profile — search prompt
    if (geoError) return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.75rem', padding: '0.5rem 0.875rem', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '0.5rem' }}>
        <i className="fas fa-map-signs" style={{ color: '#D97706', fontSize: '0.8rem', marginTop: '1px', flexShrink: 0 }} />
        <Typography sx={{ fontSize: '0.78rem', color: '#92400E', fontFamily: 'Inter,sans-serif' }}>
          {geoError}
        </Typography>
      </Box>
    );

    return null;
  };

  return (
    <Box>
      {renderBanner()}

      {/* ── Search input ──────────────────────────────────────────────────── */}
      <Box sx={{ position: 'relative', mb: '0.75rem' }}>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF', fontSize: '0.8rem', pointerEvents: 'none' }}>
            <i className="fas fa-search" />
          </Box>
          <Box
            component="input"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onFocus={() => { if (suggestions.length) setDropOpen(true); }}
            onBlur={() => setTimeout(() => setDropOpen(false), 160)}
            placeholder="Search parks, libraries, cafes, community centres…"
            sx={{
              width: '100%', padding: '0.875rem 2.75rem',
              border: '1px solid #E5E7EB', borderRadius: '0.5rem',
              fontSize: '0.875rem', color: '#1F2937', background: '#FFF',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif',
              '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
              '&::placeholder': { color: '#9CA3AF' },
            }}
          />
          <Box sx={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)' }}>
            {searching
              ? <CircularProgress size={15} sx={{ color: '#4F46E5', display: 'block' }} />
              : query && (
                <Box component="span"
                  onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); setQuery(''); setSuggestions([]); setDropOpen(false); }}
                  sx={{ color: '#9CA3AF', cursor: 'pointer', '&:hover': { color: '#374151' } }}>
                  <i className="fas fa-times-circle" />
                </Box>
              )}
          </Box>
        </Box>

        {dropOpen && suggestions.length > 0 && (
          <Box sx={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1400, maxHeight: 240, overflowY: 'auto' }}>
            {suggestions.map((s) => (
              <Box key={s.place_id}
                onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); pickSuggestion(s); }}
                sx={{ padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.625rem', borderBottom: '1px solid #F3F4F6', '&:last-child': { borderBottom: 'none' }, '&:hover': { background: 'rgba(79,70,229,0.05)' } }}
              >
                <i className="fas fa-map-marker-alt" style={{ color: '#6B7280', fontSize: '0.75rem', marginTop: '3px', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                    {s.structured_formatting.main_text}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.structured_formatting.secondary_text}
                  </Typography>
                </Box>
              </Box>
            ))}
            <Box sx={{ padding: '0.3rem 1rem', textAlign: 'right', borderTop: '1px solid #F3F4F6' }}>
              <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3_hdpi.png" alt="Powered by Google" style={{ height: 13 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* ── Map ───────────────────────────────────────────────────────────── */}
      <Box sx={{ borderRadius: '0.875rem', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative' }}>
        {fetchLoading && (
          <Box sx={{ position: 'absolute', top: '0.75rem', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(255,255,255,0.95)', borderRadius: '2rem', padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}>
            <CircularProgress size={14} sx={{ color: '#4F46E5' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
              Loading from Google + Mapbox…
            </Typography>
          </Box>
        )}

        {!isLoaded ? (
          <Box sx={{ height: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', gap: '0.75rem' }}>
            <CircularProgress size={24} sx={{ color: '#4F46E5' }} />
            <Typography sx={{ color: '#6B7280', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem' }}>
              Loading map…
            </Typography>
          </Box>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '340px' }}
            center={mapInitCenter}
            zoom={mapInitZoom}
            onLoad={onMapLoad}
            options={{
              zoomControl: true, streetViewControl: false,
              mapTypeControl: false, fullscreenControl: true,
              styles: [
                { featureType: 'poi.business',    stylers: [{ visibility: 'simplified' }] },
                { featureType: 'transit',          stylers: [{ visibility: 'simplified' }] },
              ],
            }}
          >
            {/* User location dot — profile (clickable) */}
            {locationSource === 'profile' && userCoordinates && isRealCoord(userCoordinates) && (
              <Marker
                position={geoToLatLng(userCoordinates)}
                title="Click to select your neighbourhood"
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#4F46E5', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 }}
                zIndex={9999}
                cursor="pointer"
                onClick={() => {
                  const pos = geoToLatLng(userCoordinates);
                  pickPlace({ id: 'user-profile', name: 'My Neighbourhood', address: 'Your saved location', lat: pos.lat, lng: pos.lng, category: 'search', source: 'google' });
                }}
              />
            )}

            {/* User location dot — browser GPS (clickable) */}
            {locationSource === 'browser' && resolvedCenter && (
              <Marker
                position={resolvedCenter}
                title="Click to select your current location"
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#10B981', fillOpacity: 1, strokeColor: '#FFFFFF', strokeWeight: 3 }}
                zIndex={9999}
                cursor="pointer"
                onClick={() => {
                  pickPlace({ id: 'user-gps', name: 'My Current Location', address: 'Your GPS location', lat: resolvedCenter.lat, lng: resolvedCenter.lng, category: 'search', source: 'google' });
                }}
              />
            )}

            {/* User location dot — IP-based approximate location */}
            {locationSource === 'ip' && resolvedCenter && (
              <Marker
                position={resolvedCenter}
                title="Approximate location from IP address"
                icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#4F46E5', fillOpacity: 0.7, strokeColor: '#FFFFFF', strokeWeight: 3 }}
                zIndex={9998}
              />
            )}

            {/* Place markers */}
            {places.map((place) => {
              const isSel = selected?.id === place.id;
              return (
                <Marker
                  key={place.id}
                  position={{ lat: place.lat, lng: place.lng }}
                  title={place.name}
                  onClick={() => pickPlace(place)}
                  onMouseOver={() => setHovered(place)}
                  onMouseOut={() => setHovered(null)}
                  icon={{
                    url: markerSvg(iconFor(place.category), isSel, place.source),
                    scaledSize: new google.maps.Size(isSel ? 50 : 40, isSel ? 60 : 48),
                    anchor: new google.maps.Point(isSel ? 25 : 20, isSel ? 60 : 48),
                  }}
                  zIndex={isSel ? 500 : place.source === 'google' ? 2 : 1}
                />
              );
            })}

            {/* Hover tooltip via OverlayView — no InfoWindow chrome, no × button, no white box */}
            {hovered && selected?.id !== hovered.id && (
              <OverlayView
                key={hovered.id}
                position={{ lat: hovered.lat, lng: hovered.lng }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div style={{
                  transform: 'translate(-50%, calc(-100% - 54px))',
                  background: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: 8,
                  padding: '8px 12px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Inter, sans-serif',
                  minWidth: 140,
                  maxWidth: 220,
                  position: 'relative',
                }}>
                  {/* Arrow */}
                  <div style={{
                    position: 'absolute', bottom: -7, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0, height: 0,
                    borderLeft: '7px solid transparent',
                    borderRight: '7px solid transparent',
                    borderTop: '7px solid #FFFFFF',
                    filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))',
                  }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{hovered.name}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                      background: hovered.source === 'google' ? 'rgba(79,70,229,0.12)' : 'rgba(16,185,129,0.12)',
                      color: hovered.source === 'google' ? '#4F46E5' : '#10B981',
                    }}>
                      {hovered.source === 'google' ? 'G' : 'M'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, whiteSpace: 'normal' }}>{hovered.address}</div>
                  <div style={{ fontSize: 10, color: '#4F46E5', marginTop: 5, fontWeight: 600 }}>Click to select</div>
                </div>
              </OverlayView>
            )}

            {/* No dialog InfoWindow for selected — the chip below the map shows the selection */}
          </GoogleMap>
        )}
      </Box>

      {/* ── Legend ────────────────────────────────────────────────────────── */}
      <Box sx={{ mt: '0.5rem', display: 'flex', gap: '0.875rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {showLegend && ['🌳 Park', '📚 Library', '☕ Cafe', '🏛️ Community'].map((label) => (
          <Typography key={label} sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>{label}</Typography>
        ))}
        <Box sx={{ ml: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {GOOGLE_KEY && <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Box sx={{ width: 9, height: 9, borderRadius: '50%', background: '#4F46E5' }} /><Typography sx={{ fontSize: '0.65rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Google</Typography></Box>}
          {MAPBOX_TOKEN && <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Box sx={{ width: 9, height: 9, borderRadius: '50%', background: '#10B981' }} /><Typography sx={{ fontSize: '0.65rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>Mapbox</Typography></Box>}
          {locationSource !== 'none' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', background: locationSource === 'profile' ? '#4F46E5' : '#10B981', border: '2px solid #FFF', boxShadow: `0 0 0 1.5px ${locationSource === 'profile' ? '#4F46E5' : '#10B981'}` }} />
              <Typography sx={{ fontSize: '0.65rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                {locationSource === 'profile' ? 'Your neighbourhood' : locationSource === 'ip' ? 'IP location' : 'Your position'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      {/* ── Selected chip ─────────────────────────────────────────────────── */}
      {value && (
        <Box sx={{ mt: '0.75rem', padding: '0.625rem 1rem', background: 'linear-gradient(135deg, rgba(79,70,229,0.06), rgba(16,185,129,0.06))', borderRadius: '0.5rem', border: '1px solid rgba(79,70,229,0.22)', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#4F46E5', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>Selected meeting location</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif', mt: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</Typography>
          </Box>
          <Box onClick={clearPlace} sx={{ cursor: 'pointer', color: '#9CA3AF', flexShrink: 0, '&:hover': { color: '#EF4444' } }} title="Clear">
            <i className="fas fa-times" />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default MergedPlacePicker;
