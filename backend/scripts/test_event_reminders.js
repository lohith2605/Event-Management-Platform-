import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Booking from '../src/models/Booking.js';
import Ticket from '../src/models/Ticket.js';
import Notification from '../src/models/Notification.js';
import {
  sendReminderEmailForBooking,
  sendConfirmationEmailForBooking,
  sendCancellationEmailForBooking,
  getTransporter,
  setTransporter,
} from '../src/services/emailService.js';
import {
  processEventReminders,
  handleEventRescheduled,
  getEventStartDateTime,
} from '../src/services/reminderScheduler.js';
import { issueTicketsForBooking } from '../src/utils/ticketIssuer.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runReminderTests() {
  console.log('================================================================');
  console.log('⏰ UTSAV - AUTOMATED EVENT REMINDERS (24H & 2H) TEST SUITE');
  console.log('================================================================\n');

  const originalTransporter = getTransporter();
  const testRunId = Date.now();

  let organizer, attendeeValid, attendeeLate, attendeeCancelled;
  let testEvent, cancelledEvent;
  let validBooking, lateBooking, cancelledBooking, holdBooking;

  try {
    await connectDB();

    console.log('⚙️ Configuration Check:');
    console.log('   - SMTP Host:', process.env.EMAIL_HOST || 'None');
    console.log('   - SMTP User:', process.env.EMAIL_USER || 'None');
    console.log('   - Real SMTP Configured:', !!originalTransporter);

    // Setup Test Users
    console.log('\n--- 1. Setting up test entities ---');
    organizer = await User.create({
      name: 'Reminder Organizer',
      email: `reminder_org_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeValid = await User.create({
      name: 'Eligible Attendee',
      email: `attendee_valid_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    attendeeLate = await User.create({
      name: 'Late Attendee',
      email: `attendee_late_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    attendeeCancelled = await User.create({
      name: 'Cancelled Attendee',
      email: `attendee_canc_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    // Create a base event starting in exactly 30 hours from an anchor time
    const anchorTime = new Date('2026-11-20T10:00:00.000Z');
    const eventStartTime = new Date(anchorTime.getTime() + 30 * 60 * 60 * 1000); // 30h after anchor

    testEvent = await Event.create({
      title: `UTSAV Classical Symphony ${testRunId}`,
      tagline: 'An evening of majestic melodies',
      description: 'Exclusive orchestral concert at royal auditorium',
      category: 'Music',
      date: 'Nov 21, 2026',
      isoDate: eventStartTime,
      time: '04:00 PM UTC',
      city: 'Bengaluru',
      venue: 'Chowdiah Memorial Hall, Malleshwaram',
      price: '₹500',
      priceNumber: 500,
      image: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=1200&q=80',
      organizer: organizer.name,
      organizerId: organizer._id,
      spotsLeft: 95,
      totalCapacity: 100,
      format: 'In-Person',
      status: 'published',
    });

    // Create an eligible booking created 3 days before event (well before 24h cutoff)
    const earlyBookingTime = new Date(eventStartTime.getTime() - 72 * 60 * 60 * 1000);
    validBooking = await Booking.create({
      bookingReference: `UTS-VAL-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeValid._id,
      attendeeName: attendeeValid.name,
      attendeeEmail: attendeeValid.email,
      ticketType: 'VIP Experience',
      quantity: 2,
      unitPrice: 500,
      totalAmount: 1000,
      status: 'confirmed',
      paymentStatus: 'completed',
      createdAt: earlyBookingTime,
    });
    await issueTicketsForBooking(validBooking, testEvent, attendeeValid);

    // Create a late booking created 5 hours before event start (inside 24h cutoff)
    const lateBookingTime = new Date(eventStartTime.getTime() - 5 * 60 * 60 * 1000);
    lateBooking = await Booking.create({
      bookingReference: `UTS-LAT-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeLate._id,
      attendeeName: attendeeLate.name,
      attendeeEmail: attendeeLate.email,
      ticketType: 'General Admission',
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      createdAt: lateBookingTime,
    });
    await issueTicketsForBooking(lateBooking, testEvent, attendeeLate);

    // Create a cancelled booking
    cancelledBooking = await Booking.create({
      bookingReference: `UTS-CAN-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeCancelled._id,
      attendeeName: attendeeCancelled.name,
      attendeeEmail: attendeeCancelled.email,
      ticketType: 'General Admission',
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'cancelled',
      paymentStatus: 'refunded',
      createdAt: earlyBookingTime,
    });

    // Create a pending unpaid booking
    holdBooking = await Booking.create({
      bookingReference: `UTS-HLD-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeLate._id,
      attendeeName: attendeeLate.name,
      attendeeEmail: attendeeLate.email,
      ticketType: 'General Admission',
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: earlyBookingTime,
    });

    console.log(`✅ Test event created: ${testEvent._id} (Starts: ${eventStartTime.toISOString()})`);
    console.log(`✅ Valid booking: ${validBooking.bookingReference}`);
    console.log(`✅ Late booking: ${lateBooking.bookingReference}`);
    console.log(`✅ Cancelled booking: ${cancelledBooking.bookingReference}`);

    // Mock Email Transporter for controlled offline testing
    const sentMockEmails = [];
    const mockTransporter = {
      sendMail: async (options) => {
        sentMockEmails.push(options);
        return { messageId: `<mock-rem-${Date.now()}@utsav.platform>` };
      },
    };
    setTransporter(mockTransporter);

    // ================================================================
    // TEST 1: Eligible booking receives 24-hour reminder
    // ================================================================
    console.log('\n--- TEST 1: Eligible booking receives 24-hour reminder ---');
    // Clock at 24.0 hours before event
    const time24hBefore = new Date(eventStartTime.getTime() - 24 * 60 * 60 * 1000);
    const stats24h = await processEventReminders({ referenceTime: time24hBefore });

    const updatedValid24h = await Booking.findById(validBooking._id);
    assert(stats24h.sent24h >= 1, `processEventReminders reported sent24h count >= 1 (got ${stats24h.sent24h})`);
    assert(updatedValid24h.reminder24hSent === true, 'Booking reminder24hSent is true');
    assert(updatedValid24h.reminder24hStatus === 'sent', 'Booking reminder24hStatus is "sent"');
    assert(!!updatedValid24h.reminder24hSentAt, 'Booking reminder24hSentAt timestamp recorded');
    assert(!!updatedValid24h.reminder24hMessageId, 'Booking reminder24hMessageId recorded');
    assert(
      sentMockEmails.some((m) => m.to === attendeeValid.email && m.subject.includes('Reminder:')),
      `Mock email captured with recipient ${attendeeValid.email}`
    );

    // ================================================================
    // TEST 2: Eligible booking receives 2-hour reminder
    // ================================================================
    console.log('\n--- TEST 2: Eligible booking receives 2-hour reminder ---');
    // Clock at 2.0 hours before event
    const time2hBefore = new Date(eventStartTime.getTime() - 2 * 60 * 60 * 1000);
    const stats2h = await processEventReminders({ referenceTime: time2hBefore });

    const updatedValid2h = await Booking.findById(validBooking._id);
    assert(stats2h.sent2h >= 1, `processEventReminders reported sent2h count >= 1 (got ${stats2h.sent2h})`);
    assert(updatedValid2h.reminder2hSent === true, 'Booking reminder2hSent is true');
    assert(updatedValid2h.reminder2hStatus === 'sent', 'Booking reminder2hStatus is "sent"');
    assert(!!updatedValid2h.reminder2hSentAt, 'Booking reminder2hSentAt timestamp recorded');
    assert(!!updatedValid2h.reminder2hMessageId, 'Booking reminder2hMessageId recorded');
    assert(
      sentMockEmails.some((m) => m.to === attendeeValid.email && m.subject.includes('Final Reminder:')),
      'Mock email captured 2h final reminder'
    );

    // ================================================================
    // TEST 3: Cancelled or ineligible booking receives no reminder
    // ================================================================
    console.log('\n--- TEST 3: Cancelled or ineligible booking receives no reminder ---');
    const updatedCancelled = await Booking.findById(cancelledBooking._id);
    const updatedHold = await Booking.findById(holdBooking._id);

    assert(updatedCancelled.reminder24hSent === false, 'Cancelled booking received no 24h reminder');
    assert(updatedCancelled.reminder2hSent === false, 'Cancelled booking received no 2h reminder');
    assert(updatedHold.reminder24hSent === false, 'Hold/pending booking received no 24h reminder');
    assert(updatedHold.reminder2hSent === false, 'Hold/pending booking received no 2h reminder');

    // Create a confirmed booking whose tickets are cancelled
    const bookingWithCancelledTickets = await Booking.create({
      bookingReference: `UTS-NOTKT-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeLate._id,
      attendeeName: attendeeLate.name,
      attendeeEmail: attendeeLate.email,
      ticketType: 'General Admission',
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      createdAt: earlyBookingTime,
    });
    await issueTicketsForBooking(bookingWithCancelledTickets, testEvent, attendeeLate);
    await Ticket.updateMany(
      { bookingId: bookingWithCancelledTickets._id },
      { $set: { status: 'cancelled' } }
    );

    const resVoidTkt = await processEventReminders({ referenceTime: time24hBefore });
    const checkVoid = await Booking.findById(bookingWithCancelledTickets._id);
    assert(checkVoid.reminder24hSent === false, 'Booking with 0 active tickets receives no reminder');

    // ================================================================
    // TEST 4: Event rescheduling resets reminder flags and avoids obsolete reminders
    // ================================================================
    console.log('\n--- TEST 4: Event rescheduling prevents obsolete reminders ---');
    const rescheduledDate = new Date(eventStartTime.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
    const resetCount = await handleEventRescheduled(testEvent._id, rescheduledDate, eventStartTime);

    assert(resetCount >= 1, `handleEventRescheduled reset flags for ${resetCount} bookings`);
    const refreshedBooking = await Booking.findById(validBooking._id);
    assert(refreshedBooking.reminder24hSent === false, 'Valid booking reminder24hSent reset to false');
    assert(refreshedBooking.reminder24hStatus === 'pending', 'Valid booking reminder24hStatus reset to pending');
    assert(refreshedBooking.reminder2hSent === false, 'Valid booking reminder2hSent reset to false');

    // Also test that a cancelled event receives no reminders
    cancelledEvent = await Event.create({
      title: `Cancelled Expo ${testRunId}`,
      tagline: 'Not happening',
      description: 'Event was cancelled',
      category: 'Exhibition',
      date: 'Nov 21, 2026',
      isoDate: eventStartTime,
      time: '04:00 PM UTC',
      city: 'Delhi',
      venue: 'Pragati Maidan',
      price: 'Free',
      priceNumber: 0,
      organizer: organizer.name,
      organizerId: organizer._id,
      spotsLeft: 0,
      totalCapacity: 50,
      status: 'cancelled',
    });
    const cancEvBooking = await Booking.create({
      bookingReference: `UTS-EVNCAN-${testRunId.toString().slice(-6)}`,
      eventId: cancelledEvent._id,
      userId: attendeeValid._id,
      attendeeName: attendeeValid.name,
      attendeeEmail: attendeeValid.email,
      ticketType: 'Free',
      quantity: 1,
      totalAmount: 0,
      status: 'confirmed',
      createdAt: earlyBookingTime,
    });
    await processEventReminders({ referenceTime: time24hBefore });
    const cancEvB = await Booking.findById(cancEvBooking._id);
    assert(cancEvB.reminder24hSent === false, 'Cancelled event bookings are excluded by scheduler');

    // ================================================================
    // TEST 5: Repeated scheduler execution does not duplicate reminders
    // ================================================================
    console.log('\n--- TEST 5: Repeated scheduler execution does not duplicate reminders (Idempotency) ---');
    // First, deliver 24h reminder on refreshed booking
    await sendReminderEmailForBooking({ bookingId: validBooking._id, reminderType: '24h' });
    const countBeforeRepeat = sentMockEmails.length;

    // Run scheduler 3 times consecutively at 24h window
    const repeat1 = await processEventReminders({ referenceTime: time24hBefore });
    const repeat2 = await processEventReminders({ referenceTime: time24hBefore });
    const repeat3 = await processEventReminders({ referenceTime: time24hBefore });

    assert(repeat1.sent24h === 0, 'Repeat run 1 sent 0 duplicate 24h reminders');
    assert(repeat2.sent24h === 0, 'Repeat run 2 sent 0 duplicate 24h reminders');
    assert(repeat3.sent24h === 0, 'Repeat run 3 sent 0 duplicate 24h reminders');
    assert(sentMockEmails.length === countBeforeRepeat, 'No additional emails sent during repeat runs');

    // Concurrency test: Two parallel invocations
    const [concA, concB] = await Promise.all([
      sendReminderEmailForBooking({ bookingId: validBooking._id, reminderType: '2h' }),
      sendReminderEmailForBooking({ bookingId: validBooking._id, reminderType: '2h' }),
    ]);
    const successfulSends = [concA, concB].filter((r) => r.success && !r.skipped);
    const skippedSends = [concA, concB].filter((r) => r.skipped);
    assert(successfulSends.length === 1, 'Only one concurrent call claimed lock and delivered');
    assert(skippedSends.length === 1, 'Concurrent twin was safely skipped with duplicate lock');

    // ================================================================
    // TEST 6: Timezones, boundary times & late-created bookings
    // ================================================================
    console.log('\n--- TEST 6: Timezone parsing & late-created bookings policy ---');
    // Test getEventStartDateTime parsing
    const istEvent = {
      isoDate: new Date('2026-11-20T00:00:00.000Z'),
      time: '10:00 AM IST',
    };
    const parsedIst = getEventStartDateTime(istEvent);
    // 10:00 AM IST is 04:30 AM UTC
    assert(
      parsedIst.getUTCHours() === 4 && parsedIst.getUTCMinutes() === 30,
      'Timezone IST ("10:00 AM IST") converted accurately to 04:30 UTC'
    );

    const utcEvent = {
      isoDate: new Date('2026-11-20T00:00:00.000Z'),
      time: '06:30 PM UTC',
    };
    const parsedUtc = getEventStartDateTime(utcEvent);
    assert(
      parsedUtc.getUTCHours() === 18 && parsedUtc.getUTCMinutes() === 30,
      'Timezone UTC ("06:30 PM UTC") converted accurately to 18:30 UTC'
    );

    // Test late-created booking policy:
    // lateBooking was created 5h before eventStart.
    // 24h reminder window should mark it skipped rather than sending redundant email.
    // Reset testEvent isoDate back to eventStartTime for late booking check
    testEvent.isoDate = eventStartTime;
    await testEvent.save();

    await processEventReminders({ referenceTime: time24hBefore });
    const checkLate = await Booking.findById(lateBooking._id);
    assert(
      checkLate.reminder24hStatus === 'skipped',
      `Late booking 24h reminder skipped per policy (status: ${checkLate.reminder24hStatus})`
    );
    assert(
      checkLate.reminder24hError.includes('Late booking created within 24 hours'),
      'Late booking record explains policy skip reason'
    );

    // ================================================================
    // TEST 7: Email delivery failure does not corrupt booking data
    // ================================================================
    console.log('\n--- TEST 7: Email delivery failure tolerance (Non-destructive) ---');
    // Configure failing transporter
    const failingTransporter = {
      sendMail: async () => {
        throw new Error('ETIMEDOUT: Connection dropped by mail server');
      },
    };
    setTransporter(failingTransporter);

    // Create a fresh eligible booking
    const failureTestBooking = await Booking.create({
      bookingReference: `UTS-ERR-${testRunId.toString().slice(-6)}`,
      eventId: testEvent._id,
      userId: attendeeValid._id,
      attendeeName: attendeeValid.name,
      attendeeEmail: attendeeValid.email,
      ticketType: 'General Admission',
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      createdAt: earlyBookingTime,
    });
    await issueTicketsForBooking(failureTestBooking, testEvent, attendeeValid);

    const failResult = await sendReminderEmailForBooking({
      bookingId: failureTestBooking._id,
      reminderType: '24h',
    });

    assert(failResult.success === false, 'sendReminderEmailForBooking returned success: false on SMTP drop');
    const checkedFailedBooking = await Booking.findById(failureTestBooking._id);
    assert(checkedFailedBooking.status === 'confirmed', 'Booking status remained "confirmed" (NOT deleted or corrupted)');
    assert(checkedFailedBooking.reminder24hSent === false, 'reminder24hSent remains false for safe subsequent retry');
    assert(checkedFailedBooking.reminder24hStatus === 'failed', 'reminder24hStatus recorded as "failed"');
    assert(
      checkedFailedBooking.reminder24hError.includes('ETIMEDOUT'),
      'Detailed SMTP error captured on booking record'
    );

    // Restore mock transporter
    setTransporter(mockTransporter);

    // ================================================================
    // TEST 8: In-app notifications appear correctly
    // ================================================================
    console.log('\n--- TEST 8: In-app notifications verification ---');
    const notifications = await Notification.find({
      userId: attendeeValid._id,
      type: 'event_reminder',
    });

    assert(notifications.length >= 1, `Found ${notifications.length} in-app reminder notifications`);
    const notif = notifications[0];
    assert(notif.link === '/attendee/tickets', `Notification links to "${notif.link}"`);
    assert(notif.type === 'event_reminder', `Notification type is "${notif.type}"`);
    assert(notif.title.includes(testEvent.title), 'Notification title contains event title');
    assert(notif.metadata?.reminderType === '24h' || notif.metadata?.reminderType === '2h', 'Notification metadata includes reminderType');

    // ================================================================
    // TEST 9: Existing confirmation and cancellation emails still work
    // ================================================================
    console.log('\n--- TEST 9: Existing confirmation & cancellation workflows integrity ---');
    const confirmRes = await sendConfirmationEmailForBooking({ bookingId: validBooking._id });
    assert(confirmRes.success === true, 'sendConfirmationEmailForBooking executed successfully without regression');

    const cancRes = await sendCancellationEmailForBooking({ bookingId: cancelledBooking._id });
    assert(cancRes.success === true, 'sendCancellationEmailForBooking executed successfully without regression');

    // ================================================================
    // REAL EMAIL DELIVERY VERIFICATION (Distinguished from mocked tests)
    // ================================================================
    console.log('\n--- REAL SMTP EMAIL DELIVERY CHECK ---');
    if (originalTransporter && process.env.EMAIL_USER) {
      console.log(`📡 Testing 1 real reminder email delivery via configured Gmail SMTP (${process.env.EMAIL_USER})...`);
      setTransporter(originalTransporter);
      try {
        // Reset reminder flag in MongoDB directly so atomic lock query finds it
        await Booking.findByIdAndUpdate(validBooking._id, {
          $set: {
            reminder24hSent: false,
            reminder24hStatus: 'pending',
          },
        });
        // Set recipient to real EMAIL_USER so Gmail delivers to active mailbox
        await User.findByIdAndUpdate(attendeeValid._id, {
          $set: { email: process.env.EMAIL_USER },
        });

        const realResult = await sendReminderEmailForBooking({
          bookingId: validBooking._id,
          reminderType: '24h',
        });
        console.log('  🔍 realResult:', JSON.stringify(realResult));

        if (realResult.delivered) {
          console.log(`  🎉 REAL EMAIL DELIVERED via Gmail SMTP! Message ID: ${realResult.messageId}`);
          assert(true, `Real SMTP reminder email successfully dispatched (ID: ${realResult.messageId})`);
        } else {
          console.log('  ℹ️ Real SMTP skipped or simulated.');
        }
      } catch (realErr) {
        console.warn('  ⚠️ Real SMTP delivery attempt error:', realErr.message);
      } finally {
        setTransporter(mockTransporter);
      }
    } else {
      console.log('  ℹ️ Real SMTP not configured or no credentials; automated tests ran with controllable mock transporter.');
    }

  } catch (err) {
    console.error('Unhandled test failure:', err);
    failed++;
  } finally {
    // Cleanup test data
    console.log('\n--- Cleaning up test artifacts ---');
    if (organizer) await User.deleteOne({ _id: organizer._id });
    if (attendeeValid) await User.deleteOne({ _id: attendeeValid._id });
    if (attendeeLate) await User.deleteOne({ _id: attendeeLate._id });
    if (attendeeCancelled) await User.deleteOne({ _id: attendeeCancelled._id });
    if (testEvent) await Event.deleteOne({ _id: testEvent._id });
    if (cancelledEvent) await Event.deleteOne({ _id: cancelledEvent._id });
    await Booking.deleteMany({
      bookingReference: { $regex: new RegExp(`^UTS-.*${testRunId.toString().slice(-6)}`) },
    });
    await Ticket.deleteMany({
      ticketCode: { $regex: new RegExp(`^TKT-.*${testRunId.toString().slice(-6)}`) },
    });
    if (attendeeValid) {
      await Notification.deleteMany({ userId: attendeeValid._id });
    }

    setTransporter(originalTransporter);
    await mongoose.disconnect();

    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runReminderTests();
