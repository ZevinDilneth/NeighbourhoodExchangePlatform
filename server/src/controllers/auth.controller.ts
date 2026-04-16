import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { AuthRequest, TokenPayload } from '../types';
import { createError } from '../middleware/errorHandler';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email';
import { resolveAvatarUrl } from '../services/storage';
import { containsProfanity } from '../utils/contentFilter';
import { logger } from '../utils/logger';
import { getClientIp, getGeoLocation } from '../utils/geoIp';

// ─── Helpers ───────────────────────────────────────────────────────────────

const generateTokens = (userId: string, role: string) => {
  const accessToken = jwt.sign(
    { userId, role } as TokenPayload,
    process.env.JWT_SECRET as string,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, role } as TokenPayload,
    process.env.JWT_REFRESH_SECRET as string,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

const randomToken = () => crypto.randomBytes(32).toString('hex');

// Helper: read any field from a Mongoose doc (works for fields not in typed interface)
const getField = (doc: unknown, field: string): unknown =>
  (doc as Record<string, unknown>)[field];

// ─── Register ──────────────────────────────────────────────────────────────

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name, email, password, phone,
      latitude, longitude,
      address, neighbourhood, city, postcode, country,
    } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return next(createError('Email already registered', 400));
    }

    // Content moderation — reject inappropriate display names at registration
    if (containsProfanity(name)) {
      return next(createError('Your name contains inappropriate content. Please choose a different name.', 400));
    }

    const verificationToken = randomToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

    const user = await User.create({
      name,
      email,
      password,
      ...(phone ? { phone: phone.trim() } : {}),
      location: {
        type: 'Point',
        coordinates: [longitude || 0, latitude || 0],
        address,
        neighbourhood,
        city,
        postcode,
        country,
      },
      verificationToken,
      verificationTokenExpires,
    });

    const { accessToken, refreshToken } = generateTokens(
      (user._id as { toString(): string }).toString(),
      user.role
    );

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    // Log account creation event with IP + geo location
    const regIp  = getClientIp(req);
    const regGeo = getGeoLocation(regIp);
    logger.accountEvent('REGISTERED', {
      username: user.name,
      email:    user.email,
      ip:       regIp,
      ...regGeo,
    });

    // In development: always log the verification link so it can be tested
    // even when SendGrid is not yet configured.
    if (process.env.NODE_ENV === 'development') {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      console.log('\n📧 [DEV] Email verification link for', user.email, ':');
      console.log(`   ${clientUrl}/verify-email?token=${verificationToken}\n`);
    }

    // Non-blocking — registration still succeeds even if email delivery fails
    sendVerificationEmail(user.email, user.name, verificationToken).catch((err) => {
      console.error('⚠️  Failed to send verification email:', err?.message);
    });

    res.status(201).json({
      message: 'Account created successfully',
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: resolveAvatarUrl(user.avatar) ?? user.avatar,
        role: user.role,
        isVerified: user.isVerified,
        location: user.location,
        ceuBalance: user.ceuBalance ?? 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Verify Email ──────────────────────────────────────────────────────────

export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.query as { token?: string };

    if (!token) {
      return next(createError('Verification token is required', 400));
    }

    // Simple single-field query — no compound filter on hidden fields
    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return next(createError('Verification link is invalid or has expired', 400));
    }

    // Check expiry in application code (more reliable than a MongoDB $gt query
    // when the field was previously select:false)
    const expires = getField(user, 'verificationTokenExpires') as Date | undefined;
    if (!expires || expires < new Date()) {
      return next(createError('Verification link has expired. Please request a new one.', 400));
    }

    // Atomic update: set isVerified, remove token fields
    await User.findByIdAndUpdate(user._id, {
      $set:   { isVerified: true },
      $unset: { verificationToken: '', verificationTokenExpires: '' },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Change Email (pre-verification) ───────────────────────────────────────

export const changeEmail = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    const user = await User.findById(req.userId);
    if (!user) return next(createError('User not found', 404));
    if (user.isVerified) return next(createError('Email is already verified and cannot be changed here', 400));

    // Ensure the new email isn't taken by another account
    const existing = await User.findOne({ email, _id: { $ne: user._id } });
    if (existing) return next(createError('That email address is already in use', 400));

    const verificationToken = randomToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await User.findByIdAndUpdate(user._id, {
      $set: { email, verificationToken, verificationTokenExpires },
    });

    await sendVerificationEmail(email, user.name, verificationToken);

    res.json({ message: 'Email updated. A new verification link has been sent.', email });
  } catch (err) {
    next(err);
  }
};

// ─── Resend Verification ───────────────────────────────────────────────────

export const resendVerification = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.userId);

    if (!user) return next(createError('User not found', 404));
    if (user.isVerified) return next(createError('Email is already verified', 400));

    const verificationToken = randomToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Use findByIdAndUpdate — avoids save() hook complexity and TypeScript casts
    await User.findByIdAndUpdate(user._id, {
      $set: { verificationToken, verificationTokenExpires },
    });

    if (process.env.NODE_ENV === 'development') {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      console.log('\n📧 [DEV] Email verification link for', user.email, ':');
      console.log(`   ${clientUrl}/verify-email?token=${verificationToken}\n`);
    }

    await sendVerificationEmail(user.email, user.name, verificationToken);

    res.json({ message: 'Verification email resent' });
  } catch (err) {
    next(err);
  }
};

