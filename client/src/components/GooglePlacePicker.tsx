/**
 * GooglePlacePicker
 * An interactive Google Maps based public-place picker.
 * Uses Maps JS API (loaded via @react-google-maps/api) + Places library.
 * Env var required: VITE_GOOGLE_MAPS_KEY
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getIpLocation } from '../utils/getIpLocation';
import {
  GoogleMap,
  Marker,
  InfoWindow,
  useJsApiLoader,
} from '@react-google-maps/api';
import { Box, Typography, CircularProgress } from '@mui/material';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;
const LIBRARIES: ('places')[] = ['places'];
const FALLBACK_CENTER = { lat: 51.5074, lng: -0.1278 }; // London

// Public-place types to seed the map with (string — Maps JS API accepts any type string)
const PLACE_TYPES: string[] = [
  'park',
  'library',
  'cafe',
  'community_center',
  'restaurant',
  'school',
  'grocery_or_supermarket',
  'pharmacy',
  'gym',
];

const TYPE_ICON: Record<string, string> = {
  park:                   '🌳',
  library:                '📚',
  cafe:                   '☕',
  community_center:       '🏛️',
  restaurant:             '🍽️',
  school:                 '🏫',
  grocery_or_supermarket: '🛒',
  pharmacy:               '💊',
  gym:                    '🏋️',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface Place {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: string;
}

export interface StructuredPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
}

export interface GooglePlacePickerProps {
  value: string;
  onChange: (place: string) => void;
  userCoordinates?: [number, number]; // [lng, lat]
  onStructuredSelect?: (place: StructuredPlace) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
const GooglePlacePicker: React.FC<GooglePlacePickerProps> = ({
  value,
  onChange,
  userCoordinates,
  onStructuredSelect,
}) => {
  // Convert [lng, lat] → { lat, lng } for Google Maps
  const center: google.maps.LatLngLiteral = userCoordinates
    ? { lat: userCoordinates[1], lng: userCoordinates[0] }
    : FALLBACK_CENTER;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_KEY,
    libraries: LIBRARIES,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const serviceRef = useRef<google.maps.places.PlacesService | null>(null);
  const autocompleteRef = useRef<google.maps.places.AutocompleteService | null>(null);

  const [nearbyPlaces, setNearbyPlaces]   = useState<Place[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [hoveredPlace,  setHoveredPlace]  = useState<Place | null>(null);
  const [mapCenter,     setMapCenter]     = useState<google.maps.LatLngLiteral>(center);

  // Search state
  const [query,     setQuery]     = useState('');
  const [results,   setResults]   = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [dropOpen,  setDropOpen]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch nearby places using PlacesService ────────────────────────────────
  const fetchNearby = useCallback((loc: google.maps.LatLngLiteral) => {
    if (!serviceRef.current) return;
    setLoadingNearby(true);
    const latLng = new google.maps.LatLng(loc.lat, loc.lng);
    let remaining = PLACE_TYPES.length;
    const all: Place[] = [];

    PLACE_TYPES.forEach((type) => {
      serviceRef.current!.nearbySearch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { location: latLng, radius: 2500, type } as any,
        (results, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            results.slice(0, 6).forEach((r) => {
              if (r.place_id && r.name && r.geometry?.location) {
                all.push({
                  id:      r.place_id,
                  name:    r.name,
                  address: r.vicinity ?? r.formatted_address ?? '',
                  lat:     r.geometry.location.lat(),
                  lng:     r.geometry.location.lng(),
                  type,
                });
              }
            });
          }
          remaining -= 1;
          if (remaining === 0) {
            // deduplicate by place_id
            const seen = new Set<string>();
            setNearbyPlaces(all.filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; }));
            setLoadingNearby(false);
          }
        },
      );
    });
  }, []);

  // ── When map loads, create service instances ───────────────────────────────
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    serviceRef.current      = new google.maps.places.PlacesService(map);
    autocompleteRef.current = new google.maps.places.AutocompleteService();
    if (userCoordinates) {
      fetchNearby(center);
    } else {
      getIpLocation().then((ipLoc) => {
        const c = ipLoc ? { lat: ipLoc.lat, lng: ipLoc.lng } : FALLBACK_CENTER;
        map.panTo(c);
        fetchNearby(c);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-centre + re-fetch when userCoordinates change ──────────────────────
  const coordKey = userCoordinates
    ? `${userCoordinates[0].toFixed(5)},${userCoordinates[1].toFixed(5)}`
    : 'fallback';

  useEffect(() => {
    let cancelled = false;
    const apply = (newCenter: google.maps.LatLngLiteral) => {
      if (cancelled) return;
      setMapCenter(newCenter);
      if (mapRef.current) {
        mapRef.current.panTo(newCenter);
        mapRef.current.setZoom(14);
        fetchNearby(newCenter);
      }
    };
    if (userCoordinates) {
      apply({ lat: userCoordinates[1], lng: userCoordinates[0] });
    } else {
      // No profile coords — try IP geolocation, fall back to London
      getIpLocation().then((ipLoc) => {
        apply(ipLoc ? { lat: ipLoc.lat, lng: ipLoc.lng } : FALLBACK_CENTER);
      });
    }
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordKey, fetchNearby]);

  // ── Debounced autocomplete search ──────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || !autocompleteRef.current) { setResults([]); setDropOpen(false); return; }

    debounceRef.current = setTimeout(() => {
      setSearching(true);
      autocompleteRef.current!.getPlacePredictions(
        {
          input: query,
          location: new google.maps.LatLng(mapCenter.lat, mapCenter.lng),
          radius: 10000,
          types: ['establishment', 'geocode'],
        },
        (predictions, status) => {
          setSearching(false);
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setResults(predictions.slice(0, 8));
            setDropOpen(true);
          } else {
            setResults([]);
            setDropOpen(false);
          }
        },
      );
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mapCenter]);

  // ── Pick a prediction from the autocomplete dropdown ──────────────────────
  const pickPrediction = (pred: google.maps.places.AutocompletePrediction) => {
    if (!serviceRef.current) return;
    setDropOpen(false);
    setQuery(pred.structured_formatting.main_text);

    serviceRef.current.getDetails(
      { placeId: pred.place_id, fields: ['name', 'formatted_address', 'geometry'] },
      (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result?.geometry?.location) {
          const place: Place = {
            id:      pred.place_id,
            name:    result.name ?? pred.structured_formatting.main_text,
            address: result.formatted_address ?? pred.description,
            lat:     result.geometry.location.lat(),
            lng:     result.geometry.location.lng(),
            type:    'search',
          };
          pickPlace(place);
        }
      },
    );
  };

  // ── Select a place (marker click or autocomplete) ─────────────────────────
  const pickPlace = (place: Place) => {
    setSelectedPlace(place);
    onChange(`${place.name} — ${place.address}`);
    onStructuredSelect?.({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, category: place.type });
    setQuery(place.name);
    setDropOpen(false);
    if (mapRef.current) {
      mapRef.current.panTo({ lat: place.lat, lng: place.lng });
      mapRef.current.setZoom(16);
    }
  };

  const clearPlace = () => {
    setSelectedPlace(null);
    onChange('');
    setQuery('');
    if (mapRef.current) {
      mapRef.current.panTo(mapCenter);
      mapRef.current.setZoom(14);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (!GOOGLE_KEY) {
    return (
      <Box sx={{ padding: '2rem', textAlign: 'center', color: '#9CA3AF', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem' }}>
        Google Maps unavailable — VITE_GOOGLE_MAPS_KEY not set
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ padding: '2rem', textAlign: 'center', color: '#EF4444', fontFamily: 'Inter,sans-serif', fontSize: '0.875rem' }}>
        Failed to load Google Maps — check your API key
      </Box>
    );
  }

  return (
    <Box>
      {/* Near-user banner */}
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

      {/* Search box + dropdown */}
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
                  onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); setQuery(''); setResults([]); setDropOpen(false); }}
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
            maxHeight: '240px', overflowY: 'auto',
          }}>
            {results.map((pred) => (
              <Box
                key={pred.place_id}
                onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); pickPrediction(pred); }}
                sx={{
                  padding: '0.625rem 1rem', cursor: 'pointer',
                  display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                  borderBottom: '1px solid #F3F4F6',
                  '&:last-child': { borderBottom: 'none' },
                  '&:hover': { background: 'rgba(79,70,229,0.05)' },
                }}
              >
                <Box sx={{ color: '#6B7280', fontSize: '0.8rem', mt: '2px', flexShrink: 0 }}>
                  <i className="fas fa-map-marker-alt" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                    {pred.structured_formatting.main_text}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pred.structured_formatting.secondary_text}
                  </Typography>
                </Box>
              </Box>
            ))}
            {/* Google attribution */}
            <Box sx={{ padding: '0.375rem 1rem', textAlign: 'right', borderTop: '1px solid #F3F4F6' }}>
              <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3_hdpi.png"
                alt="Powered by Google" style={{ height: 14 }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Map */}
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

        {!isLoaded ? (
          <Box sx={{ height: 330, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
            <CircularProgress size={28} sx={{ color: '#4F46E5' }} />
          </Box>
        ) : (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '330px' }}
            center={mapCenter}
            zoom={14}
            onLoad={onMapLoad}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              styles: [
                { featureType: 'poi.business', stylers: [{ visibility: 'simplified' }] },
                { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
              ],
            }}
          >
            {/* User location dot */}
            {userCoordinates && (
              <Marker
                position={{ lat: userCoordinates[1], lng: userCoordinates[0] }}
                title="Your neighbourhood"
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: '#4F46E5',
                  fillOpacity: 1,
                  strokeColor: '#FFFFFF',
                  strokeWeight: 3,
                }}
                zIndex={999}
              />
            )}

            {/* Nearby place markers */}
            {nearbyPlaces.map((place) => {
              const isSelected = selectedPlace?.id === place.id;
              return (
                <React.Fragment key={place.id}>
                  <Marker
                    position={{ lat: place.lat, lng: place.lng }}
                    title={place.name}
                    onClick={() => pickPlace(place)}
                    onMouseOver={() => setHoveredPlace(place)}
                    onMouseOut={() => setHoveredPlace(null)}
                    icon={{
                      url: `data:image/svg+xml,${encodeURIComponent(`
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="42" viewBox="0 0 36 42">
                          <circle cx="18" cy="18" r="16"
                            fill="${isSelected ? '#4F46E5' : '#FFFFFF'}"
                            stroke="${isSelected ? '#4F46E5' : '#9CA3AF'}"
                            stroke-width="2"
                          />
                          <text x="18" y="24" text-anchor="middle" font-size="16">${TYPE_ICON[place.type] ?? '📍'}</text>
                          <polygon points="14,33 18,42 22,33" fill="${isSelected ? '#4F46E5' : '#9CA3AF'}"/>
                        </svg>
                      `)}`,
                      scaledSize: new google.maps.Size(isSelected ? 46 : 36, isSelected ? 54 : 42),
                      anchor: new google.maps.Point(isSelected ? 23 : 18, isSelected ? 54 : 42),
                    }}
                    zIndex={isSelected ? 100 : 1}
                  />

                  {/* Hover info window */}
                  {hoveredPlace?.id === place.id && !isSelected && (
                    <InfoWindow
                      position={{ lat: place.lat, lng: place.lng }}
                      options={{ disableAutoPan: true }}
                    >
                      <Box sx={{ p: '0.125rem', maxWidth: 180 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                          {place.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                          {place.address}
                        </Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: '#4F46E5', fontFamily: 'Inter,sans-serif', mt: '4px' }}>
                          Click to select
                        </Typography>
                      </Box>
                    </InfoWindow>
                  )}

                  {/* Selected info window */}
                  {isSelected && (
                    <InfoWindow
                      position={{ lat: place.lat, lng: place.lng }}
                      onCloseClick={clearPlace}
                    >
                      <Box sx={{ p: '0.125rem', maxWidth: 200 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem', mb: '2px' }}>
                          <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '0.75rem' }} />
                          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', color: '#10B981', fontFamily: 'Inter,sans-serif' }}>
                            Selected
                          </Typography>
                        </Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>
                          {place.name}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', mt: '2px' }}>
                          {place.address}
                        </Typography>
                      </Box>
                    </InfoWindow>
                  )}
                </React.Fragment>
              );
            })}
          </GoogleMap>
        )}
      </Box>

      {/* Selected location chip */}
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
        {Object.entries(TYPE_ICON).map(([type, icon]) => (
          <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.85rem' }}>{icon}</span>
            <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif', textTransform: 'capitalize' }}>
              {type.replace('_', ' ')}
            </Typography>
          </Box>
        ))}
        {userCoordinates && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: '#4F46E5', border: '2px solid #FFF', boxShadow: '0 0 0 1.5px #4F46E5' }} />
            <Typography sx={{ fontSize: '0.7rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
              Your neighbourhood
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default GooglePlacePicker;
