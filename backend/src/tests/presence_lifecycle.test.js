import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from '../../../frontend/node_modules/socket.io-client/build/esm/index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import User from '../models/User.js';
import Event from '../models/Event.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Booking from '../models/Booking.js';
import {
  initSocket,
  isUserOnline,
  getOnlineUserIds,
  getUsersPresence,
  _resetPresenceTracking,
} from '../services/socketService.js';
import { getPresenceStatus } from '../controllers/chatController.js';

const JWT_SECRET = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';

// Helper to generate verified auth token
const generateAuthToken = (user, expiresIn = '1h') => {
  return jwt.sign({ id: user._id.toString(), email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn,
  });
};

// Helper to create client socket connected to test server
const createClientSocket = (port, token) => {
  return ClientIO(`http://127.0.0.1:${port}`, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000,
  });
};

// Mock Express req/res
const createMockReqRes = ({ query = {}, user = {} } = {}) => {
  const req = { query, user };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const next = (err) => {
    if (err) throw err;
  };

  return { req, res, next, getStatus: () => statusCode, getData: () => responseData };
};

test('UTSAV Chat Real-Time Online/Offline Presence Test Suite', async (t) => {
  let server;
  let port;
  const runId = Date.now();

  let organizerUser;
  let attendeeUser1;
  let attendeeUser2;
  let testEvent;
  let testConversation;

  t.before(async () => {
    await mongoose.connect(process.env.MONGODB_URI);

    // Create isolated test HTTP server and initialize Socket.IO
    server = http.createServer();
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
    initSocket(server);
    _resetPresenceTracking();

    // Create test entities
    organizerUser = await User.create({
      name: `Presence Org ${runId}`,
      email: `org_pres_${runId}@example.com`,
      password: 'HashedPassword123!',
      role: 'organizer',
      status: 'active',
    });

    attendeeUser1 = await User.create({
      name: `Presence Att1 ${runId}`,
      email: `att1_pres_${runId}@example.com`,
      password: 'HashedPassword123!',
      role: 'attendee',
      status: 'active',
    });

    attendeeUser2 = await User.create({
      name: `Presence Att2 ${runId}`,
      email: `att2_pres_${runId}@example.com`,
      password: 'HashedPassword123!',
      role: 'attendee',
      status: 'active',
    });

    testEvent = await Event.create({
      title: `Presence Test Event ${runId}`,
      tagline: 'Test event',
      description: 'Event for presence testing',
      category: 'Workshops',
      date: 'Tomorrow',
      isoDate: new Date(Date.now() + 24 * 3600 * 1000),
      time: '10:00 AM IST',
      city: 'Bangalore',
      venue: 'Auditorium',
      price: '₹500',
      priceNumber: 500,
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      spotsLeft: 50,
      totalCapacity: 50,
      status: 'published',
    });

    await Booking.create({
      bookingReference: `UTS-PRES-${runId}`,
      userId: attendeeUser1._id,
      eventId: testEvent._id,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
      paymentStatus: 'completed',
      attendeeName: attendeeUser1.name,
      attendeeEmail: attendeeUser1.email,
    });

    testConversation = await Conversation.create({
      eventId: testEvent._id,
      organizerId: organizerUser._id,
      attendeeId: attendeeUser1._id,
      type: 'attendee_organizer',
      participants: [organizerUser._id, attendeeUser1._id],
    });
  });

  t.after(async () => {
    _resetPresenceTracking();
    // Clean up test records
    await Booking.deleteMany({ eventId: testEvent?._id });
    await Message.deleteMany({ conversationId: testConversation?._id });
    await Conversation.deleteMany({ _id: testConversation?._id });
    await Event.deleteMany({ _id: testEvent?._id });
    await User.deleteMany({ _id: { $in: [organizerUser?._id, attendeeUser1?._id, attendeeUser2?._id] } });
    if (server) {
      if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  // =========================================================================
  // TEST 1: Organizer offline on initial attendee chat load
  // =========================================================================
  await t.test('1. Organizer is offline on initial attendee chat load (authoritative sync)', async () => {
    const attendeeToken = generateAuthToken(attendeeUser1);
    const attendeeSocket = createClientSocket(port, attendeeToken);

    try {
      const syncData = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for presence_sync')), 4000);
        attendeeSocket.on('presence_sync', (data) => {
          clearTimeout(timer);
          resolve(data);
        });
      });

      // Assert organizer is NOT in onlineUserIds
      assert.ok(Array.isArray(syncData.onlineUserIds));
      assert.strictEqual(syncData.onlineUserIds.includes(organizerUser._id.toString()), false);

      // Verify server helper confirms organizer is offline
      assert.strictEqual(isUserOnline(organizerUser._id), false);
      assert.strictEqual(isUserOnline(attendeeUser1._id), true);

      // Verify REST API endpoint returns offline for organizer
      const mockReqRes = createMockReqRes({
        query: { userIds: `${organizerUser._id.toString()},${attendeeUser1._id.toString()}` },
        user: attendeeUser1,
      });
      await getPresenceStatus(mockReqRes.req, mockReqRes.res, mockReqRes.next);
      const data = mockReqRes.getData();

      assert.strictEqual(data.success, true);
      assert.strictEqual(data.presence[organizerUser._id.toString()], false);
      assert.strictEqual(data.presence[attendeeUser1._id.toString()], true);
    } finally {
      attendeeSocket.disconnect();
    }
  });

  // =========================================================================
  // TEST 2: Organizer login and successful authenticated socket connection -> green
  // =========================================================================
  await t.test('2. Organizer connection broadcasts presence_change (online) in real time', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const attendeeSocket = createClientSocket(port, attendeeToken);

    await new Promise((resolve) => attendeeSocket.on('connect', resolve));

    const organizerToken = generateAuthToken(organizerUser);
    let organizerSocket;

    try {
      const presencePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for presence_change')), 4000);
        attendeeSocket.on('presence_change', (payload) => {
          if (payload.userId === organizerUser._id.toString()) {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      organizerSocket = createClientSocket(port, organizerToken);
      await new Promise((resolve) => organizerSocket.on('connect', resolve));

      const eventPayload = await presencePromise;
      assert.strictEqual(eventPayload.userId, organizerUser._id.toString());
      assert.strictEqual(eventPayload.status, 'online');
      assert.strictEqual(eventPayload.isOnline, true);

      // Confirm server presence status
      assert.strictEqual(isUserOnline(organizerUser._id), true);
    } finally {
      if (organizerSocket) organizerSocket.disconnect();
      attendeeSocket.disconnect();
    }
  });

  // =========================================================================
  // TEST 3: Organizer logout or final socket disconnect -> red
  // =========================================================================
  await t.test('3. Organizer final disconnect broadcasts presence_change (offline)', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const organizerToken = generateAuthToken(organizerUser);

    const attendeeSocket = createClientSocket(port, attendeeToken);
    await new Promise((resolve) => attendeeSocket.on('connect', resolve));

    const organizerSocket = createClientSocket(port, organizerToken);
    await new Promise((resolve) => organizerSocket.on('connect', resolve));

    assert.strictEqual(isUserOnline(organizerUser._id), true);

    try {
      const offlinePromise = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout waiting for offline event')), 4000);
        attendeeSocket.on('presence_change', (payload) => {
          if (payload.userId === organizerUser._id.toString() && payload.status === 'offline') {
            clearTimeout(timer);
            resolve(payload);
          }
        });
      });

      // Disconnect organizer socket
      organizerSocket.disconnect();

      const offlinePayload = await offlinePromise;
      assert.strictEqual(offlinePayload.userId, organizerUser._id.toString());
      assert.strictEqual(offlinePayload.status, 'offline');
      assert.strictEqual(offlinePayload.isOnline, false);

      // Confirm server presence state
      assert.strictEqual(isUserOnline(organizerUser._id), false);
    } finally {
      attendeeSocket.disconnect();
    }
  });

  // =========================================================================
  // TEST 4: Two sockets for one user: disconnecting one keeps the user online
  // =========================================================================
  await t.test('4. Multiple tabs: disconnecting one socket keeps the user online', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const organizerToken = generateAuthToken(organizerUser);

    const attendeeSocket = createClientSocket(port, attendeeToken);
    await new Promise((resolve) => attendeeSocket.on('connect', resolve));

    // Tab 1 connects
    const tab1 = createClientSocket(port, organizerToken);
    await new Promise((resolve) => tab1.on('connect', resolve));

    // Tab 2 connects
    const tab2 = createClientSocket(port, organizerToken);
    await new Promise((resolve) => tab2.on('connect', resolve));

    assert.strictEqual(isUserOnline(organizerUser._id), true);

    let unexpectedOffline = false;
    attendeeSocket.on('presence_change', (payload) => {
      if (payload.userId === organizerUser._id.toString() && payload.status === 'offline') {
        unexpectedOffline = true;
      }
    });

    // Close Tab 1
    tab1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Tab 2 is still active -> user must remain online!
    assert.strictEqual(unexpectedOffline, false, 'User must not be marked offline while Tab 2 is connected');
    assert.strictEqual(isUserOnline(organizerUser._id), true);

    tab2.disconnect();
    attendeeSocket.disconnect();
  });

  // =========================================================================
  // TEST 5: Final socket disconnect marks the user offline
  // =========================================================================
  await t.test('5. Disconnecting the remaining tab marks the user offline', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const organizerToken = generateAuthToken(organizerUser);

    const attendeeSocket = createClientSocket(port, attendeeToken);
    await new Promise((resolve) => attendeeSocket.on('connect', resolve));

    const tab = createClientSocket(port, organizerToken);
    await new Promise((resolve) => tab.on('connect', resolve));

    assert.strictEqual(isUserOnline(organizerUser._id), true);

    const offlinePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for offline event')), 4000);
      attendeeSocket.on('presence_change', (payload) => {
        if (payload.userId === organizerUser._id.toString() && payload.status === 'offline') {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    tab.disconnect();

    const payload = await offlinePromise;
    assert.strictEqual(payload.status, 'offline');
    assert.strictEqual(isUserOnline(organizerUser._id), false);

    attendeeSocket.disconnect();
  });

  // =========================================================================
  // TEST 6: Reconnection restores online status
  // =========================================================================
  await t.test('6. Reconnection restores online status and emits presence update', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const organizerToken = generateAuthToken(organizerUser);

    const attendeeSocket = createClientSocket(port, attendeeToken);
    await new Promise((resolve) => attendeeSocket.on('connect', resolve));

    const socket1 = createClientSocket(port, organizerToken);
    await new Promise((resolve) => socket1.on('connect', resolve));
    socket1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.strictEqual(isUserOnline(organizerUser._id), false);

    const reconnectOnlinePromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for reconnect online')), 4000);
      attendeeSocket.on('presence_change', (payload) => {
        if (payload.userId === organizerUser._id.toString() && payload.status === 'online') {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // Reconnect organizer
    const socket2 = createClientSocket(port, organizerToken);
    await new Promise((resolve) => socket2.on('connect', resolve));

    const payload = await reconnectOnlinePromise;
    assert.strictEqual(payload.status, 'online');
    assert.strictEqual(isUserOnline(organizerUser._id), true);

    socket2.disconnect();
    attendeeSocket.disconnect();
  });

  // =========================================================================
  // TEST 7: Invalid or expired JWT cannot establish authenticated presence
  // =========================================================================
  await t.test('7. Invalid or expired JWT is rejected and does not mark account online', async () => {
    _resetPresenceTracking();

    // Expired token
    const expiredToken = generateAuthToken(organizerUser, '-1h');
    const expiredSocket = createClientSocket(port, expiredToken);

    const connectErrorPromise = new Promise((resolve) => {
      expiredSocket.on('connect_error', (err) => {
        resolve(err);
      });
    });

    const err = await connectErrorPromise;
    assert.ok(err.message.includes('Authentication error'), 'Must reject expired JWT');
    assert.strictEqual(isUserOnline(organizerUser._id), false);

    // Completely bogus token
    const bogusSocket = createClientSocket(port, 'completely_bogus_token_123');
    const bogusErrorPromise = new Promise((resolve) => {
      bogusSocket.on('connect_error', (e) => resolve(e));
    });

    const bogusErr = await bogusErrorPromise;
    assert.ok(bogusErr.message.includes('Authentication error'), 'Must reject bogus JWT');
    assert.strictEqual(isUserOnline(organizerUser._id), false);

    expiredSocket.disconnect();
    bogusSocket.disconnect();
  });

  // =========================================================================
  // TEST 8: One user disconnect does not affect another user presence
  // =========================================================================
  await t.test('8. One user disconnect does not alter another user online status', async () => {
    _resetPresenceTracking();
    const token1 = generateAuthToken(attendeeUser1);
    const token2 = generateAuthToken(attendeeUser2);
    const orgToken = generateAuthToken(organizerUser);

    const sock1 = createClientSocket(port, token1);
    const sock2 = createClientSocket(port, token2);
    const sockOrg = createClientSocket(port, orgToken);

    await Promise.all([
      new Promise((res) => sock1.on('connect', res)),
      new Promise((res) => sock2.on('connect', res)),
      new Promise((res) => sockOrg.on('connect', res)),
    ]);

    assert.strictEqual(isUserOnline(attendeeUser1._id), true);
    assert.strictEqual(isUserOnline(attendeeUser2._id), true);
    assert.strictEqual(isUserOnline(organizerUser._id), true);

    // Attendee 1 disconnects
    sock1.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Attendee 1 is offline, but Attendee 2 and Organizer remain strictly online!
    assert.strictEqual(isUserOnline(attendeeUser1._id), false);
    assert.strictEqual(isUserOnline(attendeeUser2._id), true);
    assert.strictEqual(isUserOnline(organizerUser._id), true);

    sock2.disconnect();
    sockOrg.disconnect();
  });

  // =========================================================================
  // TEST 9: Presence updates reach all connected attendees in real time
  // =========================================================================
  await t.test('9. Presence updates broadcast simultaneously to multiple connected attendees', async () => {
    _resetPresenceTracking();
    const token1 = generateAuthToken(attendeeUser1);
    const token2 = generateAuthToken(attendeeUser2);
    const orgToken = generateAuthToken(organizerUser);

    const sock1 = createClientSocket(port, token1);
    const sock2 = createClientSocket(port, token2);

    await Promise.all([
      new Promise((res) => sock1.on('connect', res)),
      new Promise((res) => sock2.on('connect', res)),
    ]);

    const p1 = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout on attendee 1')), 4000);
      sock1.on('presence_change', (payload) => {
        if (payload.userId === organizerUser._id.toString()) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    const p2 = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout on attendee 2')), 4000);
      sock2.on('presence_change', (payload) => {
        if (payload.userId === organizerUser._id.toString()) {
          clearTimeout(timer);
          resolve(payload);
        }
      });
    });

    // Organizer connects
    const sockOrg = createClientSocket(port, orgToken);
    await new Promise((res) => sockOrg.on('connect', res));

    const [res1, res2] = await Promise.all([p1, p2]);

    assert.strictEqual(res1.userId, organizerUser._id.toString());
    assert.strictEqual(res1.status, 'online');
    assert.strictEqual(res2.userId, organizerUser._id.toString());
    assert.strictEqual(res2.status, 'online');

    sock1.disconnect();
    sock2.disconnect();
    sockOrg.disconnect();
  });

  // =========================================================================
  // TEST 10: No regression to messaging or chat functionality
  // =========================================================================
  await t.test('10. Chat messaging works alongside presence tracking without regression', async () => {
    _resetPresenceTracking();
    const attendeeToken = generateAuthToken(attendeeUser1);
    const organizerToken = generateAuthToken(organizerUser);

    const attSocket = createClientSocket(port, attendeeToken);
    const orgSocket = createClientSocket(port, organizerToken);

    await Promise.all([
      new Promise((res) => attSocket.on('connect', res)),
      new Promise((res) => orgSocket.on('connect', res)),
    ]);

    // Join conversation room
    await new Promise((resolve) => {
      attSocket.emit('join_conversation', { conversationId: testConversation._id.toString() }, resolve);
    });
    await new Promise((resolve) => {
      orgSocket.emit('join_conversation', { conversationId: testConversation._id.toString() }, resolve);
    });

    // Send message from attendee to organizer
    const incomingPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for new_message')), 4000);
      orgSocket.on('new_message', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    attSocket.emit('send_message', {
      conversationId: testConversation._id.toString(),
      text: 'Hello organizer, presence is active!',
    });

    const messagePayload = await incomingPromise;
    const receivedMsg = messagePayload.message || messagePayload;
    assert.strictEqual(receivedMsg.text, 'Hello organizer, presence is active!');
    assert.strictEqual(receivedMsg.senderId.toString(), attendeeUser1._id.toString());

    // Verify DB persistence
    const saved = await Message.findOne({
      conversationId: testConversation._id,
      text: 'Hello organizer, presence is active!',
    });
    assert.ok(saved, 'Message must be persisted to MongoDB');

    // Both users remain online
    assert.strictEqual(isUserOnline(attendeeUser1._id), true);
    assert.strictEqual(isUserOnline(organizerUser._id), true);

    attSocket.disconnect();
    orgSocket.disconnect();
  });
});
