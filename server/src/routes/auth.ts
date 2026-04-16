import { Router } from 'express';
import Joi from 'joi';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  verifyEmail,
  resendVerification,
  changeEmail,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller';

const router = Router();

// ─── Joi schemas ───────────────────────────────────────────────────────────

const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  phone: Joi.string().pattern(/^\+[1-9]\d{6,14}$/).allow('', null).optional().messages({
    'string.pattern.base': 'Phone must be in international format (e.g. +447911123456)',
  }),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  address: Joi.string().max(200).allow(''),
  neighbourhood: Joi.string().max(100).allow(''),
  city: Joi.string().max(100).allow(''),
  postcode: Joi.string().max(20).allow(''),
  country: Joi.string().max(100).allow(''),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().hex().length(64).required(),
  password: Joi.string().min(6).max(128).required(),
});

const changeEmailSchema = Joi.object({
  email: Joi.string().email().required(),
});

// ─── Routes ────────────────────────────────────────────────────────────────

router.post('/register',        validate(registerSchema),       register);
router.post('/login',           validate(loginSchema),          login);
router.post('/refresh',         refreshToken);
router.post('/logout',          authenticate, logout);
router.get('/me',               authenticate, getMe);

// Email verification
router.get('/verify-email',         verifyEmail);                                          // GET /verify-email?token=xxx
router.post('/resend-verification', authenticate, resendVerification);                     // POST (requires auth)
router.post('/change-email',        authenticate, validate(changeEmailSchema), changeEmail); // POST (requires auth, pre-verify only)

// Password reset
router.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password',  validate(resetPasswordSchema),  resetPassword);

export default router;
