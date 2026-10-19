import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import {
  encryptSecret,
  decryptSecret,
  generateTotpSecret,
  generateTotpUri,
  generateQrCode,
  verifyTotpCode,
  generateRecoveryCodes,
} from '../utils/totp.js';
import { verifyTemp2FAToken, sendTokenResponse } from '../utils/token.js';

/**
 * Helper to record security events in the audit log
 */
const recordAudit = async (req, user, action, details, metadata = {}) => {
  try {
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      '';

    await AuditLog.create({
      adminId: user._id,
      adminEmail: user.email,
      adminName: user.name,
      action,
      targetType: 'User',
      targetId: String(user._id),
      targetTitle: user.name || 'Security Event',
      details: details.substring(0, 500),
      reason: 'Security Configuration',
      metadata,
      ipAddress,
    });
  } catch (err) {
    console.error('Audit log creation error:', err.message);
  }
};

/**
 * Resolves the acting user from either an authenticated session (req.user)
 * or a restricted temporary pre-auth token (req.body.tempToken / Authorization Bearer).
 */
export const resolveUserFromSessionOrTemp = async (req) => {
  if (req.user) return req.user;

  let token = req.body?.tempToken;
  if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return null;

  try {
    const decoded = verifyTemp2FAToken(token);
    return await User.findById(decoded.id);
  } catch (err) {
    return null;
  }
};

/**
 * @desc    Initialize TOTP Authenticator enrollment
 * @route   POST /api/users/2fa/authenticator/setup
 * @access  Protected (Session or Pre-Auth Temp Token for mandatory enrollment)
 */
