import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';
import { sendEmailChangeCode } from '../services/email';
import { logger } from '../utils/logger';
import { getClientIp, getGeoLocation } from '../utils/geoIp';

const isDev = process.env.NODE_ENV !== 'production';
const generateCode = (): string => String(Math.floor(100000 + crypto.randomInt(900000)));

// ─── GET current settings ──────────────────────────────────────────────────
export const getSettings = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate('blockedUsers', 'name avatar email')
      .lean();

    if (!user) return next(createError('User not found', 404));

    res.json({
      notifications: (user as Record<string, unknown>).notifications ?? {
        exchangeRequests: true,
        messages: true,
        groupActivity: true,
        newFollowers: true,
        marketingEmails: false,
        newsletter: true,
      },
      preferences: (user as Record<string, unknown>).preferences ?? {
        profileVisibility: 'public',
        showOnlineStatus: true,
        allowExchangeRequests: true,
      },
      blockedUsers: (user as Record<string, unknown>).blockedUsers ?? [],
      suspendedUntil: (user as Record<string, unknown>).suspendedUntil ?? null,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Update notifications ──────────────────────────────────────────────────
export const updateNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { exchangeRequests, messages, groupActivity, newFollowers, marketingEmails, newsletter } =
      req.body;

    await User.findByIdAndUpdate(req.userId, {
      $set: {
        'notifications.exchangeRequests': exchangeRequests,
        'notifications.messages': messages,
        'notifications.groupActivity': groupActivity,
        'notifications.newFollowers': newFollowers,
        'notifications.marketingEmails': marketingEmails,
        'notifications.newsletter': newsletter,
      },
    });

    res.json({ message: 'Notification preferences updated' });
  } catch (err) {
    next(err);
  }
};

// ─── Update preferences ────────────────────────────────────────────────────
export const updatePreferences = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { profileVisibility, showOnlineStatus, allowExchangeRequests } = req.body;

    await User.findByIdAndUpdate(req.userId, {
      $set: {
        'preferences.profileVisibility': profileVisibility,
        'preferences.showOnlineStatus': showOnlineStatus,
        'preferences.allowExchangeRequests': allowExchangeRequests,
      },
    });

    res.json({ message: 'Privacy preferences updated' });
  } catch (err) {
    next(err);
  }
};

// ─── Change password ───────────────────────────────────────────────────────
export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(createError('Current password and new password are required', 400));
    }
    if (newPassword.length < 6) {
      return next(createError('New password must be at least 6 characters', 400));
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return next(createError('User not found', 404));

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return next(createError('Current password is incorrect', 400));

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Block a user ──────────────────────────────────────────────────────────
export const blockUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId: targetId } = req.params;

    if (targetId === req.userId) {
      return next(createError('You cannot block yourself', 400));
    }

    const target = await User.findById(targetId);
    if (!target) return next(createError('User not found', 404));

    await User.findByIdAndUpdate(req.userId, {
      $addToSet: { blockedUsers: targetId },
    });

    res.json({ message: `${target.name} has been blocked` });
  } catch (err) {
    next(err);
  }
};

// ─── Unblock a user ────────────────────────────────────────────────────────
export const unblockUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { userId: targetId } = req.params;

    const target = await User.findById(targetId);
    if (!target) return next(createError('User not found', 404));

    await User.findByIdAndUpdate(req.userId, {
      $pull: { blockedUsers: targetId },
    });

    res.json({ message: `${target.name} has been unblocked` });
  } catch (err) {
    next(err);
  }
};

// ─── Get blocked users ─────────────────────────────────────────────────────
export const getBlockedUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate('blockedUsers', 'name avatar email')
      .lean();

    if (!user) return next(createError('User not found', 404));

    res.json({ blockedUsers: (user as Record<string, unknown>).blockedUsers ?? [] });
  } catch (err) {
    next(err);
  }
};

