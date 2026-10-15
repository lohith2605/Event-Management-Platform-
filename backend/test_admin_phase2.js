import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dns from 'dns';
import app from './src/app.js';
import User from './src/models/User.js';
import Event from './src/models/Event.js';
import Booking from './src/models/Booking.js';
import Ticket from './src/models/Ticket.js';
import Review from './src/models/Review.js';
import Notification from './src/models/Notification.js';
import AuditLog from './src/models/AuditLog.js';

dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('  UTSAV — Admin Dashboard & Governance End-to-End Test Suite   ');
  console.log('===============================================================\n');

  // 1. Connect DB & start server on ephemeral port
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const server = app.listen(0);
  const port = server.address().port;
  const BASE = `http://localhost:${port}/api`;
  console.log(`Server listening on port ${port} for test runner.\n`);

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: Route Protection & Authorization
    // -------------------------------------------------------------
    console.log('--- TEST SUITE 1: Route Protection & Authorization ---');
    const guestStats = await fetch(`${BASE}/admin/stats`);
    assert(guestStats.status === 401, 'Guest request to /api/admin/stats returns 401 Unauthorized');

    const guestEvents = await fetch(`${BASE}/admin/events`);
    assert(guestEvents.status === 401, 'Guest request to /api/admin/events returns 401 Unauthorized');

    const guestUsers = await fetch(`${BASE}/admin/users`);
    assert(guestUsers.status === 401, 'Guest request to /api/admin/users returns 401 Unauthorized');

    const guestBookings = await fetch(`${BASE}/admin/bookings`);
    assert(guestBookings.status === 401, 'Guest request to /api/admin/bookings returns 401 Unauthorized');

    const guestAudit = await fetch(`${BASE}/admin/audit-logs`);
    assert(guestAudit.status === 401, 'Guest request to /api/admin/audit-logs returns 401 Unauthorized');

    // Register attendee
    const attendeeEmail = `att_${Date.now()}@utsav.test`;
    const regAttRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Attendee Tester',
        email: attendeeEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'attendee',
      }),
    });
    const attendeeCookie = regAttRes.headers.get('set-cookie');
    assert(regAttRes.status === 201, 'Registered test Attendee');

    // Attendee attempting admin endpoint
    const attAdminRes = await fetch(`${BASE}/admin/stats`, {
      headers: { cookie: attendeeCookie },
    });
    assert(attAdminRes.status === 403, 'Attendee request to /api/admin/stats returns 403 Forbidden');

    // Register organizer
    const organizerEmail = `org_${Date.now()}@utsav.test`;
    const regOrgRes = await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Organizer Tester',
        email: organizerEmail,
        password: 'Password123!',
        confirmPassword: 'Password123!',
        role: 'organizer',
      }),
    });
    const organizerCookie = regOrgRes.headers.get('set-cookie');
    assert(regOrgRes.status === 201, 'Registered test Organizer');

    // Organizer attempting admin endpoint
    const orgAdminRes = await fetch(`${BASE}/admin/stats`, {
      headers: { cookie: organizerCookie },
    });
    assert(orgAdminRes.status === 403, 'Organizer request to /api/admin/stats returns 403 Forbidden');

    // -------------------------------------------------------------
    // TEST SUITE 2: Mandatory Event Approval Gates
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Mandatory Event Approval Gates ---');
    // Organizer creates event
    const createEvtRes = await fetch(`${BASE}/organizer/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: organizerCookie },
      body: JSON.stringify({
        title: `Test Governance Summit ${Date.now()}`,
        tagline: 'Leading the future of ethical event tech',
        description: 'Comprehensive test of UTSAV moderation pipeline.',
        category: 'Tech & Design',
        date: 'Nov 20, 2026',
        isoDate: new Date('2026-11-20T10:00:00Z').toISOString(),
        time: '10:00 AM IST',
        city: 'Bengaluru',
        venue: 'Whitefield Convention Center',
        priceNumber: 0,
        format: 'In-Person',
        totalCapacity: 50,
      }),
    });
    const createEvtData = await createEvtRes.json();
    assert(createEvtRes.status === 201, 'Organizer successfully submitted new event');
    assert(createEvtData.event?.status === 'pending', 'Submitted event status strictly defaults to "pending"');
    const testEventId = createEvtData.event?._id;

    // Public discovery test: Newly submitted pending event must NOT be visible
    const publicListRes = await (await fetch(`${BASE}/events`)).json();
    const isVisibleInPublic = publicListRes.events?.some((e) => e._id === testEventId);
    assert(!isVisibleInPublic, 'Pending event is NOT visible in public event discovery (/api/events)');

    const publicDetailRes = await fetch(`${BASE}/events/${testEventId}`);
    assert(publicDetailRes.status === 404, 'Direct access to pending event (/api/events/:id) returns 404 Not Found');

    // Organizer cannot approve own event
    const orgApproveRes = await fetch(`${BASE}/admin/events/${testEventId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: organizerCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert(orgApproveRes.status === 403, 'Organizer cannot approve own event via admin review endpoint (403 Forbidden)');

    // -------------------------------------------------------------
    // TEST SUITE 3: Admin Login & Real Overview Metrics
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Admin Login & Real Platform Metrics ---');
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase().trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@utsav2026Secure';

    const adminLoginRes = await fetch(`${BASE}/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const adminCookie = adminLoginRes.headers.get('set-cookie');
    const adminData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminData.user?.role === 'admin', 'Admin successfully authenticated via /api/auth/admin-login');

    const statsRes = await (await fetch(`${BASE}/admin/stats`, {
      headers: { cookie: adminCookie },
    })).json();
    assert(statsRes.success === true, 'Admin successfully fetched /api/admin/stats');
    assert(typeof statsRes.stats?.users?.totalUsers === 'number', 'Stats contains real users count');
    assert(statsRes.stats?.events?.pendingEvents >= 1, 'Stats reflects pending event count');
    assert(typeof statsRes.stats?.finances?.grossVolume === 'number', 'Stats contains genuine financial metrics');

    // -------------------------------------------------------------
    // TEST SUITE 4: Event Moderation Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Event Moderation Lifecycle ---');
    // Fetch pending events
    const pendingEventsRes = await (await fetch(`${BASE}/admin/events/pending`, {
      headers: { cookie: adminCookie },
    })).json();
    const foundPending = pendingEventsRes.events?.some((e) => e._id === testEventId);
    assert(foundPending, 'Pending event is listed in /api/admin/events/pending');

    // Reject without reason fails
    const badRejectRes = await fetch(`${BASE}/admin/events/${testEventId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'reject', rejectionReason: '' }),
    });
    assert(badRejectRes.status === 400, 'Rejection without reason returns 400 Bad Request');

    // Return for corrections
    const returnRes = await (await fetch(`${BASE}/admin/events/${testEventId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({
        action: 'return',
        rejectionReason: 'Please provide more details in description regarding parking.',
      }),
    })).json();
    assert(returnRes.success && returnRes.event?.status === 'draft', 'Admin returned event for corrections (status = "draft")');

    // Organizer updates and resubmits
    const resubmitRes = await (await fetch(`${BASE}/organizer/events/${testEventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: organizerCookie },
      body: JSON.stringify({
        description: 'Updated with complete parking and venue accessibility details.',
      }),
    })).json();
    assert(resubmitRes.success && resubmitRes.event?.status === 'pending', 'Organizer resubmission resets status to "pending"');

    // Admin approves event
    const approveRes = await (await fetch(`${BASE}/admin/events/${testEventId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'approve' }),
    })).json();
    assert(approveRes.success && approveRes.event?.status === 'published', 'Admin approved event (status = "published")');

    // Verify public discovery now includes the approved event
    const publicAfterApprove = await (await fetch(`${BASE}/events/${testEventId}`)).json();
    assert(publicAfterApprove.success && publicAfterApprove.event?._id === testEventId, 'Approved event is now discoverable publicly on /api/events/:id');

    // -------------------------------------------------------------
    // TEST SUITE 5: User Management & Suspension
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: User Governance & Account Suspension ---');
    const usersListRes = await (await fetch(`${BASE}/admin/users?limit=5`, {
      headers: { cookie: adminCookie },
    })).json();
    assert(usersListRes.success && Array.isArray(usersListRes.users), 'Admin successfully queried /api/admin/users');
    const hasPasswordExposed = usersListRes.users?.some((u) => u.password !== undefined || u.resetPasswordToken !== undefined);
    assert(!hasPasswordExposed, 'Password and secret tokens are strictly omitted from user management payload');

    // Self-lockout safeguard: Admin cannot suspend self
    const adminUserId = adminData.user?._id || adminData.user?.id;
    const selfSuspendRes = await fetch(`${BASE}/admin/users/${adminUserId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'suspend', reason: 'Self-test' }),
    });
    assert(selfSuspendRes.status === 400, 'Security safeguard: Admin cannot suspend self (400 Bad Request)');

    // Suspend test organizer
    const organizerUser = await User.findOne({ email: organizerEmail });
    const suspendRes = await (await fetch(`${BASE}/admin/users/${organizerUser._id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'suspend', reason: 'Terms of service violation test' }),
    })).json();
    assert(suspendRes.success && suspendRes.user?.isSuspended === true, 'Admin successfully suspended test organizer account');

    // Suspended organizer is blocked from authenticated routes
    const blockedReq = await fetch(`${BASE}/organizer/overview`, {
      headers: { cookie: organizerCookie },
    });
    assert(blockedReq.status === 403, 'Suspended user is immediately blocked from authenticated endpoints (403 Forbidden)');

    // Suspended organizer cannot log in
    const blockedLogin = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: organizerEmail, password: 'Password123!' }),
    });
    assert(blockedLogin.status === 403, 'Suspended user is blocked from logging in (403 Forbidden)');

    // Reactivate organizer
    const reactivateRes = await (await fetch(`${BASE}/admin/users/${organizerUser._id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'reactivate' }),
    })).json();
    assert(reactivateRes.success && reactivateRes.user?.isSuspended === false, 'Admin successfully reactivated organizer account');

    // Reactivated organizer can log in again
    const loginAgain = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: organizerEmail, password: 'Password123!' }),
    });
    assert(loginAgain.status === 200, 'Reactivated user can log in normally (200 OK)');

    // -------------------------------------------------------------
    // TEST SUITE 6: Bookings & Cancellation / Refund Oversight
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Booking Oversight & Admin Refund ---');
    // Attendee books 2 tickets for the published event
    const bookingRes = await (await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attendeeCookie },
      body: JSON.stringify({
        eventId: testEventId,
        quantity: 2,
        ticketType: 'General Admission',
      }),
    })).json();
    assert(bookingRes.success && bookingRes.booking?._id, 'Attendee placed booking for published event');
    const testBookingId = bookingRes.booking?._id;

    // Check event spots left decremented
    const eventAfterBooking = await Event.findById(testEventId);
    assert(eventAfterBooking.spotsLeft === 48, 'Event inventory spots decremented correctly (50 - 2 = 48)');

    // Admin views bookings list
    const adminBookingsList = await (await fetch(`${BASE}/admin/bookings`, {
      headers: { cookie: adminCookie },
    })).json();
    const foundBooking = adminBookingsList.bookings?.some((b) => b._id === testBookingId);
    assert(foundBooking, 'Booking is visible in /api/admin/bookings');

    // Admin views single booking
    const adminBookingDetail = await (await fetch(`${BASE}/admin/bookings/${testBookingId}`, {
      headers: { cookie: adminCookie },
    })).json();
    assert(adminBookingDetail.success && adminBookingDetail.tickets?.length === 2, 'Admin viewed booking details with authentic digital passes');

    // Admin cancels and refunds booking
    const cancelRefundRes = await (await fetch(`${BASE}/admin/bookings/${testBookingId}/cancel-refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ reason: 'Attendee medical emergency cancellation request' }),
    })).json();
    assert(
      cancelRefundRes.success &&
      cancelRefundRes.booking?.status === 'cancelled' &&
      cancelRefundRes.booking?.paymentStatus === 'refunded',
      'Admin cancelled booking and marked payment refunded'
    );

    // Verify inventory restored
    const eventAfterRefund = await Event.findById(testEventId);
    assert(eventAfterRefund.spotsLeft === 50, 'Event inventory spots restored (48 + 2 = 50)');

    // Verify tickets deactivated
    const deactivatedTickets = await Ticket.find({ bookingId: testBookingId });
    assert(deactivatedTickets.every((t) => t.status === 'cancelled'), 'All associated tickets deactivated (status = "cancelled")');

    // -------------------------------------------------------------
    // TEST SUITE 7: Review Moderation
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: Review Moderation ---');
    // Note: Attendee had confirmed booking, let's create a review directly or via endpoint
    const testReview = await Review.create({
      userId: regAttRes.headers ? (await User.findOne({ email: attendeeEmail }))._id : null,
      eventId: testEventId,
      rating: 5,
      comment: 'Superb event planning, loved every session!',
      attendeeName: 'Attendee Tester',
      status: 'published',
    });
    assert(testReview._id !== undefined, 'Review created for published event');

    // Admin views reviews
    const adminReviewsRes = await (await fetch(`${BASE}/admin/reviews`, {
      headers: { cookie: adminCookie },
    })).json();
    const foundReview = adminReviewsRes.reviews?.some((r) => r._id === testReview._id.toString());
    assert(foundReview, 'Review is listed in /api/admin/reviews');

    // Admin hides review
    const hideReviewRes = await (await fetch(`${BASE}/admin/reviews/${testReview._id}/moderate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'hide', reason: 'Review policy test' }),
    })).json();
    assert(hideReviewRes.success && hideReviewRes.review?.status === 'hidden', 'Admin successfully hid review');

    // Verify public getEventReviews does not return hidden review
    const publicReviews = await (await fetch(`${BASE}/reviews/event/${testEventId}`)).json();
    assert(!publicReviews.reviews?.some((r) => r._id === testReview._id.toString()), 'Hidden review is NOT returned to public event review queries');

    // Admin restores review
    const publishReviewRes = await (await fetch(`${BASE}/admin/reviews/${testReview._id}/moderate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'publish' }),
    })).json();
    assert(publishReviewRes.success && publishReviewRes.review?.status === 'published', 'Admin restored review to published status');

    // -------------------------------------------------------------
    // TEST SUITE 8: Tamper-Evident Audit Logs
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Tamper-Evident Audit Logs ---');
    const auditLogsRes = await (await fetch(`${BASE}/admin/audit-logs`, {
      headers: { cookie: adminCookie },
    })).json();
    assert(auditLogsRes.success && auditLogsRes.logs?.length > 0, 'Audit logs queried successfully from /api/admin/audit-logs');

    const actionsLogged = auditLogsRes.logs?.map((l) => l.action) || [];
    assert(actionsLogged.includes('event_returned'), 'Audit trail contains "event_returned" record');
    assert(actionsLogged.includes('event_approved'), 'Audit trail contains "event_approved" record');
    assert(actionsLogged.includes('user_suspended'), 'Audit trail contains "user_suspended" record');
    assert(actionsLogged.includes('user_reactivated'), 'Audit trail contains "user_reactivated" record');
    assert(actionsLogged.includes('booking_cancelled_refunded'), 'Audit trail contains "booking_cancelled_refunded" record');
    assert(actionsLogged.includes('review_moderated'), 'Audit trail contains "review_moderated" record');

    // -------------------------------------------------------------
    // TEST SUITE 9: Admin Notifications
    // -------------------------------------------------------------
    console.log('\n--- TEST SUITE 9: Admin Notifications ---');
    const notifsRes = await (await fetch(`${BASE}/admin/notifications`, {
      headers: { cookie: adminCookie },
    })).json();
    assert(notifsRes.success && Array.isArray(notifsRes.notifications), 'Admin notifications fetched from /api/admin/notifications');

    const markAllRes = await (await fetch(`${BASE}/admin/notifications/read-all`, {
      method: 'PUT',
      headers: { cookie: adminCookie },
    })).json();
    assert(markAllRes.success === true, 'Admin marked all notifications as read');

    console.log('\n===============================================================');
    console.log(`  ALL TESTS FINISHED: Passed: ${passed} | Failed: ${failed}`);
    console.log('===============================================================\n');

    // Clean up test records
    await Event.findByIdAndDelete(testEventId);
    await Booking.findByIdAndDelete(testBookingId);
    await Ticket.deleteMany({ bookingId: testBookingId });
    await Review.findByIdAndDelete(testReview._id);
    await User.deleteMany({ email: { $in: [attendeeEmail, organizerEmail] } });
    await AuditLog.deleteMany({ targetId: { $in: [testEventId, testBookingId, testReview._id.toString()] } });
  } finally {
    server.close();
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
