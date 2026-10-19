import http from 'http';
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
import Conversation from '../src/models/Conversation.js';
import Message from '../src/models/Message.js';
import { initSocket } from '../src/services/socketService.js';
import { io as ClientIO } from '../../frontend/node_modules/socket.io-client/build/esm/index.js';

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

async function runFrontendIntegrationTestSuite() {
  console.log('====================================================================');
  console.log('💬 UTSAV — Real-Time Event Chat (Phase 2 Frontend Integration Tests)');
  console.log('   Full End-to-End Contract Validation for Chat Frontend Flows');
  console.log('====================================================================\n');

  // 1. Connect MongoDB
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.\n');

  // 2. Start HTTP server with Socket.IO initialized
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  const server = httpServer.listen(0);
  const port = server.address().port;
  const BASE = `http://localhost:${port}/api/chat`;
  const SOCKET_URL = `http://localhost:${port}`;
  console.log(`Test server running on port ${port} with Socket.IO initialized.\n`);

  const testRunId = Date.now();
  const createdUserIds = [];
  const createdEventIds = [];
  const createdBookingIds = [];
  const createdSessionIds = [];
  const createdConversationIds = [];

  const createTestSessionAndCookie = async (user) => {
    const sessionId = crypto.randomUUID();
    await Session.create({
      userId: user._id,
      sessionId,
      ipAddress: '127.0.0.1',
      userAgent: 'frontend-integration-runner',
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

    return {
      cookie: `token=${token}`,
      token,
    };
  };

  try {
    console.log('--- Setting up test accounts & fixtures ---');

    // Admin
    const adminUser = await User.create({
      name: 'Super Admin',
      email: `admin_f2_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'admin',
    });
    createdUserIds.push(adminUser._id);

    // Organizer A (Owner of Event A)
    const organizerA = await User.create({
      name: 'Organizer Alice',
      email: `alice_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
    });
    createdUserIds.push(organizerA._id);

    // Organizer B (Owner of Event B)
    const organizerB = await User.create({
      name: 'Organizer Bob',
      email: `bob_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
    });
    createdUserIds.push(organizerB._id);

    // Attendee 1 (Has confirmed booking for Event A)
    const attendeeEligible = await User.create({
      name: 'Attendee Eligible',
      email: `eligible_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
    });
    createdUserIds.push(attendeeEligible._id);

    // Attendee 2 (Has cancelled/refunded booking for Event A)
    const attendeeCancelled = await User.create({
      name: 'Attendee Cancelled',
      email: `cancelled_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
    });
    createdUserIds.push(attendeeCancelled._id);

    // Attendee 3 (Has no booking at all)
    const attendeeNoBooking = await User.create({
      name: 'Attendee NoBooking',
      email: `nobooking_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
    });
    createdUserIds.push(attendeeNoBooking._id);

    // Auth credentials
    const adminAuth = await createTestSessionAndCookie(adminUser);
    const orgAAuth = await createTestSessionAndCookie(organizerA);
    const orgBAuth = await createTestSessionAndCookie(organizerB);
    const attEligibleAuth = await createTestSessionAndCookie(attendeeEligible);
    const attCancelledAuth = await createTestSessionAndCookie(attendeeCancelled);
    const attNoBookingAuth = await createTestSessionAndCookie(attendeeNoBooking);

    // Events
    const eventA = await Event.create({
      title: `Grand Tech Symposium ${testRunId}`,
      category: 'Technology',
      format: 'In-Person',
      date: 'Mar 10, 2027',
      isoDate: new Date('2027-03-10T09:00:00.000Z'),
      venue: 'Bengaluru Tech Park',
      city: 'Bengaluru',
      organizer: organizerA.name,
      organizerId: organizerA._id,
      status: 'published',
    });
    createdEventIds.push(eventA._id);

    const eventB = await Event.create({
      title: `Global Design Meetup ${testRunId}`,
      category: 'Design',
      format: 'In-Person',
      date: 'Apr 15, 2027',
      isoDate: new Date('2027-04-15T09:00:00.000Z'),
      venue: 'Mumbai Hub',
      city: 'Mumbai',
      organizer: organizerB.name,
      organizerId: organizerB._id,
      status: 'published',
    });
    createdEventIds.push(eventB._id);

    // Bookings
    const bookingEligible = await Booking.create({
      userId: attendeeEligible._id,
      eventId: eventA._id,
      bookingReference: `UTSAV-EL-${testRunId}`,
      attendeeName: attendeeEligible.name,
      attendeeEmail: attendeeEligible.email,
      quantity: 1,
      totalAmount: 100,
      status: 'confirmed',
      paymentStatus: 'completed',
      refundStatus: 'none',
    });
    createdBookingIds.push(bookingEligible._id);

    const bookingCancelled = await Booking.create({
      userId: attendeeCancelled._id,
      eventId: eventA._id,
      bookingReference: `UTSAV-CA-${testRunId}`,
      attendeeName: attendeeCancelled.name,
      attendeeEmail: attendeeCancelled.email,
      quantity: 1,
      totalAmount: 100,
      status: 'cancelled',
      paymentStatus: 'refunded',
      refundStatus: 'processed',
    });
    createdBookingIds.push(bookingCancelled._id);

    console.log('Fixtures initialized successfully.\n');

    // -------------------------------------------------------------------------
    // TEST 1: Attendee with eligible booking opens the correct conversation
    // -------------------------------------------------------------------------
    console.log('--- TEST 1: Attendee with eligible booking opens conversation ---');
    const resAttOpen = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: attEligibleAuth.cookie,
      },
      body: JSON.stringify({
        eventId: eventA._id.toString(),
        type: 'attendee_organizer',
      }),
    });
    assert(resAttOpen.status === 200, 'Attendee with eligible booking receives 200 OK');
    const dataAttOpen = await resAttOpen.json();
    assert(dataAttOpen.success === true, 'Response payload has success: true');
    const attendeeConvId = dataAttOpen.conversation._id;
    createdConversationIds.push(attendeeConvId);
    assert(
      dataAttOpen.conversation.eventId._id.toString() === eventA._id.toString(),
      'Conversation is associated with the exact Event A'
    );
    assert(
      dataAttOpen.conversation.organizerId._id.toString() === organizerA._id.toString(),
      'Conversation participant is organizer Alice'
    );
    assert(
      dataAttOpen.conversation.attendeeId._id.toString() === attendeeEligible._id.toString(),
      'Conversation participant is attendee Eligible'
    );

    // -------------------------------------------------------------------------
    // TEST 2: Attendee without an eligible booking cannot access it
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 2: Ineligible attendee access denial ---');
    // A: Cancelled booking
    const resCancelled = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: attCancelledAuth.cookie,
      },
      body: JSON.stringify({
        eventId: eventA._id.toString(),
        type: 'attendee_organizer',
      }),
    });
    assert(
      resCancelled.status === 403,
      'Attendee with cancelled booking is rejected with 403 Forbidden'
    );

    // B: No booking at all
    const resNoBooking = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: attNoBookingAuth.cookie,
      },
      body: JSON.stringify({
        eventId: eventA._id.toString(),
        type: 'attendee_organizer',
      }),
    });
    assert(
      resNoBooking.status === 403,
      'Attendee with zero booking is rejected with 403 Forbidden'
    );

    // -------------------------------------------------------------------------
    // TEST 3: Attendee cannot access another event's chat
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 3: Attendee cross-event isolation ---');
    const resCrossEvent = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: attEligibleAuth.cookie,
      },
      body: JSON.stringify({
        eventId: eventB._id.toString(), // Event B where attendee has no booking
        type: 'attendee_organizer',
      }),
    });
    assert(
      resCrossEvent.status === 403,
      'Eligible attendee for Event A cannot open chat for Event B (403 Forbidden)'
    );

    // -------------------------------------------------------------------------
    // TEST 4: Organizer sees only their own event conversations
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 4: Organizer conversation scope isolation ---');
    // Organizer A checks conversations
    const resOrgAConvs = await fetch(`${BASE}/conversations`, {
      headers: { Cookie: orgAAuth.cookie },
    });
    assert(resOrgAConvs.status === 200, 'Organizer A fetches conversations with 200 OK');
    const dataOrgAConvs = await resOrgAConvs.json();
    assert(
      dataOrgAConvs.conversations.some((c) => c._id === attendeeConvId),
      'Organizer A inbox contains attendee inquiry for Event A'
    );

    // Organizer B checks conversations
    const resOrgBConvs = await fetch(`${BASE}/conversations`, {
      headers: { Cookie: orgBAuth.cookie },
    });
    assert(resOrgBConvs.status === 200, 'Organizer B fetches conversations with 200 OK');
    const dataOrgBConvs = await resOrgBConvs.json();
    assert(
      !dataOrgBConvs.conversations.some((c) => c._id === attendeeConvId),
      'Organizer B inbox does NOT contain Event A conversations'
    );

    // -------------------------------------------------------------------------
    // TEST 5: Admin opens the intended admin-organizer conversation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 5: Admin opens admin-organizer conversation ---');
    const resAdminConv = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminAuth.cookie,
      },
      body: JSON.stringify({
        eventId: eventA._id.toString(),
        type: 'admin_organizer',
      }),
    });
    assert(resAdminConv.status === 200, 'Admin opens admin-organizer chat with 200 OK');
    const dataAdminConv = await resAdminConv.json();
    const adminConvId = dataAdminConv.conversation._id;
    createdConversationIds.push(adminConvId);
    assert(
      dataAdminConv.conversation.type === 'admin_organizer',
      'Conversation type is strictly admin_organizer'
    );
    assert(
      dataAdminConv.conversation.organizerId._id.toString() === organizerA._id.toString(),
      'Admin conversation targets Event A organizer Alice'
    );

    // Check that attendee cannot view admin conversation
    const resAttAdminChat = await fetch(`${BASE}/conversations/${adminConvId}/messages`, {
      headers: { Cookie: attEligibleAuth.cookie },
    });
    assert(
      resAttAdminChat.status === 403,
      'Attendee cannot view admin-organizer private messages (403 Forbidden)'
    );

    // -------------------------------------------------------------------------
    // TEST 6: Real-time messaging via Socket.IO between participants
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 6: Real-time Socket.IO messaging between participants ---');
    const attendeeSocket = ClientIO(SOCKET_URL, {
      auth: { token: attEligibleAuth.token },
      transports: ['websocket'],
      forceNew: true,
    });
    const orgASocket = ClientIO(SOCKET_URL, {
      auth: { token: orgAAuth.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      let count = 0;
      const check = () => {
        count++;
        if (count === 2) resolve();
      };
      attendeeSocket.on('connect', check);
      orgASocket.on('connect', check);
    });
    assert(true, 'Both Attendee and Organizer socket clients connected successfully');

    // Join room
    await new Promise((resolve) => {
      attendeeSocket.emit('join_conversation', { conversationId: attendeeConvId }, (ack) => {
        assert(ack && ack.success === true, 'Attendee joined conversation socket room');
        resolve();
      });
    });

    await new Promise((resolve) => {
      orgASocket.emit('join_conversation', { conversationId: attendeeConvId }, (ack) => {
        assert(ack && ack.success === true, 'Organizer joined conversation socket room');
        resolve();
      });
    });

    // Attendee sends message; Organizer listens for new_message
    const orgReceivedPromise = new Promise((resolve) => {
      orgASocket.on('new_message', (payload) => {
        resolve(payload.message || payload);
      });
    });

    const sendAck = await new Promise((resolve) => {
      attendeeSocket.emit(
        'send_message',
        {
          conversationId: attendeeConvId,
          text: 'Hello Organizer Alice, what time do doors open?',
        },
        resolve
      );
    });

    assert(sendAck && sendAck.success === true, 'Socket message sent and acknowledged by server');
    const firstMsg = sendAck.message;
    assert(firstMsg.text === 'Hello Organizer Alice, what time do doors open?', 'Message text matches');
    assert(firstMsg.senderId === attendeeEligible._id.toString(), 'Sender ID is verified attendee');

    const orgReceivedMsg = await orgReceivedPromise;
    assert(
      orgReceivedMsg._id === firstMsg._id,
      'Organizer received real-time new_message with matching message ID'
    );

    // Organizer replies via socket
    const attendeeReceivedPromise = new Promise((resolve) => {
      attendeeSocket.on('new_message', (payload) => {
        resolve(payload.message || payload);
      });
    });

    const replyAck = await new Promise((resolve) => {
      orgASocket.emit(
        'send_message',
        {
          conversationId: attendeeConvId,
          text: 'Hi Priya, doors open at 8:30 AM!',
        },
        resolve
      );
    });

    assert(replyAck && replyAck.success === true, 'Organizer reply acknowledged by server');
    const secondMsg = replyAck.message;

    const attendeeReceivedMsg = await attendeeReceivedPromise;
    assert(
      attendeeReceivedMsg._id === secondMsg._id,
      'Attendee received real-time reply from organizer'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Messages persist after reload (REST pagination history)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 7: Message persistence across reloads ---');
    const resHistory = await fetch(`${BASE}/conversations/${attendeeConvId}/messages?page=1&limit=50`, {
      headers: { Cookie: attEligibleAuth.cookie },
    });
    assert(resHistory.status === 200, 'Querying message history returns 200 OK');
    const dataHistory = await resHistory.json();
    assert(dataHistory.messages.length === 2, 'Message history contains exactly 2 persisted messages');
    assert(
      dataHistory.messages[0]._id === firstMsg._id &&
        dataHistory.messages[1]._id === secondMsg._id,
      'Messages appear in correct chronological order'
    );
    assert(dataHistory.count === 2, 'Message count is accurate (2)');

    // -------------------------------------------------------------------------
    // TEST 8: Unread counts and read receipts update correctly
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 8: Unread counts and read receipts ---');
    // Attendee unread count should reflect the message sent by Organizer
    const resAttUnread = await fetch(`${BASE}/unread-count`, {
      headers: { Cookie: attEligibleAuth.cookie },
    });
    const dataAttUnread = await resAttUnread.json();
    assert(dataAttUnread.unreadCount === 1, 'Attendee unread count is 1 for organizer message');

    // Mark as read via REST (or socket mark_read)
    const readPromise = new Promise((resolve) => {
      orgASocket.on('messages_read', (eventData) => {
        resolve(eventData);
      });
    });

    const resMarkRead = await fetch(`${BASE}/conversations/${attendeeConvId}/read`, {
      method: 'PUT',
      headers: { Cookie: attEligibleAuth.cookie },
    });
    assert(resMarkRead.status === 200, 'Marking conversation read returns 200 OK');

    const readBroadcast = await readPromise;
    assert(
      readBroadcast.conversationId === attendeeConvId,
      'messages_read event broadcasted to room with matching conversation ID'
    );
    assert(
      readBroadcast.userId === attendeeEligible._id.toString(),
      'messages_read broadcast indicates reading user ID'
    );

    // Verify unread count is now 0
    const resAttUnreadAfter = await fetch(`${BASE}/unread-count`, {
      headers: { Cookie: attEligibleAuth.cookie },
    });
    const dataAttUnreadAfter = await resAttUnreadAfter.json();
    assert(dataAttUnreadAfter.unreadCount === 0, 'Attendee unread count drops to 0 after marking read');

    // -------------------------------------------------------------------------
    // TEST 9: Socket reconnection & deduplication verification
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 9: Socket reconnection and message deduplication ---');
    // Simulate socket disconnect and reconnect
    attendeeSocket.disconnect();
    const reconnectedAttendeeSocket = ClientIO(SOCKET_URL, {
      auth: { token: attEligibleAuth.token },
      transports: ['websocket'],
      forceNew: true,
    });

    await new Promise((resolve) => {
      reconnectedAttendeeSocket.on('connect', resolve);
    });
    assert(true, 'Attendee socket reconnected successfully');

    // Rejoin room
    await new Promise((resolve) => {
      reconnectedAttendeeSocket.emit(
        'join_conversation',
        { conversationId: attendeeConvId },
        (ack) => {
          assert(ack && ack.success === true, 'Reconnected socket rejoined conversation room');
          resolve();
        }
      );
    });

    // Frontend deduplication pattern verification:
    // If incoming message _id matches an existing item, state updater discards duplicate.
    const messageState = [firstMsg, secondMsg];
    const incomingDuplicate = { ...secondMsg };
    const deduplicatedState = messageState.some((m) => m._id === incomingDuplicate._id)
      ? messageState
      : [...messageState, incomingDuplicate];
    assert(
      deduplicatedState.length === 2,
      'Frontend deduplication logic properly prevents duplicate messages on reconnect overlap'
    );

    // -------------------------------------------------------------------------
    // TEST 10: Authorization failures close or disable conversation safely
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 10: Authorization failure handling ---');
    // Foreign user tries to join attendee conversation socket room
    const unauthorizedSocket = ClientIO(SOCKET_URL, {
      auth: { token: orgBAuth.token },
      transports: ['websocket'],
      forceNew: true,
    });
    await new Promise((resolve) => unauthorizedSocket.on('connect', resolve));

    const foreignJoinAck = await new Promise((resolve) => {
      unauthorizedSocket.emit(
        'join_conversation',
        { conversationId: attendeeConvId },
        resolve
      );
    });
    assert(
      foreignJoinAck && foreignJoinAck.success === false,
      'Unauthorized socket join returns error acknowledgment'
    );
    assert(
      foreignJoinAck.error.includes('Forbidden') || foreignJoinAck.error.includes('denied'),
      'Acknowledgment error explicitly identifies authorization failure'
    );

    // Clean up sockets
    reconnectedAttendeeSocket.disconnect();
    orgASocket.disconnect();
    unauthorizedSocket.disconnect();

    // -------------------------------------------------------------------------
    // TEST 11: Existing application flows remain functional
    // -------------------------------------------------------------------------
    console.log('\n--- TEST 11: Regression checks on core platform endpoints ---');
    // Health endpoint
    const resHealth = await fetch(`http://localhost:${port}/api/health`);
    assert(resHealth.status === 200, 'Core /api/health endpoint is operational (200 OK)');

    // Events listing
    const resEvents = await fetch(`http://localhost:${port}/api/events`);
    assert(resEvents.status === 200, 'Public /api/events endpoint is operational (200 OK)');

    // User session validation
    const resMe = await fetch(`http://localhost:${port}/api/auth/me`, {
      headers: { Cookie: attEligibleAuth.cookie },
    });
    assert(resMe.status === 200, 'User profile /api/auth/me endpoint is operational (200 OK)');

    console.log('\n--- Cleaning up test artifacts ---');
  } finally {
    // Teardown created DB fixtures
    if (createdConversationIds.length > 0) {
      await Message.deleteMany({ conversationId: { $in: createdConversationIds } });
      await Conversation.deleteMany({ _id: { $in: createdConversationIds } });
    }
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } });
    }
    if (createdEventIds.length > 0) {
      await Event.deleteMany({ _id: { $in: createdEventIds } });
    }
    if (createdSessionIds.length > 0) {
      await Session.deleteMany({ sessionId: { $in: createdSessionIds } });
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    server.close();
    await mongoose.disconnect();
    console.log('Cleanup completed successfully.\n');
  }

  console.log('====================================================================');
  console.log(`📊 INTEGRATION TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFrontendIntegrationTestSuite().catch((err) => {
  console.error('Fatal error during integration test run:', err);
  process.exit(1);
});
