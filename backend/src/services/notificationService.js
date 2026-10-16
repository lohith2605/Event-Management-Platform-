import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitToUser, emitToRole, getIO } from './socketService.js';
import logger from '../utils/logger.js';

/**
 * Creates a notification in MongoDB and immediately emits it via Socket.IO
 * to the authenticated user's private room.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.userId - Recipient user ID
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message body
 * @param {string} [params.type='system'] - Notification type enum
 * @param {string} [params.link='/attendee'] - Navigation link on click
 * @param {Object} [params.metadata={}] - Structured metadata
 * @param {string} [params.idempotencyKey] - Unique key to prevent duplicates
 * @returns {Promise<Object|null>} - The saved notification document
 */
export const createAndEmitNotification = async ({
  userId,
  title,
  message,
  type = 'system',
  link = '/attendee',
  metadata = {},
  idempotencyKey,
}) => {
  if (!userId) return null;

  try {
    // 1. Idempotency Check: Prevent duplicate notifications from retries or callbacks
    if (idempotencyKey) {
      const existing = await Notification.findOne({
        userId,
        'metadata.idempotencyKey': idempotencyKey,
      });
      if (existing) {
        logger.info(`Notification already sent with idempotencyKey: ${idempotencyKey}`);
        return existing;
      }
    }

    // 2. Persist notification in MongoDB
    const notification = await Notification.create({
      userId,
      title: title.trim(),
      message: message.trim(),
      type,
      link: link.trim(),
      metadata: {
        ...metadata,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      },
    });

    // 3. Compute live unread count for the user
    const unreadCount = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    // 4. Emit real-time notification to the user's private socket room
    emitToUser(userId, 'notification', {
      notification,
      unreadCount,
    });

    logger.info(`Notification created & emitted: user=${userId}, type=${type}, id=${notification._id}`);
    return notification;
  } catch (error) {
    logger.error('Failed to create and emit notification:', error);
    return null;
  }
};

/**
 * Notifies eligible attendees when an event is approved and publicly published.
 * Respects location, format, and audience targeting rules.
 *
 * @param {Object} event - The newly published event document
 * @returns {Promise<{ sentCount: number, skipped?: boolean }>}
 */
export const notifyAttendeesOfPublishedEvent = async (event) => {
  if (!event || event.status !== 'published') {
    return { sentCount: 0, skipped: true };
  }

  try {
    // 1. Idempotency Check: Prevent duplicate publication notifications for the same event
    const publicationKey = `event_published_${event._id}`;
    const alreadyDispatched = await Notification.exists({
      type: 'event_published',
      'metadata.eventId': event._id,
    });

    if (alreadyDispatched) {
      logger.info(`Publication notification already dispatched for event ${event._id}`);
      return { sentCount: 0, skipped: true };
    }

    // 2. Determine target audience: active attendees excluding the organizer
    const query = {
      role: 'attendee',
      isSuspended: false,
    };

    if (event.organizerId) {
      query._id = { $ne: event.organizerId };
    }

    // Location targeting: If in-person event, target matching city or users without city specified
    if (event.format === 'In-Person' && event.city && event.city !== 'All Cities') {
      const escapedCity = event.city.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { city: { $regex: new RegExp(`^${escapedCity}$`, 'i') } },
        { city: { $in: ['', null] } },
      ];
    }

    // Query eligible attendees (capped at 500 per event to maintain responsiveness)
    const targetAttendees = await User.find(query).select('_id email city').limit(500);

    if (targetAttendees.length === 0) {
      return { sentCount: 0 };
    }

    // 3. Prepare batch notifications for database persistence
    const eventLink = `/attendee?q=${encodeURIComponent(event.title)}`;
    const notificationDocs = targetAttendees.map((attendee) => ({
      userId: attendee._id,
      title: `New Event in ${event.city}: ${event.title}`,
      message: `"${event.title}" has just been published in ${event.category}! Explore passes, dates, and live schedules.`,
      type: 'event_published',
      link: eventLink,
      metadata: {
        eventId: event._id,
        eventTitle: event.title,
        city: event.city,
        category: event.category,
        format: event.format,
        idempotencyKey: `${publicationKey}_${attendee._id}`,
      },
      isRead: false,
    }));

    // Insert all notifications in MongoDB
    const inserted = await Notification.insertMany(notificationDocs);

    // 4. Emit to individual connected user rooms & broadcast to attendee role room
    const io = getIO();
    if (io) {
      // Broadcast publication event to all connected attendees
      emitToRole('attendee', 'event_published', {
        eventId: event._id,
        title: event.title,
        city: event.city,
        category: event.category,
        format: event.format,
        link: eventLink,
      });

      // Deliver individual notifications to currently connected attendee sockets
      for (const notif of inserted) {
        emitToUser(notif.userId, 'notification', {
          notification: notif,
        });
      }
    }

    logger.success(`Notified ${inserted.length} attendees of newly published event "${event.title}".`);
    return { sentCount: inserted.length };
  } catch (error) {
    logger.error('Error dispatching published event notifications:', error);
    return { sentCount: 0, error: error.message };
  }
};

