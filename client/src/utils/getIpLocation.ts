/**
 * getIpLocation — resolves approximate coordinates from the user's public IP.
 *
 * Tries ipapi.co first (no key needed, ~45k req/month free).
 * Falls back to ipwho.is if the first call fails.
 * Returns null when both fail (e.g. offline, VPN, corporate proxy).
 */
export interface IpLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export async function getIpLocation(): Promise<IpLocation | null> {
  // ── Primary: ipapi.co ────────────────────────────────────────────────────
  try {
    const res = await fetch('https://ipapi.co/json/', {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country_name };
      }
    }
  } catch { /* ignore */ }

  // ── Fallback: ipwho.is ───────────────────────────────────────────────────
  try {
    const res = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country };
      }
    }
  } catch { /* ignore */ }

  return null;
}
