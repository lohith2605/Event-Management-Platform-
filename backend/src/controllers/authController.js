import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from '../config/firebaseAdmin.js';
import User from '../models/User.js';
import Session from '../models/Session.js';
import AuditLog from '../models/AuditLog.js';
import {
  sendTokenResponse,
  generateTemp2FAToken,
  verifyTemp2FAToken,
  getInactivityTimeoutMs,
  getWarningBeforeExpiryMs,
} from '../utils/token.js';
import { sendEmail, sendPasswordResetEmail, send2FAVerificationEmail } from '../services/emailService.js';
import { generateOtp, hashOtp, compareOtp, maskEmail } from '../utils/otp.js';
import { decryptSecret, verifyTotpCode, verifyRecoveryCode } from '../utils/totp.js';

/**
 * Determine whether Two-Factor Authentication is required for this user account.
 * Follows user preferences and administrator mandatory policy if configured.
 */
export const is2FARequired = (user) => {
  if (user?.twoFactorEnabled) return true;
  if (user?.role === 'admin' && process.env.REQUIRE_ADMIN_2FA !== 'false') return true;
  return false;
};

/**
 * Initiate a 2FA challenge (either Authenticator TOTP or Email OTP).
 */
export const initiate2FAChallenge = async (user, res) => {
  const tempToken = generateTemp2FAToken(user._id);

  // Admin accounts MUST use Authenticator TOTP and NEVER depend on email OTP delivery
  const isAuthenticator = user.role === 'admin' || user.twoFactorMethod === 'authenticator';

  if (isAuthenticator) {
    // If admin has not yet completed authenticator enrollment, guide them to secure setup
    if (!user.totpEnrolled) {
      return res.status(200).json({
        success: true,
        require2FA: true,
        twoFactorMethod: 'authenticator',
        requireSetup: true,
        tempToken,
        message: 'Authenticator enrollment required before logging into the governance portal.',
      });
    }

    // Normal TOTP challenge: no email needs to be sent!
    return res.status(200).json({
      success: true,
      require2FA: true,
      twoFactorMethod: 'authenticator',
      tempToken,
      message: 'Please provide the 6-digit code from your authenticator application.',
    });
  }

  // Regular users with Email OTP method
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  user.twoFactorOtpHash = otpHash;
  user.twoFactorOtpExpiresAt = expiresAt;
  user.twoFactorAttempts = 0;
  user.twoFactorLastSentAt = new Date();
  await user.save({ validateBeforeSave: false });

  try {
    await send2FAVerificationEmail({
      email: user.email,
      userName: user.name,
      otp,
    });
  } catch (err) {
    await User.updateOne(
      { _id: user._id },
      {
        $unset: {
          twoFactorOtpHash: 1,
          twoFactorOtpExpiresAt: 1,
          twoFactorAttempts: 1,
          twoFactorLastSentAt: 1,
        },
      }
    );
    console.error('2FA verification email dispatch failed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Verification email service encountered an error. Please try logging in again.',
    });
  }

  return res.status(200).json({
    success: true,
    require2FA: true,
    twoFactorMethod: 'email',
    tempToken,
    email: maskEmail(user.email),
  });
};

