import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required for session tracking.'],
      index: true,
    },
    sessionId: {
      type: String,
      required: [true, 'Session identifier is required.'],
      unique: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Inactivity expiration deadline is required.'],
      index: true,
    },
    absoluteExpiresAt: {
      type: Date,
      required: [true, 'Absolute session expiration deadline is required.'],
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    revocationReason: {
      type: String,
      enum: [
        'user_logout',
        'inactivity_timeout',
        'absolute_timeout',
        'revoked_by_user',
        'revoked_other_sessions',
        'admin_revocation',
        'user_suspended',
        'password_changed',
        null,
      ],
      default: null,
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for active session lookups per user
sessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
sessionSchema.index({ userId: 1, createdAt: -1 });

// Optional TTL cleanup index on absoluteExpiresAt:
// Note: Backend middleware explicitly validates expiration on every request.
// This TTL index is purely for asynchronous background DB cleanup 24 hours after absolute expiry.
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 86400 });

const Session = mongoose.model('Session', sessionSchema);

export default Session;
