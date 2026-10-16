import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
      trim: true,
    },
    adminName: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'event_approved',
        'event_rejected',
        'event_returned',
        'user_suspended',
        'user_reactivated',
        'booking_cancelled_refunded',
        'review_moderated',
        'system_configuration_update',
        'coupon_status_updated',
        'coupon_deleted',
      ],
      index: true,
    },
    targetType: {
      type: String,
      required: true,
      enum: ['Event', 'User', 'Booking', 'Review', 'System', 'Coupon'],
      index: true,
    },
    targetId: {
      type: String,
      required: true,
      index: true,
    },
    targetTitle: {
      type: String,
      default: '',
      trim: true,
    },
    details: {
      type: String,
      default: '',
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.model('AuditLog', AuditLogSchema);
