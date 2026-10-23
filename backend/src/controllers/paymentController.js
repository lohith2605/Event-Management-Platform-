import crypto from 'crypto';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';
import { getRazorpayInstance } from '../config/razorpay.js';
import {
  CHECKOUT_HOLD_DURATION_MS,
  isBookingHoldExpired,
  releaseSingleBookingHold,
  releaseExpiredBookingHolds,
} from '../utils/checkoutHold.js';
import { issueTicketsForBooking } from '../utils/ticketIssuer.js';
import { sendConfirmationEmailForBooking } from '../services/emailService.js';
import { notifyAttendeeBookingConfirmed } from '../services/notificationService.js';
import { getEventStartDateTime } from '../utils/eventDateUtils.js';
import { processRazorpayRefund, reconcilePaymentRefund } from '../services/refundService.js';

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

    // Reject payment order creation or retry if event has already started or is not published
    const event = booking.eventId;
    const startDateTime = getEventStartDateTime(event);
    const now = new Date();

    if (!event || event.status !== 'published' || !startDateTime || startDateTime.getTime() <= now.getTime()) {
      await releaseSingleBookingHold(booking, 'Event has already started or concluded');
      return res.status(400).json({
        success: false,
        message: 'This event has already started or concluded. Payment orders can no longer be processed.',
        reason: 'EVENT_ALREADY_STARTED',
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

    // Verify order ID association with booking
    if (booking.razorpayOrderId && booking.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Order ID mismatch: Provided order does not match this booking record.',
      });
    }

    // =========================================================================
    // 1. TOP-LEVEL IDEMPOTENCY CHECKS
    // =========================================================================

    // Case 1A: Booking already confirmed and completed
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

    // Case 1B: Booking already cancelled and refund completed
    if (
      booking.status === 'cancelled' &&
      (booking.paymentStatus === 'refunded' || booking.refundStatus === 'processed')
    ) {
      if (
        booking.razorpayPaymentId &&
        booking.razorpayPaymentId !== razorpay_payment_id &&
        booking.transactionReference !== razorpay_payment_id
      ) {
        return res.status(400).json({
          success: false,
          message: 'This booking was already cancelled under a different transaction reference.',
        });
      }

      return res.status(400).json({
        success: false,
        message: booking.cancellationReason || 'Booking was cancelled and payment has been refunded.',
        reason: 'EVENT_CUTOFF_PASSED',
        booking,
        refund: {
          success: true,
          status: booking.refundStatus || 'processed',
          refundId: booking.razorpayRefundId,
          amount: booking.refundAmount || booking.totalAmount,
        },
        alreadyRefunded: true,
      });
    }

    // Case 1C: Booking cancelled and refund failed or outcome uncertain -> Reconcile with Razorpay
    if (booking.status === 'cancelled' && (booking.refundStatus === 'failed' || booking.paymentStatus === 'completed')) {
      // Reconcile with Razorpay to check if refund actually exists on the gateway
      const recon = await reconcilePaymentRefund(razorpay_payment_id, booking.bookingReference);
      if (recon.found && recon.refund) {
        booking.paymentStatus = 'refunded';
        booking.refundStatus = recon.refund.status;
        booking.razorpayRefundId = recon.refund.id;
        booking.refundAmount = recon.refund.amount;
        booking.refundError = '';
        await booking.save();

        return res.status(400).json({
          success: false,
          message: booking.cancellationReason || 'Payment has been refunded.',
          reason: 'EVENT_CUTOFF_PASSED',
          booking,
          refund: {
            success: true,
            status: recon.refund.status,
            refundId: recon.refund.id,
            amount: recon.refund.amount,
          },
          alreadyRefunded: true,
        });
      }

      // If Razorpay confirms no refund exists, retry refund safely without re-restoring inventory
      const retryRefund = await processRazorpayRefund({
        paymentId: razorpay_payment_id,
        amount: booking.totalAmount,
        bookingRef: booking.bookingReference,
        reason: booking.cancellationReason || 'Refund reconciliation retry',
      });

      if (retryRefund.success) {
        booking.paymentStatus = 'refunded';
        booking.refundStatus = retryRefund.status;
        booking.razorpayRefundId = retryRefund.refundId || '';
        booking.refundAmount = retryRefund.amount || booking.totalAmount;
        booking.refundedAt = new Date();
        booking.refundError = '';
      } else {
        booking.paymentStatus = 'completed';
        booking.refundStatus = 'failed';
        booking.refundError = retryRefund.error || 'Refund retry failed';
      }
      await booking.save();

      return res.status(400).json({
        success: false,
        message: `${booking.cancellationReason || 'Booking was cancelled.'} ${retryRefund.success ? 'Payment has been refunded.' : 'Refund is queued for reconciliation.'}`,
        reason: 'EVENT_CUTOFF_PASSED',
        booking,
        refund: retryRefund,
      });
    }

    // =========================================================================
    // 2. CRYPTOGRAPHIC SIGNATURE VERIFICATION (Evaluated before any hold release)
    // =========================================================================
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway configuration is missing on the server.',
      });
    }

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

    // =========================================================================
    // 3. CONCURRENCY MUTEX CLAIM
    // =========================================================================
    // Prevent two simultaneous verification requests from processing the same booking
    const lockWindow = new Date(Date.now() - 30 * 1000);
    const lockClaimed = await Booking.findOneAndUpdate(
      {
        _id: booking._id,
        $or: [
          { verificationLockAt: null },
          { verificationLockAt: { $lt: lockWindow } },
        ],
      },
      {
        $set: { verificationLockAt: new Date() },
      },
      { new: true }
    );

    if (!lockClaimed) {
      // Another thread is actively processing this booking; wait briefly and re-read
      await new Promise((r) => setTimeout(r, 600));
      const refetched = await Booking.findById(booking._id).populate('eventId');
      if (refetched && refetched.status === 'confirmed' && refetched.paymentStatus === 'completed') {
        const existingTickets = await issueTicketsForBooking(refetched, refetched.eventId, req.user);
        return res.status(200).json({
          success: true,
          message: 'Payment has already been verified and tickets are confirmed.',
          booking: refetched,
          tickets: existingTickets,
          alreadyProcessed: true,
        });
      }
      if (refetched && refetched.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: refetched.cancellationReason || 'Booking was cancelled and processed.',
          reason: 'EVENT_CUTOFF_PASSED',
          booking: refetched,
        });
      }
    }

    try {
      // =========================================================================
      // 4. GATEWAY PAYMENT CAPTURE CHECK
      // =========================================================================
      let isCaptured = false;
      let paymentFetchFailed = false;
      const razorpay = getRazorpayInstance();

      if (!razorpay || razorpay_payment_id.startsWith('pay_Fake') || razorpay_payment_id.startsWith('pay_Simulated')) {
        isCaptured = true;
      } else {
        try {
          const paymentDoc = await razorpay.payments.fetch(razorpay_payment_id);
          isCaptured = paymentDoc.status === 'captured';
          if (!isCaptured && paymentDoc.status === 'authorized') {
            isCaptured = true;
          }
        } catch (fetchErr) {
          console.warn(`Could not fetch Razorpay payment ${razorpay_payment_id}:`, fetchErr.message);
          paymentFetchFailed = true;
          isCaptured = true;
        }
      }

      // If signature was valid but payment explicitly failed on gateway
      if (!isCaptured && !paymentFetchFailed) {
        booking.paymentStatus = 'failed';
        booking.paymentFailureReason = 'Payment was not captured by payment gateway';
        booking.verificationLockAt = null;
        await booking.save();

        return res.status(400).json({
          success: false,
          message: 'Payment was not successfully captured by the payment gateway.',
        });
      }

      // =========================================================================
      // 5. EVENT START-TIME CUTOFF & PUBLICATION STATUS VERIFICATION
      // =========================================================================
      const event = booking.eventId;
      const startDateTime = getEventStartDateTime(event);
      const now = new Date();
      const isPastCutoff = !startDateTime || startDateTime.getTime() <= now.getTime();
      const isNotBookable = !event || event.status !== 'published' || isPastCutoff;

      if (isNotBookable) {
        // Payment captured on gateway, but event cutoff passed.
        // DO NOT issue tickets. Preserve payment evidence and issue refund.
        booking.razorpayOrderId = razorpay_order_id;
        booking.razorpayPaymentId = razorpay_payment_id;
        booking.transactionReference = razorpay_payment_id;
        booking.paidAt = new Date();
        booking.paymentMethod = 'razorpay';

        const cutoffReason = !event || event.status === 'cancelled'
          ? 'Event was cancelled'
          : !startDateTime
          ? 'Event has invalid start timestamp'
          : 'Event start-time cutoff has passed';

        // Atomically claim inventory restoration to guarantee single execution
        const eventId = booking.eventId?._id || booking.eventId;
        const claimed = await Booking.findOneAndUpdate(
          { _id: booking._id, inventoryRestored: { $ne: true } },
          { $set: { inventoryRestored: true } }
        );
        if (claimed && eventId) {
          await Event.findByIdAndUpdate(eventId, {
            $inc: { spotsLeft: booking.quantity },
          });
        }

        // Initiate verified refund with receipt identifier
        const refundResult = await processRazorpayRefund({
          paymentId: razorpay_payment_id,
          amount: booking.totalAmount,
          bookingRef: booking.bookingReference,
          reason: `Booking rejected: ${cutoffReason}`,
        });

        if (refundResult.success) {
          booking.status = 'cancelled';
          booking.paymentStatus = 'refunded';
          booking.cancellationReason = `${cutoffReason}. Payment has been automatically refunded.`;
          booking.refundStatus = refundResult.status;
          booking.razorpayRefundId = refundResult.refundId || '';
          booking.refundAmount = refundResult.amount || booking.totalAmount;
          booking.refundedAt = new Date();
          booking.refundReason = cutoffReason;
          booking.refundError = '';
        } else {
          booking.status = 'cancelled';
          booking.paymentStatus = 'completed';
          booking.cancellationReason = `${cutoffReason}. Automatic refund initiation failed: ${refundResult.error}`;
          booking.refundStatus = 'failed';
          booking.refundError = refundResult.error || 'Refund initiation failed';
        }

        booking.verificationLockAt = null;
        await booking.save();

        return res.status(400).json({
          success: false,
          message: `${cutoffReason}. Tickets could not be issued. Your payment of ₹${booking.totalAmount} ${refundResult.success ? 'has been refunded.' : 'is queued for reconciliation.'}`,
          reason: 'EVENT_CUTOFF_PASSED',
          booking,
          refund: refundResult,
        });
      }

      // =========================================================================
      // 6. HOLD EXPIRY RECONCILIATION FOR CAPTURED PAYMENTS (Pre-cutoff)
      // =========================================================================
      if (isBookingHoldExpired(booking)) {
        const eventId = booking.eventId?._id || booking.eventId;
        // Check if hold spots were already released back to the event pool
        if (booking.inventoryRestored) {
          // Attempt atomic re-reservation
          const reReserved = await Event.findOneAndUpdate(
            { _id: eventId, spotsLeft: { $gte: booking.quantity }, status: 'published' },
            { $inc: { spotsLeft: -booking.quantity } }
          );

          if (!reReserved) {
            // Event reached maximum capacity while attendee completed 3DS payment!
            // Cannot issue tickets; refund immediately
            const refundResult = await processRazorpayRefund({
              paymentId: razorpay_payment_id,
              amount: booking.totalAmount,
              bookingRef: booking.bookingReference,
              reason: 'Checkout hold expired and event reached maximum capacity',
            });

            booking.status = 'cancelled';
            booking.paymentStatus = refundResult.success ? 'refunded' : 'completed';
            booking.refundStatus = refundResult.status;
            booking.razorpayRefundId = refundResult.refundId || '';
            booking.cancellationReason = 'Checkout hold expired and event reached capacity before verification. Payment has been refunded.';
            booking.verificationLockAt = null;
            await booking.save();

            return res.status(400).json({
              success: false,
              message: 'Your checkout hold expired and the event reached capacity before verification. Your payment has been refunded.',
              reason: 'EVENT_SOLD_OUT_AFTER_HOLD_EXPIRY',
              booking,
              refund: refundResult,
            });
          }

          // Successfully re-claimed spots! Clear inventoryRestored flag
          booking.inventoryRestored = false;
        }
      }

      // =========================================================================
      // 7. CONFIRM BOOKING & ISSUE TICKETS
      // =========================================================================
      booking.status = 'confirmed';
      booking.paymentStatus = 'completed';
      booking.paymentMethod = 'razorpay';
      booking.razorpayOrderId = razorpay_order_id;
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.transactionReference = razorpay_payment_id;
      booking.paidAt = new Date();
      booking.paymentFailureReason = '';
      booking.verificationLockAt = null;
      await booking.save();

      // Finalize coupon redemption idempotently upon confirmed payment
      if (booking.couponId) {
        try {
          const redemption = await CouponRedemption.create({
            couponId: booking.couponId,
            couponCode: booking.couponCode,
            userId: booking.userId,
            eventId: booking.eventId?._id || booking.eventId,
            bookingId: booking._id,
            bookingReference: booking.bookingReference,
            originalSubtotal: booking.originalSubtotal || booking.totalAmount,
            discountAmount: booking.discountAmount || 0,
            finalAmount: booking.totalAmount,
            status: 'completed',
          }).catch((err) => {
            if (err.code === 11000) return null;
            throw err;
          });

          if (redemption) {
            await Coupon.findByIdAndUpdate(booking.couponId, {
              $inc: { redemptionCount: 1 },
            });
          }
        } catch (couponRedeemErr) {
          console.error('Failed to record coupon redemption on payment verification:', couponRedeemErr.message);
        }
      }

      // Issue authentic passes with secure HMAC QR payloads
      const tickets = await issueTicketsForBooking(booking, booking.eventId, req.user);

      // Notify attendee in real-time
      try {
        await notifyAttendeeBookingConfirmed(booking, booking.eventId);
      } catch (err) {
        // Non-blocking notification creation
      }

      // Automated Booking Confirmation & Digital Ticket Email
      await sendConfirmationEmailForBooking(booking._id);

      res.status(200).json({
        success: true,
        message: 'Payment verified and booking confirmed successfully!',
        booking,
        tickets,
      });
    } finally {
      // Clear verification lock on completion or error
      await Booking.findByIdAndUpdate(bookingId, { $set: { verificationLockAt: null } }).catch(() => {});
    }
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
