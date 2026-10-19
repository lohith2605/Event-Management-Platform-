import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Event from '../src/models/Event.js';
import Session from '../src/models/Session.js';
import Booking from '../src/models/Booking.js';
import Notification from '../src/models/Notification.js';
import AuditLog from '../src/models/AuditLog.js';
import {
  setTransporter,
  getTransporter,
  sendEventApprovalEmail,
  sendApprovalEmailForEvent,
  retryFailedApprovalEmails,
  sendBookingConfirmationEmail,
  sendCancellationEmail,
  sendEventReminderEmail,
  send2FAVerificationEmail,
  sendPasswordResetEmail,
} from '../src/services/emailService.js';

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

async function runTestSuite() {
  console.log('===============================================================');
  console.log('📧 UTSAV — Event Approval & Publication Email Test Suite');
  console.log('   Full End-to-End Workflow, Deduplication & Resilience Tests');
  console.log('===============================================================\n');

  const originalTransporter = getTransporter();
  const sentEmails = [];
  const mockTransporter = {
    sendMail: async (mailOptions) => {
      sentEmails.push(mailOptions);
      return { messageId: `<mock-approval-${Date.now()}-${Math.random().toString(36).substring(2, 8)}@utsav.test>` };
    },
  };

  // Connect to DB and start ephemeral test server
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.\n');

  const server = app.listen(0);
  const port = server.address().port;
  const BASE = `http://localhost:${port}/api`;
  console.log(`Server listening on port ${port} for automated approval testing.\n`);

  // Activate mock transporter to ensure zero real emails are dispatched
  setTransporter(mockTransporter);

  const testRunId = Date.now();
  const createdUserIds = [];
  const createdEventIds = [];
  const createdSessionIds = [];

  // Helper to create authenticated session cookie
  const createTestSessionAndCookie = async (user) => {
    const sessionId = crypto.randomUUID();
    await Session.create({
      userId: user._id,
      sessionId,
      ipAddress: '127.0.0.1',
      userAgent: 'test-runner',
      expiresAt: new Date(Date.now() + 1800 * 1000),
      absoluteExpiresAt: new Date(Date.now() + 8 * 3600 * 1000),
    });
    createdSessionIds.push(sessionId);

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role,
        sessionId,
      },
      process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform',
      { expiresIn: '8h' }
    );

    return `token=${token}`;
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP TEST ACCOUNTS
    // -------------------------------------------------------------------------
    console.log('--- Setting up test accounts ---');
    const adminUser = await User.create({
      name: 'Test Platform Admin',
      email: `test_admin_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'admin',
    });
    createdUserIds.push(adminUser._id);

    const organizerUser = await User.create({
      name: 'Rohan Sharma Organizer',
      email: `rohan_org_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
      city: 'Bengaluru',
    });
    createdUserIds.push(organizerUser._id);

    const attendeeUser = await User.create({
      name: 'Pooja Attendee',
      email: `pooja_att_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
      city: 'Bengaluru',
    });
    createdUserIds.push(attendeeUser._id);

    const adminCookie = await createTestSessionAndCookie(adminUser);
    const organizerCookie = await createTestSessionAndCookie(organizerUser);
    const attendeeCookie = await createTestSessionAndCookie(attendeeUser);

    console.log(`  - Admin: ${adminUser.email}`);
    console.log(`  - Organizer: ${organizerUser.email}`);
    console.log(`  - Attendee: ${attendeeUser.email}\n`);

    // =========================================================================
    // TEST SECTION A: APPROVAL WORKFLOW & PUBLICATION EMAIL
    // =========================================================================
    console.log('--- TEST SECTION A: Approval Workflow & Publication Email ---');

    // Create a pending event with HTML entities in title to test escaping
    const pendingEvent = await Event.create({
      title: `AI & Cloud Summit <script>alert("xss")</script> ${testRunId}`,
      tagline: 'Leading innovators in generative cloud infrastructure',
      description: 'Annual gathering of software architects and cloud leaders.',
      category: 'Technology',
      format: 'In-Person',
      date: 'Dec 15, 2026',
      isoDate: new Date('2026-12-15T04:30:00.000Z'),
      time: '10:00 AM IST',
      city: 'Bengaluru',
      venue: 'Bangalore International Exhibition Centre',
      price: 'Free',
      priceNumber: 0,
      spotsLeft: 120,
      totalCapacity: 200,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'pending',
    });
    createdEventIds.push(pendingEvent._id);

    sentEmails.length = 0; // Clear mailbox buffer

    // 1. Authorized admin approves pending event
    const approveRes = await fetch(`${BASE}/admin/events/${pendingEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    const approveData = await approveRes.json();

    assert(approveRes.status === 200, '1. Authorized admin successfully approves pending event (200 OK)');
    assert(approveData.event?.status === 'published', '2. Event status successfully transitioned to "published"');

    // Verify DB record
    const publishedEvt = await Event.findById(pendingEvent._id);
    assert(publishedEvt.status === 'published', '2b. Event persisted as "published" in MongoDB');
    assert(publishedEvt.approvalEmailSent === true, '3. Event record marked approvalEmailSent: true');
    assert(publishedEvt.approvalEmailStatus === 'sent', '3b. Event record marked approvalEmailStatus: "sent"');

    // 4. Verify email delivery captured by mock transporter
    assert(sentEmails.length === 1, '4. Exactly one email was dispatched on approval');
    const emailObj = sentEmails[0] || {};
    assert(emailObj.to === organizerUser.email, `4b. Recipient email is correctly organizer registered address: ${emailObj.to}`);
    assert(emailObj.subject === 'Your event has been approved and published!', `5. Email subject matches standard: "${emailObj.subject}"`);

    // 5 & 6. Verify email content: title, date, venue
    assert(emailObj.text?.includes(pendingEvent.title), '5b. Plain-text body contains exact event title');
    assert(emailObj.html?.includes('Dec 15, 2026'), '6. HTML body contains event date (Dec 15, 2026)');
    assert(emailObj.html?.includes('Bangalore International Exhibition Centre'), '6b. HTML body contains venue');
    assert(emailObj.html?.includes('Rohan Sharma Organizer'), '6c. HTML body includes personalized greeting with organizer name');

    // 7. Verify public event link
    const expectedLink = `/events?q=${encodeURIComponent(pendingEvent.title)}`;
    assert(emailObj.html?.includes(expectedLink), `7. HTML email contains valid public event link: ${expectedLink}`);
    assert(emailObj.html?.includes('View Your Event'), '7b. HTML email includes clear call-to-action button: "View Your Event"');

    // 8. Verify HTML injection defense: script tags must be escaped
    assert(!emailObj.html?.includes('<script>'), '8. HTML content is safely escaped: no raw <script> tag present');
    assert(emailObj.html?.includes('&lt;script&gt;'), '8b. HTML content properly encoded script entities (&lt;script&gt;)');

    // 9. Existing organizer in-app notification still works
    const organizerNotif = await Notification.findOne({
      userId: organizerUser._id,
      type: 'event_approved',
      'metadata.eventId': pendingEvent._id,
    });
    assert(organizerNotif !== null, '9. In-app notification for organizer created in MongoDB');
    assert(organizerNotif?.title === 'Event Approved & Published!', '9b. In-app notification title is correct');

    // 10. Existing attendee publication notifications still work
    const attendeeNotif = await Notification.findOne({
      userId: attendeeUser._id,
      type: 'event_published',
      'metadata.eventId': pendingEvent._id,
    });
    assert(attendeeNotif !== null, '10. In-app broadcast notification for attendee created in MongoDB');

    // 11. Existing audit log still works
    const auditLog = await AuditLog.findOne({
      targetId: pendingEvent._id.toString(),
      action: 'event_approved',
    });
    assert(auditLog !== null, '11. Tamper-evident AuditLog recorded for admin approval');

    // =========================================================================
    // TEST SECTION B: DUPLICATE PREVENTION & IDEMPOTENCY
    // =========================================================================
    console.log('\n--- TEST SECTION B: Duplicate Prevention & Idempotency ---');

    sentEmails.length = 0; // Clear email buffer

    // 12. Approving an already-published event does not send another publication email
    const secondApproveRes = await fetch(`${BASE}/admin/events/${pendingEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert(secondApproveRes.status === 200, '12. Re-approving already-published event returns 200');
    assert(sentEmails.length === 0, '12b. Zero emails sent on redundant approval of published event');

    // 13. Direct service invocation for already sent event skips cleanly
    const directRes = await sendApprovalEmailForEvent(pendingEvent._id);
    assert(directRes.skipped === true && directRes.reason === 'already_sent', '13. Repeated service call returns { skipped: true, reason: "already_sent" }');
    assert(sentEmails.length === 0, '13b. No duplicate email triggered by direct service call');

    // 14. Concurrent approval dispatch protection
    sentEmails.length = 0;
    const concurrentEvent = await Event.create({
      title: `Concurrent Test Summit ${testRunId}`,
      category: 'Design',
      format: 'Online',
      date: 'Jan 10, 2027',
      isoDate: new Date('2027-01-10T10:00:00.000Z'),
      venue: 'UTSAV Virtual Auditorium',
      city: 'Online',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'pending',
    });
    createdEventIds.push(concurrentEvent._id);

    // Trigger two approvals concurrently
    const [cRes1, cRes2] = await Promise.all([
      fetch(`${BASE}/admin/events/${concurrentEvent._id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ action: 'approve' }),
      }),
      fetch(`${BASE}/admin/events/${concurrentEvent._id}/review`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: adminCookie },
        body: JSON.stringify({ action: 'approve' }),
      }),
    ]);
    assert(cRes1.status === 200 && cRes2.status === 200, '14. Both concurrent requests handled gracefully');
    assert(sentEmails.length === 1, `14b. Concurrency lock safely guaranteed exactly 1 email sent (sent: ${sentEmails.length})`);

    // 15. Ordinary edits to published event do not trigger email
    sentEmails.length = 0;
    const editRes = await fetch(`${BASE}/organizer/events/${concurrentEvent._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: organizerCookie },
      body: JSON.stringify({
        description: 'Updated with complete speaker line-up and timetable.',
      }),
    });
    assert(editRes.status === 200, '15. Organizer updated event details (200 OK)');
    assert(sentEmails.length === 0, '15b. Ordinary event update triggered ZERO publication emails');

    // 16. Re-approval after rejection follows transition policy
    sentEmails.length = 0;
    const rejectionEvent = await Event.create({
      title: `Moderation Re-approval Test ${testRunId}`,
      category: 'Business',
      format: 'In-Person',
      date: 'Jan 20, 2027',
      isoDate: new Date('2027-01-20T10:00:00.000Z'),
      venue: 'ITC Gardenia',
      city: 'Bengaluru',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'pending',
    });
    createdEventIds.push(rejectionEvent._id);

    // Admin rejects event
    await fetch(`${BASE}/admin/events/${rejectionEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'reject', rejectionReason: 'Missing business license verification.' }),
    });
    const rejectedDoc = await Event.findById(rejectionEvent._id);
    assert(rejectedDoc.status === 'rejected', '16. Event rejected by admin');
    assert(sentEmails.length === 0, '16b. Zero publication emails sent upon rejection');

    // Admin later approves after verification (rejected -> published)
    await fetch(`${BASE}/admin/events/${rejectionEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    const reapprovedDoc = await Event.findById(rejectionEvent._id);
    assert(reapprovedDoc.status === 'published', '16c. Re-approved event status updated to "published"');
    assert(sentEmails.length === 1, '16d. Re-approval after rejection triggered exactly one new publication email');
    assert(sentEmails[0].to === organizerUser.email, '16e. Publication email sent to organizer');

    // 17. Retrying failed delivery does not duplicate delivery records
    sentEmails.length = 0;
    const retryTestEvent = await Event.create({
      title: `Retry Idempotency Test ${testRunId}`,
      category: 'Technology',
      format: 'In-Person',
      date: 'Feb 1, 2027',
      isoDate: new Date('2027-02-01T10:00:00.000Z'),
      venue: 'BIEC Hall 2',
      city: 'Bengaluru',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'published',
      approvalEmailSent: false,
      approvalEmailStatus: 'failed',
      approvalEmailError: 'Connection refused',
      approvalEmailAttempts: 1,
    });
    createdEventIds.push(retryTestEvent._id);

    // Retry sending
    const retryResult = await sendApprovalEmailForEvent(retryTestEvent._id, { forceRetry: true });
    assert(retryResult.success === true, '17. Manual retry of failed delivery succeeded');
    assert(sentEmails.length === 1, '17b. Sent 1 email upon retry');

    const retriedDoc = await Event.findById(retryTestEvent._id);
    assert(retriedDoc.approvalEmailSent === true, '17c. Event marked approvalEmailSent: true');
    assert(retriedDoc.approvalEmailStatus === 'sent', '17d. Event marked approvalEmailStatus: "sent"');

    // Second retry should now see already_sent
    sentEmails.length = 0;
    const redundantRetry = await sendApprovalEmailForEvent(retryTestEvent._id);
    assert(redundantRetry.skipped === true, '17e. Subsequent retry skipped duplicate delivery');
    assert(sentEmails.length === 0, '17f. No duplicate email sent');

    // =========================================================================
    // TEST SECTION C: FAILURE HANDLING & FAULT TOLERANCE
    // =========================================================================
    console.log('\n--- TEST SECTION C: Failure Handling & Fault Tolerance ---');

    // Configure failing transporter (simulating SMTP outage)
    const failingTransporter = {
      sendMail: async () => {
        throw new Error('ETIMEDOUT: Connection to SMTP server dropped');
      },
    };
    setTransporter(failingTransporter);

    const outageEvent = await Event.create({
      title: `SMTP Outage Resilience Test ${testRunId}`,
      category: 'Music',
      format: 'In-Person',
      date: 'Feb 10, 2027',
      isoDate: new Date('2027-02-10T10:00:00.000Z'),
      venue: 'Palace Grounds',
      city: 'Bengaluru',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'pending',
    });
    createdEventIds.push(outageEvent._id);

    // 18. SMTP failure does not revert event publication
    const outageApproveRes = await fetch(`${BASE}/admin/events/${outageEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    const outageApproveData = await outageApproveRes.json();

    assert(outageApproveRes.status === 200, '18. Admin approval returns 200 despite SMTP failure');
    assert(outageApproveData.event?.status === 'published', '18b. Event successfully published despite SMTP error');

    // 19. SMTP failure does not falsely mark email as sent
    const outageEvtInDb = await Event.findById(outageEvent._id);
    assert(outageEvtInDb.approvalEmailSent === false, '19. approvalEmailSent remains false on delivery error');

    // 20. Failed delivery is recorded with error details
    assert(outageEvtInDb.approvalEmailStatus === 'failed', '20. approvalEmailStatus is marked "failed"');
    assert(outageEvtInDb.approvalEmailError.includes('ETIMEDOUT'), `20b. Error details safely recorded: "${outageEvtInDb.approvalEmailError}"`);
    assert(outageEvtInDb.approvalEmailAttempts >= 1, '20c. Attempt counter incremented');

    // 21 & 22. Retryable failure can be retried via batch worker
    setTransporter(mockTransporter); // Restore mock transporter
    sentEmails.length = 0;

    const retryBatchRes = await retryFailedApprovalEmails({ limit: 5 });
    assert(retryBatchRes.succeeded >= 1, `21. retryFailedApprovalEmails recovered failed event (succeeded: ${retryBatchRes.succeeded})`);
    assert(sentEmails.length >= 1, '21b. Recovered event email dispatched by retry worker');

    const recoveredDoc = await Event.findById(outageEvent._id);
    assert(recoveredDoc.approvalEmailSent === true, '22. Recovered event marked approvalEmailSent: true');
    assert(recoveredDoc.approvalEmailStatus === 'sent', '22b. Recovered event marked approvalEmailStatus: "sent"');

    // 23. Missing organizer records handled safely
    const orphanEvent = await Event.create({
      title: `Orphan Event ${testRunId}`,
      category: 'Community',
      format: 'Online',
      date: 'Feb 15, 2027',
      isoDate: new Date('2027-02-15T10:00:00.000Z'),
      venue: 'Online',
      city: 'Online',
      organizer: 'Unknown Organizer',
      organizerId: new mongoose.Types.ObjectId(), // Non-existent user ID
      status: 'published',
    });
    createdEventIds.push(orphanEvent._id);

    const orphanRes = await sendApprovalEmailForEvent(orphanEvent._id);
    assert(orphanRes.success === false, '23. Missing organizer user record returns success: false');
    const orphanDoc = await Event.findById(orphanEvent._id);
    assert(orphanDoc.status === 'published', '23b. Orphan event publication preserved');
    assert(orphanDoc.approvalEmailStatus === 'failed', '23c. Marked approvalEmailStatus: "failed"');

    // 24. Missing or invalid organizer email handled safely
    const noEmailUser = await User.create({
      name: 'No Email User',
      email: `no_email_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
    });
    createdUserIds.push(noEmailUser._id);
    // Erase email in DB directly to simulate invalid state
    await User.collection.updateOne({ _id: noEmailUser._id }, { $set: { email: '' } });

    const badEmailEvent = await Event.create({
      title: `Bad Email Event ${testRunId}`,
      category: 'Art',
      format: 'In-Person',
      date: 'Feb 20, 2027',
      isoDate: new Date('2027-02-20T10:00:00.000Z'),
      venue: 'Kala Grama',
      city: 'Bengaluru',
      organizer: noEmailUser.name,
      organizerId: noEmailUser._id,
      status: 'published',
    });
    createdEventIds.push(badEmailEvent._id);

    const badEmailRes = await sendApprovalEmailForEvent(badEmailEvent._id);
    assert(badEmailRes.success === false, '24. Missing organizer email returns success: false');
    const badEmailDoc = await Event.findById(badEmailEvent._id);
    assert(badEmailDoc.approvalEmailStatus === 'failed', '24b. Invalid email marked as failed');

    // 25. Fallback URL configuration policy
    const customUrl = 'https://custom-domain.utsav.in/events/test-slug';
    sentEmails.length = 0;
    await sendEventApprovalEmail({
      organizer: organizerUser,
      event: pendingEvent,
      publicEventUrl: customUrl,
    });
    assert(sentEmails[0].html?.includes(customUrl), '25. Custom public URL respected when supplied');

    // 26. Unauthorized users cannot approve events
    const attAttemptRes = await fetch(`${BASE}/admin/events/${pendingEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: attendeeCookie },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert(attAttemptRes.status === 403, '26. Attendee cannot approve events (403 Forbidden)');

    const guestAttemptRes = await fetch(`${BASE}/admin/events/${pendingEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    });
    assert(guestAttemptRes.status === 401, '26b. Unauthenticated guest cannot approve events (401 Unauthorized)');

    // =========================================================================
    // TEST SECTION D: REGRESSION VERIFICATION
    // =========================================================================
    console.log('\n--- TEST SECTION D: Regression Verification ---');

    // 27. Booking confirmation email
    sentEmails.length = 0;
    await sendBookingConfirmationEmail({
      booking: { bookingReference: 'UTSAV-BK-TEST', attendeeEmail: attendeeUser.email, attendeeName: attendeeUser.name, paymentStatus: 'free', totalAmount: 0 },
      event: pendingEvent,
      user: attendeeUser,
      tickets: [{ ticketCode: 'TKT-TEST-001', attendeeName: attendeeUser.name, qrData: 'UTSAV:TKT:001', ticketType: 'GA' }],
    });
    assert(sentEmails.length === 1 && sentEmails[0].subject.includes('Booking Confirmed'), '27. sendBookingConfirmationEmail functions correctly');

    // 28. Cancellation email
    sentEmails.length = 0;
    await sendCancellationEmail({
      booking: { bookingReference: 'UTSAV-BK-TEST', attendeeEmail: attendeeUser.email, attendeeName: attendeeUser.name, totalAmount: 0 },
      event: pendingEvent,
      user: attendeeUser,
      tickets: [],
    });
    assert(sentEmails.length === 1 && sentEmails[0].subject.toLowerCase().includes('cancelled'), '28. sendCancellationEmail functions correctly');

    // 29. Event reminder email
    sentEmails.length = 0;
    await sendEventReminderEmail({
      booking: { bookingReference: 'UTSAV-BK-TEST', attendeeEmail: attendeeUser.email, attendeeName: attendeeUser.name },
      event: pendingEvent,
      user: attendeeUser,
      reminderType: '24h',
      tickets: [],
    });
    assert(sentEmails.length === 1 && sentEmails[0].subject.includes('Reminder'), '29. sendEventReminderEmail functions correctly');

    // 30. 2FA verification email
    sentEmails.length = 0;
    await send2FAVerificationEmail({
      email: attendeeUser.email,
      otp: '789123',
      userName: attendeeUser.name,
    });
    assert(sentEmails.length === 1 && sentEmails[0].subject.includes('Verification Code'), '30. send2FAVerificationEmail functions correctly');

    // 31. Password reset email
    sentEmails.length = 0;
    await sendPasswordResetEmail({
      email: attendeeUser.email,
      resetUrl: 'http://localhost:5173/reset-password/sample-token',
      userName: attendeeUser.name,
    });
    assert(sentEmails.length === 1 && sentEmails[0].subject.includes('Password Reset'), '31. sendPasswordResetEmail functions correctly');

    // 32. Event rejection behavior
    const rejectEvent = await Event.create({
      title: `Rejection Test ${testRunId}`,
      category: 'Tech',
      date: 'Dec 30, 2026',
      isoDate: new Date('2026-12-30T10:00:00.000Z'),
      venue: 'Online',
      city: 'Online',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      status: 'pending',
    });
    createdEventIds.push(rejectEvent._id);

    const rejRes = await fetch(`${BASE}/admin/events/${rejectEvent._id}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', cookie: adminCookie },
      body: JSON.stringify({ action: 'reject', rejectionReason: 'Incomplete agenda' }),
    });
    const rejData = await rejRes.json();
    assert(rejRes.status === 200 && rejData.event?.status === 'rejected', '32. Event rejected with mandatory reason (200 OK)');
    assert(rejData.event?.rejectionReason === 'Incomplete agenda', '32b. Rejection reason recorded');

    // 33. Public discovery visibility: Published event is visible by ID and search query
    const publicDetailRes = await fetch(`${BASE}/events/${pendingEvent._id}`);
    const publicDetail = await publicDetailRes.json();
    assert(publicDetailRes.status === 200 && publicDetail.event?._id === pendingEvent._id.toString(), '33. Published event is visible in public /api/events/:id');

    const searchRes = await fetch(`${BASE}/events?q=${encodeURIComponent(pendingEvent.title)}`);
    const searchList = await searchRes.json();
    const foundInSearch = searchList.events?.some((e) => e._id === pendingEvent._id.toString());
    assert(foundInSearch === true, '33b. Published event is returned in public event search query');

    const rejectedDetailRes = await fetch(`${BASE}/events/${rejectEvent._id}`);
    assert(rejectedDetailRes.status === 404, '33c. Rejected event is strictly hidden from public discovery (404 Not Found)');

    // 34. Booking placement flow on published event
    const bookingRes = await fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attendeeCookie },
      body: JSON.stringify({
        eventId: pendingEvent._id,
        quantity: 1,
        ticketType: 'General Admission',
      }),
    });
    const bookingData = await bookingRes.json();
    assert(bookingRes.status === 201 && bookingData.booking?.status === 'confirmed', '34. Free pass booking succeeds on published event');

    // 35. Real-time notification count verified
    const attendeeNotifCount = await Notification.countDocuments({ userId: attendeeUser._id });
    assert(attendeeNotifCount >= 1, '35. Real-time in-app notifications generated for attendee');

    // 36. Verify final event state in MongoDB
    const finalEvt = await Event.findById(pendingEvent._id);
    assert(finalEvt.approvalEmailSent === true, '36. Final event approvalEmailSent confirmed in DB');
    assert(finalEvt.approvalEmailStatus === 'sent', '36b. Final event approvalEmailStatus is "sent"');
    assert(Boolean(finalEvt.approvalEmailMessageId), '36c. Final event records approvalEmailMessageId');
    assert(finalEvt.approvalEmailRecipient === organizerUser.email, '36d. Final event records organizer recipient email');

  } catch (err) {
    console.error('❌ FATAL TEST EXCEPTION:', err);
    failed++;
  } finally {
    // Restore original transporter
    setTransporter(originalTransporter);

    // Clean up test artifacts
    console.log('\n--- Cleaning up test artifacts ---');
    try {
      if (createdEventIds.length > 0) {
        await Event.deleteMany({ _id: { $in: createdEventIds } });
        await Booking.deleteMany({ eventId: { $in: createdEventIds } });
        await Notification.deleteMany({ 'metadata.eventId': { $in: createdEventIds } });
        await AuditLog.deleteMany({ targetId: { $in: createdEventIds.map((id) => id.toString()) } });
      }
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
        await Notification.deleteMany({ userId: { $in: createdUserIds } });
      }
      if (createdSessionIds.length > 0) {
        await Session.deleteMany({ sessionId: { $in: createdSessionIds } });
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await mongoose.disconnect();
    console.log('Database disconnected.');

    console.log('\n===============================================================');
    console.log(`📊 FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('===============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
