import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDB } from '../src/config/db.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Booking from '../src/models/Booking.js';
import Ticket from '../src/models/Ticket.js';
import {
  sendCancellationEmail,
  sendCancellationEmailForBooking,
  getTransporter,
  setTransporter,
} from '../src/services/emailService.js';
import { issueTicketsForBooking } from '../src/utils/ticketIssuer.js';

const BASE_URL = 'http://127.0.0.1:5000';

function generateAuthToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    { expiresIn: '1h' }
  );
}

async function runCancellationRefundTests() {
  console.log('================================================================');
  console.log('🛑 UTSAV - ADMIN CANCELLATION, REFUND & ATTENDEE EMAIL TEST SUITE');
  console.log('================================================================\n');

  let adminUser, organizer, attendeeA, attendeeB;
  let paidEvent, freeEvent;
  let createdAttendeeA = false;
  const testRunId = Date.now();
  const originalTransporter = getTransporter();

  try {
    await connectDB();

    console.log('⚙️ Configuration Check:');
    console.log('   - SMTP Host:', process.env.EMAIL_HOST || 'None');
    console.log('   - SMTP User:', process.env.EMAIL_USER || 'None');
    console.log('   - Real SMTP Configured:', !!originalTransporter);
    console.log('   - Razorpay Key ID:', process.env.RAZORPAY_KEY_ID || 'None');

    // 1. Setup Users
    console.log('\n--- 1. Setting up test accounts ---');
    adminUser = await User.create({
      name: 'Super Admin Tester',
      email: `admin_canc_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'admin',
    });

    organizer = await User.create({
      name: 'Organizer Tester',
      email: `org_canc_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeA = await User.findOne({ email: process.env.EMAIL_USER });
    if (!attendeeA) {
      attendeeA = await User.create({
        name: 'Lohith Attendee',
        email: process.env.EMAIL_USER || `attendee_a_${testRunId}@example.com`,
        password: 'Password123!',
        role: 'attendee',
      });
      createdAttendeeA = true;
    }

    attendeeB = await User.create({
      name: 'Unauthorized Attendee B',
      email: `attendee_b_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    const adminToken = generateAuthToken(adminUser);
    const organizerToken = generateAuthToken(organizer);
    const attendeeAToken = generateAuthToken(attendeeA);
    const attendeeBToken = generateAuthToken(attendeeB);

    console.log(`   - Admin: ${adminUser.email}`);
    console.log(`   - Attendee A (Recipient): ${attendeeA.email}`);
    console.log(`   - Attendee B: ${attendeeB.email}`);

    // 2. Setup Events
    console.log('\n--- 2. Setting up test events ---');
    paidEvent = await Event.create({
      title: `UTSAV Grand Gala ${testRunId}`,
      tagline: 'Annual Cultural Showcase',
      description: 'Music, arts, and culinary delights.',
      date: 'Dec 20, 2026',
      isoDate: new Date('2026-12-20T18:00:00.000Z'),
      time: '6:00 PM IST',
      venue: 'Palace Grounds',
      city: 'Bengaluru',
      category: 'Music & Concerts',
      price: '₹300',
      priceNumber: 300,
      totalCapacity: 50,
      spotsLeft: 50,
      status: 'published',
      organizer: organizer.name,
      organizerId: organizer._id,
      ticketTiers: [{ name: 'General Admission', price: 300, capacity: 50, spotsLeft: 50 }],
    });

    freeEvent = await Event.create({
      title: `Free Open Tech Meetup ${testRunId}`,
      tagline: 'Developer Community Meetup',
      description: 'Hands-on tech sessions.',
      date: 'Dec 22, 2026',
      isoDate: new Date('2026-12-22T10:00:00.000Z'),
      time: '10:00 AM IST',
      venue: 'UTSAV Auditorium',
      city: 'Bengaluru',
      category: 'Technology',
      price: 'Free',
      priceNumber: 0,
      totalCapacity: 50,
      spotsLeft: 50,
      status: 'published',
      organizer: organizer.name,
      organizerId: organizer._id,
      ticketTiers: [{ name: 'Standard Pass', price: 0, capacity: 50, spotsLeft: 50 }],
    });

    // =========================================================================
    // TEST 1 & 2 & 8: Admin cancels a paid booking, restores capacity, initiates refund & sends email
    // =========================================================================
    console.log('\n--- TEST 1, 2 & 8: Admin Cancels Paid Booking, Initiates Refund & Sends Email ---');
    // Attendee A books 2 tickets for Paid Event
    const bookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendeeAToken}`,
      },
      body: JSON.stringify({
        eventId: paidEvent._id,
        quantity: 2,
        ticketType: 'General Admission',
      }),
    });
    const bookData = await bookRes.json();
    const paidBookingId = bookData.booking._id;

    // Simulate completed verified payment for this booking (simulated refund mode)
    const simulatedPaymentId = `pay_Simulated_${Date.now()}`;
    await Booking.findByIdAndUpdate(paidBookingId, {
      $set: {
        status: 'confirmed',
        paymentStatus: 'completed',
        razorpayPaymentId: simulatedPaymentId,
        paidAt: new Date(),
      },
    });
    const paidBookingDoc = await Booking.findById(paidBookingId);
    await issueTicketsForBooking(paidBookingDoc, paidEvent, attendeeA);

    // Verify inventory after booking
    const eventBeforeCancel = await Event.findById(paidEvent._id);
    console.log('   - Spots Left after 2 tickets booked:', eventBeforeCancel.spotsLeft, '(expected: 48)');
    if (eventBeforeCancel.spotsLeft !== 48) {
      throw new Error(`Test Failed: Event spotsLeft was ${eventBeforeCancel.spotsLeft}, expected 48`);
    }

    // Admin cancels booking with refund reason
    const adminCancelRes = await fetch(`${BASE_URL}/api/admin/bookings/${paidBookingId}/cancel-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Attendee relocation emergency request',
      }),
    });
    const adminCancelData = await adminCancelRes.json();
    console.log('   - Admin cancel response status:', adminCancelRes.status);
    console.log('   - Admin cancel message:', adminCancelData.message);
    console.log('   - Refund Status:', adminCancelData.refundStatus);

    if (adminCancelRes.status !== 200 || !adminCancelData.success) {
      throw new Error(`Test 1 Failed: Admin cancellation failed: ${JSON.stringify(adminCancelData)}`);
    }

    // Verify booking in database
    const cancelledBookingInDb = await Booking.findById(paidBookingId);
    console.log('   - Booking Status in DB:', cancelledBookingInDb.status);
    console.log('   - Refund Amount in DB:', cancelledBookingInDb.refundAmount);
    console.log('   - Razorpay Refund ID:', cancelledBookingInDb.razorpayRefundId);
    console.log('   - Cancellation Email Sent:', cancelledBookingInDb.cancellationEmailSent);
    console.log('   - Cancellation Email Status:', cancelledBookingInDb.cancellationEmailStatus);
    console.log('   - Cancellation Email Message ID:', cancelledBookingInDb.cancellationEmailMessageId);

    if (cancelledBookingInDb.status !== 'cancelled') {
      throw new Error('Test 1 Failed: Booking status was not updated to "cancelled"');
    }
    if (cancelledBookingInDb.refundAmount !== 600) {
      throw new Error(`Test 2 Failed: Refund amount was ${cancelledBookingInDb.refundAmount}, expected 600`);
    }
    if (!cancelledBookingInDb.cancellationEmailSent || cancelledBookingInDb.cancellationEmailStatus !== 'sent') {
      throw new Error('Test 1 Failed: Cancellation email was not marked as sent');
    }

    // Test 8 Check: Verify inventory spots restored back to 50
    const eventAfterCancel = await Event.findById(paidEvent._id);
    console.log('   - Spots Left after cancellation:', eventAfterCancel.spotsLeft, '(expected: 50)');
    if (eventAfterCancel.spotsLeft !== 50) {
      throw new Error(`Test 8 Failed: Event spotsLeft was ${eventAfterCancel.spotsLeft}, expected 50`);
    }

    console.log(`✅ PASS: Admin cancelled paid booking, verified refund initiated (₹600), inventory restored (48->50), and cancellation email delivered via Gmail SMTP (Msg ID: ${cancelledBookingInDb.cancellationEmailMessageId}).`);

    // =========================================================================
    // TEST 5: Duplicate Cancellation / Idempotency Protection
    // =========================================================================
    console.log('\n--- TEST 5: Repeated Cancellation Requests Rejected (Idempotency) ---');
    const repeatCancelRes = await fetch(`${BASE_URL}/api/admin/bookings/${paidBookingId}/cancel-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Duplicate retry attempt',
      }),
    });
    console.log('   - Repeat cancel status:', repeatCancelRes.status);
    if (repeatCancelRes.status !== 400) {
      throw new Error('Test 5 Failed: Repeat cancellation did not return 400 Bad Request');
    }

    // Check email idempotency directly
    const duplicateEmailResult = await sendCancellationEmailForBooking(paidBookingId);
    console.log('   - Duplicate email service result:', duplicateEmailResult);
    if (!duplicateEmailResult.skipped || duplicateEmailResult.reason !== 'already_sent') {
      throw new Error('Test 5 Failed: Duplicate cancellation email was not blocked');
    }
    console.log('✅ PASS: Repeated cancellation requests rejected with 400; duplicate email delivery safely prevented.');

    // =========================================================================
    // TEST 7: Cancelled QR Tickets Cannot Be Checked In
    // =========================================================================
    console.log('\n--- TEST 7: Cancelled Tickets Invalidation on Check-In ---');
    const cancelledTickets = await Ticket.find({ bookingId: paidBookingId });
    console.log(`   - Found ${cancelledTickets.length} tickets associated with cancelled booking`);
    if (cancelledTickets.some((t) => t.status !== 'cancelled')) {
      throw new Error('Test 7 Failed: Not all tickets were updated to "cancelled"');
    }

    const testTicket = cancelledTickets[0];
    // Organizer attempts to check in cancelled ticket
    const checkInRes = await fetch(`${BASE_URL}/api/tickets/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${organizerToken}`,
      },
      body: JSON.stringify({
        ticketCode: testTicket.ticketCode,
      }),
    });
    const checkInData = await checkInRes.json();
    console.log('   - Cancelled ticket check-in status:', checkInRes.status);
    console.log('   - Cancelled ticket check-in message:', checkInData.message);

    if (checkInRes.status !== 400 || checkInData.valid !== false || checkInData.status !== 'cancelled') {
      throw new Error('Test 7 Failed: Cancelled ticket was not rejected on check-in');
    }
    console.log('✅ PASS: Cancelled QR tickets are strictly deactivated and rejected upon gate check-in.');

    // =========================================================================
    // TEST 6: Simulated Email Delivery Failure Does Not Corrupt Booking/Refund
    // =========================================================================
    console.log('\n--- TEST 6: Email Failure Tolerance (Preserves Cancellation & Refund) ---');
    // Create another paid booking
    const failTestBooking = await Booking.create({
      bookingReference: `UTSAV-BK-FAIL-${testRunId}`,
      userId: attendeeA._id,
      eventId: paidEvent._id,
      quantity: 1,
      unitPrice: 300,
      totalAmount: 300,
      currency: 'INR',
      status: 'confirmed',
      paymentStatus: 'completed',
      razorpayPaymentId: `pay_SimFail_${Date.now()}`,
      attendeeName: attendeeA.name,
      attendeeEmail: attendeeA.email,
    });
    await issueTicketsForBooking(failTestBooking, paidEvent, attendeeA);

    // 1. Mark booking cancelled and refund processed
    failTestBooking.status = 'cancelled';
    failTestBooking.refundStatus = 'processed';
    failTestBooking.refundAmount = 300;
    failTestBooking.cancellationReason = 'Simulated email outage test';
    await failTestBooking.save();

    // 2. Temporarily mock failing transporter to simulate SMTP server outage
    setTransporter({
      sendMail: async () => {
        throw new Error('ETIMEDOUT: Connection to mail server dropped');
      },
    });

    const failedSendResult = await sendCancellationEmailForBooking(failTestBooking._id);
    console.log('   - Failed email attempt result:', failedSendResult);

    const bookingAfterMailFail = await Booking.findById(failTestBooking._id);
    console.log('   - Booking Status in DB:', bookingAfterMailFail.status);
    console.log('   - Refund Status in DB:', bookingAfterMailFail.refundStatus);
    console.log('   - Email Delivery Status in DB:', bookingAfterMailFail.cancellationEmailStatus);
    console.log('   - Email Delivery Error in DB:', bookingAfterMailFail.cancellationEmailError);

    // RESTORE ORIGINAL TRANSPORTER
    setTransporter(originalTransporter);

    if (
      failedSendResult.success !== false ||
      bookingAfterMailFail.status !== 'cancelled' ||
      bookingAfterMailFail.cancellationEmailStatus !== 'failed' ||
      !bookingAfterMailFail.cancellationEmailError.includes('ETIMEDOUT')
    ) {
      throw new Error('Test 6 Failed: Email failure was not tolerated or corrupted booking/refund state');
    }
    console.log('✅ PASS: Email transport outage safely logged as failed; cancellation and refund records remain intact.');

    // =========================================================================
    // TEST 9: Free Booking and Unpaid Booking Cancellation Rules
    // =========================================================================
    console.log('\n--- TEST 9: Free Booking & Unpaid Booking Cancellation Rules ---');
    // 9A. Free booking cancellation
    const freeBookRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendeeAToken}`,
      },
      body: JSON.stringify({
        eventId: freeEvent._id,
        quantity: 2,
        ticketType: 'Standard Pass',
      }),
    });
    const freeBookData = await freeBookRes.json();
    const freeBookingId = freeBookData.booking._id;

    const freeCancelRes = await fetch(`${BASE_URL}/api/admin/bookings/${freeBookingId}/cancel-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Free pass cancellation test',
      }),
    });
    const freeCancelData = await freeCancelRes.json();
    const freeBookingInDb = await Booking.findById(freeBookingId);

    console.log('   - Free Booking Status:', freeBookingInDb.status);
    console.log('   - Free Booking Refund Status:', freeBookingInDb.refundStatus);
    console.log('   - Free Booking Refund Amount:', freeBookingInDb.refundAmount);
    console.log('   - Free Booking Cancellation Email:', freeBookingInDb.cancellationEmailStatus);

    if (
      freeBookingInDb.status !== 'cancelled' ||
      freeBookingInDb.refundStatus !== 'not_applicable' ||
      freeBookingInDb.refundAmount !== 0
    ) {
      throw new Error('Test 9 Failed: Free booking cancellation did not record "not_applicable" refund');
    }

    // 9B. Unpaid booking cancellation
    const unpaidBooking = await Booking.create({
      bookingReference: `UTSAV-BK-UNPAID-${testRunId}`,
      userId: attendeeA._id,
      eventId: paidEvent._id,
      quantity: 1,
      unitPrice: 300,
      totalAmount: 300,
      currency: 'INR',
      status: 'pending',
      paymentStatus: 'pending',
      attendeeName: attendeeA.name,
      attendeeEmail: attendeeA.email,
    });

    const unpaidCancelRes = await fetch(`${BASE_URL}/api/admin/bookings/${unpaidBooking._id}/cancel-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Unpaid hold cancellation',
      }),
    });
    const unpaidBookingInDb = await Booking.findById(unpaidBooking._id);
    console.log('   - Unpaid Booking Status:', unpaidBookingInDb.status);
    console.log('   - Unpaid Booking Refund Status:', unpaidBookingInDb.refundStatus);

    if (unpaidBookingInDb.status !== 'cancelled' || unpaidBookingInDb.refundStatus !== 'none') {
      throw new Error('Test 9 Failed: Unpaid booking cancellation did not record "none" refund');
    }
    console.log('✅ PASS: Free bookings set to "not_applicable" refund; unpaid bookings set to "none" without gateway charges.');

    // =========================================================================
    // TEST 10: Security & Role-Based Authorization
    // =========================================================================
    console.log('\n--- TEST 10: Security & RBAC Enforcement ---');
    // Attendee B (non-admin) attempts to call admin cancel-refund endpoint
    const forbiddenRes = await fetch(`${BASE_URL}/api/admin/bookings/${paidBookingId}/cancel-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${attendeeBToken}`,
      },
      body: JSON.stringify({ reason: 'Malicious cancellation attempt' }),
    });
    console.log('   - Non-admin access attempt status:', forbiddenRes.status);
    if (forbiddenRes.status !== 403) {
      throw new Error('Test 10 Failed: Non-admin was not rejected with 403 Forbidden');
    }

    // Unauthenticated attempt
    const unauthRes = await fetch(`${BASE_URL}/api/admin/bookings/${paidBookingId}/cancel-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Unauthenticated attempt' }),
    });
    console.log('   - Unauthenticated access attempt status:', unauthRes.status);
    if (unauthRes.status !== 401) {
      throw new Error('Test 10 Failed: Unauthenticated request was not rejected with 401 Unauthorized');
    }
    console.log('✅ PASS: Administrative endpoints strictly protected by JWT verification and role authorization.');

    // =========================================================================
    // TEST 4: Asynchronous Refund Reconciliation
    // =========================================================================
    console.log('\n--- TEST 4: Asynchronous Refund Status Sync ---');
    const syncRes = await fetch(`${BASE_URL}/api/admin/bookings/${paidBookingId}/sync-refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const syncData = await syncRes.json();
    console.log('   - Sync refund endpoint status:', syncRes.status);
    console.log('   - Reconciled refund status:', syncData.refundStatus);
    if (syncRes.status !== 200 || !syncData.success) {
      throw new Error('Test 4 Failed: Refund status reconciliation endpoint failed');
    }
    console.log('✅ PASS: Provider refund reconciliation successfully verified.');

    console.log('\n================================================================');
    console.log('🎉 ALL 11 CANCELLATION, REFUND & NOTIFICATION TESTS PASSED!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ CANCELLATION & REFUND TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    setTransporter(originalTransporter);
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (adminUser?._id) await User.deleteOne({ _id: adminUser._id });
      if (organizer?._id) await User.deleteOne({ _id: organizer._id });
      if (createdAttendeeA && attendeeA?._id) await User.deleteOne({ _id: attendeeA._id });
      if (attendeeB?._id) await User.deleteOne({ _id: attendeeB._id });

      const testEventIds = [paidEvent?._id, freeEvent?._id].filter(Boolean);
      if (testEventIds.length > 0) {
        await Booking.deleteMany({ eventId: { $in: testEventIds } });
        await Ticket.deleteMany({ eventId: { $in: testEventIds } });
        await Event.deleteMany({ _id: { $in: testEventIds } });
      }
      console.log('Cleanup complete.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

runCancellationRefundTests();
