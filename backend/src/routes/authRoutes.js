import express from 'express';
import {
  register,
  login,
  adminLogin,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  googleAuth,
  verify2FA,
  resend2FA,
  refreshSession,
  getActiveSessions,
  revokeSession,
  revokeOtherSessions,
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for forgot-password requests (5 attempts per 15 minutes per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for 2FA verification attempts (5 attempts per 5 minutes per IP)
const verify2FaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many verification attempts from this IP. Please try again after 5 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for 2FA resend requests (3 requests per 15 minutes per IP)
const resend2FaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    message: 'Too many verification resend requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public Authentication endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/google', googleAuth);
router.post('/verify-2fa', verify2FaLimiter, verify2FA);
router.post('/resend-2fa', resend2FaLimiter, resend2FA);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected session & multi-device management endpoints
router.get('/me', protect, getMe);
router.post('/refresh-session', protect, refreshSession);
router.get('/sessions', protect, getActiveSessions);
router.delete('/sessions/:sessionId', protect, revokeSession);
router.post('/sessions/revoke-others', protect, revokeOtherSessions);

export default router;
