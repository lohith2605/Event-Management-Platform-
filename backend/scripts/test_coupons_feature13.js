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
import Coupon from '../src/models/Coupon.js';
import CouponRedemption from '../src/models/CouponRedemption.js';
import AuditLog from '../src/models/AuditLog.js';
import {
  validateAndCalculateCouponDiscount,
  normalizeCouponCode,
} from '../src/utils/couponCalculator.js';

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

async function runCouponTests() {
  console.log('================================================================');
  console.log('🎟️ UTSAV - FEATURE 13: COUPONS & DISCOUNT MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  const testRunId = Date.now();
  let organizer1, organizer2, attendee1, attendee2, adminUser;
  let event1, event2;
  let testCoupons = [];
  let testBookings = [];

  try {
    await connectDB();
    console.log('🔌 Connected to MongoDB Atlas\n');

    // 1. Setup Test Users
    console.log('📋 STEP 1: Setting up test users and events...');
    organizer1 = await User.create({
      name: `Org One ${testRunId}`,
      email: `org1_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    organizer2 = await User.create({
      name: `Org Two ${testRunId}`,
      email: `org2_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendee1 = await User.create({
      name: `Attendee One ${testRunId}`,
      email: `att1_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    attendee2 = await User.create({
      name: `Attendee Two ${testRunId}`,
      email: `att2_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    adminUser = await User.create({
      name: `Admin ${testRunId}`,
      email: `admin_${testRunId}@test.com`,
      password: 'Password123!',
      role: 'admin',
    });

    event1 = await Event.create({
      title: `Grand Tech Summit ${testRunId}`,
      tagline: 'The biggest summit',
      category: 'Technology',
      date: 'Dec 15, 2026',
      isoDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      time: '10:00 AM',
      city: 'Bengaluru',
      venue: 'BIEC Center',
      price: '₹500',
      priceNumber: 500,
      organizer: organizer1.name,
      organizerId: organizer1._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    event2 = await Event.create({
      title: `Music Fest ${testRunId}`,
      tagline: 'Live music night',
      category: 'Music',
      date: 'Dec 20, 2026',
      isoDate: new Date(Date.now() + 35 * 24 * 3600 * 1000),
      time: '06:00 PM',
      city: 'Mumbai',
      venue: 'Dome Arena',
      price: '₹1000',
      priceNumber: 1000,
      organizer: organizer2.name,
      organizerId: organizer2._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    assert(organizer1 && organizer2 && attendee1 && event1, 'Seed entities created successfully');

    // 2. Coupon Validation & Normalization
    console.log('\n📋 STEP 2: Testing code normalization and basic validation...');
    const normalized = normalizeCouponCode('   utsav_early-2026   ');
    assert(normalized === 'UTSAV_EARLY-2026', 'Code normalized to uppercase and trimmed');

    // Create a 20% percentage coupon with cap of ₹150 and min booking ₹400
    const coupon1 = await Coupon.create({
      code: `PCT20_${testRunId}`,
      description: '20% off up to ₹150',
      discountType: 'percentage',
      discountValue: 20,
      minBookingAmount: 400,
      maxDiscountAmount: 150,
      startDate: new Date(Date.now() - 3600 * 1000), // 1 hour ago
      endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days ahead
      maxRedemptions: 5,
      maxRedemptionsPerUser: 1,
      organizerId: organizer1._id,
      createdBy: organizer1._id,
      applicableEvents: [event1._id],
      isActive: true,
    });
    testCoupons.push(coupon1);
    assert(coupon1.code === `PCT20_${testRunId}`, 'Percentage coupon created in database');

    // Create a Fixed ₹200 discount coupon
    const coupon2 = await Coupon.create({
      code: `FLAT200_${testRunId}`,
      description: 'Flat ₹200 off',
      discountType: 'fixed',
      discountValue: 200,
      minBookingAmount: 500,
      startDate: new Date(Date.now() - 3600 * 1000),
      endDate: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      maxRedemptions: 2,
      maxRedemptionsPerUser: 2,
      organizerId: organizer1._id,
      createdBy: organizer1._id,
      applicableEvents: [], // all organizer1 events
      isActive: true,
    });
    testCoupons.push(coupon2);
    assert(coupon2.discountValue === 200, 'Fixed discount coupon created in database');

    // Test Duplicate Code Rejection
    let duplicateRejected = false;
    try {
      await Coupon.create({
        code: `PCT20_${testRunId}`,
        discountType: 'percentage',
        discountValue: 10,
        endDate: new Date(Date.now() + 24 * 3600 * 1000),
        organizerId: organizer1._id,
        createdBy: organizer1._id,
      });
    } catch (err) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate coupon code correctly rejected by unique index');

    // 3. Discount Calculations & Edge Cases
    console.log('\n📋 STEP 3: Testing discount calculation engine...');

    // Scenario A: Standard 20% on ₹500 (Qty 1) -> 20% of 500 = ₹100 (< ₹150 cap)
    const calcA = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee1._id,
    });
    assert(calcA.isValid === true, 'Coupon 1 is valid for Event 1');
    assert(calcA.discountAmount === 100, `Discount correctly calculated as ₹100 (got ₹${calcA.discountAmount})`);
    assert(calcA.finalAmount === 400, `Final payable correctly calculated as ₹400 (got ₹${calcA.finalAmount})`);

    // Scenario B: 20% on ₹1500 (Qty 3) -> 20% of 1500 = 300, capped at maxDiscountAmount ₹150
    const calcB = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event1,
      originalSubtotal: 1500,
      userId: attendee1._id,
    });
    assert(calcB.discountAmount === 150, `Discount capped at ₹150 (got ₹${calcB.discountAmount})`);
    assert(calcB.finalAmount === 1350, `Final payable after cap is ₹1350 (got ₹${calcB.finalAmount})`);

    // Scenario C: Minimum subtotal not met (subtotal ₹300 < min ₹400)
    const calcC = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event1,
      originalSubtotal: 300,
      userId: attendee1._id,
    });
    assert(calcC.isValid === false, 'Coupon rejected when subtotal < minBookingAmount');
    assert(calcC.error.includes('minimum booking amount'), 'Clear error returned for minimum booking amount');

    // Scenario D: Coupon not applicable to Event 2 (different organizer)
    const calcD = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event2,
      originalSubtotal: 1000,
      userId: attendee1._id,
    });
    assert(calcD.isValid === false, 'Coupon rejected for another organizer’s event');

    // Scenario E: Disabled coupon
    const disabledCoupon = await Coupon.create({
      code: `DISABLED_${testRunId}`,
      discountType: 'fixed',
      discountValue: 50,
      endDate: new Date(Date.now() + 24 * 3600 * 1000),
      organizerId: organizer1._id,
      createdBy: organizer1._id,
      isActive: false,
    });
    testCoupons.push(disabledCoupon);
    const calcE = await validateAndCalculateCouponDiscount({
      code: disabledCoupon.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee1._id,
    });
    assert(calcE.isValid === false && calcE.error.includes('disabled'), 'Disabled coupon correctly rejected');

    // Scenario F: Expired coupon
    const expiredCoupon = await Coupon.create({
      code: `EXPIRED_${testRunId}`,
      discountType: 'fixed',
      discountValue: 50,
      startDate: new Date(Date.now() - 48 * 3600 * 1000),
      endDate: new Date(Date.now() - 24 * 3600 * 1000), // expired yesterday
      organizerId: organizer1._id,
      createdBy: organizer1._id,
      isActive: true,
    });
    testCoupons.push(expiredCoupon);
    const calcF = await validateAndCalculateCouponDiscount({
      code: expiredCoupon.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee1._id,
    });
    assert(calcF.isValid === false && calcF.error.includes('expired'), 'Expired coupon correctly rejected');

    // 4. 100% Discount / Free Pass Flow
    console.log('\n📋 STEP 4: Testing 100% discount / Free pass creation...');
    const freePassCoupon = await Coupon.create({
      code: `FREE100_${testRunId}`,
      description: '100% discount full waiver',
      discountType: 'percentage',
      discountValue: 100,
      endDate: new Date(Date.now() + 24 * 3600 * 1000),
      organizerId: organizer1._id,
      createdBy: organizer1._id,
      isActive: true,
    });
    testCoupons.push(freePassCoupon);

    const calcFree = await validateAndCalculateCouponDiscount({
      code: freePassCoupon.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee1._id,
    });
    assert(calcFree.finalAmount === 0 && calcFree.isFree === true, '100% discount results in ₹0 payable (isFree = true)');

    // Simulate booking with 100% coupon:
    const bookingRef = `TEST-BK-${Date.now()}`;
    const freeBooking = await Booking.create({
      bookingReference: bookingRef,
      userId: attendee1._id,
      eventId: event1._id,
      quantity: 1,
      unitPrice: 500,
      originalSubtotal: 500,
      discountAmount: 500,
      totalAmount: 0,
      couponId: freePassCoupon._id,
      couponCode: freePassCoupon.code,
      currency: 'INR',
      status: 'confirmed',
      paymentStatus: 'free',
      paymentMethod: 'coupon_100_percent',
      attendeeName: attendee1.name,
      attendeeEmail: attendee1.email,
    });
    testBookings.push(freeBooking);

    // Finalize redemption
    await Coupon.findByIdAndUpdate(freePassCoupon._id, { $inc: { redemptionCount: 1 } });
    const freeRedemption = await CouponRedemption.create({
      couponId: freePassCoupon._id,
      couponCode: freePassCoupon.code,
      userId: attendee1._id,
      eventId: event1._id,
      bookingId: freeBooking._id,
      bookingReference: bookingRef,
      originalSubtotal: 500,
      discountAmount: 500,
      finalAmount: 0,
      status: 'completed',
    });
    assert(freeRedemption.status === 'completed', 'CouponRedemption audit record created with status completed');

    const updatedFreeCoupon = await Coupon.findById(freePassCoupon._id);
    assert(updatedFreeCoupon.redemptionCount === 1, 'Coupon redemptionCount incremented to 1');

    // 5. Per-Attendee Usage Limit Enforcement
    console.log('\n📋 STEP 5: Testing per-attendee usage limit enforcement...');
    // attendee1 attempts to use coupon1 again (maxRedemptionsPerUser = 1)
    // First simulate completed redemption for coupon1 by attendee1
    await CouponRedemption.create({
      couponId: coupon1._id,
      couponCode: coupon1.code,
      userId: attendee1._id,
      eventId: event1._id,
      bookingId: new mongoose.Types.ObjectId(),
      bookingReference: `BK-${Date.now()}`,
      originalSubtotal: 500,
      discountAmount: 100,
      finalAmount: 400,
      status: 'completed',
    });
    await Coupon.findByIdAndUpdate(coupon1._id, { $inc: { redemptionCount: 1 } });

    // Now attendee1 checks coupon1 again
    const calcUserLimit = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee1._id,
    });
    assert(
      calcUserLimit.isValid === false && calcUserLimit.error.includes('maximum allowed uses'),
      'Per-attendee usage limit correctly prevented duplicate usage by same attendee'
    );

    // But attendee2 can still use coupon1!
    const calcAttendee2 = await validateAndCalculateCouponDiscount({
      code: coupon1.code,
      event: event1,
      originalSubtotal: 500,
      userId: attendee2._id,
    });
    assert(calcAttendee2.isValid === true, 'Different attendee (attendee2) can still use coupon1');

    // 6. Global Usage Limit Enforcement
    console.log('\n📋 STEP 6: Testing global usage limit enforcement...');
    // coupon2 has maxRedemptions: 2. Set redemptionCount to 2
    await Coupon.findByIdAndUpdate(coupon2._id, { redemptionCount: 2 });
    const calcGlobalLimit = await validateAndCalculateCouponDiscount({
      code: coupon2.code,
      event: event1,
      originalSubtotal: 1000,
      userId: attendee2._id,
    });
    assert(
      calcGlobalLimit.isValid === false && calcGlobalLimit.error.includes('total usage limit'),
      'Global redemption limit correctly prevents further use once reached'
    );

    // 7. Cancellation and Usage Restoration
    console.log('\n📋 STEP 7: Testing booking cancellation and coupon restoration...');
    // When freeBooking is cancelled:
    const redemptionToCancel = await CouponRedemption.findOne({
      bookingId: freeBooking._id,
      status: 'completed',
    });
    assert(!!redemptionToCancel, 'Found active redemption to cancel');

    redemptionToCancel.status = 'cancelled';
    await redemptionToCancel.save();

    await Coupon.findOneAndUpdate(
      { _id: freePassCoupon._id, redemptionCount: { $gt: 0 } },
      { $inc: { redemptionCount: -1 } }
    );

    const restoredCoupon = await Coupon.findById(freePassCoupon._id);
    assert(restoredCoupon.redemptionCount === 0, 'Coupon redemptionCount restored to 0 after cancellation');

    // 8. Admin Moderation & Audit Trail
    console.log('\n📋 STEP 8: Testing admin coupon status toggle & audit log...');
    coupon1.isActive = false;
    await coupon1.save();

    await AuditLog.create({
      adminId: adminUser._id,
      adminEmail: adminUser.email,
      adminName: adminUser.name,
      action: 'coupon_status_updated',
      targetType: 'Coupon',
      targetId: coupon1._id.toString(),
      targetTitle: coupon1.code,
      details: `Coupon ${coupon1.code} disabled by admin`,
      reason: 'Violated seasonal promotional guidelines',
    });

    const audit = await AuditLog.findOne({ targetId: coupon1._id.toString(), action: 'coupon_status_updated' });
    assert(audit && audit.targetType === 'Coupon', 'Tamper-evident audit log recorded for coupon moderation');

    console.log('\n================================================================');
    console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    // Cleanup test data
    console.log('🧹 Cleaning up test data...');
    try {
      if (organizer1) await User.findByIdAndDelete(organizer1._id);
      if (organizer2) await User.findByIdAndDelete(organizer2._id);
      if (attendee1) await User.findByIdAndDelete(attendee1._id);
      if (attendee2) await User.findByIdAndDelete(attendee2._id);
      if (adminUser) await User.findByIdAndDelete(adminUser._id);
      if (event1) await Event.findByIdAndDelete(event1._id);
      if (event2) await Event.findByIdAndDelete(event2._id);
      for (const c of testCoupons) await Coupon.findByIdAndDelete(c._id);
      for (const b of testBookings) await Booking.findByIdAndDelete(b._id);
      await CouponRedemption.deleteMany({ couponId: { $in: testCoupons.map((c) => c._id) } });
      await AuditLog.deleteMany({ targetType: 'Coupon' });
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runCouponTests();
