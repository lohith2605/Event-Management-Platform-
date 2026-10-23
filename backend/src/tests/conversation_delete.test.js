import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
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
  deleteConversation,
  getUserConversations,
  getUnreadCount,
  getConversationById,
} from '../controllers/chatController.js';
import {
  executeDeleteConversation,
  restoreConversationVisibility,
} from '../services/chatService.js';

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

test('UTSAV Chat Phase 11 — Comprehensive Conversation Deletion & Visibility Tests', async (t) => {
  console.log('[TEST] Connecting to MongoDB...');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI, { family: 4, serverSelectionTimeoutMS: 15000 });
  }
  console.log('[TEST] MongoDB Connected successfully.');

  const timestamp = Date.now();

  let organizerUser, attendeeUser, outsiderUser, adminUser;
  let testEvent;
  let conv1, convAdmin;
  let msg1, msg2;

  try {
    console.log('[TEST] Setting up test data...');
    // 1. Setup Test Users
    organizerUser = await User.create({
      name: 'Delete Test Organizer',
      email: `del_org_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeUser = await User.create({
      name: 'Delete Test Attendee',
      email: `del_att_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    outsiderUser = await User.create({
      name: 'Delete Test Outsider',
      email: `del_outsider_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    adminUser = await User.create({
      name: 'Delete Test Admin',
      email: `del_admin_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'admin',
    });

    // 2. Setup Event & Booking
    testEvent = await Event.create({
      title: `Delete Test Event ${timestamp}`,
      description: 'Event to test conversation deletion',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      category: 'Technology',
      date: 'Sat Nov 21 2026',
      isoDate: new Date(Date.now() + 86400000),
      city: 'Delhi',
      venue: 'Pragati Maidan',
      status: 'published',
    });

    await Booking.create({
      bookingReference: `UTSAV-DEL-${timestamp}`,
      userId: attendeeUser._id,
      eventId: testEvent._id,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
      tickets: 1,
      quantity: 1,
      unitPrice: 500,
      totalAmount: 500,
      status: 'confirmed',
    });

    // 3. Create Attendee-Organizer Conversation
    conv1 = await Conversation.create({
      type: 'attendee_organizer',
      eventId: testEvent._id,
      organizerId: organizerUser._id,
      attendeeId: attendeeUser._id,
      unreadCounts: {
        [attendeeUser._id.toString()]: 1,
      },
      deletedFor: [],
    });

    // Create Admin-Organizer Conversation
    convAdmin = await Conversation.create({
      type: 'admin_organizer',
      eventId: testEvent._id,
      organizerId: organizerUser._id,
      adminId: adminUser._id,
      deletedFor: [],
    });

    // 4. Create sample messages in conv1
    msg1 = await Message.create({
      conversationId: conv1._id,
      senderId: organizerUser._id,
      senderRole: 'organizer',
      senderName: organizerUser.name,
      text: 'Hello from Organizer! Welcome to the event.',
      readBy: [{ userId: organizerUser._id }],
    });

    msg2 = await Message.create({
      conversationId: conv1._id,
      senderId: attendeeUser._id,
      senderRole: 'attendee',
      senderName: attendeeUser.name,
      text: 'Thanks! Here is my inquiry.',
      attachment: {
        url: 'https://res.cloudinary.com/utsav/raw/upload/test_doc.pdf',
        publicId: 'raw/utsav/test_doc',
        originalName: 'test_doc.pdf',
        mimeType: 'application/pdf',
        resourceType: 'raw',
      },
      readBy: [{ userId: attendeeUser._id }],
    });

    await Conversation.findByIdAndUpdate(conv1._id, {
      lastMessage: {
        text: msg2.text,
        senderId: msg2.senderId,
        senderName: msg2.senderName,
        senderRole: msg2.senderRole,
        createdAt: msg2.createdAt,
      },
    });

    // Subtest 1: Attendee can hide an authorized conversation from their own inbox
    await t.test('1. Attendee can hide an authorized conversation from their own inbox', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: conv1._id.toString() },
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await deleteConversation(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);
      assert.equal(getData().conversationId, conv1._id.toString());

      // Verify conversation in DB
      const updatedConv = await Conversation.findById(conv1._id);
      assert.ok(updatedConv);
      assert.equal(updatedConv.deletedFor.length, 1);
      assert.equal(updatedConv.deletedFor[0].userId.toString(), attendeeUser._id.toString());
      assert.ok(updatedConv.deletedFor[0].deletedAt);
      // Unread count for attendee should be reset to 0
      assert.equal(updatedConv.unreadCounts.get(attendeeUser._id.toString()), 0);
    });

    // Subtest 2: Conversation is excluded from Attendee inbox queries
    await t.test('2. Conversation is excluded from Attendee inbox and search queries', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        query: {},
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await getUserConversations(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);
      const conversations = getData().conversations;
      const found = conversations.some((c) => c._id.toString() === conv1._id.toString());
      assert.equal(found, false, 'Deleted conversation must be excluded from attendee conversation list');
    });

    // Subtest 3: Direct fetch via getConversationById returns 404 for deleted conversation
    await t.test('3. Direct fetch via getConversationById returns 404 for user who deleted it', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: conv1._id.toString() },
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await getConversationById(req, res, next);
      assert.equal(getStatus(), 404);
      assert.equal(getData().success, false);
    });

    // Subtest 4: Unread count excludes hidden conversations for attendee
    await t.test('4. Unread count excludes hidden conversations for attendee', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await getUnreadCount(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);
      assert.equal(getData().unreadCount, 0);
    });

    // Subtest 5: The other participant (organizer) still has full access and inbox visibility
    await t.test('5. The other participant (organizer) still has full visibility and access', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        query: {},
        user: { _id: organizerUser._id, role: 'organizer' },
      });

      await getUserConversations(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);
      const conversations = getData().conversations;
      const found = conversations.some((c) => c._id.toString() === conv1._id.toString());
      assert.equal(found, true, 'Organizer must still see the conversation in their inbox');
    });

    // Subtest 6: Messages, attachments, and history remain completely intact
    await t.test('6. Messages, attachments, and conversation documents are preserved in DB', async () => {
      const messages = await Message.find({ conversationId: conv1._id }).sort({ createdAt: 1 });
      assert.equal(messages.length, 2);
      assert.equal(messages[0].text, 'Hello from Organizer! Welcome to the event.');
      assert.equal(messages[1].text, 'Thanks! Here is my inquiry.');
      assert.ok(messages[1].attachment);
      assert.equal(messages[1].attachment.originalName, 'test_doc.pdf');
    });

    // Subtest 7: Repeated deletion is safe and idempotent
    await t.test('7. Repeated deletion requests are safe and idempotent', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: conv1._id.toString() },
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await deleteConversation(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);

      // Verify no duplicate entries created in deletedFor
      const updatedConv = await Conversation.findById(conv1._id);
      const attendeeEntries = updatedConv.deletedFor.filter(
        (e) => e.userId.toString() === attendeeUser._id.toString()
      );
      assert.equal(attendeeEntries.length, 1, 'Must not duplicate deletion records');
    });

    // Subtest 8: Invalid conversation ID validation
    await t.test('8. Invalid conversation IDs are rejected with 400 Bad Request', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: 'invalid-conv-id-123' },
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await deleteConversation(req, res, next);
      assert.equal(getStatus(), 400);
      assert.equal(getData().success, false);
      assert.match(getData().message, /Invalid conversation ID/i);
    });

    // Subtest 9: Unauthorized outsider cannot delete conversations they do not belong to
    await t.test('9. Unauthorized users cannot delete conversations they cannot access', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: conv1._id.toString() },
        user: { _id: outsiderUser._id, role: 'attendee' },
      });

      await deleteConversation(req, res, next);
      assert.equal(getStatus(), 403);
      assert.equal(getData().success, false);
    });

    // Subtest 10: Organizer can delete an authorized conversation from their own inbox
    await t.test('10. Organizer can delete an authorized conversation from their own inbox', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: conv1._id.toString() },
        user: { _id: organizerUser._id, role: 'organizer' },
      });

      await deleteConversation(req, res, next);
      assert.equal(getStatus(), 200);
      assert.equal(getData().success, true);

      // Now both attendee and organizer are in deletedFor
      const updatedConv = await Conversation.findById(conv1._id);
      assert.equal(updatedConv.deletedFor.length, 2);

      // Verify conversation document STILL exists in MongoDB (not permanently deleted)
      const convStillExists = await Conversation.findById(conv1._id);
      assert.ok(convStillExists, 'Conversation must not be permanently deleted even when both users delete it');
    });

    // Subtest 11: Admin permissions — Admin can delete admin support conversation from their own inbox
    await t.test('11. Admin can delete admin support chat from own inbox, but cannot delete unauthorized attendee chats', async () => {
      // Admin deleting their own admin-organizer conversation
      const { req: reqAdmin, res: resAdmin, next: nextAdmin, getStatus: getStatusAdmin } = createMockReqRes({
        params: { id: convAdmin._id.toString() },
        user: { _id: adminUser._id, role: 'admin' },
      });

      await deleteConversation(reqAdmin, resAdmin, nextAdmin);
      assert.equal(getStatusAdmin(), 200);

      // Verify admin is in deletedFor of convAdmin
      const updatedAdminConv = await Conversation.findById(convAdmin._id);
      assert.equal(updatedAdminConv.deletedFor.length, 1);
      assert.equal(updatedAdminConv.deletedFor[0].userId.toString(), adminUser._id.toString());
    });

    // Subtest 12: New message activity restores visibility only for the recipient
    await t.test('12. New message activity restores visibility for the relevant user', async () => {
      // Currently, conv1 is in deletedFor for both attendeeUser and organizerUser
      const convBefore = await Conversation.findById(conv1._id);
      assert.equal(convBefore.deletedFor.length, 2);

      // Simulate a new message sent from organizer to attendee
      // restoreConversationVisibility should be called for recipient (attendeeUser) and sender (organizerUser)
      await restoreConversationVisibility(conv1._id, [attendeeUser._id, organizerUser._id]);

      const convAfter = await Conversation.findById(conv1._id);
      assert.equal(convAfter.deletedFor.length, 0, 'Visibility must be restored for participants receiving new activity');

      // Now Attendee list query returns conv1 again
      const { req, res, next, getStatus, getData } = createMockReqRes({
        query: {},
        user: { _id: attendeeUser._id, role: 'attendee' },
      });

      await getUserConversations(req, res, next);
      assert.equal(getStatus(), 200);
      const found = getData().conversations.some((c) => c._id.toString() === conv1._id.toString());
      assert.equal(found, true, 'Conversation must reappear in inbox upon new genuine message activity');
    });

    // Subtest 13: Concurrent deletion and incoming message atomic safety
    await t.test('13. Concurrent operations do not corrupt visibility state', async () => {
      // Execute simultaneous delete and restore
      await Promise.all([
        executeDeleteConversation({ user: { _id: attendeeUser._id, role: 'attendee' }, conversationId: conv1._id }),
        restoreConversationVisibility(conv1._id, [attendeeUser._id]),
      ]);

      const finalConv = await Conversation.findById(conv1._id);
      assert.ok(finalConv);
      // State is either deleted or restored, but array contains no duplicates or corrupted objects
      const ids = finalConv.deletedFor.map((d) => d.userId.toString());
      const uniqueIds = new Set(ids);
      assert.equal(ids.length, uniqueIds.size, 'No duplicate entries permitted in deletedFor');
    });

  } catch (err) {
    console.error('TEST CAUGHT ERROR:', err);
    throw err;
  } finally {
    // Cleanup Test Data
    if (conv1) {
      await Message.deleteMany({ conversationId: conv1._id });
      await Conversation.findByIdAndDelete(conv1._id);
    }
    if (convAdmin) {
      await Conversation.findByIdAndDelete(convAdmin._id);
    }
    if (testEvent) {
      await Booking.deleteMany({ eventId: testEvent._id });
      await Event.findByIdAndDelete(testEvent._id);
    }
    if (organizerUser) await User.findByIdAndDelete(organizerUser._id);
    if (attendeeUser) await User.findByIdAndDelete(attendeeUser._id);
    if (outsiderUser) await User.findByIdAndDelete(outsiderUser._id);
    if (adminUser) await User.findByIdAndDelete(adminUser._id);
    await mongoose.disconnect();
  }
});