export const setupAuthenticator = async (req, res, next) => {
  try {
    const user = await resolveUserFromSessionOrTemp(req);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to initiate authenticator setup.',
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Cannot modify security settings.',
      });
    }

    // Generate fresh cryptographically random Base32 secret
    const secret = generateTotpSecret();
    const encryptedSecret = encryptSecret(secret);

    // Save pending secret (not yet active)
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          totpPendingSecret: encryptedSecret,
        },
      }
    );

    // Generate otpauth:// URI and QR code
    const issuer = 'UTSAV';
    const uri = generateTotpUri({
      email: user.email,
      secret,
      issuer,
    });

    const qrCode = await generateQrCode(uri);

    // Never log or return secret in database; return manual key for screen setup only
    res.status(200).json({
      success: true,
      qrCode,
      manualEntryKey: secret,
      issuer,
      account: user.email,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify first TOTP code and activate Authenticator 2FA
 * @route   POST /api/users/2fa/authenticator/verify-setup
 * @access  Protected (Session or Pre-Auth Temp Token)
 */
export const verifyAuthenticatorSetup = async (req, res, next) => {
  try {
    const { code, currentPassword, tempToken } = req.body;

    if (!code || !String(code).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide the 6-digit code from your authenticator app.',
      });
    }

    const cleanCode = String(code).trim().replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleanCode)) {
      return res.status(400).json({
        success: false,
        message: 'Verification code must be exactly 6 digits.',
      });
    }

    let user;
    const isEnrollingDuringLogin = Boolean(tempToken);

    if (isEnrollingDuringLogin) {
      try {
        const decoded = verifyTemp2FAToken(tempToken);
        user = await User.findById(decoded.id).select(
          '+password +totpPendingSecret +totpSecret +recoveryCodes'
        );
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Enrollment session has expired. Please log in again to restart setup.',
        });
      }
    } else {
      user = await User.findById(req.user?._id).select(
        '+password +totpPendingSecret +totpSecret +recoveryCodes'
      );
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User account not found.',
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Account is suspended.',
      });
    }

    // If changing security from an active session, require current password confirmation
    // (Except for Google-only accounts that have no password)
    if (!isEnrollingDuringLogin && user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to activate authenticator 2FA.',
        });
      }

      const isPasswordMatch = await user.matchPassword(currentPassword);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    if (!user.totpPendingSecret) {
      return res.status(400).json({
        success: false,
        message: 'No pending authenticator enrollment found. Please scan the QR code first.',
      });
    }

    let decryptedSecret;
    try {
      decryptedSecret = decryptSecret(user.totpPendingSecret);
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Failed to decrypt pending secret. Configuration error.',
      });
    }

    // Verify first TOTP code
    const verification = verifyTotpCode({
      token: cleanCode,
      secret: decryptedSecret,
    });

    if (!verification.valid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification code. Please ensure your device clock is synchronized and try again.',
      });
    }

    // Generate 8 cryptographically secure recovery codes
    const { plainCodes, hashedRecords } = generateRecoveryCodes(8);

    // Atomically activate authenticator 2FA
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          totpSecret: user.totpPendingSecret,
          totpEnrolled: true,
          twoFactorEnabled: true,
          twoFactorMethod: 'authenticator',
          totpEnrolledAt: new Date(),
          totpLastAcceptedStep: 0,
          recoveryCodes: hashedRecords,
        },
        $unset: {
          totpPendingSecret: 1,
          twoFactorOtpHash: 1,
          twoFactorOtpExpiresAt: 1,
          twoFactorAttempts: 1,
          twoFactorLastSentAt: 1,
        },
      }
    );

    await recordAudit(req, user, '2fa_totp_enrolled', 'User enrolled and activated Google Authenticator 2FA');

    // If enrolling during login (e.g. mandatory admin enrollment), grant full session now!
    if (isEnrollingDuringLogin) {
      const refreshedUser = await User.findById(user._id);
      return await sendTokenResponse(refreshedUser, 200, res, {
        recoveryCodes: plainCodes,
        enrolledDuringLogin: true,
      }, req);
    }

    // Otherwise return success with plaintext recovery codes (displayed ONLY once!)
    res.status(200).json({
      success: true,
      message: 'Google Authenticator 2FA has been successfully activated.',
      twoFactorEnabled: true,
      twoFactorMethod: 'authenticator',
      recoveryCodes: plainCodes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Disable Authenticator 2FA (or switch to disabled)
 * @route   POST /api/users/2fa/authenticator/disable
 * @access  Protected
 */
export const disableAuthenticator = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password +totpSecret');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Enforce mandatory admin 2FA policy
    if (user.role === 'admin' && process.env.REQUIRE_ADMIN_2FA !== 'false') {
      return res.status(403).json({
        success: false,
        message: 'Two-factor authentication is mandatory under administrator security policy and cannot be disabled.',
      });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to disable authenticator 2FA.',
        });
      }

      const isPasswordMatch = await user.matchPassword(currentPassword);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          twoFactorEnabled: false,
          twoFactorMethod: 'email',
          totpEnrolled: false,
        },
        $unset: {
          totpSecret: 1,
          totpPendingSecret: 1,
          totpEnrolledAt: 1,
          totpLastAcceptedStep: 1,
          recoveryCodes: 1,
        },
      }
    );

    await recordAudit(req, user, '2fa_totp_disabled', 'User disabled Authenticator 2FA');

    res.status(200).json({
      success: true,
      message: 'Two-factor authentication has been disabled.',
      twoFactorEnabled: false,
      twoFactorMethod: 'email',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Regenerate a fresh set of recovery codes
 * @route   POST /api/users/2fa/authenticator/recovery-codes
 * @access  Protected
 */
export const regenerateRecoveryCodes = async (req, res, next) => {
  try {
    const { currentPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password +totpSecret +recoveryCodes');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (!user.totpEnrolled || !user.twoFactorEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Authenticator 2FA is not active on this account.',
      });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to regenerate recovery codes.',
        });
      }

      const isPasswordMatch = await user.matchPassword(currentPassword);
      if (!isPasswordMatch) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.',
        });
      }
    }

    const { plainCodes, hashedRecords } = generateRecoveryCodes(8);

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          recoveryCodes: hashedRecords,
        },
      }
    );

    await recordAudit(req, user, '2fa_recovery_codes_generated', 'Regenerated fresh set of recovery codes');

    res.status(200).json({
      success: true,
      message: 'New recovery codes generated successfully. Save them securely.',
      recoveryCodes: plainCodes,
    });
  } catch (error) {
    next(error);
  }
};
