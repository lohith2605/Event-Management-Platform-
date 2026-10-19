import crypto from 'crypto';

export const generateOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

export const hashOtp = (otp) => {
  if (!otp || typeof otp !== 'string') {
    throw new Error('Valid OTP string is required for hashing.');
  }
  return crypto
    .createHash('sha256')
    .update(otp.trim())
    .digest('hex');
};

// Constant-time comparison to prevent side-channel timing analysis attacks
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
