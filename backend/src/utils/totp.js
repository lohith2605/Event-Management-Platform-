import crypto from 'crypto';
import QRCode from 'qrcode';
import { generateSecret, generateSync, verifySync, generateURI } from 'otplib';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

/**
 * Derives a 32-byte encryption key for AES-256-GCM.
 * Uses TOTP_ENCRYPTION_KEY or falls back to SHA-256 hash of JWT_SECRET.
 */
function getEncryptionKey() {
  const secret = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('TOTP encryption key is missing in environment variables (TOTP_ENCRYPTION_KEY or JWT_SECRET).');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext secret using authenticated AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} ivHex:authTagHex:encryptedHex
 */
export function encryptSecret(plaintext) {
  if (!plaintext) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a ciphertext encrypted with AES-256-GCM.
 * @param {string} ciphertext
 * @returns {string} plaintext
 */
export function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret format.');
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a cryptographically random Base32 TOTP secret.
 * @returns {string} Base32 secret
 */
export function generateTotpSecret() {
  return generateSecret();
}

/**
 * Generates an interoperable otpauth:// URI for authenticator applications.
 * @param {Object} params
 * @param {string} params.email User email
 * @param {string} params.secret Plaintext Base32 secret
 * @param {string} [params.issuer='UTSAV'] Application name
 * @returns {string}
 */
export function generateTotpUri({ email, secret, issuer = 'UTSAV' }) {
  return generateURI({
    issuer,
    label: email,
    secret,
  });
}

/**
 * Generates a Data URL (base64 PNG) of the QR code for enrollment.
 * @param {string} uri otpauth:// URI
 * @returns {Promise<string>}
 */
export async function generateQrCode(uri) {
  return await QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
    color: {
      dark: '#1C1917',
      light: '#FFFFFF',
    },
  });
}

/**
 * Verifies a 6-digit TOTP code with time-drift tolerance and replay prevention.
 * @param {Object} params
 * @param {string} params.token 6-digit candidate code
 * @param {string} params.secret Plaintext Base32 secret
 * @param {number} [params.lastAcceptedStep=0] The highest counter/step previously accepted
 * @returns {{ valid: boolean, timeStep?: number, reason?: string }}
 */
export function verifyTotpCode({ token, secret, lastAcceptedStep = 0 }) {
  if (!token || !secret) {
    return { valid: false, reason: 'missing_parameters' };
  }

  const cleanToken = String(token).trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) {
    return { valid: false, reason: 'invalid_format' };
  }

  // Check code with 30s epoch tolerance (+/- 1 step)
  const result = verifySync({
    token: cleanToken,
    secret,
    epochTolerance: 30,
  });

  if (!result || !result.valid) {
    return { valid: false, reason: 'mismatch' };
  }

  // Replay prevention: an accepted time-step cannot be reused
  if (lastAcceptedStep && result.timeStep <= lastAcceptedStep) {
    return { valid: false, reason: 'replay_detected' };
  }

  return { valid: true, timeStep: result.timeStep };
}

/**
 * Generates a set of 8 cryptographically secure recovery codes.
 * Format: 4-4-4 uppercase alphanumeric (e.g. A3F9-8KD2-9LM1)
 * @returns {{ plainCodes: string[], hashedRecords: Array<{ codeHash: string, used: boolean }> }}
 */
export function generateRecoveryCodes(count = 8) {
  const plainCodes = [];
  const hashedRecords = [];

  for (let i = 0; i < count; i++) {
    // 6 random bytes = 12 hex chars -> 4-4-4 format
    const hex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const formatted = `${hex.substring(0, 4)}-${hex.substring(4, 8)}-${hex.substring(8, 12)}`;
    plainCodes.push(formatted);

    const codeHash = hashRecoveryCode(formatted);
    hashedRecords.push({
      codeHash,
      used: false,
    });
  }

  return { plainCodes, hashedRecords };
}

/**
 * Hashes a recovery code with SHA-256 for secure storage.
 * @param {string} code
 * @returns {string}
 */
export function hashRecoveryCode(code) {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Checks a submitted recovery code against stored hashed recovery codes.
 * @param {string} submittedCode
 * @param {Array<{ codeHash: string, used: boolean }>} recoveryCodes
 * @returns {{ match: boolean, index: number }}
 */
export function verifyRecoveryCode(submittedCode, recoveryCodes = []) {
  if (!submittedCode || !Array.isArray(recoveryCodes)) {
    return { match: false, index: -1 };
  }

  const candidateHash = hashRecoveryCode(submittedCode);

  for (let i = 0; i < recoveryCodes.length; i++) {
    const record = recoveryCodes[i];
    if (!record.used && record.codeHash) {
      if (crypto.timingSafeEqual(Buffer.from(candidateHash), Buffer.from(record.codeHash))) {
        return { match: true, index: i };
      }
    }
  }

  return { match: false, index: -1 };
}
