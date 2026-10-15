import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Ticket from '../models/Ticket.js';
import Notification from '../models/Notification.js';
import { sendReminderEmailForBooking } from './emailService.js';

let schedulerInterval = null;
let isProcessing = false;

/**
 * Calculates the exact UTC start timestamp for an event.
 * Handles isoDate and display time parsing.
 */
export const getEventStartDateTime = (event) => {
  if (!event || !event.isoDate) return null;
  const iso = new Date(event.isoDate);
  if (isNaN(iso.getTime())) return null;

  // If isoDate has hours/minutes set, return directly
  if (iso.getUTCHours() !== 0 || iso.getUTCMinutes() !== 0) {
    return iso;
  }

  // If time string is present (e.g. '10:00 AM IST' or '6:30 PM')
  if (event.time && typeof event.time === 'string') {
    const match = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?(?:\s*([A-Z]{3}))?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const meridiem = (match[3] || '').toUpperCase();
      const tz = (match[4] || '').toUpperCase();

      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;

      // Default timezone is IST (+05:30) if IST or unspecified
      const tzOffsetMinutes = tz === 'UTC' || tz === 'GMT' ? 0 : 330; // 5.5 hours for IST

      const startUtc = new Date(iso);
      startUtc.setUTCHours(hours, minutes, 0, 0);
      // Adjust for timezone offset
      startUtc.setTime(startUtc.getTime() - tzOffsetMinutes * 60 * 1000);
      return startUtc;
    }
  }

  return iso;
};

/**
 * Core reminder processing logic.
 * Scans upcoming published events and sends 24h & 2h reminders to confirmed bookings.
 * Supports controllable clock via `referenceTime` for automated testing.
 * @param {Object} [options]
 * @param {Date} [options.referenceTime=new Date()]
 * @returns {Promise<{ checkedEvents: number, sent24h: number, sent2h: number, skipped: number, errors: number }>}
 */
export const processEventReminders = async (options = {}) => {
  const referenceTime = options.referenceTime ? new Date(options.referenceTime) : new Date();
  const stats = {
    checkedEvents: 0,
    sent24h: 0,
    sent2h: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Look ahead window: query events around the reference time
    const minLookahead = new Date(referenceTime.getTime() - 48 * 60 * 60 * 1000);
    const maxLookahead = new Date(referenceTime.getTime() + 48 * 60 * 60 * 1000);

    // Only query published events
    const upcomingEvents = await Event.find({
      status: 'published',
      isoDate: { $gte: minLookahead, $lte: maxLookahead },
    });

    stats.checkedEvents = upcomingEvents.length;

    for (const event of upcomingEvents) {
      const eventStart = getEventStartDateTime(event);
      if (!eventStart) continue;

      const diffMs = eventStart.getTime() - referenceTime.getTime();
      const hoursUntil = diffMs / (1000 * 60 * 60);

      // Event has already passed
      if (diffMs <= 0) continue;

      // 1. Check 24-Hour Reminder Window: between 25.5h and 18.0h before event
      const is24hWindow = hoursUntil <= 25.5 && hoursUntil >= 18.0;

      // 2. Check 2-Hour Reminder Window: between 2.5h and 0.0h before event
      const is2hWindow = hoursUntil <= 2.5 && hoursUntil > 0;

      if (!is24hWindow && !is2hWindow) continue;

      // Fetch confirmed, non-cancelled bookings for this published event
      const confirmedBookings = await Booking.find({
        eventId: event._id,
        status: 'confirmed',
      });

      for (const booking of confirmedBookings) {
        try {
          // Verify booking has active tickets (not cancelled)
          const activeTicketCount = await Ticket.countDocuments({
            bookingId: booking._id,
            status: { $ne: 'cancelled' },
          });

          if (activeTicketCount === 0) {
            stats.skipped++;
            continue;
          }

          const bookingCreatedTime = new Date(booking.createdAt).getTime();

          // --- Process 24-Hour Reminder ---
          if (is24hWindow && !booking.reminder24hSent && booking.reminder24hStatus !== 'skipped') {
            // Late-created booking policy: If booked inside 24h window, skip 24h reminder
            // (Attendee already received confirmation; they will get the 2h reminder)
            const wasLateBooking = bookingCreatedTime > eventStart.getTime() - 24 * 60 * 60 * 1000;
            if (wasLateBooking) {
              booking.reminder24hStatus = 'skipped';
              booking.reminder24hError = 'Late booking created within 24 hours of event start';
              await booking.save();
              stats.skipped++;
            } else {
              // Dispatch email
              const emailRes = await sendReminderEmailForBooking({
                bookingId: booking._id,
                reminderType: '24h',
              });

              if (emailRes.success && !emailRes.skipped) {
                stats.sent24h++;

                // Dispatch in-app notification
                try {
                  await Notification.create({
                    userId: booking.userId,
                    title: `Upcoming Event Tomorrow: ${event.title}`,
                    message: `Your registered event "${event.title}" takes place tomorrow at ${event.time || ''}. Your verified digital passes are ready in My Tickets.`,
                    type: 'event_reminder',
                    link: '/attendee/tickets',
                    metadata: {
                      eventId: event._id,
                      bookingId: booking._id,
                      reminderType: '24h',
                    },
                  });
                } catch (notifErr) {
                  console.warn('Failed to create 24h reminder in-app notification:', notifErr.message);
                }
              }
            }
          }

          // --- Process 2-Hour Reminder ---
          if (is2hWindow && !booking.reminder2hSent && booking.reminder2hStatus !== 'skipped') {
            // Late-created booking policy: If booked inside 2h window, skip 2h reminder
            const wasUltraLateBooking = bookingCreatedTime > eventStart.getTime() - 2 * 60 * 60 * 1000;
            if (wasUltraLateBooking) {
              booking.reminder2hStatus = 'skipped';
              booking.reminder2hError = 'Ultra-late booking created within 2 hours of event start';
              await booking.save();
              stats.skipped++;
            } else {
              // Dispatch email
              const emailRes = await sendReminderEmailForBooking({
                bookingId: booking._id,
                reminderType: '2h',
              });

              if (emailRes.success && !emailRes.skipped) {
                stats.sent2h++;

                // Dispatch in-app notification
                try {
                  await Notification.create({
                    userId: booking.userId,
                    title: `Event Starting in 2 Hours: ${event.title}`,
                    message: `Get ready! "${event.title}" starts in 2 hours at ${event.venue || 'the venue'}. Have your dynamic pass ready for gate check-in.`,
                    type: 'event_reminder',
                    link: '/attendee/tickets',
                    metadata: {
                      eventId: event._id,
                      bookingId: booking._id,
                      reminderType: '2h',
                    },
                  });
                } catch (notifErr) {
                  console.warn('Failed to create 2h reminder in-app notification:', notifErr.message);
                }
              }
            }
          }
        } catch (bookingErr) {
          stats.errors++;
          console.error(`Error processing reminders for booking ${booking._id}:`, bookingErr.message);
        }
      }
    }
  } catch (err) {
    stats.errors++;
    console.error('Error during processEventReminders execution:', err.message);
  }

  return stats;
};

