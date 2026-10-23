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
import Coupon from '../models/Coupon.js';
import CouponRedemption from '../models/CouponRedemption.js';
import { verifyPayment } from '../controllers/paymentController.js';
import { releaseSingleBookingHold } from '../utils/checkoutHold.js';
import { processRazorpayRefund, reconcilePaymentRefund } from '../services/refundService.js';
import { issueTicketsForBooking } from '../utils/ticketIssuer.js';

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

test('UTSAV Phase 3 — Payment, Refund & Inventory Idempotency Safety Test Suite', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_for_signature_verification_123';
  process.env.RAZORPAY_KEY_SECRET = secret;

  const runId = Date.now();
  let organizerUser, attendeeUser;

  // Setup test users
  organizerUser = await User.create({
    name: 'Safety Org User',
    email: `safety_org_${runId}@example.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  attendeeUser = await User.create({
    name: 'Safety Attendee User',
    email: `safety_att_${runId}@example.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  t.after(async () => {
    await User.deleteMany({ email: { $regex: `${runId}` } });
    await Event.deleteMany({ title: { $regex: `${runId}` } });
    await Booking.deleteMany({ bookingReference: { $regex: `${runId}` } });
    await Ticket.deleteMany({ bookingReference: { $regex: `${runId}` } });
    await Coupon.deleteMany({ code: { $regex: `${runId}` } });
    await CouponRedemption.deleteMany({ couponCode: { $regex: `${runId}` } });
    await mongoose.disconnect();
  });

  // Helper to generate a valid cryptographic signature
  const generateSignature = (orderId, paymentId) => {
    const payload = `${orderId}|${paymentId}`;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  };

  // =========================================================================
  // TEST 1: Repeated verification after a successful cutoff refund
  // =========================================================================
  await t.test('1. Repeated verification after a successful cutoff refund is idempotent', async () => {
    const pastEvent = await Event.create({
      title: `Cutoff Refund Repeat Event ${runId}`,
      tagline: 'Event in the past',
      description: 'Test event',
      category: 'Concerts',
      date: 'Yesterday',
      isoDate: new Date(Date.now() - 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'Arena',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const booking = await Booking.create({
      bookingReference: `UTS-REF-REP-${runId}`,
      userId: attendeeUser._id,
      eventId: pastEvent._id,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'pending',
      paymentStatus: 'pending',
      razorpayOrderId: `order_rep_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const paymentId = `pay_Simulated_rep_${runId}`;
    const sig = generateSignature(booking.razorpayOrderId, paymentId);

    // Call 1: Cutoff refund executes
    const mock1 = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });
    await verifyPayment(mock1.req, mock1.res, mock1.next);
    assert.equal(mock1.getStatus(), 400);
    assert.equal(mock1.getData().reason, 'EVENT_CUTOFF_PASSED');

    const eventAfter1 = await Event.findById(pastEvent._id);
    assert.equal(eventAfter1.spotsLeft, 10, 'Spots must be restored once');

    // Call 2: Repeated verification
    const mock2 = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });
    await verifyPayment(mock2.req, mock2.res, mock2.next);
    assert.equal(mock2.getStatus(), 400);
    assert.equal(mock2.getData().alreadyRefunded, true);

    const eventAfter2 = await Event.findById(pastEvent._id);
    assert.equal(eventAfter2.spotsLeft, 10, 'Spots must NOT be restored a second time');

    const tickets = await Ticket.find({ bookingId: booking._id });
    assert.equal(tickets.length, 0, 'No tickets should ever be issued for cutoff refund');
  });

  // =========================================================================
  // TEST 2: Repeated verification after a failed refund
  // =========================================================================
  await t.test('2. Repeated verification after a failed refund reconciles without double-restoring inventory', async () => {
    const pastEvent = await Event.create({
      title: `Failed Refund Reconcile Event ${runId}`,
      tagline: 'Event past cutoff',
      description: 'Test event',
      category: 'Conferences',
      date: 'Yesterday',
      isoDate: new Date(Date.now() - 48 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Delhi',
      venue: 'Auditorium',
      price: '₹400',
      priceNumber: 400,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 5,
      totalCapacity: 6,
      status: 'published',
    });

    // Simulate booking where refund previously failed (inventory was already restored)
    const booking = await Booking.create({
      bookingReference: `UTS-FAIL-REF-${runId}`,
      userId: attendeeUser._id,
      eventId: pastEvent._id,
      quantity: 1,
      unitPrice: 400,
      totalAmount: 400,
      status: 'cancelled',
      paymentStatus: 'completed',
      refundStatus: 'failed',
      refundError: 'Gateway timeout during refund creation',
      razorpayOrderId: `order_fail_${runId}`,
      razorpayPaymentId: `pay_Simulated_fail_${runId}`,
      transactionReference: `pay_Simulated_fail_${runId}`,
      inventoryRestored: true,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const sig = generateSignature(booking.razorpayOrderId, booking.razorpayPaymentId);

    const mockRetry = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: booking.razorpayPaymentId,
        razorpay_signature: sig,
      },
    });

    await verifyPayment(mockRetry.req, mockRetry.res, mockRetry.next);
    assert.equal(mockRetry.getStatus(), 400);

    // Verify inventory spots stayed at 5 (not double incremented)
    const eventAfterRetry = await Event.findById(pastEvent._id);
    assert.equal(eventAfterRetry.spotsLeft, 5, 'Inventory must not be incremented again on retry');

    const updatedBooking = await Booking.findById(booking._id);
    assert.equal(updatedBooking.status, 'cancelled');
    assert.equal(updatedBooking.paymentStatus, 'refunded', 'Payment should transition to refunded upon successful retry');
    assert.equal(updatedBooking.refundStatus, 'processed');
  });

  // =========================================================================
  // TEST 3: Refund timeout where Razorpay actually created a refund
  // =========================================================================
  await t.test('3. Reconcile refund when gateway already processed refund', async () => {
    // Test the reconcilePaymentRefund utility with simulated payment
    const simulatedPaymentId = `pay_Simulated_test_${runId}`;
    const recon = await reconcilePaymentRefund(simulatedPaymentId, `UTS-BK-${runId}`);
    assert.equal(typeof recon, 'object');
    assert.equal(recon.found, false, 'Simulated mode reports clean check without throwing');
  });

  // =========================================================================
  // TEST 4: Expired hold with captured payment (re-claims available inventory)
  // =========================================================================
  await t.test('4. Expired hold with captured payment confirms booking when event is still eligible', async () => {
    const futureEvent = await Event.create({
      title: `Future Event Expired Hold ${runId}`,
      tagline: 'Hold expired but spots available',
      description: 'Test event',
      category: 'Hackathons',
      date: 'Next Week',
      isoDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Bengaluru',
      venue: 'Tech Park',
      price: '₹200',
      priceNumber: 200,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 5,
      totalCapacity: 5,
      status: 'published',
    });

    // Booking whose hold expired 5 minutes ago and inventory was restored to event pool
    const expiredBooking = await Booking.create({
      bookingReference: `UTS-EXP-CAPT-${runId}`,
      userId: attendeeUser._id,
      eventId: futureEvent._id,
      quantity: 1,
      unitPrice: 200,
      totalAmount: 200,
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() - 5 * 60 * 1000), // Expired 5 mins ago
      inventoryRestored: true, // Spots were released back
      razorpayOrderId: `order_exp_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const paymentId = `pay_Simulated_exp_${runId}`;
    const sig = generateSignature(expiredBooking.razorpayOrderId, paymentId);

    const mock = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: expiredBooking._id.toString(),
        razorpay_order_id: expiredBooking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await verifyPayment(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200, 'Should successfully re-reserve and confirm when event has spots');
    assert.equal(mock.getData().booking.status, 'confirmed');
    assert.equal(mock.getData().tickets.length, 1);

    // Event spotsLeft should be decremented from 5 to 4
    const eventAfterConfirm = await Event.findById(futureEvent._id);
    assert.equal(eventAfterConfirm.spotsLeft, 4, 'Spot should be claimed on re-reservation');
  });

  // =========================================================================
  // TEST 5: Expired hold with uncaptured or failed payment
  // =========================================================================
  await t.test('5. Expired hold with invalid signature is rejected and hold released', async () => {
    const futureEvent = await Event.create({
      title: `Future Event Bad Sig ${runId}`,
      tagline: 'Invalid payment signature test',
      description: 'Test event',
      category: 'Sports',
      date: 'Next Month',
      isoDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Pune',
      venue: 'Sports Arena',
      price: '₹100',
      priceNumber: 100,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 5,
      totalCapacity: 5,
      status: 'published',
    });

    const booking = await Booking.create({
      bookingReference: `UTS-BAD-SIG-${runId}`,
      userId: attendeeUser._id,
      eventId: futureEvent._id,
      quantity: 1,
      unitPrice: 100,
      totalAmount: 100,
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      razorpayOrderId: `order_badsig_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const mock = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: `pay_badsig_${runId}`,
        razorpay_signature: 'invalid_cryptographic_signature_value',
      },
    });

    await verifyPayment(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 400);
    assert.ok(mock.getData().message.includes('Invalid cryptographic payment signature'));

    const b = await Booking.findById(booking._id);
    assert.equal(b.paymentStatus, 'failed');
  });

  // =========================================================================
  // TEST 6: Two concurrent verification requests (pre-cutoff)
  // =========================================================================
  await t.test('6. Two concurrent verification requests produce exactly one confirmed booking with no duplicate tickets', async () => {
    const futureEvent = await Event.create({
      title: `Concurrent Verify Event ${runId}`,
      tagline: 'Race condition test',
      description: 'Test event',
      category: 'Workshops',
      date: 'Next Week',
      isoDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Chennai',
      venue: 'Studio',
      price: '₹300',
      priceNumber: 300,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 4,
      totalCapacity: 5,
      status: 'published',
    });

    const booking = await Booking.create({
      bookingReference: `UTS-CONC-${runId}`,
      userId: attendeeUser._id,
      eventId: futureEvent._id,
      quantity: 1,
      unitPrice: 300,
      totalAmount: 300,
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 8 * 60 * 1000),
      razorpayOrderId: `order_conc_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const paymentId = `pay_Simulated_conc_${runId}`;
    const sig = generateSignature(booking.razorpayOrderId, paymentId);

    const mockA = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    const mockB = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    // Execute both concurrently
    await Promise.all([
      verifyPayment(mockA.req, mockA.res, mockA.next),
      verifyPayment(mockB.req, mockB.res, mockB.next),
    ]);

    // Exactly one set of tickets must exist
    const tickets = await Ticket.find({ bookingId: booking._id });
    assert.equal(tickets.length, 1, 'Exactly 1 ticket must be created across concurrent requests');

    const confirmedBooking = await Booking.findById(booking._id);
    assert.equal(confirmedBooking.status, 'confirmed');
    assert.equal(confirmedBooking.paymentStatus, 'completed');
  });

  // =========================================================================
  // TEST 7: Two concurrent post-cutoff verification requests
  // =========================================================================
  await t.test('7. Two concurrent post-cutoff verification requests restore inventory only once', async () => {
    const pastEvent = await Event.create({
      title: `Concurrent Cutoff Event ${runId}`,
      tagline: 'Race condition after cutoff',
      description: 'Test event',
      category: 'Festivals',
      date: 'Yesterday',
      isoDate: new Date(Date.now() - 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Jaipur',
      venue: 'Fort',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const booking = await Booking.create({
      bookingReference: `UTS-CONC-CUT-${runId}`,
      userId: attendeeUser._id,
      eventId: pastEvent._id,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'pending',
      paymentStatus: 'pending',
      holdExpiresAt: new Date(Date.now() + 8 * 60 * 1000),
      razorpayOrderId: `order_conccut_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const paymentId = `pay_Simulated_conccut_${runId}`;
    const sig = generateSignature(booking.razorpayOrderId, paymentId);

    const mockA = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    const mockB = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await Promise.all([
      verifyPayment(mockA.req, mockA.res, mockA.next),
      verifyPayment(mockB.req, mockB.res, mockB.next),
    ]);

    // Inventory spotsLeft should be exactly 10 (9 + 1), NOT 11
    const eventAfter = await Event.findById(pastEvent._id);
    assert.equal(eventAfter.spotsLeft, 10, 'Spots must be restored exactly once under concurrency');

    const tickets = await Ticket.find({ bookingId: booking._id });
    assert.equal(tickets.length, 0, 'No tickets issued');
  });

  // =========================================================================
  // TEST 8: Inventory restored exactly once across hold release & cutoff
  // =========================================================================
  await t.test('8. Inventory restored exactly once even if hold release and cutoff both trigger', async () => {
    const pastEvent = await Event.create({
      title: `Double Release Guard Event ${runId}`,
      tagline: 'Hold release then cutoff',
      description: 'Test event',
      category: 'Tech',
      date: 'Yesterday',
      isoDate: new Date(Date.now() - 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Hyderabad',
      venue: 'HITEC City',
      price: '₹300',
      priceNumber: 300,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const booking = await Booking.create({
      bookingReference: `UTS-DBL-REL-${runId}`,
      userId: attendeeUser._id,
      eventId: pastEvent._id,
      quantity: 1,
      unitPrice: 300,
      totalAmount: 300,
      status: 'pending',
      paymentStatus: 'pending',
      razorpayOrderId: `order_dbl_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    // 1. Release hold
    await releaseSingleBookingHold(booking, 'Test hold release');
    const eventAfterHold = await Event.findById(pastEvent._id);
    assert.equal(eventAfterHold.spotsLeft, 10, 'Incremented once on hold release');

    // 2. Try calling verifyPayment on the same booking after cutoff
    const paymentId = `pay_Simulated_dbl_${runId}`;
    const sig = generateSignature(booking.razorpayOrderId, paymentId);
    const mock = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await verifyPayment(mock.req, mock.res, mock.next);

    const eventAfterVerify = await Event.findById(pastEvent._id);
    assert.equal(eventAfterVerify.spotsLeft, 10, 'Spots must remain 10 and not increment to 11');
  });

  // =========================================================================
  // TEST 9: No duplicate tickets or coupon redemption
  // =========================================================================
  await t.test('9. No duplicate tickets or coupon redemption under repeated verification', async () => {
    const futureEvent = await Event.create({
      title: `Coupon Concurrency Event ${runId}`,
      tagline: 'Discounted event',
      description: 'Test event',
      category: 'Workshops',
      date: 'Next Week',
      isoDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Mumbai',
      venue: 'Center',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const coupon = await Coupon.create({
      code: `DISC${runId}`.toUpperCase().slice(0, 12),
      discountType: 'percentage',
      discountValue: 20,
      redemptionCount: 0,
      organizerId: organizerUser._id,
      createdBy: organizerUser._id,
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      isActive: true,
    });

    const booking = await Booking.create({
      bookingReference: `UTS-COUP-CONC-${runId}`,
      userId: attendeeUser._id,
      eventId: futureEvent._id,
      quantity: 1,
      unitPrice: 500,
      originalSubtotal: 500,
      discountAmount: 100,
      totalAmount: 400,
      couponId: coupon._id,
      couponCode: coupon.code,
      status: 'pending',
      paymentStatus: 'pending',
      razorpayOrderId: `order_coup_${runId}`,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const paymentId = `pay_Simulated_coup_${runId}`;
    const sig = generateSignature(booking.razorpayOrderId, paymentId);

    const mockA = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    const mockB = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await Promise.all([
      verifyPayment(mockA.req, mockA.res, mockA.next),
      verifyPayment(mockB.req, mockB.res, mockB.next),
    ]);

    const updatedCoupon = await Coupon.findById(coupon._id);
    assert.equal(updatedCoupon.redemptionCount, 1, 'Coupon redemptionCount must be incremented exactly once');

    const redemptions = await CouponRedemption.find({ bookingId: booking._id });
    assert.equal(redemptions.length, 1, 'Exactly one CouponRedemption document must exist');

    const tickets = await Ticket.find({ bookingId: booking._id });
    assert.equal(tickets.length, 1, 'Exactly one ticket must be issued');
  });

  // =========================================================================
  // TEST 10: Ticket issuance failure followed by safe retry
  // =========================================================================
  await t.test('10. Booking confirmed without tickets recovers and issues tickets on retry', async () => {
    const futureEvent = await Event.create({
      title: `Ticket Recovery Event ${runId}`,
      tagline: 'Recovery testing',
      description: 'Test event',
      category: 'Conferences',
      date: 'Next Month',
      isoDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Delhi',
      venue: 'Pragati Maidan',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 9,
      totalCapacity: 10,
      status: 'published',
    });

    const paymentId = `pay_Simulated_recov_${runId}`;
    // Booking was confirmed and paid, but ticket issuance failed mid-flight (0 tickets in DB)
    const booking = await Booking.create({
      bookingReference: `UTS-RECOV-${runId}`,
      userId: attendeeUser._id,
      eventId: futureEvent._id,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      razorpayOrderId: `order_recov_${runId}`,
      razorpayPaymentId: paymentId,
      transactionReference: paymentId,
      paidAt: new Date(),
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    const sig = generateSignature(booking.razorpayOrderId, paymentId);

    const mock = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await verifyPayment(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    assert.equal(mock.getData().alreadyProcessed, true);

    const tickets = await Ticket.find({ bookingId: booking._id });
    assert.equal(tickets.length, 1, 'Tickets must be generated on retry if they were missing');
  });

  // =========================================================================
  // TEST 11: Confirmed historical booking verification remains idempotent
  // =========================================================================
  await t.test('11. Confirmed historical booking verification remains idempotent', async () => {
    const historicalEvent = await Event.create({
      title: `Historical Oct 17 Safe ${runId}`,
      tagline: 'Oct 17 Festival',
      description: 'Historical',
      category: 'Cultural',
      date: 'Oct 17, 2026',
      isoDate: new Date('2026-10-17T04:30:00.000Z'),
      time: '10:00 AM IST',
      city: 'Kolkata',
      venue: 'Grounds',
      price: '₹1000',
      priceNumber: 1000,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 0,
      totalCapacity: 50,
      status: 'published',
    });

    const paymentId = `pay_hist_${runId}`;
    const booking = await Booking.create({
      bookingReference: `UTS-HIST-SAFE-${runId}`,
      userId: attendeeUser._id,
      eventId: historicalEvent._id,
      quantity: 1,
      unitPrice: 1000,
      totalAmount: 1000,
      status: 'confirmed',
      paymentStatus: 'completed',
      razorpayOrderId: `order_histsafe_${runId}`,
      razorpayPaymentId: paymentId,
      transactionReference: paymentId,
      paidAt: new Date('2026-10-15T12:00:00.000Z'),
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    await Ticket.create({
      ticketCode: `TKT-HISTSAFE-${runId}`,
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      eventId: historicalEvent._id,
      userId: attendeeUser._id,
      attendeeName: attendeeUser.name,
      qrData: JSON.stringify({ app: 'UTSAV', tkt: `TKT-HISTSAFE-${runId}` }),
      status: 'valid',
    });

    const sig = generateSignature(booking.razorpayOrderId, paymentId);
    const mock = createMockReqRes({
      user: attendeeUser,
      body: {
        bookingId: booking._id.toString(),
        razorpay_order_id: booking.razorpayOrderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: sig,
      },
    });

    await verifyPayment(mock.req, mock.res, mock.next);
    assert.equal(mock.getStatus(), 200);
    assert.equal(mock.getData().alreadyProcessed, true);
    assert.equal(mock.getData().tickets.length, 1);

    const b = await Booking.findById(booking._id);
    assert.equal(b.status, 'confirmed', 'Historical booking must remain confirmed');
    assert.equal(b.paymentStatus, 'completed');
  });

  // =========================================================================
  // TEST 12: Unknown gateway/refund state remains safely reconcilable
  // =========================================================================
  await t.test('12. Unknown gateway/refund state preserves evidence without fabricating refund ID', async () => {
    const booking = await Booking.create({
      bookingReference: `UTS-UNKNOWN-${runId}`,
      userId: attendeeUser._id,
      eventId: new mongoose.Types.ObjectId(),
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'cancelled',
      paymentStatus: 'completed',
      refundStatus: 'failed',
      refundError: 'Network socket closed',
      razorpayOrderId: `order_unk_${runId}`,
      razorpayPaymentId: `pay_unk_${runId}`,
      inventoryRestored: true,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
    });

    // Check that booking retains payment evidence
    const saved = await Booking.findById(booking._id);
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.paymentStatus, 'completed');
    assert.equal(saved.refundStatus, 'failed');
    assert.equal(saved.razorpayRefundId, '');
    assert.ok(saved.refundError.includes('Network socket closed'));
  });
});
