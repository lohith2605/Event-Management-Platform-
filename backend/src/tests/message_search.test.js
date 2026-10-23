import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import dns from 'dns';
dns.setServers(['8.8.8.8', '8.8.4.4']);

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import Booking from '../models/Booking.js';
import {
  searchConversationMessages,
  getConversationMessages,
} from '../controllers/chatController.js';

// Helper to simulate Express req, res, next
const createMockReqRes = ({ params = {}, query = {}, user = {}, body = {} } = {}) => {
  const req = { params, query, user, body };
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
    if (err) {
      statusCode = err.status || 500;
      responseData = { success: false, message: err.message };
    }
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getData: () => responseData,
  };
};

test('Chat Message Search Feature — Backend Validation & Controller Tests', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const timestamp = Date.now();

  // Create real test users
  const organizerUser = await User.create({
    name: 'Search Test Organizer',
    email: `org_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  const attendeeUser = await User.create({
    name: 'Search Test Attendee',
    email: `att_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  const intruderUser = await User.create({
    name: 'Unauthorized Intruder',
    email: `intruder_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  const otherAttendeeUser = await User.create({
    name: 'Other Attendee',
    email: `other_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  // Published event
  const publishedEvent = await Event.create({
    title: 'Searchable UTSAV Festival',
    description: 'UTSAV event with message search capability',
    organizer: organizerUser.name,
    organizerId: organizerUser._id,
    date: 'Sat Nov 14 2026',
    isoDate: new Date(Date.now() + 86400000 * 7),
    city: 'Bangalore',
    venue: 'Convention Hall',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
    format: 'In-Person',
    status: 'published',
    category: 'Technology',
  });

  // Valid confirmed booking for attendeeUser
  await Booking.create({
    bookingReference: `UTSAV-SRCH-${timestamp}-1`,
    userId: attendeeUser._id,
    eventId: publishedEvent._id,
    attendeeName: attendeeUser.name,
    attendeeEmail: attendeeUser.email,
    tickets: 1,
    status: 'confirmed',
    paymentStatus: 'completed',
    amount: 100,
  });

  // Valid confirmed booking for otherAttendeeUser
  await Booking.create({
    bookingReference: `UTSAV-SRCH-${timestamp}-2`,
    userId: otherAttendeeUser._id,
    eventId: publishedEvent._id,
    attendeeName: otherAttendeeUser.name,
    attendeeEmail: otherAttendeeUser.email,
    tickets: 1,
    status: 'confirmed',
    paymentStatus: 'completed',
    amount: 100,
  });

  // Main test conversation
  const convA = await Conversation.create({
    type: 'attendee_organizer',
    eventId: publishedEvent._id,
    organizerId: organizerUser._id,
    attendeeId: attendeeUser._id,
    participants: [organizerUser._id, attendeeUser._id],
  });

  // Second conversation to verify search isolation
  const convB = await Conversation.create({
    type: 'attendee_organizer',
    eventId: publishedEvent._id,
    organizerId: organizerUser._id,
    attendeeId: otherAttendeeUser._id,
    participants: [organizerUser._id, otherAttendeeUser._id],
  });

  // Populate messages for convA across different timestamps
  const baseTime = new Date(Date.now() - 100000);

  const msg1 = await Message.create({
    conversationId: convA._id,
    senderId: attendeeUser._id,
    senderName: attendeeUser.name,
    senderRole: attendeeUser.role,
    text: 'Hello, what time does the UTSAV keynote start?',
    createdAt: new Date(baseTime.getTime() + 1000),
  });

  const msg2 = await Message.create({
    conversationId: convA._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'The keynote starts at 10:00 AM sharp in the Main Auditorium.',
    createdAt: new Date(baseTime.getTime() + 2000),
  });

  const msg3 = await Message.create({
    conversationId: convA._id,
    senderId: attendeeUser._id,
    senderName: attendeeUser.name,
    senderRole: attendeeUser.role,
    text: 'Is there a KEYNOTE handout or slide deck available?',
    createdAt: new Date(baseTime.getTime() + 3000),
  });

  const msgDeleted = await Message.create({
    conversationId: convA._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'This secret keynote was cancelled',
    isDeleted: true,
    deletedAt: new Date(),
    createdAt: new Date(baseTime.getTime() + 4000),
  });

  const msgInOtherConv = await Message.create({
    conversationId: convB._id,
    senderId: otherAttendeeUser._id,
    senderName: otherAttendeeUser.name,
    senderRole: otherAttendeeUser.role,
    text: 'Keynote questions for other conversation',
    createdAt: new Date(baseTime.getTime() + 5000),
  });

  t.after(async () => {
    // Cleanup created test records
    await Message.deleteMany({ conversationId: { $in: [convA._id, convB._id] } });
    await Conversation.deleteMany({ _id: { $in: [convA._id, convB._id] } });
    await Booking.deleteMany({ eventId: publishedEvent._id });
    await Event.deleteMany({ _id: publishedEvent._id });
    await User.deleteMany({
      _id: { $in: [organizerUser._id, attendeeUser._id, intruderUser._id, otherAttendeeUser._id] },
    });
    await mongoose.disconnect();
  });

  await t.test('1. Empty or whitespace queries are rejected with 400 Bad Request', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: '   ' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.match(getData().message, /cannot be empty/i);
  });

  await t.test('2. Excessively long queries (> 100 characters) are rejected with 400 Bad Request', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'a'.repeat(101) },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.match(getData().message, /cannot exceed 100 characters/i);
  });

  await t.test('3. Invalid conversation ID is rejected with 400 Bad Request', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: 'invalid-id-format' },
      query: { q: 'keynote' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
  });

  await t.test('4. Case-insensitive search on message text returns matching messages', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'keynote' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.count, 3, 'Should find msg1, msg2, msg3 regardless of case');
    assert.strictEqual(data.pagination.totalCount, 3);
  });

  await t.test('5. Excludes soft-deleted messages and does not return deleted message content', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'secret' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.count, 0, 'Soft deleted message matching "secret" must be excluded');
  });

  await t.test('6. Strictly isolates search to specified conversation (no cross-conversation leakage)', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'other conversation' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.count, 0, 'Should not match messages from convB');
  });

  await t.test('7. Unauthorized user cannot search conversation', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'keynote' },
      user: intruderUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 403);
    assert.strictEqual(getData().success, false);
  });

  await t.test('8. Supports pagination with page and limit parameters', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'keynote', page: '1', limit: '2' },
      user: organizerUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.pagination.limit, 2);
    assert.strictEqual(data.pagination.page, 1);
    assert.strictEqual(data.pagination.totalCount, 3);
    assert.strictEqual(data.pagination.totalPages, 2);
    assert.strictEqual(data.pagination.hasMore, true);
    assert.strictEqual(data.messages.length, 2);

    // Fetch page 2
    const p2 = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'keynote', page: '2', limit: '2' },
      user: organizerUser,
    });
    await searchConversationMessages(p2.req, p2.res, p2.next);
    assert.strictEqual(p2.getStatus(), 200);
    const p2Data = p2.getData();
    assert.strictEqual(p2Data.pagination.page, 2);
    assert.strictEqual(p2Data.pagination.hasMore, false);
    assert.strictEqual(p2Data.messages.length, 1);
  });

  await t.test('9. Safe projection does not expose attachment URLs or private metadata', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: { q: 'sharp' },
      user: attendeeUser,
    });

    await searchConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const msg = getData().messages[0];
    assert.ok(msg);
    assert.ok(msg._id);
    assert.ok(msg.conversationId);
    assert.ok(msg.senderName);
    assert.ok(msg.senderRole);
    assert.ok(msg.text);
    assert.strictEqual(msg.attachment, undefined);
    assert.strictEqual(msg.attachments, undefined);
  });

  await t.test('10. Jump loading: getConversationMessages encompasses target message with includeMessageId', async () => {
    // When requesting messages with before: msg3 and includeMessageId: msg1
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: {
        limit: '1',
        before: new Date(baseTime.getTime() + 3500).toISOString(),
        includeMessageId: msg1._id.toString(),
      },
      user: attendeeUser,
    });

    await getConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    const foundTarget = data.messages.some((m) => m._id.toString() === msg1._id.toString());
    assert.strictEqual(foundTarget, true, 'getConversationMessages must include the target message');
  });
});