/**
 * @desc    Register attendee or organizer
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;

    // 1. Required field checks
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide your full name.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (!password) {
      return res.status(400).json({ success: false, message: 'Please provide a password.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    // 2. Strict Role Security: Deny self-registering as 'admin'
    const targetRole = role ? role.toLowerCase().trim() : 'attendee';
    if (targetRole === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Security policy violation: Administrator accounts cannot be created via public registration.',
      });
    }

    if (!['attendee', 'organizer'].includes(targetRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid account role. Allowed roles are Attendee or Organizer.',
      });
    }

    // 3. Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // 4. Duplicate account check
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.',
      });
    }

    // 5. Create real account
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: targetRole,
    });

    await sendTokenResponse(user, 201, res, {}, req);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user (Attendee or Organizer)
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Check for user (include password field)
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 4. Verify account status
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator. Please contact support.',
        isSuspended: true,
      });
    }

    if (is2FARequired(user)) {
      return await initiate2FAChallenge(user, res);
    }

    await sendTokenResponse(user, 200, res, {}, req);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Dedicated Admin Login (Enforces admin role verification)
 * @route   POST /api/auth/admin-login
 * @access  Public
 */
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide admin email and password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Fetch user with password
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid administrative credentials.',
      });
    }

    // Strict Role Enforcement
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access Denied: This account does not possess administrator privileges for the Admin Portal.',
      });
    }

    // Verify account status
    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'This administrative account has been suspended. Please contact root support.',
        isSuspended: true,
      });
    }

    if (is2FARequired(user)) {
      return await initiate2FAChallenge(user, res);
    }

    await sendTokenResponse(user, 200, res, {}, req);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently authenticated user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res) => {
  const normalizedRole = (req.user.role || 'attendee').toLowerCase();
  const safeRole =
    normalizedRole === 'admin'
      ? 'admin'
      : normalizedRole === 'organizer'
      ? 'organizer'
      : 'attendee';

  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: safeRole,
      twoFactorEnabled: req.user.twoFactorEnabled || false,
      twoFactorMethod: req.user.twoFactorMethod || 'email',
      totpEnrolled: req.user.totpEnrolled || false,
      createdAt: req.user.createdAt,
    },
    session: req.session
      ? {
          id: req.session.sessionId,
          expiresAt: req.session.expiresAt,
          absoluteExpiresAt: req.session.absoluteExpiresAt,
          inactivityTimeoutMs: getInactivityTimeoutMs(),
          warningBeforeExpiryMs: getWarningBeforeExpiryMs(),
        }
      : undefined,
  });
};

/**
 * @desc    Log out current session and invalidate in MongoDB
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = async (req, res) => {
  try {
    let token;
    if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.sessionId) {
          await Session.updateOne(
            { sessionId: decoded.sessionId, revokedAt: null },
            { $set: { revokedAt: new Date(), revocationReason: 'user_logout' } }
          );
        }
      } catch (err) {
        // Safe to ignore decode failure on logout
      }
    }

    res.cookie('token', '', {
      expires: new Date(0),
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return res.status(200).json({
      success: true,
      message: 'User logged out successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Logout failed. Please try again.',
    });
  }
};

/**
 * @desc    Request password reset token
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered email address.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Consistent security response: do not disclose whether user exists to prevent account enumeration
    const safeResponse = {
      success: true,
      message: 'If an account exists with that email address, a password reset link has been dispatched.',
    };

    if (!user) {
      return res.status(200).json(safeResponse);
    }

    // If user's name is missing (legacy account), safely resolve it from linked employee record if present in DB
    if (!user.name) {
      try {
        const db = mongoose.connection.db;
        let empDoc = null;
        if (user.employeeId) {
          empDoc = await db.collection('employees').findOne({ _id: user.employeeId });
        }
        if (!empDoc) {
          empDoc = await db.collection('employees').findOne({ userId: user._id });
        }
        if (empDoc && (empDoc.firstName || empDoc.lastName)) {
          user.name = `${empDoc.firstName || ''} ${empDoc.lastName || ''}`.trim();
        }
      } catch (lookupErr) {
        console.warn('Could not retrieve name from linked legacy profile:', lookupErr.message);
      }
    }

    // Generate cryptographically secure reset token (hashed in DB, raw returned for URL)
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Build reset URL targeting frontend route
    const frontendUrl = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await sendPasswordResetEmail({
        email: user.email,
        resetUrl,
        userName: user.name,
      });

      res.status(200).json(safeResponse);
    } catch (err) {
      // Clear token state if email delivery fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });

      console.error('Password reset email delivery failed:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Email service could not dispatch the reset notification. Please try again later.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password using valid token
 * @route   POST /api/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'A password reset token is required.',
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    // Hash the token from URL parameter to compare with database hash
    const cleanToken = token.trim();
    const hashedToken = crypto
      .createHash('sha256')
      .update(cleanToken)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset link is invalid or has expired. Please request a new link.',
      });
    }

    // If user's name is missing (legacy account), safely resolve it from linked employee record if present in DB
    if (!user.name) {
      try {
        const db = mongoose.connection.db;
        let empDoc = null;
        if (user.employeeId) {
          empDoc = await db.collection('employees').findOne({ _id: user.employeeId });
        }
        if (!empDoc) {
          empDoc = await db.collection('employees').findOne({ userId: user._id });
        }
        if (empDoc && (empDoc.firstName || empDoc.lastName)) {
          user.name = `${empDoc.firstName || ''} ${empDoc.lastName || ''}`.trim();
        }
      } catch (lookupErr) {
        console.warn('Could not retrieve name from linked legacy profile:', lookupErr.message);
      }
    }

    // Set new password (will be hashed by User pre('save') hook) and invalidate reset token
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;

    // Use validateBeforeSave: false to update only modified authentication fields
    // without triggering validation errors on unrelated legacy fields (e.g. legacy roles)
    await user.save({ validateBeforeSave: false });

    if (is2FARequired(user)) {
      return await initiate2FAChallenge(user, res);
    }

    // Send fresh session token response with refreshed cookies
    await sendTokenResponse(user, 200, res, {}, req);
  } catch (error) {
    console.error('Password reset encountered an unexpected error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while resetting your password. Please try again or request a new reset link.',
    });
  }
};

/**
 * @desc    Authenticate or register user via verified Google Firebase ID Token
 * @route   POST /api/auth/google
 * @access  Public
 */