/**
 * Resets reminder status on bookings when an event is rescheduled to a future date
 */
export const handleEventRescheduled = async (eventId, newIsoDate, oldIsoDate) => {
  if (!eventId || !newIsoDate) return 0;
  const newDate = new Date(newIsoDate);
  const oldDate = oldIsoDate ? new Date(oldIsoDate) : null;

  // If pushed forward by more than 2 hours, reset reminder flags so attendees receive reminders for new date
  if (!oldDate || newDate.getTime() > oldDate.getTime() + 2 * 60 * 60 * 1000) {
    const result = await Booking.updateMany(
      { eventId, status: 'confirmed' },
      {
        $set: {
          reminder24hSent: false,
          reminder24hStatus: 'pending',
          reminder2hSent: false,
          reminder2hStatus: 'pending',
        },
      }
    );
    console.log(`ℹ️ [Reschedule] Reset reminder state for ${result.modifiedCount} bookings on event ${eventId}`);
    return result.modifiedCount;
  }
  return 0;
};

/**
 * Starts the server-side reminder scheduler
 * @param {Object} [options]
 * @param {number} [options.intervalMs=600000] Default: 10 minutes
 */
export const startReminderScheduler = ({ intervalMs = 10 * 60 * 1000 } = {}) => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  console.log(`⏰ [Reminder Scheduler] Initialized (Interval: ${Math.round(intervalMs / 60000)}m)`);

  schedulerInterval = setInterval(async () => {
    if (isProcessing) return; // Prevent overlapping runs
    isProcessing = true;
    try {
      const stats = await processEventReminders();
      if (stats.sent24h > 0 || stats.sent2h > 0) {
        console.log(`⏰ [Reminder Scheduler] Run complete: 24h: ${stats.sent24h}, 2h: ${stats.sent2h}`);
      }
    } catch (err) {
      console.error('⚠️ [Reminder Scheduler Error]:', err.message);
    } finally {
      isProcessing = false;
    }
  }, intervalMs);

  // Unref so scheduler timer doesn't prevent Node from exiting cleanly during shutdown
  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }

  return schedulerInterval;
};

/**
 * Stops the scheduler
 */
export const stopReminderScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('⏰ [Reminder Scheduler] Stopped.');
  }
};

export default {
  processEventReminders,
  handleEventRescheduled,
  startReminderScheduler,
  stopReminderScheduler,
  getEventStartDateTime,
};