// ─── Suspend account ───────────────────────────────────────────────────────
export const suspendAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { duration } = req.body; // duration in days

    if (!duration || isNaN(Number(duration)) || Number(duration) < 1) {
      return next(createError('Invalid suspension duration', 400));
    }

    const suspendedUntil = new Date();
    suspendedUntil.setDate(suspendedUntil.getDate() + Number(duration));

    await User.findByIdAndUpdate(req.userId, { suspendedUntil });

    res.json({
      message: `Account suspended until ${suspendedUntil.toLocaleDateString()}`,
      suspendedUntil,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Cancel suspension ─────────────────────────────────────────────────────
export const cancelSuspension = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await User.findByIdAndUpdate(req.userId, { $unset: { suspendedUntil: '' } });
    res.json({ message: 'Suspension cancelled. Your account is now fully active.' });
  } catch (err) {
    next(err);
  }
};

// ─── Delete account (soft delete) ─────────────────────────────────────────
export const deleteAccount = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { password, confirmation } = req.body;

    if (confirmation !== 'DELETE') {
      return next(createError('Please type DELETE to confirm', 400));
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return next(createError('User not found', 404));

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return next(createError('Incorrect password', 400));

    // Log deletion before anonymising
    const delIp  = getClientIp(req);
    const delGeo = getGeoLocation(delIp);
    logger.accountEvent('DELETED', {
      username: user.name,
      email:    user.email,
      ip:       delIp,
      ...delGeo,
    });

    // Soft delete: anonymise and deactivate
    await User.findByIdAndUpdate(req.userId, {
      $set: {
        isActive: false,
        name: 'Deleted User',
        email: `deleted_${req.userId}@deleted.local`,
        bio: '',
        avatar: null,
        skills: [],
        interests: [],
        refreshTokens: [],
      },
      $unset: { password: '' },
    });

    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Request email change (step 1 — validates + sends code to new address) ─
export const requestEmailChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      return next(createError('Please enter a valid email address', 400));
    }
    if (!password) {
      return next(createError('Current password is required', 400));
    }

    const user = await User.findById(req.userId).select('+password');
    if (!user) return next(createError('User not found', 404));

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return next(createError('Incorrect password', 400));

    const normalised = newEmail.trim().toLowerCase();
    if (normalised === user.email) {
      return next(createError('New email is the same as your current email', 400));
    }

    const taken = await User.exists({ email: normalised, _id: { $ne: req.userId } });
    if (taken) return next(createError('That email is already in use', 409));

    const code    = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await User.findByIdAndUpdate(req.userId, {
      $set: { pendingEmail: normalised, emailChangeCode: code, emailChangeExpires: expires },
    });

    await sendEmailChangeCode(normalised, user.name, code);

    res.json({ message: `Verification code sent to ${normalised}` });
  } catch (err) {
    next(err);
  }
};

// ─── Verify email change (step 2 — confirms code, updates email) ───────────
export const verifyEmailChange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { code } = req.body as { code?: string };
    if (!code || typeof code !== 'string') {
      return next(createError('Verification code is required', 400));
    }

    const user = await User.findById(req.userId).select(
      '+emailChangeCode +emailChangeExpires +pendingEmail',
    );
    if (!user) return next(createError('User not found', 404));

    const r = user as unknown as Record<string, unknown>;
    const storedCode    = r.emailChangeCode as string | undefined;
    const storedExpires = r.emailChangeExpires as Date | undefined;
    const pendingEmail  = r.pendingEmail as string | undefined;

    if (!storedCode || !storedExpires || !pendingEmail) {
      return next(createError('No email change in progress. Please request a new code.', 400));
    }
    if (storedExpires < new Date()) {
      return next(createError('Verification code has expired. Please request a new one.', 400));
    }
    if (storedCode.trim() !== code.trim()) {
      return next(createError('Incorrect verification code.', 400));
    }

    await User.findByIdAndUpdate(req.userId, {
      $set:   { email: pendingEmail, isVerified: false },
      $unset: { pendingEmail: '', emailChangeCode: '', emailChangeExpires: '' },
    });

    res.json({ message: 'Email updated successfully.', email: pendingEmail });
  } catch (err) {
    next(err);
  }
};