export const googleAuth = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'A valid Google ID token is required.',
      });
    }

    // Initialize Firebase Admin SDK if not already initialized
    if (getApps().length === 0) {
      initializeFirebaseAdmin();
    }

    if (getApps().length === 0) {
      return res.status(500).json({
        success: false,
        message: 'Google authentication service is currently unavailable. Server credentials not configured.',
      });
    }

    // Verify token with Firebase Admin
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (verifyError) {
      console.warn('Firebase ID token verification failed:', verifyError.message);
      return res.status(401).json({
        success: false,
        message: 'Google identity verification failed. The provided token is invalid, expired, or malformed.',
      });
    }

    const { email, email_verified, name, picture, uid } = decodedToken;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Your Google account does not provide an email address.',
      });
    }

    if (!email_verified) {
      return res.status(401).json({
        success: false,
        message: 'Your Google email address is not verified. Please verify your email with Google before signing in.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // 1. Account Status Enforcement
      if (user.isSuspended) {
        return res.status(403).json({
          success: false,
          message: 'Your account has been suspended by an administrator. Please contact support.',
          isSuspended: true,
        });
      }

      // 2. Safe Account Linking (Never override role, preserve existing permissions)
      let needsSave = false;

      if (!user.googleId) {
        user.googleId = uid;
        needsSave = true;
      }

      if ((!user.name || !user.name.trim()) && name) {
        user.name = name.trim();
        needsSave = true;
      }

      if (!user.avatar && picture) {
        user.avatar = picture;
        needsSave = true;
      }

      // 3. Ensure role is valid UTSAV role
      const validRoles = ['admin', 'organizer', 'attendee'];
      if (!validRoles.includes(user.role)) {
        user.role = 'attendee';
        needsSave = true;
      }

      if (needsSave) {
        await user.save({ validateBeforeSave: false });
      }

      if (is2FARequired(user)) {
        return await initiate2FAChallenge(user, res);
      }

      return await sendTokenResponse(user, 200, res, {}, req);
    }

    // 3. New User Registration via Google OAuth
    // Self-registration is strictly restricted to 'attendee'. Never allow client-supplied roles.
    const resolvedName = name?.trim() || normalizedEmail.split('@')[0] || 'Attendee';
    const randomPassword = crypto.randomBytes(32).toString('hex');

    user = await User.create({
      name: resolvedName,
      email: normalizedEmail,
      password: randomPassword,
      role: 'attendee',
      googleId: uid,
      avatar: picture || '',
    });

    await sendTokenResponse(user, 201, res, {}, req);
  } catch (error) {
    console.error('Unhandled error in googleAuth:', error.message);
    next(error);
  }
};

/**
 * @desc    Verify 2FA challenge (Supports TOTP Authenticator, Recovery Codes, and Email OTP)
 * @route   POST /api/auth/verify-2fa
 * @access  Public (Guarded by temporary pre-auth JWT)
 */
