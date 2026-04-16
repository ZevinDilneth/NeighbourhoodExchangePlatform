import * as tf from '@tensorflow/tfjs';
import * as nsfwjs from 'nsfwjs';
import { Jimp } from 'jimp';
import sharp from 'sharp';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// ── Backend + model singleton ─────────────────────────────────────────────────
// Auto-selects the best available backend:
//   1. GPU   — @tensorflow/tfjs-node-gpu (requires NVIDIA CUDA)
//   2. Native CPU — @tensorflow/tfjs-node (native bindings, ~5× faster than JS)
//   3. Pure JS CPU — @tensorflow/tfjs (always available, no native deps)

const loadBestBackend = async (): Promise<string> => {
  // GPU (CUDA)
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tensorflow/tfjs-node-gpu');
    await tf.ready();
    return 'GPU (CUDA)';
  } catch { /* CUDA not available */ }

  // Native CPU
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@tensorflow/tfjs-node');
    await tf.ready();
    return 'CPU (native)';
  } catch { /* native bindings not available */ }

  // Pure JS CPU fallback
  await tf.setBackend('cpu');
  await tf.ready();
  return 'CPU (pure JS)';
};

let modelPromise: Promise<nsfwjs.NSFWJS> | null = null;

const getModel = (): Promise<nsfwjs.NSFWJS> => {
  if (!modelPromise) {
    console.log('[Moderation] Loading NSFW ML model…');
    modelPromise = loadBestBackend()
      .then((backend) => {
        console.log(`[Moderation] Backend: ${backend}`);
        return nsfwjs.load(); // bundled local MobileNetV2 — no CDN needed
      })
      .then((m) => {
        console.log('[Moderation] NSFW model ready.');
        return m;
      })
      .catch((err) => {
        modelPromise = null; // allow retry on next request
        throw err;
      });
  }
  return modelPromise;
};

// Model loads lazily on first image/video scan request.
// Preloading here blocked the event loop for several seconds (TF kernel
// registration) before httpServer.listen() could fire, causing ECONNREFUSED
// on all client requests during startup.

// ── Thresholds ────────────────────────────────────────────────────────────────
// Individual: flag if any single class exceeds its threshold
const THRESHOLDS: Record<string, number> = {
  Porn:   0.40,
  Hentai: 0.40,
  Sexy:   0.55,
};
// Combined: flag if Porn + Sexy together suggest nudity even below individual thresholds
const COMBINED_PORN_SEXY_THRESHOLD = 0.65;

// ── WebP detection ────────────────────────────────────────────────────────────
// Jimp does not support WebP. Detect via magic bytes and transcode to JPEG
// using sharp (already a project dependency) before Jimp ever sees the buffer.
//
// WebP magic bytes layout:
//   [0–3]  = 52 49 46 46  "RIFF"
//   [4–7]  = <file size>  (any 4 bytes)
//   [8–11] = 57 45 42 50  "WEBP"
const isWebP = (buf: Buffer): boolean =>
  buf.length >= 12 &&
  buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && // RIFF
  buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;  // WEBP

const toDecodableBuffer = async (buffer: Buffer): Promise<Buffer> =>
  isWebP(buffer)
    ? sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    : buffer;

// ── Decode image buffer → RGB Tensor3D (pure JS, no native bindings) ─────────
const bufferToTensor = async (buffer: Buffer): Promise<tf.Tensor3D> => {
  // Normalise WebP → JPEG so Jimp can decode it
  const decodable = await toDecodableBuffer(buffer);
  const image = await Jimp.fromBuffer(decodable);
  const { width, height, data } = image.bitmap; // RGBA Buffer

  // nsfwjs expects int32 RGB values shaped [height, width, 3]
  const rgb = new Int32Array(width * height * 3);
  for (let i = 0; i < width * height; i++) {
    rgb[i * 3]     = data[i * 4];     // R
    rgb[i * 3 + 1] = data[i * 4 + 1]; // G
    rgb[i * 3 + 2] = data[i * 4 + 2]; // B
  }
  return tf.tensor3d(rgb, [height, width, 3], 'int32');
};

// ── Scan image buffer ─────────────────────────────────────────────────────────
export const scanImageBuffer = async (
  buffer: Buffer,
): Promise<{ safe: boolean; reason?: string }> => {
  try {
    const model  = await getModel();
    const tensor = await bufferToTensor(buffer);
    const predictions = await model.classify(tensor);
    tensor.dispose();

    // Log all predictions so we can tune thresholds
    console.log('[Moderation] Scan results:', predictions.map(p =>
      `${p.className}=${(p.probability * 100).toFixed(1)}%`).join(' | '));

    const scoreMap: Record<string, number> = {};
    for (const { className, probability } of predictions) scoreMap[className] = probability;

    const flagged: string[] = [];

    // Individual threshold checks
    for (const { className, probability } of predictions) {
      const threshold = THRESHOLDS[className];
      if (threshold !== undefined && probability >= threshold) {
        flagged.push(className.toLowerCase());
      }
    }

    // Combined check — catches nudes that score just below individual thresholds
    const combinedPornSexy = (scoreMap['Porn'] ?? 0) + (scoreMap['Sexy'] ?? 0);
    if (combinedPornSexy >= COMBINED_PORN_SEXY_THRESHOLD && !flagged.includes('porn') && !flagged.includes('sexy')) {
      flagged.push('sexually explicit content');
    }

    if (flagged.length > 0) {
      console.log('[Moderation] BLOCKED — reason:', flagged.join(', '));
      return { safe: false, reason: flagged.join(', ') };
    }
    return { safe: true };
  } catch (err) {
    // Log the error so we know if the scan is silently failing
    console.error('[Moderation] Scan error (failing open):', (err as Error).message);
    return { safe: true };
  }
};

