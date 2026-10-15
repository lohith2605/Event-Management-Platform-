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
} from '../controllers/authController.js';
import { protect } from '../middlewares/auth.js';

import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limiter for forgot-password requests (5 attempts per 15 minutes per IP)
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many password reset requests from this IP. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public Authentication endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/google', googleAuth);
router.post('/logout', logout);
router.post('/forgot-password', forgotPasswordLimiter, forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Protected session endpoint
router.get('/me', protect, getMe);

export default router;
