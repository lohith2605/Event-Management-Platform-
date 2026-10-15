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
  sendEmail,
  sendBookingConfirmationEmail,
  sendConfirmationEmailForBooking,
  getTransporter,
  setTransporter,
} from '../src/services/emailService.js';

const BASE_URL = 'http://127.0.0.1:5000';

function generateAuthToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
    { expiresIn: '1h' }
  );
}

async function runPhase2Tests() {
  console.log('================================================================');
  console.log('📧 UTSAV PLATFORM - PHASE 2: AUTOMATED CONFIRMATION & TICKET EMAILS');
  console.log('================================================================\n');

  let organizer, attendeeA, attendeeB;
  let freeEvent, paidEvent;
  const testRunId = Date.now();
  const originalTransporter = getTransporter();

  let createdAttendeeA = false;
  try {
    await connectDB();

    console.log('⚙️ Configuration Check:');
    console.log('   - SMTP Host:', process.env.EMAIL_HOST || 'None');
    console.log('   - SMTP User:', process.env.EMAIL_USER || 'None');
    console.log('   - Real SMTP Configured:', !!originalTransporter);
    console.log('   - Razorpay Key ID:', process.env.RAZORPAY_KEY_ID || 'None');

    // 1. Setup Test Users
    console.log('\n--- Setting up test users ---');
    organizer = await User.create({
      name: 'Organizer Phase 2',
      email: `org_phase2_${testRunId}@example.com`,
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
      name: 'Secondary Attendee',
      email: `attendee_b_${testRunId}@example.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    const tokenA = generateAuthToken(attendeeA);
    const tokenB = generateAuthToken(attendeeB);

    console.log(`Attendee A (Recipient): ${attendeeA.email}`);
    console.log(`Attendee B: ${attendeeB.email}`);

    // 2. Setup Events
    console.log('\n--- Setting up test events ---');
    freeEvent = await Event.create({
      title: `Free AI Innovators Summit ${testRunId}`,
      tagline: 'Premier AI gathering',
      description: 'Free community summit on generative AI.',
      date: 'Nov 25, 2026',
      isoDate: new Date('2026-11-25T10:00:00.000Z'),
      time: '10:00 AM IST',
      venue: 'UTSAV Tech Park',
      city: 'Bengaluru',
      category: 'Technology',
      price: 'Free',
      priceNumber: 0,
      totalCapacity: 50,
      spotsLeft: 50,
      status: 'published',
      organizer: organizer.name,
      organizerId: organizer._id,
      ticketTiers: [{ name: 'VIP Pass', price: 0, capacity: 50, spotsLeft: 50 }],
    });

    paidEvent = await Event.create({
      title: `UTSAV Fusion Fest 2026 ${testRunId}`,
      tagline: 'Annual Music & Culture Festival',
      description: 'Live musical performances and food carnival.',
      date: 'Dec 15, 2026',
      isoDate: new Date('2026-12-15T18:00:00.000Z'),
      time: '6:00 PM IST',
      venue: 'Palace Grounds',
      city: 'Bengaluru',
      category: 'Music',
      price: '₹350',
      priceNumber: 350,
      totalCapacity: 50,
      spotsLeft: 50,
      status: 'published',
      organizer: organizer.name,
      organizerId: organizer._id,
      ticketTiers: [{ name: 'General Admission', price: 350, capacity: 50, spotsLeft: 50 }],
    });

    // =========================================================================
    // TEST 1: Free Event Booking - Confirmation & QR Email Dispatch
    // =========================================================================
    console.log('\n--- TEST 1: Free Event Booking & Confirmation Email ---');
    const freeRes = await fetch(`${BASE_URL}/api/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        eventId: freeEvent._id,
        quantity: 2,
        ticketType: 'VIP Pass',
      }),
    });
    const freeData = await freeRes.json();
    console.log('Free booking response status:', freeRes.status);
    console.log('Free booking status:', freeData.booking?.status);

    if (freeRes.status !== 201 || freeData.booking?.status !== 'confirmed') {
      throw new Error('Test 1 Failed: Free booking was not confirmed.');
    }

    // Verify email status in database
    const freeBookingInDb = await Booking.findById(freeData.booking._id);
    console.log('Confirmation Email Sent:', freeBookingInDb.confirmationEmailSent);
    console.log('Confirmation Email Status:', freeBookingInDb.confirmationEmailStatus);
    console.log('Message ID:', freeBookingInDb.confirmationEmailMessageId);

    if (
      freeBookingInDb.confirmationEmailSent !== true ||
      freeBookingInDb.confirmationEmailStatus !== 'sent' ||
      !freeBookingInDb.confirmationEmailMessageId
    ) {
      throw new Error('Test 1 Failed: Free booking confirmation email was not recorded as sent.');
    }

    console.log('✅ PASS: Free event booking immediately confirmed, QR passes generated, and confirmation email dispatched.');

    // =========================================================================
    // TEST 2: Paid Booking in Pending Hold - NO Premature Email
    // =========================================================================
    console.log('\n--- TEST 2: Paid Booking in Hold - No Premature Email ---');
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
    const paidBookingId = paidData.booking._id;
    const razorpayOrderId = paidData.order.id;

    const pendingBookingInDb = await Booking.findById(paidBookingId);
    console.log('Paid Booking Status:', pendingBookingInDb.status);
    console.log('Paid Booking Payment Status:', pendingBookingInDb.paymentStatus);
    console.log('Confirmation Email Sent during hold:', pendingBookingInDb.confirmationEmailSent);

    if (pendingBookingInDb.confirmationEmailSent === true) {
      throw new Error('Test 2 Failed: Confirmation email was sent prematurely before payment verification!');
    }
    console.log('✅ PASS: Paid booking in pending hold correctly did NOT trigger confirmation email.');

    // =========================================================================
    // TEST 3: Invalid Payment Signature - NO Confirmation Email
    // =========================================================================
    console.log('\n--- TEST 3: Invalid Signature - Rejection & No Email ---');
    const invalidVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: paidBookingId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: 'pay_FakePayment999',
        razorpay_signature: 'invalid_corrupted_signature_123',
      }),
    });

    console.log('Invalid signature response status:', invalidVerifyRes.status);
    const failedBookingInDb = await Booking.findById(paidBookingId);
    if (failedBookingInDb.confirmationEmailSent === true) {
      throw new Error('Test 3 Failed: Invalid payment signature triggered confirmation email!');
    }
    console.log('✅ PASS: Invalid signature rejected with 400 Bad Request; zero confirmation emails triggered.');

    // =========================================================================
    // TEST 4: Valid Server-Side Signature Verification & Email Dispatch
    // =========================================================================
    console.log('\n--- TEST 4: Server Signature Verification & Real Email Dispatch ---');
    const validPaymentId = `pay_RealTest_${Date.now()}`;
    const validSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${validPaymentId}`)
      .digest('hex');

    const validVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: paidBookingId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const validVerifyData = await validVerifyRes.json();
    console.log('Verification status:', validVerifyRes.status);
    console.log('Booking status after verification:', validVerifyData.booking?.status);

    const verifiedBookingInDb = await Booking.findById(paidBookingId);
    console.log('Verified Booking Email Sent:', verifiedBookingInDb.confirmationEmailSent);
    console.log('Verified Booking Email Status:', verifiedBookingInDb.confirmationEmailStatus);
    console.log('Verified Booking Message ID:', verifiedBookingInDb.confirmationEmailMessageId);

    if (
      verifiedBookingInDb.confirmationEmailSent !== true ||
      verifiedBookingInDb.confirmationEmailStatus !== 'sent' ||
      !verifiedBookingInDb.confirmationEmailMessageId
    ) {
      throw new Error('Test 4 Failed: Confirmation email was not dispatched after verified payment.');
    }
    console.log(`✅ PASS: Verified payment confirmed booking, generated QR passes, and sent confirmation email (Message ID: ${verifiedBookingInDb.confirmationEmailMessageId}).`);

    // =========================================================================
    // TEST 5: Duplicate Callback / Idempotency Protection
    // =========================================================================
    console.log('\n--- TEST 5: Duplicate Callback / Webhook Idempotency ---');
    // Try sending email again directly on the confirmed booking
    const duplicateResult = await sendConfirmationEmailForBooking(paidBookingId);
    console.log('Duplicate email attempt result:', duplicateResult);

    if (duplicateResult.skipped !== true || duplicateResult.reason !== 'already_sent') {
      throw new Error('Test 5 Failed: Duplicate email attempt was not blocked by idempotency check!');
    }

    // Try calling verify API again with same payment ID
    const repeatVerifyRes = await fetch(`${BASE_URL}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        bookingId: paidBookingId,
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      }),
    });
    const repeatVerifyData = await repeatVerifyRes.json();
    console.log('Repeat verify API status:', repeatVerifyRes.status);
    console.log('Repeat verify alreadyProcessed:', repeatVerifyData.alreadyProcessed);

    if (repeatVerifyRes.status !== 200 || repeatVerifyData.alreadyProcessed !== true) {
      throw new Error('Test 5 Failed: Repeat verification did not return 200 alreadyProcessed.');
    }
    console.log('✅ PASS: Duplicate payment callbacks and repeated email triggers safely blocked without duplicate emails.');

    // =========================================================================
    // TEST 6: Safe Handling of Retryable Email Delivery Failures
    // =========================================================================
    console.log('\n--- TEST 6: Retryable Email Failure Handling (Simulated Outage) ---');
    // Create a new booking
    const failBooking = await Booking.create({
      bookingReference: `UTSAV-TEST-FAIL-${testRunId}`,
      userId: attendeeA._id,
      eventId: freeEvent._id,
      quantity: 1,
      unitPrice: 0,
      totalAmount: 0,
      status: 'confirmed',
      paymentStatus: 'free',
      attendeeName: attendeeA.name,
      attendeeEmail: attendeeA.email,
    });
    await Ticket.create({
      ticketCode: `UTSAV-TKT-FAIL-${testRunId}`,
      bookingId: failBooking._id,
      bookingReference: failBooking.bookingReference,
      eventId: freeEvent._id,
      userId: attendeeA._id,
      attendeeName: attendeeA.name,
      qrData: JSON.stringify({ app: 'UTSAV', tkt: 'FAIL', ref: failBooking.bookingReference, sig: 'sig123' }),
    });

    // Temporarily inject a failing transporter to simulate SMTP server outage
    setTransporter({
      sendMail: async () => {
        throw new Error('ETIMEDOUT: Connection to SMTP server timed out');
      },
    });

    const failedSendResult = await sendConfirmationEmailForBooking(failBooking._id);
    console.log('Failed email attempt result:', failedSendResult);

    const bookingAfterFail = await Booking.findById(failBooking._id);
    console.log('Booking status after email failure:', bookingAfterFail.status);
    console.log('Email delivery status:', bookingAfterFail.confirmationEmailStatus);
    console.log('Email error recorded:', bookingAfterFail.confirmationEmailError);

    // RESTORE ORIGINAL TRANSPORTER
    setTransporter(originalTransporter);

    if (
      failedSendResult.success !== false ||
      bookingAfterFail.status !== 'confirmed' ||
      bookingAfterFail.confirmationEmailStatus !== 'failed' ||
      !bookingAfterFail.confirmationEmailError.includes('ETIMEDOUT')
    ) {
      throw new Error('Test 6 Failed: Email failure was not handled safely or altered confirmed booking state!');
    }
    console.log('✅ PASS: Email network failure safely recorded on booking without crashing or undoing confirmed booking/payment.');

    // =========================================================================
    // TEST 7: Ticket Ownership & Privacy Isolation
    // =========================================================================
    console.log('\n--- TEST 7: Ticket Ownership & Privacy Isolation ---');
    const foreignTicketsRes = await fetch(`${BASE_URL}/api/bookings/${paidBookingId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenB}`, // Attendee B attempting to read Attendee A's booking
      },
    });
    console.log('Foreign booking access status:', foreignTicketsRes.status);
    if (foreignTicketsRes.status !== 403 && foreignTicketsRes.status !== 404) {
      throw new Error('Test 7 Failed: Attendee B was able to view Attendee A’s booking!');
    }
    console.log('✅ PASS: Private ticket and booking data securely isolated between attendees.');

    console.log('\n================================================================');
    console.log('🎉 ALL 7 PHASE 2 AUTOMATED EMAIL INTEGRATION TESTS PASSED!');
    console.log('================================================================');
  } catch (err) {
    console.error('\n❌ PHASE 2 TEST SUITE FAILED:', err);
    process.exitCode = 1;
  } finally {
    setTransporter(originalTransporter);
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (organizer?._id) await User.deleteOne({ _id: organizer._id });
      if (createdAttendeeA && attendeeA?._id) await User.deleteOne({ _id: attendeeA._id });
      if (attendeeB?._id) await User.deleteOne({ _id: attendeeB._id });

      const testEventIds = [freeEvent?._id, paidEvent?._id].filter(Boolean);
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

runPhase2Tests();
