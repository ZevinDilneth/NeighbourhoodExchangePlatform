/**
 * MapboxPlacePicker
 * Interactive public-place picker powered by Mapbox GL + Geocoding API.
 * Env var required: VITE_MAPBOX_ACCESS_TOKEN
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Box, Typography, CircularProgress } from '@mui/material';
import { getIpLocation } from '../utils/getIpLocation';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string;

const FALLBACK: [number, number] = [-0.1278, 51.5074]; // London
const SEED_QUERIES = [
  'park', 'library', 'community center', 'cafe', 'coffee',
  'restaurant', 'school', 'supermarket', 'pharmacy', 'gym',
];

const categoryIcon = (cat: string): string => {
  if (cat.includes('park'))        return '🌳';
  if (cat.includes('library'))     return '📚';
  if (cat.includes('community'))   return '🏛️';
  if (cat.includes('restaurant'))  return '🍽️';
  if (cat.includes('school'))      return '🏫';
  if (cat.includes('supermarket')) return '🛒';
  if (cat.includes('pharmacy'))    return '💊';
  if (cat.includes('gym'))         return '🏋️';
  return '☕';
};

interface Place {
  id: string;
  name: string;
  address: string;
  coordinates: [number, number]; // [lng, lat]
  category: string;
}

interface GeocoderFeature {
  id: string;
  text: string;
  place_name: string;
  geometry: { coordinates: [number, number] };
}

export interface StructuredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export interface MapboxPlacePickerProps {
  value: string;
  onChange: (place: string) => void;
  userCoordinates?: [number, number]; // [lng, lat]
  onStructuredSelect?: (place: StructuredPlace) => void;
}

const geocode = async (
  query: string,
  proximity: [number, number],
  types = 'poi',
  limit = 6,
): Promise<Place[]> => {
  const [lng, lat] = proximity;
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
    `?access_token=${MAPBOX_TOKEN}` +
    `&types=${types}` +
    `&proximity=${lng},${lat}` +
    `&limit=${limit}` +
    `&language=en`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data: { features?: GeocoderFeature[] } = await res.json();
  return (data.features ?? []).map((f) => ({
    id: f.id,
    name: f.text,
    address: f.place_name,
    coordinates: f.geometry.coordinates,
    category: query,
  }));
};

const MapboxPlacePicker: React.FC<MapboxPlacePickerProps> = ({
  value,
  onChange,
  userCoordinates,
  onStructuredSelect,
}) => {
  const center: [number, number] = userCoordinates ?? FALLBACK;

  const [viewState, setViewState] = useState({
    longitude: center[0],
    latitude:  center[1],
    zoom: 14,
  });

  const [nearbyPlaces,  setNearbyPlaces]  = useState<Place[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlace,  setHoveredPlace]  = useState<Place | null>(null);

  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropOpen,  setDropOpen]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable coord key to avoid re-fetching on every render
  const coordKey = userCoordinates
    ? `${userCoordinates[0].toFixed(5)},${userCoordinates[1].toFixed(5)}`
    : 'fallback';

  const fetchNearby = useCallback(async (coord: [number, number]) => {
    if (!MAPBOX_TOKEN) return;
    setLoadingNearby(true);
    try {
      const arrays = await Promise.all(SEED_QUERIES.map((q) => geocode(q, coord)));
      const all  = arrays.flat();
      const seen = new Set<string>();
      setNearbyPlaces(
        all.filter((p) => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        }),
      );
    } catch {/* fail silently */}
    finally { setLoadingNearby(false); }
  }, []);

  // Re-centre + re-fetch when userCoordinates change (or resolve via IP on first mount)
  useEffect(() => {
    let cancelled = false;
    if (userCoordinates) {
      const coord = userCoordinates;
      setViewState((prev) => ({ ...prev, longitude: coord[0], latitude: coord[1] }));
      fetchNearby(coord);
    } else {
      // No profile coords — try IP geolocation, fall back to London
      getIpLocation().then((ipLoc) => {
        if (cancelled) return;
        const coord: [number, number] = ipLoc ? [ipLoc.lng, ipLoc.lat] : FALLBACK;
        setViewState((prev) => ({ ...prev, longitude: coord[0], latitude: coord[1] }));
        fetchNearby(coord);
      });
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordKey, fetchNearby]);

  // Debounced geocoding search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setDropOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      if (!MAPBOX_TOKEN) return;
      setSearching(true);
      try {
        const places = await geocode(query, center, 'poi,place', 8);
        setResults(places);
        setDropOpen(true);
      } catch {/* fail silently */}
      finally { setSearching(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const pickPlace = (place: Place) => {
    setSelectedPlace(place);
    onChange(`${place.name} — ${place.address}`);
    onStructuredSelect?.({ name: place.name, address: place.address, lat: place.coordinates[1], lng: place.coordinates[0], category: place.category });
    setQuery(place.name);
    setDropOpen(false);
    setViewState((prev) => ({
      ...prev,
      longitude: place.coordinates[0],
      latitude:  place.coordinates[1],
      zoom: 16,
    }));
  };

  const clearPlace = () => {
    setSelectedPlace(null);
    onChange('');
    setQuery('');
    setViewState((prev) => ({ ...prev, longitude: center[0], latitude: center[1], zoom: 14 }));
  };

  return (
    <Box>
      {userCoordinates && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          mb: '0.75rem', padding: '0.5rem 0.875rem',
          background: 'rgba(79,70,229,0.06)',
          border: '1px solid rgba(79,70,229,0.2)',
          borderRadius: '0.5rem',
        }}>
          <i className="fas fa-location-arrow" style={{ color: '#4F46E5', fontSize: '0.75rem' }} />
          <Typography sx={{ fontSize: '0.78rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
            Showing public places near your saved neighbourhood
          </Typography>
        </Box>
      )}

      {/* Search input + dropdown */}
      <Box sx={{ position: 'relative', mb: '0.75rem' }}>
        <Box sx={{ position: 'relative' }}>
          <Box sx={{
            position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)',
            color: '#9CA3AF', fontSize: '0.875rem', pointerEvents: 'none',
          }}>
            <i className="fas fa-search" />
          </Box>
          <Box
            component="input"
            value={query}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
            onFocus={() => { if (results.length) setDropOpen(true); }}
            onBlur={() => setTimeout(() => setDropOpen(false), 160)}
            placeholder="Search for a park, library, cafe, community centre…"
            sx={{
              width: '100%', padding: '0.875rem 2.75rem',
              border: '1px solid #E5E7EB', borderRadius: '0.5rem',
              fontSize: '0.875rem', color: '#1F2937', background: '#FFF',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter,sans-serif',
              transition: 'border-color 0.2s',
              '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
              '&::placeholder': { color: '#9CA3AF' },
            }}
          />
          <Box sx={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)' }}>
            {searching
              ? <CircularProgress size={16} sx={{ color: '#4F46E5', display: 'block' }} />
              : query && (
                <Box
                  component="span"
                  onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    setQuery(''); setResults([]); setDropOpen(false);
                  }}
                  sx={{ color: '#9CA3AF', cursor: 'pointer', fontSize: '0.875rem', '&:hover': { color: '#374151' } }}
                >
                  <i className="fas fa-times-circle" />
                </Box>
              )
            }
          </Box>
        </Box>

        {dropOpen && results.length > 0 && (
          <Box sx={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: '#FFF', border: '1px solid #E5E7EB', borderRadius: '0.5rem',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1200,
            maxHeight: '220px', overflowY: 'auto',
          }}>
            {results.map((place) => (
              <Box
                key={place.id}
                onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); pickPlace(place); }}
                sx={{
                  padding: '0.625rem 1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  borderBottom: '1px solid #F3F4F6',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { background: 'rgba(79,70,229,0.05)' },
                }}
              >
                <Box sx={{ fontSize: '1.1rem', mt: '2px', flexShrink: 0 }}>{categoryIcon(place.category)}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {place.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {place.address}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Mapbox GL Map */}
      <Box sx={{ borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #E5E7EB', position: 'relative' }}>
        {loadingNearby && (
          <Box sx={{
            position: 'absolute', top: '0.625rem', right: '0.625rem', zIndex: 10,
            background: 'rgba(255,255,255,0.92)', borderRadius: '0.5rem',
            padding: '0.375rem 0.625rem',
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}>
            <CircularProgress size={12} sx={{ color: '#4F46E5' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#374151', fontFamily: 'Inter,sans-serif' }}>
              Loading nearby places…
            </Typography>
          </Box>
        )}

        {!MAPBOX_TOKEN ? (
          <Box sx={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
            <Typography sx={{ color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem' }}>
              Map unavailable — VITE_MAPBOX_ACCESS_TOKEN not set
            </Typography>
          </Box>
        ) : (
          <Map
            {...viewState}
            onMove={(e) => setViewState(e.viewState)}
            style={{ width: '100%', height: '330px' }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={MAPBOX_TOKEN}
            reuseMaps
          >
            <NavigationControl position="top-left" />

            {userCoordinates && (
              <Marker longitude={userCoordinates[0]} latitude={userCoordinates[1]}>
                <Box
                  title="Your neighbourhood"
                  sx={{
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#4F46E5', border: '3px solid #FFF',
                    boxShadow: '0 0 0 3px rgba(79,70,229,0.35)',
                    cursor: 'default',
                  }}
                />
              </Marker>
            )}

            {nearbyPlaces.map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <Marker
                  key={place.id}
                  longitude={place.coordinates[0]}
                  latitude={place.coordinates[1]}
                  onClick={(e) => { e.originalEvent.stopPropagation(); pickPlace(place); }}
                >
                  <Box
                    onMouseEnter={() => setHoveredPlace(place)}
                    onMouseLeave={() => setHoveredPlace(null)}
                    sx={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      cursor: 'pointer',
                      transform: isSelected ? 'scale(1.35)' : 'scale(1)',
                      transition: 'transform 0.15s',
                      '&:hover': { transform: 'scale(1.2)' },
                    }}
                  >
                    <Box sx={{
                      background: isSelected ? '#4F46E5' : '#FFFFFF',
                      border: `2px solid ${isSelected ? '#4F46E5' : '#9CA3AF'}`,
                      borderRadius: '50%', width: 30, height: 30,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem',
                      boxShadow: isSelected
                        ? '0 3px 14px rgba(79,70,229,0.5)'
                        : '0 2px 6px rgba(0,0,0,0.18)',
                    }}>
                      {categoryIcon(place.category)}
                    </Box>
                    <Box sx={{
                      width: 0, height: 0,
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: `5px solid ${isSelected ? '#4F46E5' : '#9CA3AF'}`,
                    }} />
                  </Box>
                </Marker>
              );
            })}

            {hoveredPlace && !selectedPlace && (
              <Popup
                longitude={hoveredPlace.coordinates[0]}
                latitude={hoveredPlace.coordinates[1]}
                closeButton={false}
                anchor="bottom"
                offset={44}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                <Box sx={{ p: '0.25rem 0.125rem', maxWidth: 180 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                    {hoveredPlace.name}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                    {hoveredPlace.address}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', mt: '4px' }}>
                    Click to select
                  </Typography>
                </Box>
              </Popup>
            )}
          </Map>
        )}
      </Box>

      {value && (
        <Box sx={{
          mt: '0.75rem', padding: '0.625rem 1rem',
          background: 'rgba(79,70,229,0.06)', borderRadius: '0.5rem',
          border: '1px solid rgba(79,70,229,0.25)',
          display: 'flex', alignItems: 'center', gap: '0.625rem',
        }}>
          <i className="fas fa-map-marker-alt" style={{ color: '#4F46E5', flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4F46E5', fontFamily: 'Inter,sans-serif' }}>
              Selected location
            </Typography>
            <Typography sx={{ fontSize: '0.78rem', color: '#374151', fontFamily: 'Inter,sans-serif', mt: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {value}
            </Typography>
          </Box>
          <Box
            onClick={clearPlace}
            sx={{ cursor: 'pointer', color: '#9CA3AF', flexShrink: 0, fontSize: '0.8rem', '&:hover': { color: '#EF4444' } }}
            title="Clear selection"
          >
            <i className="fas fa-times" />
          </Box>
        </Box>
      )}

      {/* Legend */}
      <Box sx={{ mt: '0.5rem', display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
        {[
          { icon: '🌳', label: 'Park' },
          { icon: '📚', label: 'Library' },
          { icon: '🏛️', label: 'Community Centre' },
          { icon: '☕', label: 'Cafe' },
          { icon: '🍽️', label: 'Restaurant' },
          { icon: '🏫', label: 'School' },
          { icon: '🛒', label: 'Supermarket' },
          { icon: '💊', label: 'Pharmacy' },
          { icon: '🏋️', label: 'Gym' },
        ].map((item) => (
          <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem' }}>{item.icon}</span>
            <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
              {item.label}
            </Typography>
          </Box>
        ))}
        {userCoordinates && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Box sx={{
              width: 10, height: 10, borderRadius: '50%',
              background: '#4F46E5', border: '2px solid #FFF',
              boxShadow: '0 0 0 1.5px #4F46E5',
            }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
              Your neighbourhood
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default MapboxPlacePicker;
