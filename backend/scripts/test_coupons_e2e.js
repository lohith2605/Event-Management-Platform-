import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Booking from '../src/models/Booking.js';
import Ticket from '../src/models/Ticket.js';
import Coupon from '../src/models/Coupon.js';
import CouponRedemption from '../src/models/CouponRedemption.js';
import AuditLog from '../src/models/AuditLog.js';
import Session from '../src/models/Session.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runE2ETests() {
  console.log('===============================================================');
  console.log('🎟️ UTSAV - FEATURE 13: END-TO-END HTTP INTEGRATION TEST SUITE');
  console.log('===============================================================\n');

  let server;
  let baseUrl;
  const testRunId = Date.now();

  let organizer1, organizer2, attendee1, attendee2, adminUser;
  let org1Token, org2Token, att1Token, att2Token, adminToken;
  let event1, event2;

  const testCoupons = [];
  const testBookings = [];

  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    server = app.listen(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    console.log(`Ephemeral test server running at ${baseUrl}\n`);

    const signToken = async (user) => {
      const sessionId = crypto.randomBytes(32).toString('hex');
      await Session.create({
        userId: user._id,
        sessionId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      });
      return jwt.sign(
        { id: user._id, role: user.role, sessionId },
        process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
        { expiresIn: '1d' }
      );
    };

    // Helper for requests
    const request = async (endpoint, { method = 'GET', token, body } = {}) => {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, data };
    };

    // 1. Setup entities
    console.log('📋 STEP 1: Setting up entities and authenticating...');
    organizer1 = await User.create({
      name: `Org E2E One ${testRunId}`,
      email: `org_e2e_1_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });
    org1Token = await signToken(organizer1);

    organizer2 = await User.create({
      name: `Org E2E Two ${testRunId}`,
      email: `org_e2e_2_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });
    org2Token = await signToken(organizer2);

    attendee1 = await User.create({
      name: `Attendee E2E One ${testRunId}`,
      email: `att_e2e_1_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });
    att1Token = await signToken(attendee1);

    attendee2 = await User.create({
      name: `Attendee E2E Two ${testRunId}`,
      email: `att_e2e_2_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });
    att2Token = await signToken(attendee2);

    adminUser = await User.create({
      name: `Admin E2E ${testRunId}`,
      email: `admin_e2e_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'admin',
    });
    adminToken = await signToken(adminUser);

    event1 = await Event.create({
      title: `E2E Tech Summit ${testRunId}`,
      category: 'Technology',
      date: 'Dec 25, 2026',
      isoDate: new Date(Date.now() + 40 * 24 * 3600 * 1000),
      city: 'Hyderabad',
      venue: 'HICC',
      price: '₹500',
      priceNumber: 500,
      organizer: organizer1.name,
      organizerId: organizer1._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    event2 = await Event.create({
      title: `E2E Art Gala ${testRunId}`,
      category: 'Art',
      date: 'Dec 30, 2026',
      isoDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
      city: 'Delhi',
      venue: 'Pragati Maidan',
      price: '₹800',
      priceNumber: 800,
      organizer: organizer2.name,
      organizerId: organizer2._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    assert(org1Token && att1Token && adminToken, 'Tokens and seed data created');

    // 2. Organizer Coupon Creation & Validation Endpoints
    console.log('\n📋 STEP 2: Testing organizer coupon creation API...');
    const validCouponRes = await request('/api/organizer/coupons', {
      method: 'POST',
      token: org1Token,
      body: {
        code: `SUMMIT25_${testRunId}`,
        description: '25% discount on summit passes',
        discountType: 'percentage',
        discountValue: 25,
        minBookingAmount: 400,
        maxDiscountAmount: 300,
        startDate: new Date(Date.now() - 3600 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
        maxRedemptions: 10,
        maxRedemptionsPerUser: 1,
        applicableEvents: [event1._id],
        isActive: true,
      },
    });
    assert(validCouponRes.status === 201, 'POST /api/organizer/coupons returned 201 Created');
    assert(validCouponRes.data.coupon?.code === `SUMMIT25_${testRunId}`, 'Coupon created with normalized code');
    testCoupons.push(validCouponRes.data.coupon);

    // Test rejection of discount > 100%
    const invalidPctRes = await request('/api/organizer/coupons', {
      method: 'POST',
      token: org1Token,
      body: {
        code: `INVALID120_${testRunId}`,
        discountType: 'percentage',
        discountValue: 120,
        endDate: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    assert(invalidPctRes.status === 400, 'POST /api/organizer/coupons rejected >100% discount (400)');

    // Test rejection of invalid date range
    const invalidDateRes = await request('/api/organizer/coupons', {
      method: 'POST',
      token: org1Token,
      body: {
        code: `BAD_DATE_${testRunId}`,
        discountType: 'fixed',
        discountValue: 100,
        startDate: new Date(Date.now() + 48 * 3600 * 1000),
        endDate: new Date(Date.now() + 24 * 3600 * 1000), // end before start
      },
    });
    assert(invalidDateRes.status === 400, 'POST /api/organizer/coupons rejected end date before start date (400)');

    // Test organizer boundary check: organizer1 attempts to attach coupon to event2 (owned by organizer2)
    const unauthorizedEventRes = await request('/api/organizer/coupons', {
      method: 'POST',
      token: org1Token,
      body: {
        code: `CROSS_ORG_${testRunId}`,
        discountType: 'fixed',
        discountValue: 100,
        endDate: new Date(Date.now() + 24 * 3600 * 1000),
        applicableEvents: [event2._id], // Event2 belongs to organizer2!
      },
    });
    assert(
      unauthorizedEventRes.status === 403,
      'POST /api/organizer/coupons rejected applying coupon to another organizer’s event (403)'
    );

    // 3. Organizer Query & Stats Endpoints
    console.log('\n📋 STEP 3: Testing organizer list & metrics endpoints...');
    const listRes = await request('/api/organizer/coupons', {
      method: 'GET',
      token: org1Token,
    });
    assert(listRes.status === 200, 'GET /api/organizer/coupons returned 200');
    assert(listRes.data.coupons?.length >= 1, 'Organizer coupons list contains created coupon');

    const statsRes = await request('/api/organizer/coupons/stats', {
      method: 'GET',
      token: org1Token,
    });
    assert(statsRes.status === 200, 'GET /api/organizer/coupons/stats returned 200');
    assert(statsRes.data.stats?.totalCoupons >= 1, 'Coupon statistics calculated accurately');

    // 4. Attendee Checkout Preview & Validation Endpoint
    console.log('\n📋 STEP 4: Testing attendee checkout validation route...');
    const validateRes = await request('/api/bookings/validate-coupon', {
      method: 'POST',
      token: att1Token,
      body: {
        eventId: event1._id,
        quantity: 2, // 2 * 500 = ₹1000
        code: `summit25_${testRunId}`, // lower case to test server normalization
      },
    });
    assert(validateRes.status === 200, 'POST /api/bookings/validate-coupon returned 200');
    assert(validateRes.data.originalSubtotal === 1000, 'Original subtotal is ₹1000 (2 × 500)');
    // 25% of 1000 = 250 (which is <= maxDiscountAmount 300)
    assert(validateRes.data.discountAmount === 250, 'Discount correctly calculated as ₹250');
    assert(validateRes.data.finalAmount === 750, 'Final payable is ₹750');

    // 5. Booking Creation with 100% Free Pass Coupon
    console.log('\n📋 STEP 5: Testing 100% discount waiver instant booking confirmation...');
    const fullWaiverRes = await request('/api/organizer/coupons', {
      method: 'POST',
      token: org1Token,
      body: {
        code: `VIPFREE_${testRunId}`,
        description: 'VIP 100% discount pass',
        discountType: 'percentage',
        discountValue: 100,
        endDate: new Date(Date.now() + 10 * 24 * 3600 * 1000),
        applicableEvents: [event1._id],
        isActive: true,
      },
    });
    testCoupons.push(fullWaiverRes.data.coupon);

    const freeBookingRes = await request('/api/bookings', {
      method: 'POST',
      token: att1Token,
      body: {
        eventId: event1._id,
        quantity: 1,
        couponCode: `vipfree_${testRunId}`,
      },
    });
    assert(freeBookingRes.status === 201, 'POST /api/bookings with 100% coupon returned 201');
    assert(freeBookingRes.data.booking?.status === 'confirmed', '100% coupon booking is immediately confirmed');
    assert(freeBookingRes.data.booking?.paymentStatus === 'free', 'Payment status is free');
    assert(freeBookingRes.data.booking?.totalAmount === 0, 'Total amount payable is 0');
    assert(freeBookingRes.data.tickets?.length === 1, 'Digital ticket pass was issued');
    testBookings.push(freeBookingRes.data.booking);

    // Verify redemption record was created and coupon count incremented
    const redemptionCheck = await CouponRedemption.findOne({
      bookingId: freeBookingRes.data.booking._id,
      status: 'completed',
    });
    assert(!!redemptionCheck, 'CouponRedemption recorded with status completed');

    const updatedVipCoupon = await Coupon.findById(fullWaiverRes.data.coupon._id);
    assert(updatedVipCoupon.redemptionCount === 1, 'VIP coupon redemptionCount incremented to 1');

    // 6. Booking Cancellation & Coupon Restoration
    console.log('\n📋 STEP 6: Testing cancellation & coupon quota restoration...');
    const cancelRes = await request(`/api/bookings/${freeBookingRes.data.booking._id}/cancel`, {
      method: 'POST',
      token: att1Token,
      body: { reason: 'Attendee cannot make it' },
    });
    assert(cancelRes.status === 200, 'POST /api/bookings/:id/cancel returned 200');

    const cancelledRedemption = await CouponRedemption.findOne({
      bookingId: freeBookingRes.data.booking._id,
    });
    assert(cancelledRedemption?.status === 'cancelled', 'CouponRedemption status transitioned to cancelled');

    const restoredCoupon = await Coupon.findById(fullWaiverRes.data.coupon._id);
    assert(restoredCoupon.redemptionCount === 0, 'Coupon redemptionCount restored back to 0');

    // 7. Paid Booking, Razorpay Order & Payment Verification with Idempotency
    console.log('\n📋 STEP 7: Testing paid checkout, Razorpay signature verification & idempotency...');
    // Create paid booking with SUMMIT25_ coupon
    const paidBookingRes = await request('/api/bookings', {
      method: 'POST',
      token: att2Token,
      body: {
        eventId: event1._id,
        quantity: 1, // 500 - 25% (125) = ₹375
        couponCode: `SUMMIT25_${testRunId}`,
      },
    });
    assert(paidBookingRes.status === 201, 'Paid booking reservation created');
    assert(paidBookingRes.data.booking?.status === 'pending', 'Paid booking is pending');
    assert(paidBookingRes.data.booking?.totalAmount === 375, 'totalAmount is discounted to ₹375');
    testBookings.push(paidBookingRes.data.booking);

    // Simulate Razorpay payment verification
    const orderId = paidBookingRes.data.booking.razorpayOrderId || `order_test_${Date.now()}`;
    const paymentId = `pay_test_${Date.now()}`;
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
    const signature = crypto
      .createHmac('sha256', keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    // Temporarily ensure secret is in env for test
    process.env.RAZORPAY_KEY_SECRET = keySecret;

    const verifyRes = await request('/api/payments/verify', {
      method: 'POST',
      token: att2Token,
      body: {
        bookingId: paidBookingRes.data.booking._id,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
    });
    assert(verifyRes.status === 200, 'POST /api/payments/verify returned 200');
    assert(verifyRes.data.booking?.status === 'confirmed', 'Booking confirmed on verified payment');

    const paidRedemption = await CouponRedemption.findOne({
      bookingId: paidBookingRes.data.booking._id,
      status: 'completed',
    });
    assert(!!paidRedemption, 'CouponRedemption finalized on payment confirmation');

    // Test Idempotency: verify again with same payload
    const verifyRetryRes = await request('/api/payments/verify', {
      method: 'POST',
      token: att2Token,
      body: {
        bookingId: paidBookingRes.data.booking._id,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
    });
    assert(verifyRetryRes.status === 200, 'Idempotent verification retry returned 200');
    assert(verifyRetryRes.data.alreadyProcessed === true, 'Response identified alreadyProcessed without double-counting');

    const totalRedemptionsCount = await CouponRedemption.countDocuments({
      bookingId: paidBookingRes.data.booking._id,
    });
    assert(totalRedemptionsCount === 1, 'Coupon was NOT double-redeemed on retry');

    // 8. Admin Oversight & Moderation Endpoints
    console.log('\n📋 STEP 8: Testing admin coupon governance endpoints...');
    const adminListRes = await request('/api/admin/coupons', {
      method: 'GET',
      token: adminToken,
    });
    assert(adminListRes.status === 200, 'GET /api/admin/coupons returned 200');
    assert(adminListRes.data.coupons?.length >= 1, 'Admin can view coupons across all organizers');

    const adminStatsRes = await request('/api/admin/coupons/stats', {
      method: 'GET',
      token: adminToken,
    });
    assert(adminStatsRes.status === 200, 'GET /api/admin/coupons/stats returned 200');

    // Admin disables coupon
    const couponToModerate = testCoupons[0];
    const adminToggleRes = await request(`/api/admin/coupons/${couponToModerate._id}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: {
        isActive: false,
        reason: 'Administrative policy compliance test',
      },
    });
    assert(adminToggleRes.status === 200, 'PATCH /api/admin/coupons/:id/status returned 200');
    assert(adminToggleRes.data.coupon?.isActive === false, 'Coupon state disabled by admin');

    // Verify audit log entry
    const auditRecord = await AuditLog.findOne({
      action: 'coupon_status_updated',
      targetId: couponToModerate._id.toString(),
    });
    assert(!!auditRecord, 'Tamper-evident audit log recorded admin coupon status update');

    console.log('\n===============================================================');
    console.log(`🎉 ALL E2E TESTS FINISHED: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal E2E test error:', err);
    failed++;
  } finally {
    console.log('Cleaning up ephemeral server and test entities...');
    if (server) server.close();
    try {
      if (organizer1) await User.findByIdAndDelete(organizer1._id);
      if (organizer2) await User.findByIdAndDelete(organizer2._id);
      if (attendee1) await User.findByIdAndDelete(attendee1._id);
      if (attendee2) await User.findByIdAndDelete(attendee2._id);
      if (adminUser) await User.findByIdAndDelete(adminUser._id);
      if (event1) await Event.findByIdAndDelete(event1._id);
      if (event2) await Event.findByIdAndDelete(event2._id);
      for (const c of testCoupons) await Coupon.findByIdAndDelete(c._id);
      for (const b of testBookings) {
        await Booking.findByIdAndDelete(b._id);
        await Ticket.deleteMany({ bookingId: b._id });
      }
      await CouponRedemption.deleteMany({ couponId: { $in: testCoupons.map((c) => c._id) } });
      await AuditLog.deleteMany({ targetType: 'Coupon' });
    } catch (e) {
      console.warn('Cleanup error:', e.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runE2ETests();
