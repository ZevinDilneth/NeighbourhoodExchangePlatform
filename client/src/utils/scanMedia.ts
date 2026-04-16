import api from '../services/api';

export interface ScanResult {
  safe: boolean;
  reason?: string;
}

// File types the scanner accepts
export const SCAN_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const SCAN_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',    // MOV
  'video/x-matroska',  // MKV
  'video/x-msvideo',   // AVI
];
export const SCAN_AUDIO_TYPES = [
  'audio/mpeg',         // MP3
  'audio/wav', 'audio/x-wav',
  'audio/flac', 'audio/x-flac',
];
export const ALL_SCAN_TYPES = [
  ...SCAN_IMAGE_TYPES,
  ...SCAN_VIDEO_TYPES,
  ...SCAN_AUDIO_TYPES,
];


/**
 * Send a file to the server NSFW scan endpoint immediately on selection.
 *
 * - Images (JPG/PNG/WebP): direct ML scan
 * - GIF: frame-by-frame ML scan via ffmpeg on server
 * - Videos (MP4/MOV/MKV/WebM): full frame-by-frame ML scan via ffmpeg (same as GIF)
 * - Audio (MP3/WAV/FLAC): server extracts embedded cover art and scans it;
 *   if no cover art exists the file is safe
 *
 * Fails open on network/server error so the user isn't blocked by
 * infrastructure issues.
 */
export const scanMedia = async (file: File): Promise<ScanResult> => {
  try {
    const fd = new FormData();

    // Send the full file for all types — videos are scanned frame-by-frame on the
    // server via ffmpeg (same method as GIFs). Files are already gated to ≤100 MB
    // before scanMedia is called, so this stays within the multer limit.
    fd.append('file', file);

    const res = await api.post<ScanResult>('/media/scan', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 5 * 60 * 1000, // large video/audio scans can take time
    });
    return res.data;
  } catch {
    // Fail open — server-side scan on actual upload is the backstop
    return { safe: true };
  }
};