/**
 * Notifies organizer when an event submission is approved by admin
 */
export const notifyOrganizerEventApproved = async (event) => {
  if (!event || !event.organizerId) return null;
  return createAndEmitNotification({
    userId: event.organizerId,
    title: 'Event Approved & Published!',
    message: `Congratulations! Your event "${event.title}" has been reviewed, approved, and published on UTSAV.`,
    type: 'event_approved',
    link: '/organizer/events',
    metadata: { eventId: event._id, action: 'approve' },
    idempotencyKey: `event_approved_${event._id}`,
  });
};

/**
 * Notifies organizer when an event submission is rejected by admin
 */
export const notifyOrganizerEventRejected = async (event, reason) => {
  if (!event || !event.organizerId) return null;
  return createAndEmitNotification({
    userId: event.organizerId,
    title: 'Event Submission Rejected',
    message: `Your event submission "${event.title}" was rejected by admin. Reason: ${reason}`,
    type: 'event_rejected',
    link: '/organizer/events',
    metadata: { eventId: event._id, action: 'reject', reason },
    idempotencyKey: `event_rejected_${event._id}_${Date.now()}`,
  });
};

/**
 * Notifies attendee when a booking is confirmed
 */
export const notifyAttendeeBookingConfirmed = async (booking, event) => {
  if (!booking || !booking.userId) return null;
  return createAndEmitNotification({
    userId: booking.userId,
    title: 'Booking Confirmed!',
    message: `Your booking for "${event?.title || 'Event'}" is confirmed. Reference: ${booking.bookingReference}. Passes are ready in My Tickets.`,
    type: 'booking_confirmed',
    link: '/attendee/tickets',
    metadata: {
      bookingId: booking._id,
      eventId: event?._id,
      bookingReference: booking.bookingReference,
    },
    idempotencyKey: `booking_confirmed_${booking._id}`,
  });
};

/**
 * Notifies attendee when a booking is cancelled
 */
export const notifyAttendeeBookingCancelled = async (booking, event, reason) => {
  if (!booking || !booking.userId) return null;
  return createAndEmitNotification({
    userId: booking.userId,
    title: 'Booking Cancelled',
    message: `Your booking for "${event?.title || 'Event'}" (${booking.bookingReference}) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
    type: 'booking_cancelled',
    link: '/attendee/bookings',
    metadata: {
      bookingId: booking._id,
      eventId: event?._id,
      bookingReference: booking.bookingReference,
      reason,
    },
    idempotencyKey: `booking_cancelled_${booking._id}`,
  });
};

/**
 * Notifies attendee when a refund status is updated
 */
export const notifyAttendeeRefundUpdated = async (booking, event, refundStatus, amount) => {
  if (!booking || !booking.userId) return null;
  return createAndEmitNotification({
    userId: booking.userId,
    title: 'Refund Status Updated',
    message: `Refund for booking "${event?.title || booking.bookingReference}" (₹${amount || booking.totalAmount}) is now ${refundStatus}.`,
    type: 'refund_updated',
    link: '/attendee/bookings',
    metadata: {
      bookingId: booking._id,
      eventId: event?._id,
      bookingReference: booking.bookingReference,
      refundStatus,
      amount,
    },
    idempotencyKey: `refund_updated_${booking._id}_${refundStatus}`,
  });
};
