import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Event from '../models/Event.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Ticket from '../models/Ticket.js';
import {
  getEventStartDateTime,
  isEventStarted,
  checkBookingEligibility,
} from '../utils/eventDateUtils.js';
import { createBooking } from '../controllers/bookingController.js';
import { createOrder, verifyPayment } from '../controllers/paymentController.js';
import { issueTicketsForBooking } from '../utils/ticketIssuer.js';
import { releaseSingleBookingHold } from '../utils/checkoutHold.js';

// Helper to simulate Express req, res, next
const createMockReqRes = ({ params = {}, query = {}, user = {}, body = {} } = {}) => {
  const req = { params, query, user, body };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) {
      statusCode = err.status || 500;
      responseData = { success: false, message: err.message };
    }
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
};

test('UTSAV Phase 1 — Event Start-Time Cutoff & Booking Eligibility Test Suite', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
  }

  const runId = Date.now();
  let organizerUser, attendeeUser;

  // Setup test users
  organizerUser = await User.create({
    name: 'Cutoff Test Organizer',
    email: `cutoff_org_${runId}@example.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  attendeeUser = await User.create({
    name: 'Cutoff Test Attendee',
    email: `cutoff_att_${runId}@example.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  t.after(async () => {
    // Cleanup test artifacts
    await User.deleteMany({ email: { $regex: `${runId}` } });
    await Event.deleteMany({ title: { $regex: `${runId}` } });
    await Booking.deleteMany({ bookingReference: { $regex: `${runId}` } });
    await Ticket.deleteMany({ attendeeName: attendeeUser.name });
    await mongoose.disconnect();
  });

  // =========================================================================
  // TEST 1: Unit Eligibility - Future published event with capacity is allowed
  // =========================================================================
  await t.test('1. Future published event with available capacity is allowed', () => {
    const futureEvent = {
      status: 'published',
      isoDate: new Date(Date.now() + 48 * 3600 * 1000),
      time: '10:00 AM IST',
      spotsLeft: 50,
    };
    const res = checkBookingEligibility(futureEvent, 2);
    assert.equal(res.eligible, true, 'Future published event should be eligible');
    assert.ok(res.startDateTime instanceof Date, 'Should return parsed startDateTime');
  });

  // =========================================================================
  // TEST 2: Unit Eligibility - Exactly at or before start instant is rejected
  // =========================================================================
  await t.test('2. Event exactly at or before start instant is rejected', () => {
    const fixedInstant = new Date('2026-11-20T10:00:00.000Z');

    // Exactly at start instant
    const atInstantEvent = {
      status: 'published',
      isoDate: fixedInstant,
      time: '10:00 AM UTC',
      spotsLeft: 20,
    };
    const resAt = checkBookingEligibility(atInstantEvent, 1, { referenceDate: fixedInstant });
    assert.equal(resAt.eligible, false, 'Event exactly at start instant must be rejected');
    assert.equal(resAt.reason, 'EVENT_ALREADY_STARTED');

    // 1 millisecond after start instant
    const resAfter = checkBookingEligibility(atInstantEvent, 1, {
      referenceDate: new Date(fixedInstant.getTime() + 1),
    });
    assert.equal(resAfter.eligible, false, 'Event 1ms past start instant must be rejected');
    assert.equal(resAfter.reason, 'EVENT_ALREADY_STARTED');

    // 1 millisecond before start instant is allowed
    const resBefore = checkBookingEligibility(atInstantEvent, 1, {
      referenceDate: new Date(fixedInstant.getTime() - 1),
    });
    assert.equal(resBefore.eligible, true, 'Event 1ms before start instant should be allowed');
  });

  // =========================================================================
  // TEST 3: Unit Eligibility - Past published event is rejected
  // =========================================================================
  await t.test('3. Past published event is rejected', () => {
    const pastEvent = {
      status: 'published',
      isoDate: new Date(Date.now() - 72 * 3600 * 1000), // 3 days ago
      time: '10:00 AM IST',
      spotsLeft: 100,
    };
    const res = checkBookingEligibility(pastEvent, 1);
    assert.equal(res.eligible, false, 'Past event must be rejected');
    assert.equal(res.reason, 'EVENT_ALREADY_STARTED');
  });

  // =========================================================================
  // TEST 4: Unit Eligibility - Cancelled or unpublished event is rejected
  // =========================================================================
  await t.test('4. Cancelled or unpublished event is rejected', () => {
    const cancelledEvent = {
      status: 'cancelled',
      isoDate: new Date(Date.now() + 48 * 3600 * 1000),
      time: '10:00 AM IST',
      spotsLeft: 10,
    };
    const resCancelled = checkBookingEligibility(cancelledEvent, 1);
    assert.equal(resCancelled.eligible, false);
    assert.equal(resCancelled.reason, 'EVENT_CANCELLED');

    const draftEvent = {
      status: 'draft',
      isoDate: new Date(Date.now() + 48 * 3600 * 1000),
      time: '10:00 AM IST',
      spotsLeft: 10,
    };
    const resDraft = checkBookingEligibility(draftEvent, 1);
    assert.equal(resDraft.eligible, false);
    assert.equal(resDraft.reason, 'EVENT_NOT_PUBLISHED');
  });

  // =========================================================================
  // TEST 5: Unit Eligibility - Missing or invalid start timestamp is rejected
  // =========================================================================
  await t.test('5. Missing or invalid start timestamp is rejected for new bookings', () => {
    const invalidIsoEvent = {
      status: 'published',
      isoDate: 'not-a-valid-date',
      time: '10:00 AM IST',
      spotsLeft: 10,
    };
    const resInvalid = checkBookingEligibility(invalidIsoEvent, 1);
    assert.equal(resInvalid.eligible, false);
    assert.equal(resInvalid.reason, 'INVALID_START_TIME');

    // Ambiguous: 00:00 UTC and completely missing/invalid time
    const ambiguousEvent = {
      status: 'published',
      isoDate: new Date('2026-11-20T00:00:00.000Z'),
      time: 'invalid time string',
      spotsLeft: 10,
    };
    const resAmbiguous = checkBookingEligibility(ambiguousEvent, 1);
    assert.equal(resAmbiguous.eligible, false);
    assert.equal(resAmbiguous.reason, 'INVALID_START_TIME');
  });

  // =========================================================================
  // TEST 6: Flow 1 - createBooking rejects past/started free event
  // =========================================================================
  await t.test('6. POST /api/bookings enforces cutoff on free bookings and past events', async () => {
    const pastFreeEvent = await Event.create({
      title: `Past Free Event ${runId}`,
      tagline: 'Should never allow booking',
      description: 'Past free event description',
      category: 'Technology & Hackathons',
      date: 'Oct 17, 2026',
      isoDate: new Date(Date.now() - 5 * 24 * 3600 * 1000), // 5 days ago
      time: '10:00 AM IST',
      city: 'Bengaluru',
      venue: 'Online Virtual Hall',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    const { req, res, next, getStatus, getData } = createMockReqRes({
      user: attendeeUser,
      body: {
        eventId: pastFreeEvent._id.toString(),
        quantity: 1,
      },
    });

    await createBooking(req, res, next);
    assert.equal(getStatus(), 400, 'Should reject booking for past event with 400');
    assert.equal(getData().reason, 'EVENT_ALREADY_STARTED');
    assert.equal(getData().success, false);

    // Verify inventory was NOT decremented
    const refetchedEvent = await Event.findById(pastFreeEvent._id);
    assert.equal(refetchedEvent.spotsLeft, 50, 'Spots left must not change');

    // Verify zero tickets were created
    const tickets = await Ticket.find({ eventId: pastFreeEvent._id });
    assert.equal(tickets.length, 0, 'No tickets should be issued for past event');
  });

  // =========================================================================
  // TEST 7: Flow 2 - createOrder rejects order retry after event cutoff
  // =========================================================================
  await t.test('7. POST /api/payments/create-order rejects order creation after event cutoff', async () => {
    // Event that started 10 minutes ago
    const startedPaidEvent = await Event.create({
      title: `Started Paid Event ${runId}`,
      tagline: 'Paid concert that just started',
      description: 'Music event',
      category: 'Music & Concerts',
      date: 'Today',
      isoDate: new Date(Date.now() - 10 * 60 * 1000), // started 10m ago
      time: '10:00 AM IST',
      city: 'Bengaluru',
      venue: 'Open Grounds',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 20,
      totalCapacity: 25,
      status: 'published',
    });

    // Existing pending booking with held spot
    const pendingBooking = await Booking.create({
      bookingReference: `UTS-CUTOFF-ORD-${runId}`,
      userId: attendeeUser._id,
      eventId: startedPaidEvent._id,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // active hold
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const { req, res, next, getStatus, getData } = createMockReqRes({
      user: attendeeUser,
      body: { bookingId: pendingBooking._id.toString() },
    });

    await createOrder(req, res, next);
    assert.equal(getStatus(), 400, 'createOrder must return 400 when event has started');
    assert.equal(getData().reason, 'EVENT_ALREADY_STARTED');

    // Verify hold was released and booking cancelled
    const updatedBooking = await Booking.findById(pendingBooking._id);
    assert.equal(updatedBooking.status, 'cancelled');
    assert.ok(updatedBooking.cancellationReason.includes('started or concluded'));

    // Verify spotsLeft was restored
    const updatedEvent = await Event.findById(startedPaidEvent._id);
    assert.equal(updatedEvent.spotsLeft, 21, 'Inventory spots must be restored');
  });

  // =========================================================================
  // TEST 8: Flow 3 - verifyPayment rejects confirmation after event cutoff
  // =========================================================================
  await t.test('8. POST /api/payments/verify rejects confirmation and issues refund after cutoff', async () => {
    const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_for_signature_verification_123';
    process.env.RAZORPAY_KEY_SECRET = secret;

    const startedEvent = await Event.create({
      title: `Event for Verify Cutoff ${runId}`,
      tagline: 'Event started before verification',
      description: 'Verification test event',
      category: 'Workshops & Masterclasses',
      date: 'Today',
      isoDate: new Date(Date.now() - 30 * 60 * 1000), // started 30 mins ago
      time: '10:00 AM IST',
      city: 'Delhi',
      venue: 'Auditorium',
      price: '₹300',
      priceNumber: 300,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const pendingBooking = await Booking.create({
      bookingReference: `UTS-CUTOFF-VRF-${runId}`,
      userId: attendeeUser._id,
      eventId: startedEvent._id,
      quantity: 1,
      unitPrice: 300,
      totalAmount: 300,
      status: 'pending',
      paymentStatus: 'pending',
      razorpayOrderId: `order_sim_${runId}`,
      holdExpiresAt: new Date(Date.now() + 8 * 60 * 1000),
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const testPaymentId = `pay_Simulated_${runId}`;
    const payload = `${pendingBooking.razorpayOrderId}|${testPaymentId}`;
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const { req, res, next, getStatus, getData } = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: pendingBooking._id.toString(),
        razorpay_order_id: pendingBooking.razorpayOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      },
    });

    await verifyPayment(req, res, next);
    assert.equal(getStatus(), 400, 'verifyPayment should return 400 when event cutoff passed');
    assert.equal(getData().reason, 'EVENT_CUTOFF_PASSED');

    // Verify booking updated safely without corrupting payment evidence
    const refetchedBooking = await Booking.findById(pendingBooking._id);
    assert.equal(refetchedBooking.status, 'cancelled');
    assert.equal(refetchedBooking.paymentStatus, 'refunded');
    assert.equal(refetchedBooking.razorpayPaymentId, testPaymentId, 'Payment evidence must be recorded');
    assert.equal(refetchedBooking.transactionReference, testPaymentId);
    assert.ok(refetchedBooking.paidAt instanceof Date, 'paidAt timestamp must be recorded');
    assert.ok(refetchedBooking.refundStatus === 'processed' || refetchedBooking.refundStatus === 'initiated');

    // Verify NO tickets were issued
    const issuedTickets = await Ticket.find({ bookingId: pendingBooking._id });
    assert.equal(issuedTickets.length, 0, 'No tickets should be issued when cutoff has passed');

    // Verify inventory restored
    const refetchedEvent = await Event.findById(startedEvent._id);
    assert.equal(refetchedEvent.spotsLeft, 10, 'Held spot must be restored');
  });

  // =========================================================================
  // TEST 9: Existing confirmed historical booking and tickets remain intact
  // =========================================================================
  await t.test('9. Existing confirmed historical booking and tickets remain intact', async () => {
    const historicalEvent = await Event.create({
      title: `Historical Oct 17 Event ${runId}`,
      tagline: 'Event from the past with genuine tickets',
      description: 'Historical event',
      category: 'Cultural & Festivals',
      date: 'Oct 17, 2026',
      isoDate: new Date('2026-10-17T04:30:00.000Z'),
      time: '10:00 AM IST',
      city: 'Jaipur',
      venue: 'Palace Grounds',
      price: '₹1000',
      priceNumber: 1000,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 0,
      totalCapacity: 50,
      status: 'published',
    });

    const historicalBooking = await Booking.create({
      bookingReference: `UTS-HIST-${runId}`,
      userId: attendeeUser._id,
      eventId: historicalEvent._id,
      quantity: 1,
      unitPrice: 1000,
      totalAmount: 1000,
      status: 'confirmed',
      paymentStatus: 'completed',
      razorpayOrderId: `order_hist_${runId}`,
      razorpayPaymentId: `pay_hist_${runId}`,
      transactionReference: `pay_hist_${runId}`,
      paidAt: new Date('2026-10-15T12:00:00.000Z'),
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const historicalTicket = await Ticket.create({
      ticketCode: `TKT-HIST-${runId}`,
      bookingId: historicalBooking._id,
      bookingReference: historicalBooking.bookingReference,
      eventId: historicalEvent._id,
      userId: attendeeUser._id,
      attendeeName: attendeeUser.name,
      qrData: JSON.stringify({ tkt: `TKT-HIST-${runId}`, app: 'UTSAV' }),
      status: 'valid',
    });

    // Check that historical booking and ticket remain unchanged
    const b = await Booking.findById(historicalBooking._id);
    assert.equal(b.status, 'confirmed', 'Historical booking must remain confirmed');
    assert.equal(b.paymentStatus, 'completed');

    const tkt = await Ticket.findById(historicalTicket._id);
    assert.equal(tkt.status, 'valid', 'Historical ticket must remain valid');
  });

  // =========================================================================
  // TEST 10: Repeated verification preserves idempotency on confirmed booking
  // =========================================================================
  await t.test('10. Repeated verification preserves idempotency on confirmed booking', async () => {
    const historicalEvent = await Event.findOne({ title: `Historical Oct 17 Event ${runId}` });
    const historicalBooking = await Booking.findOne({ bookingReference: `UTS-HIST-${runId}` });

    const secret = process.env.RAZORPAY_KEY_SECRET;
    const testPaymentId = historicalBooking.razorpayPaymentId;
    const payload = `${historicalBooking.razorpayOrderId}|${testPaymentId}`;
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    const { req, res, next, getStatus, getData } = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: historicalBooking._id.toString(),
        razorpay_order_id: historicalBooking.razorpayOrderId,
        razorpay_payment_id: testPaymentId,
        razorpay_signature: validSignature,
      },
    });

    await verifyPayment(req, res, next);
    assert.equal(getStatus(), 200, 'Idempotent verify must return 200');
    assert.equal(getData().alreadyProcessed, true);
    assert.equal(getData().booking.status, 'confirmed');
    assert.equal(getData().tickets.length, 1);
  });

  // =========================================================================
  // TEST 11: Inventory atomicity and single restoration
  // =========================================================================
  await t.test('11. Inventory never becomes negative and hold restoration is not duplicated', async () => {
    const limitedEvent = await Event.create({
      title: `Limited Event ${runId}`,
      tagline: 'Only 1 spot available',
      description: 'Inventory concurrency test',
      category: 'Sports & Fitness',
      date: 'Tomorrow',
      isoDate: new Date(Date.now() + 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'Club Stadium',
      price: 'Free',
      priceNumber: 0,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 1,
      totalCapacity: 1,
      status: 'published',
    });

    // Attempt booking 2 spots when only 1 is left
    const { req: reqTooMany, res: resTooMany, next: nextTooMany, getStatus: getStatusTooMany, getData: getDataTooMany } =
      createMockReqRes({
        user: attendeeUser,
        body: { eventId: limitedEvent._id.toString(), quantity: 2 },
      });

    await createBooking(reqTooMany, resTooMany, nextTooMany);
    assert.equal(getStatusTooMany(), 400);
    assert.equal(getDataTooMany().reason, 'INSUFFICIENT_CAPACITY');

    const eventAfterFailed = await Event.findById(limitedEvent._id);
    assert.equal(eventAfterFailed.spotsLeft, 1, 'Spots left must not change or go negative');

    // Test hold release idempotency: releaseSingleBookingHold called twice does not restore twice
    const bookingForHold = await Booking.create({
      bookingReference: `UTS-HOLD-DUP-${runId}`,
      userId: attendeeUser._id,
      eventId: limitedEvent._id,
      quantity: 1,
      status: 'pending',
      paymentStatus: 'pending',
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    // First release
    await releaseSingleBookingHold(bookingForHold, 'Test release 1');
    const eventAfterRel1 = await Event.findById(limitedEvent._id);
    assert.equal(eventAfterRel1.spotsLeft, 2, 'Spots left should increment by 1 on first release');

    // Second release on same booking
    const refetchedBooking = await Booking.findById(bookingForHold._id);
    await releaseSingleBookingHold(refetchedBooking, 'Test release 2');
    const eventAfterRel2 = await Event.findById(limitedEvent._id);
    assert.equal(eventAfterRel2.spotsLeft, 2, 'Spots left must NOT increment a second time');
  });
});
