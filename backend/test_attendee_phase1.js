const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('====================================================');
  console.log(' UTSAV — Phase 1: Attendee Verification Test Suite  ');
  console.log('====================================================\n');

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

  // 1. Guest protection check
  console.log('Step 1: Testing Guest Authorization Protection...');
  const guestRes = await fetch(`${BASE_URL}/bookings/my-bookings`);
  assert(guestRes.status === 401, 'Guest request to /api/bookings/my-bookings returns 401 Unauthorized');
  const guestTkt = await fetch(`${BASE_URL}/tickets/my-tickets`);
  assert(guestTkt.status === 401, 'Guest request to /api/tickets/my-tickets returns 401 Unauthorized');
  const guestNotif = await fetch(`${BASE_URL}/notifications`);
  assert(guestNotif.status === 401, 'Guest request to /api/notifications returns 401 Unauthorized');
  const guestProf = await fetch(`${BASE_URL}/users/profile`);
  assert(guestProf.status === 401, 'Guest request to /api/users/profile returns 401 Unauthorized');

  // 2. Register / Authenticate Test Attendee A
  console.log('\nStep 2: Authenticating Attendee A...');
  const emailA = `attendee_a_${Date.now()}@utsav.test`;
  const regARes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Aarav Patel',
      email: emailA,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'attendee',
    }),
  });
  const cookieA = regARes.headers.get('set-cookie');
  const regAData = await regARes.json();
  assert(regARes.status === 201 && regAData.user?.role === 'attendee', 'Attendee A registered with role: attendee');

  // 3. Register / Authenticate Test Attendee B
  console.log('\nStep 3: Authenticating Attendee B...');
  const emailB = `attendee_b_${Date.now()}@utsav.test`;
  const regBRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Diya Sharma',
      email: emailB,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      role: 'attendee',
    }),
  });
  const cookieB = regBRes.headers.get('set-cookie');
  assert(regBRes.status === 201, 'Attendee B registered');

  // Helper for authenticated requests
  const authFetch = (url, options = {}, cookie = cookieA) => {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookie,
        ...(options.headers || {}),
      },
    });
  };

  // 4. Test Profile Management
  console.log('\nStep 4: Testing Profile Management and Role Protection...');
  const profRes = await authFetch(`${BASE_URL}/users/profile`);
  const profData = await profRes.json();
  assert(profData.user.name === 'Aarav Patel', 'Attendee A profile retrieved successfully');

  // Attempt role escalation
  const updateProfRes = await authFetch(`${BASE_URL}/users/profile`, {
    method: 'PUT',
    body: JSON.stringify({
      name: 'Aarav Patel (Updated)',
      phone: '+91 99999 88888',
      bio: 'Loves open-source hackathons',
      city: 'Bangalore',
      role: 'admin', // Escalation attempt
    }),
  });
  const updateProfData = await updateProfRes.json();
  assert(updateProfData.user.name === 'Aarav Patel (Updated)', 'Attendee name and bio updated');
  assert(updateProfData.user.role === 'attendee', 'Role escalation prevented: User remains attendee');

  // 5. Fetch Real Events from DB
  console.log('\nStep 5: Testing Event Discovery...');
  const eventsRes = await fetch(`${BASE_URL}/events`);
  const eventsData = await eventsRes.json();
  assert(eventsData.success && eventsData.events.length > 0, `Discovered ${eventsData.events.length} real events in MongoDB`);
  const freeEvent = eventsData.events.find((e) => e.priceNumber === 0);
  const paidEvent = eventsData.events.find((e) => e.priceNumber > 0);
  assert(!!freeEvent, `Found free event: ${freeEvent?.title}`);
  assert(!!paidEvent, `Found paid event: ${paidEvent?.title}`);

  // 6. Test Free Event Booking Workflow
  console.log('\nStep 6: Testing Free Booking & Ticket Issuance...');
  const initialSpots = freeEvent.spotsLeft;
  const bookRes = await authFetch(`${BASE_URL}/bookings`, {
    method: 'POST',
    body: JSON.stringify({
      eventId: freeEvent._id,
      quantity: 2,
      ticketType: 'General Admission',
    }),
  });
  const bookData = await bookRes.json();
  assert(bookRes.status === 201, 'Booking API returned 201 Created');
  assert(bookData.booking.status === 'confirmed', 'Free booking status is immediately "confirmed"');
  assert(bookData.booking.paymentStatus === 'free', 'Payment status is "free"');
  assert(bookData.tickets.length === 2, 'Exactly 2 digital tickets issued');
  assert(bookData.tickets[0].ticketCode.startsWith('UTSAV-TKT-'), 'Ticket code formatted as UTSAV-TKT-XXXX');
  
  // Safe QR check
  const qrPayload = JSON.parse(bookData.tickets[0].qrData);
  assert(qrPayload.app === 'UTSAV' && qrPayload.sig, 'Ticket QR payload contains valid server signature');
  assert(!qrPayload.token && !qrPayload.password, 'Ticket QR payload does NOT contain any authentication token or secret');

  const bookingIdA = bookData.booking._id;
  const ticketIdA = bookData.tickets[0]._id;

  // 7. Verify Inventory Decrement
  console.log('\nStep 7: Testing Inventory Concurrency & Spots Left...');
  const updatedEventRes = await fetch(`${BASE_URL}/events/${freeEvent._id}`);
  const updatedEventData = await updatedEventRes.json();
  assert(updatedEventData.event.spotsLeft === initialSpots - 2, `Spots decremented correctly from ${initialSpots} to ${updatedEventData.event.spotsLeft}`);

  // 8. Test Paid Booking Workflow (Honest Pending Gateway state)
  console.log('\nStep 8: Testing Paid Event Booking Handling...');
  const paidBookRes = await authFetch(`${BASE_URL}/bookings`, {
    method: 'POST',
    body: JSON.stringify({
      eventId: paidEvent._id,
      quantity: 1,
    }),
  });
  const paidBookData = await paidBookRes.json();
  assert(paidBookRes.status === 201, 'Paid reservation recorded');
  assert(paidBookData.booking.status === 'pending', 'Paid booking is honestly marked "pending" (never falsely confirmed)');
  assert(paidBookData.tickets.length === 0, 'No active tickets issued for unverified payment');

  // 9. Test Notifications
  console.log('\nStep 9: Testing Notifications & Mark Read...');
  const notifRes = await authFetch(`${BASE_URL}/notifications`);
  const notifData = await notifRes.json();
  assert(notifData.notifications.length >= 1, `Attendee A has ${notifData.notifications.length} real notifications`);
  const unreadNotif = notifData.notifications[0];

  const markReadRes = await authFetch(`${BASE_URL}/notifications/${unreadNotif._id}/read`, {
    method: 'PATCH',
  });
  const markReadData = await markReadRes.json();
  assert(markReadData.notification.isRead === true, 'Notification marked as read');

  // 10. Test Event Reviews (Eligibility Enforcement)
  console.log('\nStep 10: Testing Event Review Eligibility & Duplicate Prevention...');
  // Attendee A booked freeEvent -> Eligible!
  const reviewResA = await authFetch(`${BASE_URL}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      eventId: freeEvent._id,
      rating: 5,
      comment: 'Incredible hackathon mentoring and energetic atmosphere!',
    }),
  });
  const reviewDataA = await reviewResA.json();
  assert(reviewResA.status === 200 && reviewDataA.review.rating === 5, 'Eligible attendee review saved successfully');

  // Attendee B did NOT book freeEvent -> Ineligible! Must be blocked with 403
  const reviewResB = await authFetch(`${BASE_URL}/reviews`, {
    method: 'POST',
    body: JSON.stringify({
      eventId: freeEvent._id,
      rating: 4,
      comment: 'Trying to review without booking',
    }),
  }, cookieB);
  assert(reviewResB.status === 403, 'Ineligible attendee review strictly rejected with 403 Forbidden');

  // 11. Cross-Attendee Privacy & Authorization Enforcement
  console.log('\nStep 11: Testing Cross-Attendee Privacy (Isolation)...');
  // Attendee B tries to access Attendee A's booking
  const crossBookRes = await authFetch(`${BASE_URL}/bookings/${bookingIdA}`, {}, cookieB);
  assert(crossBookRes.status === 403, 'Attendee B cannot view Attendee A’s booking (403)');

  // Attendee B tries to access Attendee A's ticket
  const crossTktRes = await authFetch(`${BASE_URL}/tickets/${ticketIdA}`, {}, cookieB);
  assert(crossTktRes.status === 403, 'Attendee B cannot access Attendee A’s ticket pass (403)');

  // Attendee B tries to cancel Attendee A's booking
  const crossCancelRes = await authFetch(`${BASE_URL}/bookings/${bookingIdA}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Malicious attempt' }),
  }, cookieB);
  assert(crossCancelRes.status === 403, 'Attendee B cannot cancel Attendee A’s booking (403)');

  // 12. Test Cancellation and Inventory Restoration
  console.log('\nStep 12: Testing Legitimate Booking Cancellation & Inventory Rollback...');
  const cancelRes = await authFetch(`${BASE_URL}/bookings/${bookingIdA}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Schedule clash' }),
  }, cookieA);
  const cancelData = await cancelRes.json();
  assert(cancelRes.status === 200, 'Attendee A successfully cancelled booking');
  assert(cancelData.booking.status === 'cancelled', 'Booking status updated to "cancelled"');

  // Check inventory restored
  const restoredEventRes = await fetch(`${BASE_URL}/events/${freeEvent._id}`);
  const restoredEventData = await restoredEventRes.json();
  assert(restoredEventData.event.spotsLeft === initialSpots, `Inventory restored back to ${initialSpots} spots`);

  // Check ticket status updated to cancelled
  const tktCheckRes = await authFetch(`${BASE_URL}/tickets/${ticketIdA}`, {}, cookieA);
  const tktCheckData = await tktCheckRes.json();
  assert(tktCheckData.ticket.status === 'cancelled', 'Ticket status updated to "cancelled"');

  // 13. Test Overview Stats Aggregation
  console.log('\nStep 13: Testing Attendee Overview Aggregation...');
  const statsRes = await authFetch(`${BASE_URL}/bookings/overview-stats`, {}, cookieA);
  const statsData = await statsRes.json();
  assert(statsData.success, 'Overview stats returned successfully');
  assert(statsData.stats.totalBookings >= 1, `Total bookings counted accurately (${statsData.stats.totalBookings})`);

  console.log('\n====================================================');
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED `);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite encountered an uncaught error:', err);
  process.exit(1);
});
