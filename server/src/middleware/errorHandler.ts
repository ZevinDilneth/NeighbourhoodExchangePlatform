import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError & { name?: string; code?: number | string; errors?: Record<string, { message: string }> },
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('❌ Error:', err);

  // ── Multer errors (file size / file type) ────────────────────────────────
  if (err instanceof multer.MulterError) {
    const me = err as multer.MulterError;
    const msg = me.code === 'LIMIT_FILE_SIZE'
      ? 'File size exceeded. Maximum allowed size is 100 MB.'
      : me.message;
    res.status(400).json({ message: msg });
    return;
  }
  // Multer fileFilter rejection (plain Error thrown in filter callback)
  if (err.message && !err.isOperational && !err.statusCode) {
    res.status(400).json({ message: err.message });
    return;
  }

  // ── Mongoose validation error ─────────────────────────────────────────────
  if (err.name === 'ValidationError' && err.errors) {
    const messages = Object.values(err.errors).map((e) => e.message);
    res.status(400).json({ message: messages[0] || 'Validation error', errors: messages });
    return;
  }

  // ── Mongoose cast error (bad ObjectId) ───────────────────────────────────
  if (err.name === 'CastError') {
    res.status(400).json({ message: 'Invalid ID format' });
    return;
  }

  // ── MongoDB duplicate key ─────────────────────────────────────────────────
  if (err.code === 11000) {
    res.status(409).json({ message: 'A record with that value already exists' });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message    = err.isOperational ? err.message : 'Internal server error';

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export const notFound = (_req: Request, res: Response): void => {
  res.status(404).json({ message: 'Route not found' });
};

export const createError = (message: string, statusCode: number): AppError => {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
