import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Session from '../models/Session.js';
import { getInactivityTimeoutMs } from '../utils/token.js';

/**
 * Protect routes - Verifies JWT from HTTP-only cookie or Bearer header,
 * validates active MongoDB session, enforces inactivity & absolute timeouts,
 * and slides the inactivity window atomically on accepted requests.
 */
export const protect = async (req, res, next) => {
  let token;

  // 1. Check cookies first (most secure)
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 2. Check Authorization header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Ensure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized. Please log in to access this resource.',
    });
  }

  try {
    // Verify JWT cryptographic signature and expiration
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform'
    );

    // Reject restricted pre-authentication 2FA tokens
    if (decoded.purpose === '2fa_pending' || !decoded.role) {
      return res.status(401).json({
        success: false,
        message: 'Temporary two-factor authentication token cannot be used to access protected resources. Please complete 2FA verification.',
      });
    }

    // Require session identifier in token
    if (!decoded.sessionId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session identifier. Please log in again.',
        sessionExpired: true,
      });
    }

    // Retrieve active session from MongoDB
    const session = await Session.findOne({ sessionId: decoded.sessionId });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Session not found or has expired. Please log in again.',
        sessionExpired: true,
      });
    }

    // Check if session has been revoked
    if (session.revokedAt) {
      return res.status(401).json({
        success: false,
        message: 'Session has been revoked or logged out. Please log in again.',
        sessionExpired: true,
        reason: session.revocationReason || 'session_revoked',
      });
    }

    const now = new Date();

    // Check absolute session lifetime (hard ceiling: can NEVER be extended by activity)
    if (now > session.absoluteExpiresAt) {
      await Session.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: now, revocationReason: 'absolute_timeout' } }
      );
      return res.status(401).json({
        success: false,
        message: 'Session has reached its maximum allowed lifetime. Please log in again.',
        sessionExpired: true,
        reason: 'absolute_timeout',
      });
    }

    // Check sliding inactivity timeout
    if (now > session.expiresAt) {
      await Session.updateOne(
        { _id: session._id, revokedAt: null },
        { $set: { revokedAt: now, revocationReason: 'inactivity_timeout' } }
      );
      return res.status(401).json({
        success: false,
        message: 'Session expired due to inactivity. Please log in again.',
        sessionExpired: true,
        reason: 'inactivity_timeout',
      });
    }

    // Fetch user and verify account state
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this session no longer exists.',
      });
    }

    // Ensure session belongs to the user matching the token
    if (session.userId.toString() !== user._id.toString()) {
      return res.status(401).json({
        success: false,
        message: 'Session ownership verification failed.',
        sessionExpired: true,
      });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended by an administrator. Please contact support.',
        isSuspended: true,
      });
    }

    // Slide the inactivity window atomically:
    // New inactivity deadline is min(now + inactivityTimeout, absoluteExpiresAt)
    const inactivityTimeoutMs = getInactivityTimeoutMs();
    const newExpiresAt = new Date(
      Math.min(now.getTime() + inactivityTimeoutMs, session.absoluteExpiresAt.getTime())
    );

    // Atomically renew lastActivityAt and expiresAt if not revoked concurrently
    await Session.updateOne(
      { _id: session._id, revokedAt: null },
      { $set: { lastActivityAt: now, expiresAt: newExpiresAt } }
    );

    session.lastActivityAt = now;
    session.expiresAt = newExpiresAt;

    req.user = user;
    req.session = session;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Authentication session expired or invalid. Please log in again.',
      sessionExpired: true,
    });
  }
};

/**
 * Grant access to specific roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user?.role || 'anonymous'}' is not authorized to access this resource.`,
      });
    }
    next();
  };
};
