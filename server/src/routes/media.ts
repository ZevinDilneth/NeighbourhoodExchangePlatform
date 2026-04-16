import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { scanMedia } from '../controllers/media.controller';

// ── Accepted MIME types ───────────────────────────────────────────────────────
export const IMAGE_MIME  = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const VIDEO_MIME  = [
  'video/webm',
  'video/mp4',
  'video/ogg',
  'video/quicktime',          // MOV
  'video/x-matroska',         // MKV
  'video/x-msvideo',          // AVI (bonus)
];
export const AUDIO_MIME  = [
  'audio/mpeg',               // MP3
  'audio/wav',  'audio/x-wav',
  'audio/flac', 'audio/x-flac',
];

const ALL_MIME = [...IMAGE_MIME, ...VIDEO_MIME, ...AUDIO_MIME];

// ── Multer config ─────────────────────────────────────────────────────────────
const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB — covers video
  fileFilter: (_req, file, cb) => {
    if (ALL_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── Route ─────────────────────────────────────────────────────────────────────
const router = Router();

router.post(
  '/scan',
  authenticate,
  uploadAny.fields([
    { name: 'file',      maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },   // optional pre-captured video frame
  ]),
  scanMedia,
);

export default router;
