import express from 'express';
import {
  getProfile,
  updateProfile,
  updatePassword,
  toggle2FA,
} from '../controllers/userController.js';
import {
  setupAuthenticator,
  verifyAuthenticatorSetup,
  disableAuthenticator,
  regenerateRecoveryCodes,
} from '../controllers/totpController.js';
import { protect } from '../middlewares/auth.js';
import { verifyTemp2FAToken } from '../utils/token.js';
import User from '../models/User.js';

const router = express.Router();

/**
 * Middleware that allows either standard authenticated session OR
 * pre-auth temporary token (for unenrolled users required to complete TOTP setup during login)
 */
const allowPreAuthOrProtect = async (req, res, next) => {
  let token = req.body?.tempToken;
  if (!token && req.headers?.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyTemp2FAToken(token);
      const user = await User.findById(decoded.id);
      if (user && !user.isSuspended) {
        req.user = user;
        req.isPreAuth = true;
        return next();
      }
    } catch (e) {
      // Fall through to protect
    }
  }

  return protect(req, res, next);
};

// Authenticator Setup and Verification (Allows pre-auth tempToken or full session)
router.post('/2fa/authenticator/setup', allowPreAuthOrProtect, setupAuthenticator);
router.post('/2fa/authenticator/verify-setup', allowPreAuthOrProtect, verifyAuthenticatorSetup);

// Strictly Protected Routes
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/password', updatePassword);
router.put('/2fa-toggle', toggle2FA);

// Authenticator Management
router.post('/2fa/authenticator/disable', disableAuthenticator);
router.post('/2fa/authenticator/recovery-codes', regenerateRecoveryCodes);

export default router;
