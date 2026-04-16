import multer from 'multer';
import { Request } from 'express';

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const VIDEO_MIME = ['video/webm', 'video/mp4', 'video/ogg', 'video/quicktime'];

const imageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (IMAGE_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  }
};

const videoFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (VIDEO_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only WebM, MP4, OGG, and MOV videos are allowed'));
  }
};

// Memory storage — buffer is uploaded to S3 in the controller
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: imageFilter,
});

// Video upload — up to 50 MB
export const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: videoFilter,
});

// Video + thumbnail (image) upload — used for video intro with thumbnail
const videoOrImageFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if ([...IMAGE_MIME, ...VIDEO_MIME].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only images and videos are allowed'));
  }
};

export const uploadVideoWithThumbnail = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: videoOrImageFilter,
});

// General media upload (images) — used by posts, comments, exchanges
export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: videoOrImageFilter,
});

const DOC_MIME = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
];

const anyFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if ([...IMAGE_MIME, ...VIDEO_MIME, ...DOC_MIME].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'));
  }
};

// Chat file upload — images, videos, documents up to 10 MB
export const uploadAny = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: anyFileFilter,
});

// Group resource upload — any file type (images, video, audio, docs, executables, etc.) up to 50 MB
export const uploadGroupResource = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});
