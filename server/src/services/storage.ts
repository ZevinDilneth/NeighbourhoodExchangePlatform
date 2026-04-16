import AWS from 'aws-sdk';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { logger } from '../utils/logger';

const s3 = new AWS.S3({
  accessKeyId:     process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region:          process.env.AWS_REGION,
});

const BUCKET  = () => process.env.AWS_S3_BUCKET as string;
const EXPIRY  = 60 * 60 * 24; // 24 hours — refreshed on every profile load

// ── Upload ───────────────────────────────────────────────────────────────────
export const uploadToS3 = (
  key:         string,
  buffer:      Buffer,
  contentType: string,
): Promise<AWS.S3.ManagedUpload.SendData> => {
  const fileName = key.split('/').pop() || key;
  const fileSize = buffer.length;

  logger.upload(fileName, fileSize, 'start');

  const bar = new cliProgress.SingleBar({
    format:            `  ${chalk.magenta('{filename}')} ${chalk.gray('|')}{bar}${chalk.gray('|')} ${chalk.white('{percentage}%')} ${chalk.gray('{value}/{total} B')}`,
    barCompleteChar:   '█',
    barIncompleteChar: '░',
    hideCursor:        true,
    clearOnComplete:   false,
    barsize:           25,
  });

  bar.start(fileSize, 0, { filename: fileName.slice(0, 20).padEnd(20) });

  const managed = s3.upload({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        buffer,
    ContentType: contentType,
  });

  managed.on('httpUploadProgress', (progress) => {
    bar.update(progress.loaded ?? 0);
  });

  return managed.promise().then((data) => {
    bar.update(fileSize);
    bar.stop();
    logger.upload(fileName, fileSize, 'done');
    return data;
  }).catch((err) => {
    bar.stop();
    logger.upload(fileName, fileSize, 'error');
    throw err;
  });
};

// ── Signed URL ────────────────────────────────────────────────────────────────
// Returns a temporary URL (24 h) — works with any S3 bucket regardless of
// whether public-read ACLs or bucket policies are configured.
export const getSignedUrl = (key: string): string =>
  s3.getSignedUrl('getObject', { Bucket: BUCKET(), Key: key, Expires: EXPIRY });

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteFromS3 = (key: string): Promise<AWS.S3.DeleteObjectOutput> =>
  s3.deleteObject({ Bucket: BUCKET(), Key: key }).promise();

// ── Resolve avatar ────────────────────────────────────────────────────────────
// Accepts either:
//  • an S3 key  (e.g.  "avatars/abc-123.jpg")  → generates a signed URL
//  • an S3 full/presigned URL for our bucket    → extract key and re-sign (handles expiry)
//  • any other full URL (e.g. "https://...")    → returned as-is (external provider)
//  • undefined / null                           → returns undefined
export const resolveAvatarUrl = (avatar?: string | null): string | undefined => {
  if (!avatar) return undefined;
  if (avatar.startsWith('http')) {
    // If it's our own S3 bucket URL, extract the key and re-sign so it never expires
    const bucket = process.env.AWS_S3_BUCKET;
    if (bucket) {
      const patterns = [
        new RegExp(`^https?://${bucket}\\.s3[^/]*/(.+?)(?:\\?|$)`),
        new RegExp(`^https?://s3[^/]*\\.amazonaws\\.com/${bucket}/(.+?)(?:\\?|$)`),
      ];
      for (const re of patterns) {
        const m = avatar.match(re);
        if (m) return getSignedUrl(decodeURIComponent(m[1]));
      }
    }
    return avatar; // external provider — return as-is
  }
  return getSignedUrl(avatar); // S3 key — sign it
};
