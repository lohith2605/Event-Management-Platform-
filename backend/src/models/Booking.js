import mongoose from 'mongoose';

const BookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Booking must belong to a registered user'],
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: [true, 'Booking must belong to a valid event'],
      index: true,
    },
    ticketType: {
      type: String,
      default: 'General Admission',
      trim: true,
    },
    quantity: {
      type: Number,
      required: [true, 'Ticket quantity is required'],
      min: [1, 'Quantity must be at least 1'],
      max: [10, 'Cannot book more than 10 tickets per order'],
      default: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: {
        values: ['confirmed', 'pending', 'cancelled'],
        message: '{VALUE} is not a valid booking status',
      },
      default: 'confirmed',
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['free', 'pending', 'completed', 'failed', 'refunded'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'free',
      index: true,
    },
    paymentMethod: {
      type: String,
      default: 'free_pass',
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      default: '',
    },
    holdExpiresAt: {
      type: Date,
      index: true,
    },
    paymentFailureReason: {
      type: String,
      trim: true,
      default: '',
    },
    paidAt: {
      type: Date,
    },
    confirmationEmailSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    confirmationEmailSentAt: {
      type: Date,
    },
    confirmationEmailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    confirmationEmailError: {
      type: String,
      default: '',
    },
    confirmationEmailMessageId: {
      type: String,
      default: '',
    },
    attendeeName: {
      type: String,
      required: [true, 'Attendee name is required'],
      trim: true,
    },
    attendeeEmail: {
      type: String,
      required: [true, 'Attendee email is required'],
      lowercase: true,
      trim: true,
    },
    attendeePhone: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    cancelledAt: {
      type: Date,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationEmailSent: {
      type: Boolean,
      default: false,
      index: true,
    },
    cancellationEmailSentAt: {
      type: Date,
    },
    cancellationEmailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    cancellationEmailError: {
      type: String,
      default: '',
    },
    cancellationEmailMessageId: {
      type: String,
      default: '',
    },
    refundStatus: {
      type: String,
      enum: ['none', 'not_applicable', 'initiated', 'processed', 'failed'],
      default: 'none',
      index: true,
    },
    refundAmount: {
      type: Number,
      default: 0,
    },
    razorpayRefundId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    refundError: {
      type: String,
      default: '',
    },
    refundedAt: {
      type: Date,
    },
    refundReason: {
      type: String,
      trim: true,
      default: '',
    },
    refundEmailSent: {
      type: Boolean,
      default: false,
    },
    refundEmailSentAt: {
      type: Date,
    },
    refundEmailStatus: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed'],
      default: 'pending',
    },
    refundEmailMessageId: {
      type: String,
      default: '',
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// High performance compound indexes for queries
BookingSchema.index({ userId: 1, createdAt: -1 });
BookingSchema.index({ eventId: 1, status: 1 });
BookingSchema.index({ userId: 1, eventId: 1, status: 1 });

export default mongoose.model('Booking', BookingSchema);
