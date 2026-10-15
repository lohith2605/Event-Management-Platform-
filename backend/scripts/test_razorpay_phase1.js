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
import Notification from '../src/models/Notification.js';

const BASE_URL = 'http://127.0.0.1:5000';

function generateAuthToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('================================================================');
  console.log('💳 UTSAV PLATFORM - RAZORPAY PAYMENT INTEGRATION PHASE 1 TESTS');
  console.log('================================================================\n');

  let organizer, attendeeA, attendeeB;
  let freeEvent, paidEvent;
  const testRunId = Date.now();

  try {
    await connectDB();

    console.log('⚙️ Environment Check:');
    console.log('   - RAZORPAY_KEY_ID present:', !!process.env.RAZORPAY_KEY_ID, `(${process.env.RAZORPAY_KEY_ID || 'missing'})`);
    console.log('   - RAZORPAY_KEY_SECRET present:', !!process.env.RAZORPAY_KEY_SECRET, `(${process.env.RAZORPAY_KEY_SECRET ? 'configured [redacted]' : 'missing'})`);
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('Razorpay Test credentials are missing from backend/.env');
    }

    // 1. Setup Test Users
    console.log('\n--- Setting up test users ---');
    organizer = await User.create({
      name: 'Organizer Test',
      email: `org_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeA = await User.create({
      name: 'Attendee Alpha',
      email: `attendee_a_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    attendeeB = await User.create({
      name: 'Attendee Beta',
      email: `attendee_b_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    const tokenA = generateAuthToken(attendeeA);
    const tokenB = generateAuthToken(attendeeB);

    console.log('Created Organizer and 2 Attendees with JWT auth.');

    // 2. Setup Events
    console.log('\n--- Setting up test events ---');
    freeEvent = await Event.create({
      title: `Free Tech Talk ${testRunId}`,
      tagline: 'Community tech gathering',
      description: 'A free community session on technology.',
      date: 'Nov 20, 2026',
      isoDate: new Date('2026-11-20T18:00:00.000Z'),
      time: '18:00',
      venue: 'UTSAV Tech Hub',
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

    paidEvent = await Event.create({
      title: `Grand Music Concert ${testRunId}`,
      tagline: 'Live evening musical concert',
      description: 'Live performance and music concert.',
      date: 'Dec 01, 2026',
      isoDate: new Date('2026-12-01T19:30:00.000Z'),
      time: '19:30',
      venue: 'UTSAV Arena',
      city: 'Mumbai',
      category: 'Music',
      price: '₹250',
      priceNumber: 250,
      totalCapacity: 50,
      spotsLeft: 50,
      status: 'published',
      organizer: organizer.name,
      organizerId: organizer._id,
      ticketTiers: [{ name: 'General Admission', price: 250, capacity: 50, spotsLeft: 50 }],
    });

    console.log(`Created Free Event: "${freeEvent.title}" (₹0, capacity: 50)`);
    console.log(`Created Paid Event: "${paidEvent.title}" (₹250, capacity: 50)`);

    // =========================================================================
    // TEST 1: Free Event Booking Flow (Preserve Zero-Fee Architecture)
    // =========================================================================
    console.log('\n--- TEST 1: Free Event Booking Flow ---');
    const freeRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        eventId: freeEvent._id,
        quantity: 2,
        ticketType: 'Standard Pass',
      }),
    });
    const freeData = await freeRes.json();
    console.log('Free booking response status:', freeRes.status);
    console.log('Free booking status:', freeData.booking?.status);
    console.log('Free booking paymentStatus:', freeData.booking?.paymentStatus);
    console.log('Free booking tickets issued:', freeData.tickets?.length);

    if (
      freeRes.status !== 201 ||
      freeData.booking?.status !== 'confirmed' ||
      freeData.booking?.paymentStatus !== 'free' ||
      freeData.tickets?.length !== 2 ||
      freeData.order !== null
    ) {
      throw new Error('Test 1 Failed: Free booking did not confirm immediately or improperly created order.');
    }

    const freeEventAfter = await Event.findById(freeEvent._id);
    if (freeEventAfter.spotsLeft !== 48) {
      throw new Error(`Test 1 Failed: Spots left expected 48, got ${freeEventAfter.spotsLeft}`);
    }
    console.log('✅ PASS: Free event booking immediately confirmed, issued QR passes, deducted spots, and bypassed payment gateway.');

    // =========================================================================
    // TEST 2: Paid Event Booking Flow (Real Razorpay Test Order + 10m Hold)
    // =========================================================================
    console.log('\n--- TEST 2: Paid Event Booking Flow (Razorpay Order & 10m Hold) ---');
    const paidRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        eventId: paidEvent._id,
        quantity: 2,
        ticketType: 'General Admission',
      }),
    });
    const paidData = await paidRes.json();
    console.log('Paid booking response status:', paidRes.status);
    console.log('Paid booking status:', paidData.booking?.status);
    console.log('Paid booking paymentStatus:', paidData.booking?.paymentStatus);
    console.log('Hold expires at:', paidData.booking?.holdExpiresAt);
    console.log('Razorpay Order ID:', paidData.order?.id);
    console.log('Razorpay Amount (paise):', paidData.order?.amount);

    if (
      paidRes.status !== 201 ||
      paidData.booking?.status !== 'pending' ||
      paidData.booking?.paymentStatus !== 'pending' ||
      !paidData.order?.id?.startsWith('order_') ||
      paidData.order?.amount !== 50000 // 2 * 250 * 100 paise
    ) {
      throw new Error('Test 2 Failed: Paid booking order creation failed or invalid status.');
    }

    // Capacity must be reserved
    const paidEventAfter = await Event.findById(paidEvent._id);
    if (paidEventAfter.spotsLeft !== 48) {
      throw new Error(`Test 2 Failed: Spots left expected 48, got ${paidEventAfter.spotsLeft}`);
    }

    // Tickets must NOT be issued yet
    const ticketsBeforePay = await Ticket.find({ bookingId: paidData.booking._id });
    if (ticketsBeforePay.length !== 0) {
      throw new Error('Test 2 Failed: Tickets were prematurely issued before payment confirmation!');
    }
    console.log('✅ PASS: Real Razorpay Test order generated, 10-minute hold initiated, spots reserved, no tickets premature issuance.');

    const bookingA = paidData.booking;
    const razorpayOrderIdA = paidData.order.id;

    // =========================================================================
    // TEST 3: Invalid Signature Verification Rejection
    // =========================================================================
    console.log('\n--- TEST 3: Invalid Signature Verification Rejection ---');
    const fakePaymentId = 'pay_FakePaymentTest12345';
    const fakeSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const invalidVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: bookingA._id,
        razorpay_order_id: razorpayOrderIdA,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
      }),
    });
    const invalidVerifyData = await invalidVerifyRes.json();
    console.log('Invalid signature response status:', invalidVerifyRes.status);
    console.log('Invalid signature response message:', invalidVerifyData.message);

    if (invalidVerifyRes.status !== 400 || invalidVerifyData.success !== false) {
      throw new Error('Test 3 Failed: Server accepted an invalid payment signature!');
    }

    const bookingAfterInvalid = await Booking.findById(bookingA._id);
    if (bookingAfterInvalid.paymentStatus !== 'failed') {
      throw new Error(`Test 3 Failed: Booking paymentStatus should be 'failed', got ${bookingAfterInvalid.paymentStatus}`);
    }
    console.log('✅ PASS: Invalid signature rejected with 400 Bad Request and booking marked as failed.');

    // =========================================================================
    // TEST 4: Timing-Safe Server Verification of Valid Signature
    // =========================================================================
    console.log('\n--- TEST 4: Timing-Safe Server Verification with Valid Signature ---');
    // In Razorpay Test Mode transactions, the client receives razorpay_payment_id and razorpay_signature.
    // The valid signature is HMAC-SHA256(order_id + "|" + payment_id, key_secret).
    const validTestPaymentId = `pay_TestSuccess_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderIdA}|${validTestPaymentId}`)
      .digest('hex');

    const validVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: bookingA._id,
        razorpay_order_id: razorpayOrderIdA,
        razorpay_payment_id: validTestPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const validVerifyData = await validVerifyRes.json();
    console.log('Valid verification response status:', validVerifyRes.status);
    console.log('Booking status after verification:', validVerifyData.booking?.status);
    console.log('Payment status after verification:', validVerifyData.booking?.paymentStatus);
    console.log('Issued tickets count:', validVerifyData.tickets?.length);

    if (
      validVerifyRes.status !== 200 ||
      validVerifyData.booking?.status !== 'confirmed' ||
      validVerifyData.booking?.paymentStatus !== 'completed' ||
      validVerifyData.tickets?.length !== 2
    ) {
      throw new Error('Test 4 Failed: Server verification failed to mark booking completed or issue tickets.');
    }

    // Verify tickets in database have valid QR security hashes
    const ticketsInDb = await Ticket.find({ bookingId: bookingA._id });
    if (ticketsInDb.length !== 2 || !ticketsInDb[0].ticketCode || !ticketsInDb[0].qrData) {
      throw new Error('Test 4 Failed: Tickets missing ticketCode or QR code payload.');
    }
    const parsedQr = JSON.parse(ticketsInDb[0].qrData);
    if (!parsedQr.sig || parsedQr.app !== 'UTSAV') {
      throw new Error('Test 4 Failed: Ticket QR data does not contain HMAC signature or app identifier.');
    }

    // Verify notification was created
    const notif = await Notification.findOne({
      userId: attendeeA._id,
      type: 'booking_confirmed',
    });
    if (!notif) {
      throw new Error('Test 4 Failed: Attendee confirmation notification was not created.');
    }

    console.log('✅ PASS: Timing-safe HMAC-SHA256 verified, booking confirmed, 2 valid QR tickets issued, notification sent.');

    // =========================================================================
    // TEST 5: Idempotency Protection (Repeated Verification Request)
    // =========================================================================
    console.log('\n--- TEST 5: Idempotency & Duplicate Protection ---');
    const repeatVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: bookingA._id,
        razorpay_order_id: razorpayOrderIdA,
        razorpay_payment_id: validTestPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const repeatVerifyData = await repeatVerifyRes.json();
    console.log('Repeated verification response status:', repeatVerifyRes.status);
    console.log('Repeated verification message:', repeatVerifyData.message);

    if (repeatVerifyRes.status !== 200 || repeatVerifyData.alreadyProcessed !== true) {
      throw new Error('Test 5 Failed: Idempotent repeat request did not return 200 with alreadyProcessed indicator.');
    }

    const allTicketsForBooking = await Ticket.find({ bookingId: bookingA._id });
    if (allTicketsForBooking.length !== 2) {
      throw new Error(`Test 5 Failed: Duplicate tickets were issued! Count: ${allTicketsForBooking.length}`);
    }

    const paidEventFinal = await Event.findById(paidEvent._id);
    if (paidEventFinal.spotsLeft !== 48) {
      throw new Error(`Test 5 Failed: Repeated verification corrupted event spotsLeft! Now ${paidEventFinal.spotsLeft}`);
    }
    console.log('✅ PASS: Repeated verification handled idempotently without duplicate tickets or capacity leakage.');

    // =========================================================================
    // TEST 6: Ownership & Cross-Account Authorization Protection
    // =========================================================================
    console.log('\n--- TEST 6: Ownership Protection (Anti-Tampering) ---');
    const tamperRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`, // Attendee B attempting to verify Attendee A's booking
      },
      body: JSON.stringify({
        bookingId: bookingA._id,
        razorpay_order_id: razorpayOrderIdA,
        razorpay_payment_id: 'pay_Tamper123',
        razorpay_signature: validSignature,
      }),
    });
    const tamperData = await tamperRes.json();
    console.log('Cross-account tamper status:', tamperRes.status);
    console.log('Cross-account tamper message:', tamperData.message);

    if (tamperRes.status !== 404 && tamperRes.status !== 403) {
      throw new Error('Test 6 Failed: Server permitted unauthorized attendee to access foreign booking.');
    }
    console.log('✅ PASS: Cross-account tampering rejected with 404/403.');

    // =========================================================================
    // TEST 7: Expired Checkout Hold Automatic Release & Inventory Rollback
    // =========================================================================
    console.log('\n--- TEST 7: Expired Checkout Hold & Capacity Rollback ---');
    // Create another booking for Attendee A
    const holdRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        eventId: paidEvent._id,
        quantity: 3,
        ticketType: 'General Admission',
      }),
    });
    const holdData = await holdRes.json();
    const holdBookingId = holdData.booking._id;

    const eventDuringHold = await Event.findById(paidEvent._id);
    console.log('Spots left during active 3-ticket hold:', eventDuringHold.spotsLeft); // Should be 45 (48 - 3)
    if (eventDuringHold.spotsLeft !== 45) {
      throw new Error(`Test 7 Failed: Spots during hold expected 45, got ${eventDuringHold.spotsLeft}`);
    }

    // Artificially expire the hold window in the database
    await Booking.findByIdAndUpdate(holdBookingId, {
      holdExpiresAt: new Date(Date.now() - 10000), // 10s in the past
    });

    // Attempt to verify payment on expired booking
    const expiredVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: holdBookingId,
        razorpay_order_id: holdData.order.id,
        razorpay_payment_id: 'pay_ExpiredAttempt123',
        razorpay_signature: 'dummy_sig',
      }),
    });
    const expiredVerifyData = await expiredVerifyRes.json();
    console.log('Expired hold verification status:', expiredVerifyRes.status);
    console.log('Expired hold response message:', expiredVerifyData.message);

    if (expiredVerifyRes.status !== 400 || expiredVerifyData.holdExpired !== true) {
      throw new Error(`Test 7 Failed: Expired hold should return 400 with holdExpired: true, got ${expiredVerifyRes.status}`);
    }

    // Verify inventory was restored to 48 (+3 returned)
    const eventAfterExpiredHold = await Event.findById(paidEvent._id);
    console.log('Spots left after expired hold released:', eventAfterExpiredHold.spotsLeft);
    if (eventAfterExpiredHold.spotsLeft !== 48) {
      throw new Error(`Test 7 Failed: Spots were not rolled back! Expected 48, got ${eventAfterExpiredHold.spotsLeft}`);
    }

    // Verify booking marked cancelled
    const bookingAfterExpiry = await Booking.findById(holdBookingId);
    if (bookingAfterExpiry.status !== 'cancelled' || !bookingAfterExpiry.cancellationReason?.includes('Checkout hold expired')) {
      throw new Error(`Test 7 Failed: Booking was not marked cancelled with hold expired reason.`);
    }
    console.log('✅ PASS: Expired hold rejected with 400 (holdExpired: true), booking cancelled, and 3 reserved tickets restored to capacity.');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 RAZORPAY PHASE 1 INTEGRATION TESTS PASSED PERFECTLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (organizer) await User.deleteMany({ _id: { $in: [organizer._id, attendeeA._id, attendeeB._id] } });
      if (freeEvent) await Event.deleteOne({ _id: freeEvent._id });
      if (paidEvent) await Event.deleteOne({ _id: paidEvent._id });
      if (organizer) await Booking.deleteMany({ attendeeId: { $in: [attendeeA._id, attendeeB._id] } });
      if (organizer) await Ticket.deleteMany({ attendeeId: { $in: [attendeeA._id, attendeeB._id] } });
      if (organizer) await Notification.deleteMany({ userId: { $in: [attendeeA._id, attendeeB._id] } });
      console.log('Cleanup complete.');
    } catch (cleanErr) {
      console.error('Cleanup error:', cleanErr);
    }
    await mongoose.disconnect();
    console.log('Database disconnected.');
  }
}

runTests();
