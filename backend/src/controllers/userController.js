import User from '../models/User.js';
import Session from '../models/Session.js';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { initializeFirebaseAdmin } from '../config/firebaseAdmin.js';

/**
 * @desc    Get authenticated attendee profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        bio: user.bio || '',
        city: user.city || '',
        avatar: user.avatar || '',
        twoFactorEnabled: user.twoFactorEnabled || false,
        twoFactorMethod: user.twoFactorMethod || 'email',
        totpEnrolled: user.totpEnrolled || false,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update permitted attendee profile fields
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, bio, city, avatar } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found.',
      });
    }

    // Whitelist and validate permitted fields only
    // Role privilege escalation is strictly prohibited
    if (name && name.trim()) {
      user.name = name.trim();
    }
    if (phone !== undefined) {
      user.phone = phone.trim();
    }
    if (bio !== undefined) {
      if (bio.length > 300) {
        return res.status(400).json({
          success: false,
          message: 'Bio cannot exceed 300 characters.',
        });
      }
      user.bio = bio.trim();
    }
    if (city !== undefined) {
      user.city = city.trim();
    }
    if (avatar !== undefined) {
      user.avatar = avatar.trim();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || '',
        bio: user.bio || '',
        city: user.city || '',
        avatar: user.avatar || '',
        twoFactorEnabled: user.twoFactorEnabled || false,
        twoFactorMethod: user.twoFactorMethod || 'email',
        totpEnrolled: user.totpEnrolled || false,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Change password with current password verification
 * @route   PUT /api/users/password
 * @access  Private
 */
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current password and new password.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long.',
      });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirmation do not match.',
      });
    }

    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Verify current password
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect current password. Please try again.',
      });
    }

    // Update password (triggers bcrypt hashing pre-save hook)
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    // Revoke all other active sessions for security
    if (req.session?.sessionId) {
      await Session.updateMany(
        {
          userId: user._id,
          sessionId: { $ne: req.session.sessionId },
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: new Date(),
            revocationReason: 'password_changed',
          },
        }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle Two-Factor Authentication (2FA) status with security re-verification
 * @route   PUT /api/users/2fa-toggle
 * @access  Private
 */
export const toggle2FA = async (req, res, next) => {
  try {
    const { enabled, currentPassword, googleIdToken } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'The desired twoFactorEnabled state (true/false) is required.',
      });
    }

    const targetState = Boolean(enabled);

    // Fetch authenticated user with password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
      });
    }

    // Administrator Mandatory Policy:
    // If 2FA is mandated for admin accounts, admins cannot disable it
    if (user.role === 'admin' && process.env.REQUIRE_ADMIN_2FA !== 'false' && !targetState) {
      return res.status(403).json({
        success: false,
        message: 'Administrator security policy mandates that Two-Factor Authentication remain enabled for governance accounts.',
      });
    }

    // Identity Re-verification Check:
    // 1. If user has a password, current password is verified
    let reauthSuccess = false;

    if (currentPassword && typeof currentPassword === 'string') {
      const isMatch = await user.matchPassword(currentPassword);
      if (isMatch) {
        reauthSuccess = true;
      } else {
        return res.status(401).json({
          success: false,
          message: 'Incorrect current password. Re-authentication failed.',
        });
      }
    }
    // 2. If user authenticated via Google (passwordless / Google OAuth linked) and provided googleIdToken
    else if (user.googleId && googleIdToken && typeof googleIdToken === 'string') {
      if (getApps().length === 0) {
        initializeFirebaseAdmin();
      }

      try {
        const decodedToken = await getAuth().verifyIdToken(googleIdToken);
        if (decodedToken.uid === user.googleId || decodedToken.email?.toLowerCase() === user.email.toLowerCase()) {
          reauthSuccess = true;
        } else {
          return res.status(401).json({
            success: false,
            message: 'Google identity verification mismatch. Re-authentication failed.',
          });
        }
      } catch (tokenErr) {
        return res.status(401).json({
          success: false,
          message: 'Google re-authentication token expired or invalid.',
        });
      }
    }

    // If neither re-authentication succeeded
    if (!reauthSuccess) {
      return res.status(400).json({
        success: false,
        message: 'Security verification required: Please provide your current password to update Two-Factor Authentication settings.',
      });
    }

    user.twoFactorEnabled = targetState;

    if (targetState) {
      // Default or switch to email method if requested
      user.twoFactorMethod = req.body.method === 'authenticator' ? 'authenticator' : 'email';
    } else {
      // If disabling 2FA, also clean up any pending challenge and TOTP state
      user.totpEnrolled = false;
      user.totpSecret = undefined;
      user.totpPendingSecret = undefined;
      user.totpEnrolledAt = undefined;
      user.totpLastAcceptedStep = 0;
      user.recoveryCodes = [];
      user.twoFactorOtpHash = undefined;
      user.twoFactorOtpExpiresAt = undefined;
      user.twoFactorAttempts = 0;
      user.twoFactorLastSentAt = undefined;
    }

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: `Two-Factor Authentication has been successfully ${targetState ? 'enabled' : 'disabled'}.`,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorMethod: user.twoFactorMethod,
      totpEnrolled: user.totpEnrolled,
    });
  } catch (error) {
    next(error);
  }
};

