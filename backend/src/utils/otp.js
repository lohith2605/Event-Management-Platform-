import crypto from 'crypto';

/**
 * Generate a cryptographically secure 6-digit numeric OTP.
 * Uses crypto.randomInt to guarantee uniform randomness and prevent PRNG predictability.
 *
 * @returns {string} 6-digit numeric string (100000 - 999999)
 */
export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hash an OTP using SHA-256 before database persistence.
 *
 * @param {string} otp Raw 6-digit code
 * @returns {string} Hex-encoded SHA-256 digest
 */
export const hashOtp = (otp) => {
  if (!otp || typeof otp !== 'string') {
    throw new Error('Valid OTP string is required for hashing.');
  }
  return crypto
    .createHash('sha256')
    .update(otp.trim())
    .digest('hex');
};

/**
 * Constant-time comparison of a submitted OTP against a stored SHA-256 hash.
 * Mitigates side-channel timing analysis attacks.
 *
 * @param {string} candidateOtp The OTP provided by user
 * @param {string} storedHash The SHA-256 hash retrieved from the database
 * @returns {boolean} True if hashes match exactly
 */
export const compareOtp = (candidateOtp, storedHash) => {
  if (!candidateOtp || !storedHash || typeof candidateOtp !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const candidateHash = hashOtp(candidateOtp);
  const candidateBuffer = Buffer.from(candidateHash, 'hex');
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (candidateBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(candidateBuffer, storedBuffer);
};

/**
 * Mask an email address for safe challenge presentation in UI and API responses.
 * Example: 'lohith.developer@example.com' -> 'l***r@example.com'
 *
 * @param {string} email
 * @returns {string}
 */
export const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return 'your registered email';
  }

  const [username, domain] = email.trim().toLowerCase().split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }

  const firstChar = username[0];
  const lastChar = username[username.length - 1];
  return `${firstChar}***${lastChar}@${domain}`;
};