// ─── Forgot Password ───────────────────────────────────────────────────────

export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    // Generic response — prevents email enumeration attacks
    const genericMsg = { message: 'If an account with that email exists, a reset link has been sent.' };

    const user = await User.findOne({ email });
    if (!user) {
      res.json(genericMsg);
      return;
    }

    const resetToken = randomToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.findByIdAndUpdate(user._id, {
      $set: { passwordResetToken: resetToken, passwordResetExpires: resetExpires },
    });

    const isDev = process.env.NODE_ENV === 'development';
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl  = `${clientUrl}/reset-password?token=${resetToken}`;

    // In development: always log to console as a fallback
    if (isDev) {
      console.log('\n🔑 [DEV] Password reset link for', user.email, ':');
      console.log(`   ${resetUrl}\n`);
    }

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailErr) {
      if (!isDev) {
        // Production: roll back token so the user can retry cleanly
        await User.findByIdAndUpdate(user._id, {
          $unset: { passwordResetToken: '', passwordResetExpires: '' },
        });
        return next(createError('Failed to send reset email. Please try again later.', 500));
      }
      console.warn('⚠️  [DEV] Email send failed (see above) — use the console link or devResetLink in the response.');
    }

    res.json(genericMsg);
  } catch (err) {
    next(err);
  }
};

// ─── Reset Password ────────────────────────────────────────────────────────

export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    // Find by token only — check expiry in application code
    const user = await User.findOne({ passwordResetToken: token });

    if (!user) {
      return next(createError('Reset link is invalid or has expired', 400));
    }

    const expires = getField(user, 'passwordResetExpires') as Date | undefined;
    if (!expires || expires < new Date()) {
      return next(createError('Reset link has expired. Please request a new one.', 400));
    }

    // Set new password — pre-save hook hashes it
    user.password = password;
    user.refreshTokens = []; // Invalidate all active sessions
    await user.save();

    // Clear reset token fields with a reliable atomic operation
    await User.findByIdAndUpdate(user._id, {
      $unset: { passwordResetToken: '', passwordResetExpires: '' },
    });

    res.json({ message: 'Password reset successfully. You can now sign in with your new password.' });
  } catch (err) {
    next(err);
  }
};

// ─── Login ─────────────────────────────────────────────────────────────────

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await (user as unknown as { comparePassword: (p: string) => Promise<boolean> }).comparePassword(password))) {
      return next(createError('Invalid email or password', 401));
    }

    if (!user.isActive) {
      return next(createError('Account is deactivated', 403));
    }

    const { accessToken, refreshToken } = generateTokens(
      (user._id as { toString(): string }).toString(),
      user.role
    );

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    // Log login event
    const loginIp  = getClientIp(req);
    const loginGeo = getGeoLocation(loginIp);
    logger.accountEvent('LOGGED IN', {
      username: user.name,
      email:    user.email,
      ip:       loginIp,
      ...loginGeo,
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: resolveAvatarUrl(user.avatar) ?? user.avatar,
        videoIntro: resolveAvatarUrl(user.videoIntro) ?? user.videoIntro ?? null,
        role: user.role,
        isVerified: user.isVerified,
        location: user.location,
        ceuBalance: user.ceuBalance ?? 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─── Refresh Token ─────────────────────────────────────────────────────────

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) return next(createError('Refresh token required', 400));

    let decoded: TokenPayload;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as TokenPayload;
    } catch {
      return next(createError('Invalid refresh token', 401));
    }

    const user = await User.findOne({
      _id: decoded.userId,
      refreshTokens: token,
    });

    if (!user) return next(createError('Refresh token not found', 401));

    // Rotate refresh token
    await User.findByIdAndUpdate(user._id, { $pull: { refreshTokens: token } });

    const tokens = generateTokens(
      (user._id as { toString(): string }).toString(),
      user.role
    );

    await User.findByIdAndUpdate(user._id, { $push: { refreshTokens: tokens.refreshToken } });

    res.json(tokens);
  } catch (err) {
    next(err);
  }
};

// ─── Logout ────────────────────────────────────────────────────────────────

export const logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (req.userId && token) {
      const logoutUser = await User.findByIdAndUpdate(
        req.userId,
        { $pull: { refreshTokens: token } },
        { new: false },
      ).lean();

      if (logoutUser) {
        const logoutIp  = getClientIp(req);
        const logoutGeo = getGeoLocation(logoutIp);
        logger.accountEvent('LOGGED OUT', {
          username: (logoutUser as { name: string }).name,
          email:    (logoutUser as { email: string }).email,
          ip:       logoutIp,
          ...logoutGeo,
        });
      }
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

// ─── Get Me ────────────────────────────────────────────────────────────────

export const getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await User.findById(req.userId)
      .populate('groups', 'name avatar memberCount')
      .lean();

    if (!user) return next(createError('User not found', 404));

    // Sign the avatar and videoIntro keys so the client always gets valid, accessible URLs
    const u = user as Record<string, unknown>;
    res.json({
      ...u,
      avatar: resolveAvatarUrl(u.avatar as string | undefined) ?? u.avatar,
      videoIntro: resolveAvatarUrl(u.videoIntro as string | undefined) ?? u.videoIntro ?? null,
    });
  } catch (err) {
    console.error('[getMe] error:', err);
    next(err);
  }
};