// ── Shared: extract frames from any ffmpeg-compatible source ──────────────────
// Writes buffer to a temp file, runs ffmpeg to extract JPEG frames,
// scans each frame, returns on first NSFW hit.
const scanFramesWithFfmpeg = async (
  buffer: Buffer,
  ext: string,         // e.g. 'webm', 'mp4', 'gif', 'mkv', 'mov'
  ffmpegFilter: string, // vf filter, e.g. 'fps=1/2' or 'fps=5'
  logLabel: string,
): Promise<{ safe: boolean; reason?: string }> => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsfw-'));
  try {
    const inputPath     = path.join(tmpDir, `input.${ext}`);
    const outputPattern = path.join(tmpDir, 'frame%04d.jpg');

    fs.writeFileSync(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', inputPath,
        '-vf', ffmpegFilter,
        '-q:v', '3',
        outputPattern,
      ]);
      let errOut = '';
      proc.stderr?.on('data', (d: Buffer) => { errOut += d.toString(); });
      proc.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${errOut}`)),
      );
    });

    const frameFiles = fs.readdirSync(tmpDir)
      .filter((f) => f.startsWith('frame') && f.endsWith('.jpg'))
      .sort();

    console.log(`[Moderation] ${logLabel}: scanning ${frameFiles.length} frame(s)…`);

    for (const frameFile of frameFiles) {
      const frameBuffer = fs.readFileSync(path.join(tmpDir, frameFile));
      const result = await scanImageBuffer(frameBuffer);
      if (!result.safe) {
        console.log(`[Moderation] NSFW frame detected: ${frameFile} — ${result.reason}`);
        return { safe: false, reason: result.reason };
      }
    }

    return { safe: true };
  } catch (err) {
    console.error(`[Moderation] ${logLabel} scan error (failing open):`, (err as Error).message);
    return { safe: true };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
};

// ── Scan video buffer frame-by-frame (MP4, WebM, MOV, MKV) ───────────────────
export const scanVideoBuffer = async (
  buffer: Buffer,
  ext = 'mp4',
): Promise<{ safe: boolean; reason?: string }> =>
  scanFramesWithFfmpeg(buffer, ext, 'fps=1/2', 'Video');

// ── Scan animated GIF frame-by-frame ─────────────────────────────────────────
// Samples every 5th frame for animated GIFs (typically 10–30 fps).
// Static GIFs produce a single frame.
export const scanGifBuffer = async (
  buffer: Buffer,
): Promise<{ safe: boolean; reason?: string }> =>
  scanFramesWithFfmpeg(buffer, 'gif', 'fps=5', 'GIF');

// ── Scan audio file — extract embedded cover art and scan it ──────────────────
// MP3, WAV, FLAC may carry embedded album-art images that could be NSFW.
// If no cover art is found, the audio has no visual content → safe.
export const scanAudioBuffer = async (
  buffer: Buffer,
  ext: string, // 'mp3' | 'wav' | 'flac'
): Promise<{ safe: boolean; reason?: string }> => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nsfw-audio-'));
  try {
    const inputPath  = path.join(tmpDir, `audio.${ext}`);
    const coverPath  = path.join(tmpDir, 'cover.jpg');

    fs.writeFileSync(inputPath, buffer);

    // Extract the embedded cover art (stream 0:v for attached_pic)
    const extracted = await new Promise<boolean>((resolve) => {
      const proc = spawn('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', inputPath,
        '-an',             // no audio output
        '-vcodec', 'copy', // copy video (cover art) stream as-is
        coverPath,
      ]);
      proc.on('close', (code) => resolve(code === 0));
    });

    if (!extracted || !fs.existsSync(coverPath)) {
      console.log('[Moderation] Audio: no embedded cover art — safe');
      return { safe: true };
    }

    const coverBuffer = fs.readFileSync(coverPath);
    const result = await scanImageBuffer(coverBuffer);
    if (!result.safe) {
      console.log(`[Moderation] Audio: NSFW cover art detected — ${result.reason}`);
    }
    return result;
  } catch (err) {
    console.error('[Moderation] Audio scan error (failing open):', (err as Error).message);
    return { safe: true };
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
};
