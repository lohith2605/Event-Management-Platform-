import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import Session from '../models/Session.js';

export const DEFAULT_INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const DEFAULT_ABSOLUTE_LIFETIME_MS = 8 * 60 * 60 * 1000; // 8 hours
export const DEFAULT_WARNING_BEFORE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes


export const getInactivityTimeoutMs = () => {
  const val = parseInt(process.env.SESSION_INACTIVITY_TIMEOUT_MS, 10);
  return Number.isFinite(val) && val > 0 ? val : DEFAULT_INACTIVITY_TIMEOUT_MS;
};

export const getAbsoluteLifetimeMs = () => {
  const val = parseInt(process.env.SESSION_ABSOLUTE_LIFETIME_MS, 10);
  return Number.isFinite(val) && val > 0 ? val : DEFAULT_ABSOLUTE_LIFETIME_MS;
};

export const getWarningBeforeExpiryMs = () => {
  const val = parseInt(process.env.SESSION_WARNING_BEFORE_EXPIRY_MS, 10);
  return Number.isFinite(val) && val > 0 ? val : DEFAULT_WARNING_BEFORE_EXPIRY_MS;
};


export const generateSessionId = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Create a new authenticated Session record in MongoDB
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {object} meta - Optional client metadata { ipAddress, userAgent }
 * @returns {Promise<Document>} Created Session document
 */
export const createSessionRecord = async (userId, meta = {}) => {
  const now = Date.now();
  const inactivityTimeoutMs = getInactivityTimeoutMs();
  const absoluteLifetimeMs = getAbsoluteLifetimeMs();

  const sessionId = generateSessionId();
  const createdAt = new Date(now);
  const lastActivityAt = new Date(now);
  const absoluteExpiresAt = new Date(now + absoluteLifetimeMs);
  const expiresAt = new Date(Math.min(now + inactivityTimeoutMs, absoluteExpiresAt.getTime()));

  const session = await Session.create({
    userId,
    sessionId,
    createdAt,
    lastActivityAt,
    expiresAt,
    absoluteExpiresAt,
    ipAddress: meta.ipAddress || '',
    userAgent: meta.userAgent || '',
  });

  return session;
};

/**
 * Generate signed JWT containing user ID, role, and cryptographically secure session ID.
 * JWT expiration is capped at the session absolute lifetime.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} role
 * @param {string} sessionId
 * @returns {string} Signed JWT
 */
export const generateToken = (userId, role, sessionId) => {
  const absoluteLifetimeMs = getAbsoluteLifetimeMs();
  const expiresInSeconds = Math.max(60, Math.floor(absoluteLifetimeMs / 1000));

  return jwt.sign(
    { id: userId, role, sessionId },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    {
      expiresIn: process.env.JWT_EXPIRE || `${expiresInSeconds}s`,
    }
  );
};

/**
 * Create a MongoDB session, sign JWT, send in HTTP-Only cookie and JSON response.
 *
 * @param {object} user - Authenticated User document
 * @param {number} statusCode - HTTP status code
 * @param {object} res - Express response object
 * @param {object} extraData - Optional additional response payload
 * @param {object} req - Express request object (for client IP and User-Agent)
 */
export const sendTokenResponse = async (user, statusCode, res, extraData = {}, req = null) => {
  // Extract client metadata safely
  const clientMeta = {
    ipAddress:
      req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      req?.ip ||
      '',
    userAgent: req?.headers?.['user-agent'] || '',
  };

 
  const session = await createSessionRecord(user._id, clientMeta);

  
  const token = generateToken(user._id, user.role, session.sessionId);

  
  const options = {
    expires: session.absoluteExpiresAt,
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name || '',
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      session: {
        id: session.sessionId,
        expiresAt: session.expiresAt,
        absoluteExpiresAt: session.absoluteExpiresAt,
        inactivityTimeoutMs: getInactivityTimeoutMs(),
        warningBeforeExpiryMs: getWarningBeforeExpiryMs(),
      },
      ...extraData,
    });
};

/**
 * Generate a short-lived, restricted pre-authentication token for 2FA challenge.
 * Does NOT contain role or access permissions and NEVER creates a session.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {string} Signed JWT with purpose: '2fa_pending' (5 minutes)
 */
export const generateTemp2FAToken = (userId) => {
  return jwt.sign(
    { id: userId, purpose: '2fa_pending' },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    {
      expiresIn: '5m',
    }
  );
};

/**
 * Verify and decode a restricted pre-authentication 2FA token.
 *
 * @param {string} token
 * @returns {{ id: string, purpose: string }} Decoded payload
 * @throws {Error} If token is invalid, expired, or purpose mismatch
 */
export const verifyTemp2FAToken = (token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('A temporary 2FA token is required.');
  }

  const decoded = jwt.verify(
    token,
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform'
  );

  if (decoded.purpose !== '2fa_pending' || !decoded.id) {
    throw new Error('Invalid token purpose: Not a valid 2FA pre-authentication challenge.');
  }

  return decoded;
};
