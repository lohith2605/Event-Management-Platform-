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

async function runTestSuite() {
  console.log('===============================================================');
  console.log('💬 UTSAV — Real-Time Event Chat (Phase 1 Backend) Test Suite');
  console.log('   Security, Authorization, Booking Gates & Socket.IO Real-Time');
  console.log('===============================================================\n');

  // 1. Connect MongoDB Atlas
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
  console.log(`Server listening on port ${port} with Socket.IO enabled.\n`);

  const testRunId = Date.now();
  const createdUserIds = [];
  const createdEventIds = [];
  const createdBookingIds = [];
  const createdSessionIds = [];
  const createdConversationIds = [];

  // Helper to create authenticated session cookie & token
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

    return {
      cookie: `token=${token}`,
      token,
    };
  };

  try {
    // -------------------------------------------------------------------------
    // SETUP TEST ENTITIES
    // -------------------------------------------------------------------------
    console.log('--- Setting up test accounts & events ---');

    // Users
    const adminUser = await User.create({
      name: 'System Platform Admin',
      email: `chat_admin_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'admin',
    });
    createdUserIds.push(adminUser._id);

    const organizer1 = await User.create({
      name: 'Organizer Alpha',
      email: `org_alpha_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
    });
    createdUserIds.push(organizer1._id);

    const organizer2 = await User.create({
      name: 'Organizer Beta (Unrelated)',
      email: `org_beta_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'organizer',
    });
    createdUserIds.push(organizer2._id);

    const attendeeQualified = await User.create({
      name: 'Priya Attendee (Booked A)',
      email: `priya_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
    });
    createdUserIds.push(attendeeQualified._id);

    const attendeeUnqualified = await User.create({
      name: 'Rahul Attendee (No Booking / Cancelled)',
      email: `rahul_${testRunId}@utsav.test`,
      password: 'Password123!',
      role: 'attendee',
    });
    createdUserIds.push(attendeeUnqualified._id);

    // Auth credentials
    const adminAuth = await createTestSessionAndCookie(adminUser);
    const org1Auth = await createTestSessionAndCookie(organizer1);
    const org2Auth = await createTestSessionAndCookie(organizer2);
    const attQualAuth = await createTestSessionAndCookie(attendeeQualified);
    const attUnqualAuth = await createTestSessionAndCookie(attendeeUnqualified);

    // Events
    const pendingEvent = await Event.create({
      title: `Pending Moderation Summit ${testRunId}`,
      category: 'Technology',
      format: 'In-Person',
      date: 'Jan 15, 2027',
      isoDate: new Date('2027-01-15T10:00:00.000Z'),
      venue: 'BIEC Hall 1',
      city: 'Bengaluru',
      organizer: organizer1.name,
      organizerId: organizer1._id,
      status: 'pending',
    });
    createdEventIds.push(pendingEvent._id);

    const approvedEventA = await Event.create({
      title: `Tech Expo India 2027 ${testRunId}`,
      category: 'Technology',
      format: 'In-Person',
      date: 'Jan 20, 2027',
      isoDate: new Date('2027-01-20T10:00:00.000Z'),
      venue: 'Whitefield Convention Center',
      city: 'Bengaluru',
      organizer: organizer1.name,
      organizerId: organizer1._id,
      status: 'published',
    });
    createdEventIds.push(approvedEventA._id);

    const approvedEventB = await Event.create({
      title: `Music Fest Karnataka ${testRunId}`,
      category: 'Music',
      format: 'In-Person',
      date: 'Feb 1, 2027',
      isoDate: new Date('2027-02-01T10:00:00.000Z'),
      venue: 'Palace Grounds',
      city: 'Bengaluru',
      organizer: organizer2.name,
      organizerId: organizer2._id,
      status: 'published',
    });
    createdEventIds.push(approvedEventB._id);

    // Bookings
    // 1. Qualifying confirmed booking for Priya on Event A
    const validBooking = await Booking.create({
      userId: attendeeQualified._id,
      eventId: approvedEventA._id,
      bookingReference: `UTSAV-BK-Q-${testRunId}`,
      attendeeName: attendeeQualified.name,
      attendeeEmail: attendeeQualified.email,
      quantity: 1,
      totalAmount: 0,
      status: 'confirmed',
      paymentStatus: 'free',
      refundStatus: 'none',
    });
    createdBookingIds.push(validBooking._id);

    // 2. Cancelled booking for Rahul on Event A
    const cancelledBooking = await Booking.create({
      userId: attendeeUnqualified._id,
      eventId: approvedEventA._id,
      bookingReference: `UTSAV-BK-C-${testRunId}`,
      attendeeName: attendeeUnqualified.name,
      attendeeEmail: attendeeUnqualified.email,
      quantity: 1,
      totalAmount: 500,
      status: 'cancelled',
      paymentStatus: 'refunded',
      refundStatus: 'processed',
    });
    createdBookingIds.push(cancelledBooking._id);

    console.log('Entities setup completed successfully.\n');

    // =========================================================================
    // TEST 1, 2 & 4: ADMIN-ORGANIZER CONVERSATION ACCESS RULES
    // =========================================================================
    console.log('--- TEST GROUP 1: Admin-Organizer Conversation Access & Approval Gates ---');

    // 4. Organizer CANNOT access admin conversation before event approval
    const preApprovalRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: org1Auth.cookie },
      body: JSON.stringify({
        eventId: pendingEvent._id,
        type: 'admin_organizer',
      }),
    });
    const preApprovalData = await preApprovalRes.json();
    assert(preApprovalRes.status === 403, '4. Organizer cannot access admin conversation for unapproved/pending event (403 Forbidden)');
    assert(preApprovalData.message?.includes('approved and published'), '4b. Rejection message mentions approval and publication requirement');

    // 1. Approved event organizer CAN create/access admin conversation
    const org1AdminConvRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: org1Auth.cookie },
      body: JSON.stringify({
        eventId: approvedEventA._id,
        type: 'admin_organizer',
      }),
    });
    const org1AdminConvData = await org1AdminConvRes.json();
    assert(org1AdminConvRes.status === 200, '1. Approved event organizer can create/access admin conversation (200 OK)');
    assert(org1AdminConvData.conversation?.type === 'admin_organizer', '1b. Conversation type is strictly "admin_organizer"');
    const adminConvId = org1AdminConvData.conversation?._id;
    createdConversationIds.push(adminConvId);

    // 2. Authorized admin can access that conversation
    const adminAccessRes = await fetch(`${BASE}/conversations/${adminConvId}`, {
      method: 'GET',
      headers: { cookie: adminAuth.cookie },
    });
    const adminAccessData = await adminAccessRes.json();
    assert(adminAccessRes.status === 200, '2. Authorized platform admin can access the admin-organizer conversation (200 OK)');
    assert(adminAccessData.conversation?._id === adminConvId, '2b. Admin retrieved correct conversation ID');

    // 3. Different organizer (Organizer Beta) CANNOT access Organizer Alpha's admin conversation
    const org2AccessRes = await fetch(`${BASE}/conversations/${adminConvId}`, {
      method: 'GET',
      headers: { cookie: org2Auth.cookie },
    });
    assert(org2AccessRes.status === 403, '3. Unrelated organizer cannot access another organizer\'s admin conversation (403 Forbidden)');

    // 3b. Organizer Beta cannot create an admin conversation for an event they do not own
    const org2CreateOnA = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: org2Auth.cookie },
      body: JSON.stringify({
        eventId: approvedEventA._id,
        type: 'admin_organizer',
      }),
    });
    assert(org2CreateOnA.status === 403, '3b. Organizer cannot initiate admin chat for an event they do not own (403 Forbidden)');

    // =========================================================================
    // TEST 5, 6 & 7: ATTENDEE-ORGANIZER CHAT & BOOKING GATES
    // =========================================================================
    console.log('\n--- TEST GROUP 2: Attendee-Organizer Conversation & Booking Verification ---');

    // 5. Attendee with a qualifying booking can access the chat for Event A
    const attendeeConvRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({
        eventId: approvedEventA._id,
        type: 'attendee_organizer',
      }),
    });
    const attendeeConvData = await attendeeConvRes.json();
    assert(attendeeConvRes.status === 200, '5. Attendee with qualifying booking can open chat with organizer (200 OK)');
    assert(attendeeConvData.conversation?.type === 'attendee_organizer', '5b. Conversation type is "attendee_organizer"');
    const attendeeConvId = attendeeConvData.conversation?._id;
    createdConversationIds.push(attendeeConvId);

    // 6. Attendee without a qualifying booking (cancelled/refunded) is strictly denied
    const unqualRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attUnqualAuth.cookie },
      body: JSON.stringify({
        eventId: approvedEventA._id,
        type: 'attendee_organizer',
      }),
    });
    assert(unqualRes.status === 403, '6. Attendee with cancelled/refunded booking is denied chat access (403 Forbidden)');

    // 7. Attendee who booked Event A CANNOT access Event B's chat
    const crossEventRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({
        eventId: approvedEventB._id,
        type: 'attendee_organizer',
      }),
    });
    assert(crossEventRes.status === 403, '7. Attendee who booked Event A cannot access Event B\'s chat (403 Forbidden)');

    // =========================================================================
    // TEST 8 & 9: ID GUESSING DEFENSE & SENDER SPOOFING PREVENTION
    // =========================================================================
    console.log('\n--- TEST GROUP 3: ID Guessing Defense & Sender Identity Integrity ---');

    // 8. User cannot read messages by guessing another conversation's ID
    const randomConvId = new mongoose.Types.ObjectId();
    const guessNonExistent = await fetch(`${BASE}/conversations/${randomConvId}/messages`, {
      headers: { cookie: attQualAuth.cookie },
    });
    assert(guessNonExistent.status === 404, '8. Guessing non-existent conversation returns 404 Not Found');

    const guessUnauthorized = await fetch(`${BASE}/conversations/${adminConvId}/messages`, {
      headers: { cookie: attQualAuth.cookie },
    });
    assert(guessUnauthorized.status === 403, '8b. Attendee attempting to read admin conversation ID returns 403 Forbidden');

    // 9. User cannot send messages as another user (server derives sender from session)
    const spoofAttemptRes = await fetch(`${BASE}/conversations/${attendeeConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({
        text: 'Hello organizer, is parking available on site?',
        senderId: organizer1._id.toString(), // Malicious attempt to spoof organizer
        senderRole: 'organizer',            // Malicious attempt to spoof role
        senderName: 'Spoofed Organizer',
      }),
    });
    const spoofData = await spoofAttemptRes.json();
    assert(spoofAttemptRes.status === 201, '9. Message sent successfully (201 Created)');
    assert(spoofData.message?.senderId === attendeeQualified._id.toString(), '9b. Sender ID strictly matches authenticated user, ignoring client payload');
    assert(spoofData.message?.senderRole === 'attendee', '9c. Sender role strictly matches authenticated user role ("attendee")');
    assert(spoofData.message?.senderName === attendeeQualified.name, '9d. Sender name strictly matches authenticated user name');

    // =========================================================================
    // TEST 10 & 11: SOCKET.IO REAL-TIME COMMUNICATION & RECONNECT PERSISTENCE
    // =========================================================================
    console.log('\n--- TEST GROUP 4: Socket.IO Real-Time Messaging & Reconnection ---');

    let attackerSocket;
    let organizerSocket;
    let attendeeSocket;

    const connectClient = (authData) => {
      return ClientIO(SOCKET_URL, {
        auth: { token: authData.token },
        extraHeaders: { cookie: authData.cookie },
        transports: ['websocket'],
        reconnection: false,
      });
    };

    attackerSocket = connectClient(org2Auth);
    organizerSocket = connectClient(org1Auth);
    attendeeSocket = connectClient(attQualAuth);

    // Wait for sockets to connect
    await Promise.all([
      new Promise((resolve) => attackerSocket.on('connect', resolve)),
      new Promise((resolve) => organizerSocket.on('connect', resolve)),
      new Promise((resolve) => attendeeSocket.on('connect', resolve)),
    ]);
    console.log('  Authenticated socket clients connected successfully.');

    // 10. Unauthorized socket room join is rejected
    const joinAttackerPromise = new Promise((resolve) => {
      attackerSocket.emit('join_conversation', { conversationId: attendeeConvId }, (res) => {
        resolve(res);
      });
    });
    const attackerJoinRes = await joinAttackerPromise;
    assert(attackerJoinRes.success === false, '10. Unauthorized socket client rejected when joining foreign conversation room');
    assert(attackerJoinRes.error?.includes('Forbidden') || attackerJoinRes.error?.includes('denied'), '10b. Socket error explicitly states access denied');

    // Authorized attendee joins conversation
    const joinAttendeePromise = new Promise((resolve) => {
      attendeeSocket.emit('join_conversation', { conversationId: attendeeConvId }, (res) => {
        resolve(res);
      });
    });
    const attendeeJoinRes = await joinAttendeePromise;
    assert(attendeeJoinRes.success === true, '10c. Authorized attendee successfully joins conversation socket room');

    // Authorized organizer joins conversation
    const joinOrganizerPromise = new Promise((resolve) => {
      organizerSocket.emit('join_conversation', { conversationId: attendeeConvId }, (res) => {
        resolve(res);
      });
    });
    const organizerJoinRes = await joinOrganizerPromise;
    assert(organizerJoinRes.success === true, '10d. Authorized organizer successfully joins conversation socket room');

    // Organizer sends a real-time message to the attendee via socket
    const receivedMessagesAttendee = [];
    attendeeSocket.on('new_message', (payload) => {
      receivedMessagesAttendee.push(payload);
    });

    const sendMsgPromise = new Promise((resolve) => {
      organizerSocket.emit('send_message', {
        conversationId: attendeeConvId,
        text: 'Yes Priya! Free reserved parking is available for all confirmed ticket holders in Basement 2.',
      }, (res) => {
        resolve(res);
      });
    });
    const sendResult = await sendMsgPromise;
    assert(sendResult.success === true, '10e. Organizer sends message via socket and receives success acknowledgment');

    // Wait brief interval for socket broadcast delivery
    await new Promise((r) => setTimeout(r, 200));

    assert(receivedMessagesAttendee.length === 1, '10f. Attendee receives real-time "new_message" broadcast via Socket.IO');
    assert(receivedMessagesAttendee[0]?.message?.text?.includes('Free reserved parking'), '10g. Broadcast message text is correct');
    assert(receivedMessagesAttendee[0]?.message?.senderId === organizer1._id.toString(), '10h. Broadcast message sender is verified organizer');

    // 11. Disconnect and reconnect: verify message persistence in DB
    organizerSocket.disconnect();
    attendeeSocket.disconnect();
    attackerSocket.disconnect();

    // Reconnected client queries messages via REST
    const historyRes = await fetch(`${BASE}/conversations/${attendeeConvId}/messages`, {
      headers: { cookie: attQualAuth.cookie },
    });
    const historyData = await historyRes.json();
    assert(historyRes.status === 200, '11. Reconnected user queries conversation message history (200 OK)');
    assert(historyData.count === 2, `11b. All messages persisted in MongoDB Atlas (count: ${historyData.count})`);
    assert(historyData.messages[0].text.includes('parking available'), '11c. First message intact');
    assert(historyData.messages[1].text.includes('Basement 2'), '11d. Second message intact');

    // =========================================================================
    // TEST 12: DUPLICATE CONVERSATION HANDLING & ATOMIC IDEMPOTENCY
    // =========================================================================
    console.log('\n--- TEST GROUP 5: Duplicate Prevention & Atomic Idempotency ---');

    // Repeat creation request
    const duplicateRes = await fetch(`${BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({
        eventId: approvedEventA._id,
        type: 'attendee_organizer',
      }),
    });
    const duplicateData = await duplicateRes.json();
    assert(duplicateRes.status === 200, '12. Redundant conversation creation request returns 200 OK');
    assert(duplicateData.conversation?._id === attendeeConvId, '12b. Exactly reuses existing conversation document without duplicating');

    // Check count in MongoDB
    const convCountInDb = await Conversation.countDocuments({
      eventId: approvedEventA._id,
      attendeeId: attendeeQualified._id,
      type: 'attendee_organizer',
    });
    assert(convCountInDb === 1, '12c. Database strictly enforces single conversation document (count: 1)');

    // =========================================================================
    // TEST 13: READ RECEIPTS, UNREAD COUNTS & VALIDATION SAFEGUARDS
    // =========================================================================
    console.log('\n--- TEST GROUP 6: Read Receipts, Unread Counts & Input Safeguards ---');

    // Unread count check for attendee
    const unreadRes = await fetch(`${BASE}/unread-count`, {
      headers: { cookie: attQualAuth.cookie },
    });
    const unreadData = await unreadRes.json();
    assert(unreadRes.status === 200, '13. Successfully queried unread messages count (200 OK)');
    assert(unreadData.unreadCount >= 1, `13b. Unread count reflects incoming messages (${unreadData.unreadCount})`);

    // Mark as read
    const markReadRes = await fetch(`${BASE}/conversations/${attendeeConvId}/read`, {
      method: 'PUT',
      headers: { cookie: attQualAuth.cookie },
    });
    assert(markReadRes.status === 200, '13c. Marking conversation as read returns 200 OK');

    const unreadAfterRes = await fetch(`${BASE}/unread-count`, {
      headers: { cookie: attQualAuth.cookie },
    });
    const unreadAfterData = await unreadAfterRes.json();
    assert(unreadAfterData.unreadCount === 0, '13d. Unread count drops to 0 after marking read');

    // Empty text validation
    const emptyMsgRes = await fetch(`${BASE}/conversations/${attendeeConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({ text: '   ' }),
    });
    assert(emptyMsgRes.status === 400, '13e. Empty whitespace message rejected with 400 Bad Request');

    // Exceeding text length validation (>2000 chars)
    const longText = 'A'.repeat(2005);
    const longMsgRes = await fetch(`${BASE}/conversations/${attendeeConvId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: attQualAuth.cookie },
      body: JSON.stringify({ text: longText }),
    });
    assert(longMsgRes.status === 400, '13f. Message exceeding 2000 characters rejected with 400 Bad Request');

    // Malformed conversation ID validation
    const badIdRes = await fetch(`${BASE}/conversations/invalid-id-format/messages`, {
      headers: { cookie: attQualAuth.cookie },
    });
    assert(badIdRes.status === 400, '13g. Malformed conversation ID format rejected with 400 Bad Request');

  } catch (err) {
    console.error('❌ FATAL TEST EXCEPTION:', err);
    failed++;
  } finally {
    // Cleanup test artifacts
    console.log('\n--- Cleaning up test artifacts ---');
    try {
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
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
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
