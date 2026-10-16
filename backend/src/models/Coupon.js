import mongoose from 'mongoose';

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [3, 'Coupon code must be at least 3 characters'],
      maxlength: [30, 'Coupon code cannot exceed 30 characters'],
      match: [/^[A-Z0-9_-]+$/, 'Coupon code can only contain uppercase letters, numbers, hyphens, and underscores'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, 'Description cannot exceed 200 characters'],
      default: '',
    },
    discountType: {
      type: String,
      required: [true, 'Discount type is required'],
      enum: {
        values: ['percentage', 'fixed'],
        message: '{VALUE} is not a valid discount type. Must be "percentage" or "fixed"',
      },
      index: true,
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0.01, 'Discount value must be greater than 0'],
    },
    minBookingAmount: {
      type: Number,
      min: [0, 'Minimum booking amount cannot be negative'],
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, 'Maximum discount amount cannot be negative'],
      default: null,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    maxRedemptions: {
      type: Number,
      min: [1, 'Maximum redemptions must be at least 1 if specified'],
      default: null,
    },
    maxRedemptionsPerUser: {
      type: Number,
      min: [1, 'Maximum redemptions per attendee must be at least 1'],
      default: 1,
    },
    redemptionCount: {
      type: Number,
      min: [0, 'Redemption count cannot be negative'],
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Applicable events: empty array means applicable to all events owned by this organizer
    applicableEvents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
      },
    ],
    organizerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Coupon must belong to an organizer'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator user reference is required'],
    },
  },
  {
    timestamps: true,
  }
);

// High-performance compound indexes
CouponSchema.index({ organizerId: 1, isActive: 1, endDate: 1 });
CouponSchema.index({ code: 1, isActive: 1 });

export default mongoose.model('Coupon', CouponSchema);
