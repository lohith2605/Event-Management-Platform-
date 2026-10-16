import mongoose from 'mongoose';

const CouponRedemptionSchema = new mongoose.Schema(
  {
    couponId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    bookingReference: {
      type: String,
      required: true,
      trim: true,
    },
    originalSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: {
        values: ['applied', 'completed', 'cancelled', 'refunded'],
        message: '{VALUE} is not a valid coupon redemption status',
      },
      default: 'completed',
      index: true,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast audit and quota checks
CouponRedemptionSchema.index({ couponId: 1, userId: 1, status: 1 });
CouponRedemptionSchema.index({ eventId: 1, status: 1 });
CouponRedemptionSchema.index({ couponId: 1, status: 1 });

export default mongoose.model('CouponRedemption', CouponRedemptionSchema);
