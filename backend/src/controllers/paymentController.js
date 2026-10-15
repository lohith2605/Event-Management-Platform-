import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import { getRazorpayInstance } from '../config/razorpay.js';
import {
  CHECKOUT_HOLD_DURATION_MS,
  isBookingHoldExpired,
  releaseSingleBookingHold,
  releaseExpiredBookingHolds,
} from '../utils/checkoutHold.js';
import { issueTicketsForBooking } from '../utils/ticketIssuer.js';
import { sendConfirmationEmailForBooking } from '../services/emailService.js';

/**
 * @desc    Create a Razorpay order for an existing pending booking
 * @route   POST /api/payments/create-order
 * @access  Private (Authenticated Attendee / Booking Owner)
 */
export const createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid booking ID is required to initiate payment.',
      });
    }

    // Proactively release any stale holds
    await releaseExpiredBookingHolds();

    const booking = await Booking.findById(bookingId).populate('eventId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check: Never trust client-supplied booking ownership
    if (booking.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot initiate payment for another attendee’s booking.',
      });
    }

    // Free event check
    if (booking.totalAmount === 0 || booking.paymentStatus === 'free') {
      return res.status(400).json({
        success: false,
        message: 'This booking is for a free event and does not require payment.',
      });
    }

    // Already completed check (Idempotency)
    if (booking.paymentStatus === 'completed' && booking.status === 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been paid and confirmed.',
      });
    }

    // Cancelled check
    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: `This booking is cancelled (${booking.cancellationReason || 'Hold expired'}). Please create a new booking.`,
      });
    }

    // Enforce 10-minute hold expiration
    if (isBookingHoldExpired(booking)) {
      await releaseSingleBookingHold(booking);
      return res.status(400).json({
        success: false,
        message: 'Checkout hold has expired (10-minute limit exceeded). The held tickets have been released back to the event.',
      });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway credentials are not configured on the server.',
      });
    }

    // Server-side calculated amount in paise (1 INR = 100 paise)
    // Never trust client-supplied amounts
    const amountInPaise = Math.round(booking.totalAmount * 100);

    const orderOptions = {
      amount: amountInPaise,
      currency: booking.currency || 'INR',
      receipt: booking.bookingReference.substring(0, 40),
      notes: {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        eventId: booking.eventId?._id ? booking.eventId._id.toString() : '',
        userId: req.user._id.toString(),
      },
    };

    const order = await razorpay.orders.create(orderOptions);

    // Securely associate order with booking
    booking.razorpayOrderId = order.id;
    if (!booking.holdExpiresAt) {
      booking.holdExpiresAt = new Date(Date.now() + CHECKOUT_HOLD_DURATION_MS);
    }
    await booking.save();

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      booking: {
        _id: booking._id,
        bookingReference: booking.bookingReference,
        totalAmount: booking.totalAmount,
        quantity: booking.quantity,
        holdExpiresAt: booking.holdExpiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Razorpay payment signature server-side and confirm booking
 * @route   POST /api/payments/verify
 * @access  Private (Authenticated Attendee / Booking Owner)
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Strict validation of verification parameters
    if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters.',
      });
    }

    const booking = await Booking.findById(bookingId).populate('eventId');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check
    if (booking.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot verify payment for another attendee’s booking.',
      });
    }

    // Idempotency: Return existing confirmed booking if already processed with this payment
    if (booking.paymentStatus === 'completed' && booking.status === 'confirmed') {
      if (
        booking.razorpayPaymentId === razorpay_payment_id ||
        booking.transactionReference === razorpay_payment_id
      ) {
        const existingTickets = await issueTicketsForBooking(booking, booking.eventId, req.user);
        return res.status(200).json({
          success: true,
          message: 'Payment has already been verified and tickets are confirmed.',
          booking,
          tickets: existingTickets,
          alreadyProcessed: true,
        });
      }

      return res.status(400).json({
        success: false,
        message: 'This booking has already been completed under a different transaction reference.',
      });
    }

    // Verify order ID association with booking
    if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID mismatch: Provided order does not match this booking record.',
      });
    }

    // Hold expiration check
    if (isBookingHoldExpired(booking)) {
      await releaseSingleBookingHold(booking);
      return res.status(400).json({
        success: false,
        message: 'Checkout hold expired (10-minute limit exceeded). The held tickets have been released back to general availability.',
        holdExpired: true,
      });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway configuration is missing on the server.',
      });
    }

    // Timing-safe cryptographic HMAC-SHA256 signature verification
    // Payload: order_id + "|" + payment_id
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(payload)
      .digest('hex');

    const isMatch =
      expectedSignature.length === razorpay_signature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'utf-8'),
        Buffer.from(razorpay_signature, 'utf-8')
      );

    if (!isMatch) {
      booking.paymentStatus = 'failed';
      booking.paymentFailureReason = 'Invalid cryptographic payment signature';
      await booking.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Invalid cryptographic payment signature.',
      });
    }

    // Signature verified successfully! Update booking state
    booking.status = 'confirmed';
    booking.paymentStatus = 'completed';
    booking.paymentMethod = 'razorpay';
    booking.razorpayOrderId = razorpay_order_id;
    booking.razorpayPaymentId = razorpay_payment_id;
    booking.transactionReference = razorpay_payment_id;
    booking.paidAt = new Date();
    booking.paymentFailureReason = '';
    await booking.save();

    // Issue authentic passes with secure HMAC QR payloads
    const tickets = await issueTicketsForBooking(booking, booking.eventId, req.user);

    // Notify attendee of verified booking confirmation
    try {
      await Notification.create({
        userId: booking.userId,
        title: 'Payment Successful & Booking Confirmed!',
        message: `Your payment of ₹${booking.totalAmount} for "${booking.eventId?.title || 'event'}" was verified. Digital passes are ready in My Tickets.`,
        type: 'booking_confirmed',
        link: '/attendee/tickets',
        metadata: { bookingReference: booking.bookingReference, eventId: booking.eventId?._id },
      });
    } catch (err) {
      // Non-blocking notification creation
    }

    // Automated Booking Confirmation & Digital Ticket Email (Phase 2)
    // Non-blocking: Email errors will be recorded on booking but will not undo payment or tickets
    await sendConfirmationEmailForBooking(booking._id);

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed successfully!',
      booking,
      tickets,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Record payment failure / dismissal from frontend checkout modal
 * @route   POST /api/payments/failure
 * @access  Private (Authenticated Attendee / Booking Owner)
 */
export const recordPaymentFailure = async (req, res, next) => {
  try {
    const { bookingId, error } = req.body;

    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid booking ID is required.',
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
      });
    }

    // Ownership check
    if (booking.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot update another attendee’s booking.',
      });
    }

    // If already completed, ignore failure callback
    if (booking.paymentStatus === 'completed' && booking.status === 'confirmed') {
      return res.status(200).json({
        success: true,
        message: 'Booking has already been completed.',
        booking,
      });
    }

    const failureReason =
      error?.description || error?.reason || 'Payment cancelled or dismissed by attendee';

    booking.paymentStatus = 'failed';
    booking.paymentFailureReason = failureReason;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Payment failure recorded.',
      booking,
    });
  } catch (error) {
    next(error);
  }
};
