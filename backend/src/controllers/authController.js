import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { sendTokenResponse } from '../utils/token.js';
import { sendEmail, sendPasswordResetEmail } from '../services/emailService.js';

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

    sendTokenResponse(user, 201, res);
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

    sendTokenResponse(user, 200, res);
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

    sendTokenResponse(user, 200, res);
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
  res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
};

/**
 * @desc    Log out current session
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 5 * 1000),
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully.',
  });
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

    // Send fresh session token response with refreshed cookies
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Password reset encountered an unexpected error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while resetting your password. Please try again or request a new reset link.',
    });
  }
};
