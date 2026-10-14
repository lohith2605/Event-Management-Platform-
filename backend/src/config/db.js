import mongoose from 'mongoose';

/**
 * Returns a safe, informative diagnostic message without exposing
 * connection strings, passwords, or cluster credentials.
 */
import dns from 'dns';

dns.setServers(["8.8.8.8", "8.8.4.4"]);
const getSafeDiagnostic = (error) => {
  if (!error) return 'Unknown database error';

  const message = error.message || '';
  const errorName = error.name || 'DatabaseError';

  if (message.includes('bad auth') || message.includes('Authentication failed')) {
    return 'Authentication failed: Invalid MongoDB Atlas username or password.';
  }

  if (message.includes('querySrv') || error.code === 'ENOTFOUND') {
    return 'DNS query failed for Atlas cluster: Hostname not found or invalid cluster address.';
  }

  if (message.includes('ECONNREFUSED')) {
    return 'Connection refused: Unable to reach database server. Verify network connectivity.';
  }

  if (message.includes('ETIMEDOUT') || errorName === 'MongooseServerSelectionError') {
    return 'Connection timed out: Server selection timed out. Verify your Atlas Network Access (IP Access List / Whitelist) and firewall settings.';
  }

  if (errorName === 'MongoParseError') {
    return 'Invalid connection string format: Verify that special characters in your password are percent-encoded.';
  }

  // Fallback: Strip any URI or credential fragments
  return `${errorName}: ${message
    .replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/gi, 'mongodb+srv://[REDACTED_CREDENTIALS]@')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[REDACTED_URI]')
    .replace(/[^\s]+@[^\s]+/gi, '[REDACTED]')}`;
};

import logger from '../utils/logger.js';

// Listen to ongoing connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB connection lost. Attempting automatic reconnection...');
});

mongoose.connection.on('reconnected', () => {
  logger.success('MongoDB Atlas reconnected successfully.');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB Runtime error: ${getSafeDiagnostic(err)}`);
});

/**
 * Connects to MongoDB Atlas using process.env.MONGODB_URI.
 * Exits process with code 1 if initial connection fails.
 */
export const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.trim()) {
    logger.error('Database connection failed: MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });

    return conn;
  } catch (error) {
    const safeDiagnostic = getSafeDiagnostic(error);
    logger.error(`Database connection failed: ${safeDiagnostic}`);
    process.exit(1);
  }
};