export const verify2FA = async (req, res, next) => {
  try {
    const { tempToken, otp, code, recoveryCode, isRecoveryCode } = req.body;
    const rawCandidate = otp || code || recoveryCode;

    if (!tempToken || !rawCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Temporary session token and verification code are required.',
      });
    }

    let decoded;
    try {
      decoded = verifyTemp2FAToken(tempToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Verification session has expired or is invalid. Please log in again.',
      });
    }

    const user = await User.findById(decoded.id).select(
      '+twoFactorOtpHash +twoFactorOtpExpiresAt +twoFactorAttempts +password +totpSecret +totpLastAcceptedStep +recoveryCodes'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this verification session no longer exists.',
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator. Please contact support.',
        isSuspended: true,
      });
    }

    const isAuthenticator = user.role === 'admin' || user.twoFactorMethod === 'authenticator';

    // =========================================================================
    // 1. AUTHENTICATOR METHOD (TOTP & RECOVERY CODES)
    // =========================================================================
    if (isAuthenticator) {
      const candidateStr = String(rawCandidate).trim();
      const isRecoverySubmission =
        isRecoveryCode ||
        Boolean(recoveryCode) ||
        candidateStr.includes('-') ||
        candidateStr.length > 8;

      // 1A. RECOVERY CODE ATTEMPT
      if (isRecoverySubmission) {
        if (!user.recoveryCodes || user.recoveryCodes.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No recovery codes are configured on this account.',
          });
        }

        const matchResult = verifyRecoveryCode(candidateStr, user.recoveryCodes);
        if (!matchResult.match) {
          const newAttempts = (user.twoFactorAttempts || 0) + 1;
          await User.updateOne({ _id: user._id }, { $inc: { twoFactorAttempts: 1 } });
          return res.status(400).json({
            success: false,
            message: 'Invalid or already consumed recovery code.',
          });
        }

        // Atomically consume recovery code so it cannot be reused
        const updateKey = `recoveryCodes.${matchResult.index}.used`;
        const updateDateKey = `recoveryCodes.${matchResult.index}.usedAt`;
        const consumedUser = await User.findOneAndUpdate(
          {
            _id: user._id,
            [`recoveryCodes.${matchResult.index}.used`]: false,
          },
          {
            $set: {
              [updateKey]: true,
              [updateDateKey]: new Date(),
              twoFactorAttempts: 0,
            },
          },
          { new: true }
        );

        if (!consumedUser) {
          return res.status(400).json({
            success: false,
            message: 'Recovery code has already been consumed. Please try another code.',
          });
        }

        // Record security audit event
        try {
          const ipAddress =
            req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
            req.socket?.remoteAddress ||
            '';
          await AuditLog.create({
            adminId: user._id,
            adminEmail: user.email,
            adminName: user.name,
            action: '2fa_recovery_code_used',
            targetType: 'User',
            targetId: String(user._id),
            targetTitle: user.name,
            details: 'Account successfully authenticated using a one-time emergency recovery code.',
            ipAddress,
          });
        } catch (auditErr) {
          // non-blocking
        }

        return await sendTokenResponse(consumedUser, 200, res, { recoveryCodeUsed: true }, req);
      }

      // 1B. 6-DIGIT TOTP AUTHENTICATOR CODE
      const cleanToken = candidateStr.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(cleanToken)) {
        return res.status(400).json({
          success: false,
          message: 'Verification code must be exactly 6 digits.',
        });
      }

      if (!user.totpSecret) {
        return res.status(400).json({
          success: false,
          message: 'Authenticator is not enrolled on this account. Please complete setup.',
        });
      }

      let secret;
      try {
        secret = decryptSecret(user.totpSecret);
      } catch (e) {
        return res.status(500).json({
          success: false,
          message: 'Security configuration error: failed to decrypt TOTP secret.',
        });
      }

      const verifyResult = verifyTotpCode({
        token: cleanToken,
        secret,
        lastAcceptedStep: user.totpLastAcceptedStep,
      });

      if (verifyResult.reason === 'replay_detected') {
        return res.status(400).json({
          success: false,
          message: 'This verification code was already used. Please wait 30 seconds for the next code in your authenticator app.',
        });
      }

      if (!verifyResult.valid) {
        const newAttempts = (user.twoFactorAttempts || 0) + 1;
        const remaining = Math.max(0, 5 - newAttempts);

        if (newAttempts >= 5) {
          await User.updateOne({ _id: user._id }, { $set: { twoFactorAttempts: 0 } });
          return res.status(400).json({
            success: false,
            message: 'Incorrect verification code. Maximum attempts exceeded. Please try an emergency recovery code or log in again.',
          });
        }

        await User.updateOne({ _id: user._id }, { $inc: { twoFactorAttempts: 1 } });
        return res.status(400).json({
          success: false,
          message: `Incorrect verification code. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
        });
      }

      // Atomically consume TOTP timeStep for replay and concurrency protection
      const consumedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          totpLastAcceptedStep: { $ne: verifyResult.timeStep },
        },
        {
          $set: {
            totpLastAcceptedStep: verifyResult.timeStep,
            twoFactorAttempts: 0,
          },
        },
        { new: true }
      );

      if (!consumedUser) {
        return res.status(400).json({
          success: false,
          message: 'This verification code has already been consumed. Please wait for the next time-step.',
        });
      }

      return await sendTokenResponse(consumedUser, 200, res, {}, req);
    }

    // =========================================================================
    // 2. EMAIL OTP METHOD
    // =========================================================================
    const cleanOtp = String(rawCandidate).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be exactly 6 digits.',
      });
    }

    if (!user.twoFactorOtpHash || !user.twoFactorOtpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: 'No active verification session found. Please log in again to receive a new code.',
      });
    }

    // Check expiry (5 minutes)
    if (Date.now() > new Date(user.twoFactorOtpExpiresAt).getTime()) {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            twoFactorOtpHash: 1,
            twoFactorOtpExpiresAt: 1,
            twoFactorAttempts: 1,
          },
        }
      );
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code or log in again.',
      });
    }

    // Check attempt limit
    if (user.twoFactorAttempts >= 5) {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            twoFactorOtpHash: 1,
            twoFactorOtpExpiresAt: 1,
            twoFactorAttempts: 1,
          },
        }
      );
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. For your security, this code has been invalidated. Please log in again.',
      });
    }

    // Timing-safe comparison of candidate OTP with stored hash
    const isMatch = compareOtp(cleanOtp, user.twoFactorOtpHash);

    if (!isMatch) {
      const newAttempts = (user.twoFactorAttempts || 0) + 1;
      const remaining = Math.max(0, 5 - newAttempts);

      if (newAttempts >= 5) {
        await User.updateOne(
          { _id: user._id },
          {
            $unset: {
              twoFactorOtpHash: 1,
              twoFactorOtpExpiresAt: 1,
              twoFactorAttempts: 1,
            },
          }
        );
        return res.status(400).json({
          success: false,
          message: 'Incorrect verification code. Maximum attempts exceeded. Please log in again.',
        });
      }

      await User.updateOne(
        { _id: user._id },
        { $inc: { twoFactorAttempts: 1 } }
      );

      return res.status(400).json({
        success: false,
        message: `Incorrect verification code. You have ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      });
    }

    // Atomically consume OTP to prevent replay and concurrency double-spend
    const consumed = await User.findOneAndUpdate(
      {
        _id: user._id,
        twoFactorOtpHash: user.twoFactorOtpHash,
      },
      {
        $unset: {
          twoFactorOtpHash: 1,
          twoFactorOtpExpiresAt: 1,
          twoFactorAttempts: 1,
          twoFactorLastSentAt: 1,
        },
      },
      { new: true }
    );

    if (!consumed) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has already been consumed or invalidated. Please log in again.',
      });
    }

    // Issue standard full session token and HTTP-only cookie
    await sendTokenResponse(consumed, 200, res, {}, req);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resend 6-digit OTP code with 60-second cooldown
 * @route   POST /api/auth/resend-2fa
 * @access  Public (Guarded by temporary pre-auth JWT)
 */
