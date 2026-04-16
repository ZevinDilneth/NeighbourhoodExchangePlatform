import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import {
  scanImageBuffer,
  scanVideoBuffer,
  scanGifBuffer,
  scanAudioBuffer,
} from '../services/moderation';
import { createError } from '../middleware/errorHandler';
import { IMAGE_MIME, VIDEO_MIME, AUDIO_MIME } from '../routes/media';

// Extension helpers — ffmpeg needs a real extension to detect the container
const mimeToExt: Record<string, string> = {
  'video/mp4':         'mp4',
  'video/webm':        'webm',
  'video/ogg':         'ogg',
  'video/quicktime':   'mov',
  'video/x-matroska':  'mkv',
  'video/x-msvideo':   'avi',
  'audio/mpeg':        'mp3',
  'audio/wav':         'wav',
  'audio/x-wav':       'wav',
  'audio/flac':        'flac',
  'audio/x-flac':      'flac',
};

export const scanMedia = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const files     = req.files as Record<string, Express.Multer.File[]> | undefined;
    const file      = files?.['file']?.[0];
    const thumbnail = files?.['thumbnail']?.[0];

    if (!file) return next(createError('No file provided', 400));

    const mime = file.mimetype;
    let result: { safe: boolean; reason?: string };

    // ── GIF ──────────────────────────────────────────────────────────────────
    if (mime === 'image/gif') {
      result = await scanGifBuffer(file.buffer);

    // ── Static image ─────────────────────────────────────────────────────────
    } else if (IMAGE_MIME.includes(mime)) {
      result = await scanImageBuffer(file.buffer);

    // ── Video ────────────────────────────────────────────────────────────────
    } else if (VIDEO_MIME.includes(mime)) {
      // Fast path: scan client-captured thumbnail first (avoids full video scan if NSFW)
      if (thumbnail) {
        const thumbResult = await scanImageBuffer(thumbnail.buffer);
        if (!thumbResult.safe) {
          res.json({ safe: false, reason: thumbResult.reason });
          return;
        }
      }
      const ext = mimeToExt[mime] ?? 'mp4';
      result = await scanVideoBuffer(file.buffer, ext);

    // ── Audio ────────────────────────────────────────────────────────────────
    } else if (AUDIO_MIME.includes(mime)) {
      const ext = mimeToExt[mime] ?? 'mp3';
      result = await scanAudioBuffer(file.buffer, ext);

    } else {
      return next(createError(`Unsupported file type: ${mime}`, 400));
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
};
