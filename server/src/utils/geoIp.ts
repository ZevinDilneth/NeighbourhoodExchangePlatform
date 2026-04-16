import geoip from 'geoip-lite';
import { Request } from 'express';

export interface GeoLocation {
  country?: string;
  city?: string;
  zip?: string;
}

const PRIVATE_RANGES = ['::1', '127.0.0.1', '::ffff:127.0.0.1'];
const isPrivate = (ip: string) =>
  PRIVATE_RANGES.includes(ip) ||
  ip.startsWith('192.168.') ||
  ip.startsWith('10.')       ||
  ip.startsWith('172.16.')   ||
  ip.startsWith('172.17.')   ||
  ip.startsWith('172.18.')   ||
  ip.startsWith('172.19.')   ||
  ip.startsWith('172.2')     ||
  ip.startsWith('172.3');

export const getGeoLocation = (ip: string): GeoLocation => {
  try {
    if (isPrivate(ip)) return { country: 'Local', city: 'localhost' };
    const geo = geoip.lookup(ip);
    if (!geo) return {};
    return {
      country: geo.country || undefined,
      city:    geo.city    || undefined,
      zip:     (geo as unknown as { zip?: string }).zip || undefined,
    };
  } catch {
    return {};
  }
};

export const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return raw.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
};