export const resend2FA = async (req, res, next) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({
        success: false,
        message: 'Temporary verification token is required.',
      });
    }

    let decoded;
    try {
      decoded = verifyTemp2FAToken(tempToken);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: 'Verification session has expired or is invalid. Please log in again.',
      });
    }

    const user = await User.findById(decoded.id).select(
      '+twoFactorLastSentAt +twoFactorOtpExpiresAt +twoFactorAttempts'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this verification session not found.',
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator. Please contact support.',
        isSuspended: true,
      });
    }

    // If account uses Authenticator app, codes are generated locally!
    if (user.role === 'admin' || user.twoFactorMethod === 'authenticator') {
      return res.status(400).json({
        success: false,
        message: 'Verification codes are generated locally inside your authenticator application and cannot be resent via email.',
      });
    }

    // Enforce server-side 60-second cooldown
    if (user.twoFactorLastSentAt) {
      const timeSinceLastSent = Date.now() - new Date(user.twoFactorLastSentAt).getTime();
      if (timeSinceLastSent < 60 * 1000) {
        const waitSeconds = Math.ceil((60 * 1000 - timeSinceLastSent) / 1000);
        return res.status(429).json({
          success: false,
          message: `Please wait ${waitSeconds} seconds before requesting a new verification code.`,
          retryAfter: waitSeconds,
        });
      }
    }

    // Generate fresh OTP and new 5-minute expiry, reset attempts
    const otp = generateOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    user.twoFactorOtpHash = otpHash;
    user.twoFactorOtpExpiresAt = expiresAt;
    user.twoFactorAttempts = 0;
    user.twoFactorLastSentAt = new Date();
    await user.save({ validateBeforeSave: false });

    try {
      await send2FAVerificationEmail({
        email: user.email,
        userName: user.name,
        otp,
      });
    } catch (err) {
      await User.updateOne(
        { _id: user._id },
        {
          $unset: {
            twoFactorOtpHash: 1,
            twoFactorOtpExpiresAt: 1,
            twoFactorAttempts: 1,
            twoFactorLastSentAt: 1,
          },
        }
      );
      console.error('Resend 2FA email dispatch failed:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Verification email could not be dispatched. Please try again.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'A fresh 6-digit verification code has been dispatched to your email.',
      email: maskEmail(user.email),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Extend session inactivity timeout (called by user action / keep alive)
 * @route   POST /api/auth/refresh-session
 * @access  Private
 */
export const refreshSession = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Session refreshed successfully.',
    session: {
      id: req.session.sessionId,
      expiresAt: req.session.expiresAt,
      absoluteExpiresAt: req.session.absoluteExpiresAt,
      inactivityTimeoutMs: getInactivityTimeoutMs(),
      warningBeforeExpiryMs: getWarningBeforeExpiryMs(),
    },
  });
};

