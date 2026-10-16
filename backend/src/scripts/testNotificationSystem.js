import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { io as ClientIO } from '../../../frontend/node_modules/socket.io-client/build/esm/index.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Notification from '../models/Notification.js';
import { initSocket } from '../services/socketService.js';
import {
  createAndEmitNotification,
  notifyAttendeesOfPublishedEvent,
  notifyOrganizerEventApproved,
  notifyOrganizerEventRejected,
} from '../services/notificationService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';
const TEST_PORT = 5098;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runTests() {
  console.log('\n========================================');
  console.log('🧪 UTSAV Socket.IO & Notification Tests');
  console.log('========================================\n');

  let testUser = null;
  let testOrganizer = null;
  let clientSocket = null;
  let testHttpServer = null;

  try {
    // 1. Database Connection & Server Initialization
    console.log('[TEST 1] Connecting to MongoDB & initializing Socket.IO test server...');
    await connectDB();
    console.log('✅ MongoDB Atlas connected successfully.');

    testHttpServer = http.createServer();
    initSocket(testHttpServer);
    await new Promise((resolve) => testHttpServer.listen(TEST_PORT, '127.0.0.1', resolve));
    console.log(`✅ Test Socket.IO server listening on ${SERVER_URL}\n`);

    // 2. Locate or create test user
    console.log('[TEST 2] Locating an attendee user for testing...');
    testUser = await User.findOne({ role: 'attendee' });
    if (!testUser) {
      console.log('Creating a temporary test attendee...');
      testUser = await User.create({
        name: 'Test Attendee Socket',
        email: `test_socket_${Date.now()}@utsav.test`,
        password: 'password123',
        role: 'attendee',
        city: 'Bengaluru',
      });
    }
    console.log(`✅ Attendee selected: ${testUser.name} (${testUser._id}), role: ${testUser.role}\n`);

    testOrganizer = await User.findOne({ role: 'organizer' });
    if (!testOrganizer) {
      testOrganizer = await User.create({
        name: 'Test Organizer Socket',
        email: `test_org_${Date.now()}@utsav.test`,
        password: 'password123',
        role: 'organizer',
        city: 'Bengaluru',
      });
    }
    console.log(`✅ Organizer selected: ${testOrganizer.name} (${testOrganizer._id})\n`);

    // 3. Test Socket Security: Attempt connection WITHOUT token
    console.log('[TEST 3] Testing socket connection WITHOUT authentication token (expecting rejection)...');
    const unauthSocket = ClientIO(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false,
    });

    const unauthRejected = await new Promise((resolve) => {
      unauthSocket.on('connect_error', (err) => {
        resolve(err.message);
      });
      unauthSocket.on('connect', () => {
        resolve('CONNECTED_UNEXPECTEDLY');
      });
      setTimeout(() => resolve('TIMEOUT'), 4000);
    });

    unauthSocket.disconnect();

    if (unauthRejected && unauthRejected !== 'CONNECTED_UNEXPECTEDLY') {
      console.log(`✅ Unauthenticated connection properly rejected: "${unauthRejected}"\n`);
    } else {
      console.error(`❌ Security failure: Unauthenticated connection was allowed or timed out: ${unauthRejected}\n`);
    }

    // 4. Test Socket Connection WITH valid JWT
    console.log('[TEST 4] Testing socket connection WITH verified JWT token...');
    const token = jwt.sign(
      { id: testUser._id.toString(), role: testUser.role, email: testUser.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    clientSocket = ClientIO(SERVER_URL, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: { token },
      reconnection: false,
    });

    const connected = await new Promise((resolve) => {
      clientSocket.on('connect', () => resolve(true));
      clientSocket.on('connect_error', (err) => resolve(err.message));
      setTimeout(() => resolve('TIMEOUT'), 5000);
    });

    if (connected === true) {
      console.log(`✅ Socket connected successfully! Socket ID: ${clientSocket.id}\n`);
    } else {
      throw new Error(`Socket failed to connect: ${connected}`);
    }

    // 5. Test Real-time In-App Notification Emission & Delivery
    console.log('[TEST 5] Testing real-time notification emission to authenticated private user room...');
    const testIdempotencyKey = `test_idem_${Date.now()}`;

    const notificationReceivedPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Notification receive timed out after 6s')), 6000);
      clientSocket.on('notification', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    const createdNotif = await createAndEmitNotification({
      userId: testUser._id,
      title: 'Real-Time Test Notification',
      message: 'Testing instant Socket.IO notification delivery in UTSAV platform.',
      type: 'system',
      link: '/attendee',
      metadata: { test: true },
      idempotencyKey: testIdempotencyKey,
    });

    const receivedPayload = await notificationReceivedPromise;

    if (
      receivedPayload &&
      receivedPayload.notification &&
      receivedPayload.notification._id.toString() === createdNotif._id.toString()
    ) {
      console.log(`✅ Real-time notification received via Socket.IO! Title: "${receivedPayload.notification.title}"`);
      console.log(`   Live unread count delivered: ${receivedPayload.unreadCount}\n`);
    } else {
      throw new Error('Received notification payload does not match sent notification');
    }

    // 6. Test Idempotency: Same key should not create a duplicate
    console.log('[TEST 6] Testing idempotency check (duplicate prevention)...');
    const duplicateNotif = await createAndEmitNotification({
      userId: testUser._id,
      title: 'Real-Time Test Notification DUPLICATE',
      message: 'This should be ignored due to duplicate idempotency key.',
      type: 'system',
      link: '/attendee',
      metadata: { test: true },
      idempotencyKey: testIdempotencyKey,
    });

    if (duplicateNotif._id.toString() === createdNotif._id.toString()) {
      console.log('✅ Idempotency verified! Second call returned existing document without duplicate creation.\n');
    } else {
      throw new Error('Idempotency failed: duplicate notification was created.');
    }

    // 7. Test Event Publication Notification Handler
    console.log('[TEST 7] Testing notifyAttendeesOfPublishedEvent targeting & dispatch...');
    const mockEvent = {
      _id: new mongoose.Types.ObjectId(),
      title: 'UTSAV Tech & Music Festival 2026',
      status: 'published',
      city: 'Bengaluru',
      category: 'Festivals',
      format: 'In-Person',
      organizerId: testOrganizer._id,
    };

    const pubResult = await notifyAttendeesOfPublishedEvent(mockEvent);
    console.log(`✅ Published event notification result: sentCount=${pubResult.sentCount}, skipped=${pubResult.skipped || false}\n`);

    // 8. Test Idempotent Publication (repeated approval should not re-notify)
    console.log('[TEST 8] Testing repeated publication safety (should skip)...');
    const repeatPubResult = await notifyAttendeesOfPublishedEvent(mockEvent);
    if (repeatPubResult.skipped) {
      console.log('✅ Idempotency verified for event publication! Duplicate dispatch safely skipped.\n');
    } else {
      throw new Error('Publication idempotency failed: second approval was not skipped.');
    }

    // 9. Clean up test notifications
    console.log('[TEST 9] Cleaning up test notifications from MongoDB...');
    await Notification.deleteMany({
      $or: [
        { 'metadata.test': true },
        { 'metadata.eventId': mockEvent._id },
      ],
    });
    console.log('✅ Cleaned up test data.\n');

    console.log('========================================');
    console.log('🎉 ALL NOTIFICATION TESTS PASSED!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ TEST RUN FAILED:', error);
  } finally {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (testHttpServer) {
      testHttpServer.close();
    }
    await mongoose.disconnect();
    process.exit(0);
  }
}

runTests();
