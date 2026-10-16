import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

async function runReviewTests() {
  console.log('=== UTSAV RATINGS & REVIEWS TEST SUITE ===\n');

  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('✓ MongoDB Connected.\n');

  // 1. Authenticate Attendee A (testattendee@utsav.com)
  const attendeeARes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'testattendee@utsav.com', password: 'Password123!' }),
  });
  const attendeeA = await attendeeARes.json();
  const tokenA = attendeeA.token;
  const userAId = new mongoose.Types.ObjectId(attendeeA.user._id || attendeeA.user.id);
  console.log(`✓ Attendee A authenticated: ID=${userAId}`);

  // 2. Authenticate or Find Attendee B
  let userB = await db.collection('users').findOne({ role: 'attendee', _id: { $ne: userAId } });
  if (!userB) {
    const bId = new mongoose.Types.ObjectId();
    await db.collection('users').insertOne({
      _id: bId,
      name: 'Second Test Attendee',
      email: 'second_attendee@utsav.com',
      role: 'attendee',
      createdAt: new Date(),
    });
    userB = await db.collection('users').findOne({ _id: bId });
  }
  const userBId = userB._id;

  // Sign token for Attendee B
  const jwtSecret = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';
  const jwt = await import('jsonwebtoken');
  const tokenB = jwt.default.sign({ id: userBId.toString() }, jwtSecret, { expiresIn: '1d' });
  console.log(`✓ Attendee B authenticated: ID=${userBId}\n`);

  // 3. Admin Authentication
  const adminRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: 'lohith2605' }),
  });
  const adminData = await adminRes.json();
  const adminToken = adminData.token;
  console.log('✓ Admin authenticated.\n');

  const organizer = await db.collection('users').findOne({ role: 'organizer' });

  // 4. Staging Future Event (Has NOT ended)
  const futureEventId = new mongoose.Types.ObjectId();
  await db.collection('events').insertOne({
    _id: futureEventId,
    title: 'Future AI Summit 2027',
    category: 'Technology',
    city: 'Bengaluru',
    venue: 'BIEC Arena',
    organizer: organizer?.name || 'UTSAV Council',
    organizerId: organizer?._id,
    date: 'Dec 15, 2027',
    isoDate: new Date('2027-12-15T09:00:00Z'),
    startDate: new Date('2027-12-15T09:00:00Z'),
    endDate: new Date('2027-12-16T18:00:00Z'),
    time: '09:00 AM IST',
    status: 'published',
    averageRating: 0,
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const runSuffix = Date.now();
  // Staging Confirmed Booking for Attendee A on Future Event
  await db.collection('bookings').insertOne({
    userId: userAId,
    eventId: futureEventId,
    bookingReference: `BK-FUTURE-${runSuffix}`,
    status: 'confirmed',
    paymentStatus: 'completed',
    totalAmount: 499,
    createdAt: new Date(),
  });

  // 5. Staging Concluded Event (Has already ended)
  const pastEventId = new mongoose.Types.ObjectId();
  await db.collection('events').insertOne({
    _id: pastEventId,
    title: 'UTSAV Flagship Retro Hackathon 2025',
    category: 'Technology',
    city: 'Bengaluru',
    venue: 'Palace Grounds',
    organizer: organizer?.name || 'UTSAV Council',
    organizerId: organizer?._id,
    date: 'Jan 10, 2025',
    isoDate: new Date('2025-01-10T09:00:00Z'),
    startDate: new Date('2025-01-10T09:00:00Z'),
    endDate: new Date('2025-01-11T18:00:00Z'),
    time: '09:00 AM IST',
    status: 'completed',
    averageRating: 0,
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Staging Confirmed Booking for Attendee A on Past Event
  await db.collection('bookings').insertOne({
    userId: userAId,
    eventId: pastEventId,
    bookingReference: `BK-PAST-A-${runSuffix}`,
    status: 'confirmed',
    paymentStatus: 'completed',
    totalAmount: 299,
    createdAt: new Date(),
  });

  // Staging Confirmed Booking for Attendee B on Past Event
  await db.collection('bookings').insertOne({
    userId: userBId,
    eventId: pastEventId,
    bookingReference: `BK-PAST-B-${runSuffix}`,
    status: 'confirmed',
    paymentStatus: 'completed',
    totalAmount: 299,
    createdAt: new Date(),
  });

  console.log('--- TEST CASES ---');

  // TEST 1: Unauthorized Submission (No token)
  console.log('\n[TEST 1] Unauthorized submission check...');
  const t1 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: pastEventId.toString(), rating: 5 }),
  });
  console.log(`Response status: ${t1.status} (Expected: 401)`);
  if (t1.status !== 401) throw new Error('TEST 1 Failed: Expected 401 Unauthorized');
  console.log('✓ TEST 1 Passed.');

  // TEST 2: Invalid Rating Value (Rating: 6)
  console.log('\n[TEST 2] Invalid rating value (rating = 6)...');
  const t2 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ eventId: pastEventId.toString(), rating: 6, comment: 'Great' }),
  });
  console.log(`Response status: ${t2.status} (Expected: 400)`);
  if (t2.status !== 400) throw new Error('TEST 2 Failed: Expected 400 for rating > 5');
  console.log('✓ TEST 2 Passed.');

  // TEST 3: Unconfirmed / Not Booked Event
  console.log('\n[TEST 3] Reviewing an event without booking...');
  const unbookedEventId = new mongoose.Types.ObjectId();
  await db.collection('events').insertOne({
    _id: unbookedEventId,
    title: 'Random Event',
    category: 'Music',
    city: 'Mumbai',
    venue: 'Arena',
    organizer: 'Organizer',
    organizerId: organizer?._id,
    date: 'Jan 01, 2025',
    isoDate: new Date('2025-01-01T09:00:00Z'),
    endDate: new Date('2025-01-01T18:00:00Z'),
    status: 'published',
  });
  const t3 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ eventId: unbookedEventId.toString(), rating: 5, comment: 'I did not book this' }),
  });
  console.log(`Response status: ${t3.status} (Expected: 403)`);
  if (t3.status !== 403) throw new Error('TEST 3 Failed: Expected 403 Forbidden for non-booked event');
  console.log('✓ TEST 3 Passed.');

  // TEST 4: Event Not Ended Yet
  console.log('\n[TEST 4] Reviewing an event before it has concluded...');
  const t4 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ eventId: futureEventId.toString(), rating: 5, comment: 'Too early' }),
  });
  const t4Data = await t4.json();
  console.log(`Response status: ${t4.status} (Expected: 400), Message: "${t4Data.message}"`);
  if (t4.status !== 400) throw new Error('TEST 4 Failed: Expected 400 for event before conclusion');
  console.log('✓ TEST 4 Passed.');

  // TEST 5: Valid Review Submission (Attendee A on concluded event)
  console.log('\n[TEST 5] Valid review submission with written feedback...');
  const t5 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      eventId: pastEventId.toString(),
      rating: 5,
      comment: 'Incredible summit with top-notch speakers!',
    }),
  });
  const t5Data = await t5.json();
  console.log(`Response status: ${t5.status}, Message: "${t5Data.message}"`);
  if (t5.status !== 200 || !t5Data.success) throw new Error('TEST 5 Failed');
  const reviewAId = t5Data.review._id;

  // Verify DB recalculation on Event
  const pastEvtAfterT5 = await db.collection('events').findOne({ _id: pastEventId });
  console.log(`Event Rating Stats: average=${pastEvtAfterT5.averageRating}, count=${pastEvtAfterT5.reviewCount} (Expected: 5.0, 1)`);
  if (pastEvtAfterT5.averageRating !== 5.0 || pastEvtAfterT5.reviewCount !== 1) {
    throw new Error('TEST 5 Failed: Event rating recalculation mismatch');
  }
  console.log('✓ TEST 5 Passed.');

  // TEST 6: Valid Review with Optional Written Feedback (Attendee B rating only)
  console.log('\n[TEST 6] Valid review submission with optional written feedback omitted...');
  const t6 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({
      eventId: pastEventId.toString(),
      rating: 4,
      comment: '',
    }),
  });
  const t6Data = await t6.json();
  console.log(`Response status: ${t6.status}, Message: "${t6Data.message}"`);
  if (t6.status !== 200 || !t6Data.success) throw new Error('TEST 6 Failed');

  // Verify Aggregation Calculation: (5 + 4) / 2 = 4.5, count = 2
  const pastEvtAfterT6 = await db.collection('events').findOne({ _id: pastEventId });
  console.log(`Event Aggregation: average=${pastEvtAfterT6.averageRating}, count=${pastEvtAfterT6.reviewCount} (Expected: 4.5, 2)`);
  if (pastEvtAfterT6.averageRating !== 4.5 || pastEvtAfterT6.reviewCount !== 2) {
    throw new Error('TEST 6 Failed: Rating aggregation mismatch');
  }
  console.log('✓ TEST 6 Passed.');

  // TEST 7: Single Review Uniqueness (Attendee A submits again)
  console.log('\n[TEST 7] Duplicate review prevention / single-review rule...');
  const t7 = await fetch('http://127.0.0.1:5000/api/reviews', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({
      eventId: pastEventId.toString(),
      rating: 5,
      comment: 'Updated review content',
    }),
  });
  const t7Data = await t7.json();
  const totalReviewsInDb = await db.collection('reviews').countDocuments({ eventId: pastEventId });
  console.log(`Total reviews in DB for event: ${totalReviewsInDb} (Expected: exactly 2)`);
  if (totalReviewsInDb !== 2) throw new Error('TEST 7 Failed: Duplicate review was created in DB');
  console.log('✓ TEST 7 Passed.');

  // TEST 8: Ownership-Verified Review Editing (PUT /api/reviews/:id)
  console.log('\n[TEST 8] Ownership check when editing review...');
  // Attendee B tries to edit Attendee A's review
  const t8Unauthorized = await fetch(`http://127.0.0.1:5000/api/reviews/${reviewAId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ rating: 1, comment: 'Hacked review' }),
  });
  console.log(`Unauthorized edit status: ${t8Unauthorized.status} (Expected: 403)`);
  if (t8Unauthorized.status !== 403) throw new Error('TEST 8 Failed: Non-owner was able to edit review');

  // Attendee A edits their own review to rating 3
  const t8Authorized = await fetch(`http://127.0.0.1:5000/api/reviews/${reviewAId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ rating: 3, comment: 'Adjusted rating after reflection.' }),
  });
  const t8AuthorizedData = await t8Authorized.json();
  console.log(`Owner edit status: ${t8Authorized.status}, Success: ${t8AuthorizedData.success}`);
  if (t8Authorized.status !== 200) throw new Error('TEST 8 Failed: Owner could not edit review');

  // Verify Aggregation Update: (3 + 4) / 2 = 3.5
  const pastEvtAfterT8 = await db.collection('events').findOne({ _id: pastEventId });
  console.log(`Recalculated Event Aggregation: average=${pastEvtAfterT8.averageRating}, count=${pastEvtAfterT8.reviewCount} (Expected: 3.5, 2)`);
  if (pastEvtAfterT8.averageRating !== 3.5 || pastEvtAfterT8.reviewCount !== 2) {
    throw new Error('TEST 8 Failed: Aggregation did not update after edit');
  }
  console.log('✓ TEST 8 Passed.');

  // TEST 9: Admin Moderation (Hide review & verify recalculation)
  console.log('\n[TEST 9] Admin moderation & exclusion from active rating...');
  const t9Hide = await fetch(`http://127.0.0.1:5000/api/admin/reviews/${reviewAId}/moderate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'hide', reason: 'Content flagged by moderator' }),
  });
  const t9HideData = await t9Hide.json();
  console.log(`Admin hide status: ${t9Hide.status}, Success: ${t9HideData.success}`);

  // When Review A is hidden, only Review B (rating 4) remains active
  const pastEvtAfterHide = await db.collection('events').findOne({ _id: pastEventId });
  console.log(`Event Aggregation after Hide: average=${pastEvtAfterHide.averageRating}, count=${pastEvtAfterHide.reviewCount} (Expected: 4.0, 1)`);
  if (pastEvtAfterHide.averageRating !== 4.0 || pastEvtAfterHide.reviewCount !== 1) {
    throw new Error('TEST 9 Failed: Hidden review was not excluded from active ratings');
  }

  // Admin Unhides (Publishes) Review A again
  const t9Publish = await fetch(`http://127.0.0.1:5000/api/admin/reviews/${reviewAId}/moderate`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'publish' }),
  });
  const pastEvtAfterPublish = await db.collection('events').findOne({ _id: pastEventId });
  console.log(`Event Aggregation after Publish: average=${pastEvtAfterPublish.averageRating}, count=${pastEvtAfterPublish.reviewCount} (Expected: 3.5, 2)`);
  if (pastEvtAfterPublish.averageRating !== 3.5 || pastEvtAfterPublish.reviewCount !== 2) {
    throw new Error('TEST 9 Failed: Unhidden review was not restored in active ratings');
  }
  console.log('✓ TEST 9 Passed.');

  // TEST 10: Public Event Reviews API & My Reviews API
  console.log('\n[TEST 10] Public Event Reviews & My Reviews endpoint verification...');
  const publicReviewsRes = await fetch(`http://127.0.0.1:5000/api/reviews/event/${pastEventId}`);
  const publicReviewsData = await publicReviewsRes.json();
  console.log(`Public Reviews count: ${publicReviewsData.count}, average: ${publicReviewsData.averageRating}`);
  if (publicReviewsData.count !== 2 || publicReviewsData.averageRating !== 3.5) {
    throw new Error('TEST 10 Failed: Public reviews endpoint mismatch');
  }

  const myReviewsRes = await fetch('http://127.0.0.1:5000/api/reviews/my-reviews', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const myReviewsData = await myReviewsRes.json();
  console.log(`Attendee A my-reviews count: ${myReviewsData.count}`);
  if (!Array.isArray(myReviewsData.reviews) || myReviewsData.count < 1) {
    throw new Error('TEST 10 Failed: my-reviews endpoint returned invalid data');
  }
  console.log('✓ TEST 10 Passed.');

  // Cleanup test documents
  await db.collection('events').deleteMany({ _id: { $in: [futureEventId, pastEventId, unbookedEventId] } });
  await db.collection('bookings').deleteMany({ eventId: { $in: [futureEventId, pastEventId, unbookedEventId] } });
  await db.collection('reviews').deleteMany({ eventId: { $in: [futureEventId, pastEventId, unbookedEventId] } });
  await mongoose.disconnect();

  console.log('\n==============================================');
  console.log('🎉 ALL 10 RATINGS & REVIEWS TEST CASES PASSED 100%!');
  console.log('==============================================\n');
}

runReviewTests().catch((err) => {
  console.error('\n❌ Review Tests Failed:', err);
  process.exit(1);
});
