import crypto from 'crypto';
import QRCode from 'qrcode';
import { generateSecret, verifySync, generateURI } from 'otplib';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM

function getEncryptionKey() {
  const secret = process.env.TOTP_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('TOTP encryption key is missing in environment variables (TOTP_ENCRYPTION_KEY or JWT_SECRET).');
  }
  return crypto.createHash('sha256').update(String(secret)).digest();
}

// Encrypts plaintext secret using AES-256-GCM; returns ivHex:authTagHex:encryptedHex
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

export function generateTotpSecret() {
  return generateSecret();
}

export function generateTotpUri({ email, secret, issuer = 'UTSAV' }) {
  return generateURI({
    issuer,
    label: email,
    secret,
  });
}

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

// Verifies a 6-digit TOTP code with 30s drift tolerance and replay prevention
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

// Generates 8 recovery codes formatted as 4-4-4 uppercase alphanumeric (e.g. A3F9-8KD2-9LM1)
export function generateRecoveryCodes(count = 8) {
  const plainCodes = [];
  const hashedRecords = [];

  for (let i = 0; i < count; i++) {
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

export function hashRecoveryCode(code) {
  const normalized = String(code).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

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
