/**
 * Re-export email utilities from the centralized emailService
 * Maintains full backward compatibility with UTSAV utils import patterns
 */
export { sendEmail, sendPasswordResetEmail, send2FAVerificationEmail } from '../services/emailService.js';
export { default } from '../services/emailService.js';
