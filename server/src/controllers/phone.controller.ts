import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { sendVerificationSms } from '../services/sms';

const isDev = process.env.NODE_ENV !== 'production';
const showDevCodes = () => isDev || process.env.DEV_SHOW_CODES === 'true';

/** Generate a cryptographically-random 6-digit numeric code. */
const generateCode = (): string =>
  String(Math.floor(100000 + crypto.randomInt(900000)));

// ─── Send verification code ───────────────────────────────────────────────────

export const sendPhoneVerification = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return next(createError('User not found', 404));

    if (!user.phone) {
      return next(createError('No phone number on file. Please add a phone number first.', 400));
    }
    if (user.isPhoneVerified) {
      return next(createError('Phone number is already verified.', 400));
    }

    const code    = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(user._id, {
      $set: {
        phoneVerificationCode:    code,
        phoneVerificationExpires: expires,
      },
    });

    let smsFailed = false;
    let smsError: string | undefined;
    try {
      await sendVerificationSms(user.phone, code);
    } catch (smsErr: unknown) {
      if (!showDevCodes()) {
        const msg = (smsErr as { message?: string })?.message ?? 'Failed to send SMS.';
        return next(createError(msg, 400));
      }
      smsFailed = true;
      smsError = (smsErr as { message?: string })?.message ?? 'SMS delivery failed.';
    }

    const payload: Record<string, unknown> = {
      message: smsFailed
        ? `SMS delivery failed — dev code returned instead.`
        : `Verification code sent to ${user.phone}`,
    };
    if (showDevCodes()) payload.devCode = code;
    if (smsError) payload.smsError = smsError;

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// ─── Verify code ─────────────────────────────────────────────────────────────

export const verifyPhone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return next(createError('Verification code is required.', 400));
    }

    // Fetch all hidden fields
    const user = await User.findById(req.userId).select(
      '+phoneVerificationCode +phoneVerificationExpires +pendingPhone +pendingPhoneCode +pendingPhoneExpires',
    );
    if (!user) return next(createError('User not found', 404));

    const u = user as unknown as Record<string, unknown>;

    // ── Pending phone change flow ──────────────────────────────────────────
    const pendingPhone   = u.pendingPhone   as string | undefined;
    const pendingCode    = u.pendingPhoneCode    as string | undefined;
    const pendingExpires = u.pendingPhoneExpires as Date   | undefined;

    if (pendingPhone && pendingCode) {
      if (!pendingExpires || pendingExpires < new Date()) {
        return next(createError('Verification code has expired. Please request a new one.', 400));
      }
      if (pendingCode.trim() !== code.trim()) {
        return next(createError('Incorrect verification code.', 400));
      }
      // Promote pending → real phone, mark verified
      await User.findByIdAndUpdate(user._id, {
        $set:   { phone: pendingPhone, isPhoneVerified: true },
        $unset: { pendingPhone: '', pendingPhoneCode: '', pendingPhoneExpires: '',
                  phoneVerificationCode: '', phoneVerificationExpires: '' },
      });
      res.json({ message: 'Phone number changed and verified successfully.', isPhoneVerified: true, phone: pendingPhone });
      return;
    }

    // ── Initial verification flow ──────────────────────────────────────────
    if (user.isPhoneVerified) {
      return next(createError('Phone number is already verified.', 400));
    }

    const storedCode    = u.phoneVerificationCode    as string | undefined;
    const storedExpires = u.phoneVerificationExpires as Date   | undefined;

    if (!storedCode || !storedExpires) {
      return next(createError('No verification code found. Please request a new code.', 400));
    }
    if (storedExpires < new Date()) {
      return next(createError('Verification code has expired. Please request a new one.', 400));
    }
    if (storedCode.trim() !== code.trim()) {
      return next(createError('Incorrect verification code.', 400));
    }

    await User.findByIdAndUpdate(user._id, {
      $set:   { isPhoneVerified: true },
      $unset: { phoneVerificationCode: '', phoneVerificationExpires: '' },
    });

    res.json({ message: 'Phone number verified successfully.', isPhoneVerified: true });
  } catch (err) {
    next(err);
  }
};

