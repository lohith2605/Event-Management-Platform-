import Booking from '../models/Booking.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';

export const CHECKOUT_HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Checks if a booking's checkout hold has expired.
 */
export const isBookingHoldExpired = (booking) => {
  if (!booking || !booking.holdExpiresAt) return false;
  return new Date(booking.holdExpiresAt).getTime() < Date.now();
};

/**
 * Releases inventory and cancels an individual expired booking.
 */
export const releaseSingleBookingHold = async (booking, reason = 'Checkout hold expired (10-minute limit exceeded)') => {
  if (!booking || booking.status !== 'pending' || booking.paymentStatus !== 'pending') {
    return booking;
  }

  // Restore inventory spots atomically
  await Event.findByIdAndUpdate(booking.eventId, {
    $inc: { spotsLeft: booking.quantity },
  });

  booking.status = 'cancelled';
  booking.paymentStatus = 'failed';
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;
  booking.paymentFailureReason = reason;
  await booking.save();

  // Create notification
  try {
    await Notification.create({
      userId: booking.userId,
      title: 'Booking Reservation Expired',
      message: `Your reservation ${booking.bookingReference} has expired because payment was not completed within 10 minutes. The held tickets have been released back to general availability.`,
      type: 'system',
      link: '/attendee/bookings',
      metadata: { bookingReference: booking.bookingReference, eventId: booking.eventId },
    });
  } catch (err) {
    // Non-blocking notification failure
  }

  return booking;
};

/**
 * Scans and releases all pending checkout holds that exceeded the 10-minute window.
 */
export const releaseExpiredBookingHolds = async () => {
  try {
    const now = new Date();
    const expiredBookings = await Booking.find({
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: { $lt: now, $ne: null },
    });

    for (const booking of expiredBookings) {
      await releaseSingleBookingHold(booking);
    }

    return expiredBookings.length;
  } catch (error) {
    console.error('Error during expired booking hold release:', error.message);
    return 0;
  }
};