/**
 * @desc    Get all active sessions for the authenticated user
 * @route   GET /api/auth/sessions
 * @access  Private
 */
export const getActiveSessions = async (req, res, next) => {
  try {
    const now = new Date();
    const sessions = await Session.find({
      userId: req.user._id,
      revokedAt: null,
      expiresAt: { $gt: now },
      absoluteExpiresAt: { $gt: now },
    }).sort({ createdAt: -1 });

    const safeSessions = sessions.map((s) => ({
      id: s.sessionId,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
      expiresAt: s.expiresAt,
      absoluteExpiresAt: s.absoluteExpiresAt,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      isCurrent: s.sessionId === req.session?.sessionId,
    }));

    res.status(200).json({
      success: true,
      sessions: safeSessions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revoke a specific session
 * @route   DELETE /api/auth/sessions/:sessionId
 * @access  Private
 */
export const revokeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findOne({
      sessionId,
      userId: req.user._id,
      revokedAt: null,
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or already revoked.',
      });
    }

    session.revokedAt = new Date();
    session.revocationReason = 'revoked_by_user';
    await session.save();

    // If revoking the current session, clear cookie
    if (session.sessionId === req.session?.sessionId) {
      res.cookie('token', '', {
        expires: new Date(0),
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Session revoked successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revoke all other active sessions except the current one
 * @route   POST /api/auth/sessions/revoke-others
 * @access  Private
 */
export const revokeOtherSessions = async (req, res, next) => {
  try {
    const currentSessionId = req.session?.sessionId;

    const result = await Session.updateMany(
      {
        userId: req.user._id,
        sessionId: { $ne: currentSessionId },
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revocationReason: 'revoked_other_sessions',
        },
      }
    );

    res.status(200).json({
      success: true,
      message: 'All other sessions have been logged out.',
      revokedCount: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};