// ─── Request phone change (stores as pending, sends OTP to new number) ────────

export const requestPhoneChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || typeof phone !== 'string') {
      return next(createError('Phone number is required.', 400));
    }

    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      return next(createError('Invalid phone number format. Use international format (e.g. +447911123456).', 400));
    }

    const user = await User.findById(req.userId);
    if (!user) return next(createError('User not found', 404));

    // Block only if this exact number is already verified — unverified same number just re-sends OTP
    if (user.phone && user.phone === cleaned && user.isPhoneVerified) {
      return next(createError('Phone number already verified.', 400));
    }

    // Check not taken by another user who has already *verified* it
    const taken = await User.findOne({
      _id: { $ne: req.userId },
      $or: [{ phone: cleaned }, { pendingPhone: cleaned }],
    });
    if (taken) {
      if ((taken as unknown as { isPhoneVerified?: boolean }).isPhoneVerified) {
        return next(createError('This phone number is already in use by another account.', 400));
      }
      // Number was stored but never verified — release it so this user can claim it
      await User.findByIdAndUpdate(taken._id, {
        $unset: { phone: '', pendingPhone: '', pendingPhoneCode: '', pendingPhoneExpires: '',
                  phoneVerificationCode: '', phoneVerificationExpires: '' },
        $set: { isPhoneVerified: false },
      });
    }

    const code    = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await User.findByIdAndUpdate(user._id, {
      $set: { pendingPhone: cleaned, pendingPhoneCode: code, pendingPhoneExpires: expires },
    });

    let smsFailed = false;
    let smsError: string | undefined;
    try {
      await sendVerificationSms(cleaned, code);
    } catch (smsErr: unknown) {
      if (!showDevCodes()) {
        const msg = (smsErr as { message?: string })?.message ?? 'Failed to send SMS.';
        return next(createError(msg, 400));
      }
      smsFailed = true;
      smsError = (smsErr as { message?: string })?.message ?? 'SMS delivery failed.';
    }

    const payload: Record<string, unknown> = {
      message: smsFailed
        ? `SMS delivery failed — dev code returned instead.`
        : `Verification code sent to ${cleaned}. Your current number stays active until verified.`,
    };
    if (showDevCodes()) payload.devCode = code;
    if (smsError) payload.smsError = smsError;

    res.json(payload);
  } catch (err) {
    next(err);
  }
};

// ─── Update phone number (unverified users) ───────────────────────────────────

export const updatePhone = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { phone } = req.body as { phone?: string };
    if (!phone || typeof phone !== 'string') {
      return next(createError('Phone number is required.', 400));
    }

    // Basic E.164 format check
    const cleaned = phone.trim().replace(/\s/g, '');
    if (!/^\+[1-9]\d{6,14}$/.test(cleaned)) {
      return next(createError('Invalid phone number format. Use international format (e.g. +447911123456).', 400));
    }

    // Release number from any other unverified account holding it
    const takenBy = await User.findOne({
      _id: { $ne: req.userId },
      $or: [{ phone: cleaned }, { pendingPhone: cleaned }],
    });
    if (takenBy) {
      if ((takenBy as unknown as { isPhoneVerified?: boolean }).isPhoneVerified) {
        return next(createError('This phone number is already in use by another account.', 400));
      }
      await User.findByIdAndUpdate(takenBy._id, {
        $unset: { phone: '', pendingPhone: '', pendingPhoneCode: '', pendingPhoneExpires: '',
                  phoneVerificationCode: '', phoneVerificationExpires: '' },
        $set: { isPhoneVerified: false },
      });
    }

    // If changing phone, reset verification status
    await User.findByIdAndUpdate(req.userId, {
      $set:   { phone: cleaned, isPhoneVerified: false },
      $unset: { phoneVerificationCode: '', phoneVerificationExpires: '' },
    });

    res.json({ phone: cleaned, isPhoneVerified: false, message: 'Phone number updated. Please verify it.' });
  } catch (err) {
    next(err);
  }
};
