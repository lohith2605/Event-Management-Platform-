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
  pinMessage,
  unpinMessage,
  editMessage,
  deleteMessage,
} from '../controllers/chatController.js';
import { executePinMessage, executeUnpinMessage } from '../services/chatService.js';

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

test('Chat Pin & Unpin Feature — Comprehensive Backend & Security Integration Tests', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const timestamp = Date.now();

  let organizerUser, attendeeUser, unauthorizedUser;
  let testEvent, testEventB;
  let convA, convB;
  let textMsg1, textMsg2, imageMsg, docMsg;

  try {
    // 1. Setup Test Users
    organizerUser = await User.create({
      name: 'Pin Test Organizer',
      email: `pin_org_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeUser = await User.create({
      name: 'Pin Test Attendee',
      email: `pin_att_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    unauthorizedUser = await User.create({
      name: 'Pin Test Outsider',
      email: `pin_outsider_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    // 2. Setup Events and Bookings
    testEvent = await Event.create({
      title: `Pin Feature Event A ${timestamp}`,
      description: 'Test Event for message pinning',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      category: 'Technology',
      date: 'Sat Nov 14 2026',
      isoDate: new Date(Date.now() + 86400000),
      city: 'Bangalore',
      venue: 'Bangalore Tech Park',
      status: 'published',
    });

    testEventB = await Event.create({
      title: `Pin Feature Event B ${timestamp}`,
      description: 'Second Test Event for message pinning',
      organizer: organizerUser.name,
      organizerId: organizerUser._id,
      category: 'Workshop',
      date: 'Sun Nov 15 2026',
      isoDate: new Date(Date.now() + 172800000),
      city: 'Bangalore',
      venue: 'Bangalore Auditorium',
      status: 'published',
    });

    await Booking.create({
      bookingReference: `UTSAV-PIN-A-${timestamp}`,
      userId: attendeeUser._id,
      eventId: testEvent._id,
      attendeeName: attendeeUser.name,
      attendeeEmail: attendeeUser.email,
      tickets: 1,
      quantity: 1,
      unitPrice: 200,
      totalAmount: 200,
      status: 'confirmed',
    });

    // 3. Setup Conversations
    convA = await Conversation.create({
      eventId: testEvent._id,
      organizerId: organizerUser._id,
      attendeeId: attendeeUser._id,
      type: 'attendee_organizer',
    });

    convB = await Conversation.create({
      eventId: testEventB._id,
      organizerId: organizerUser._id,
      attendeeId: attendeeUser._id,
      type: 'attendee_organizer',
    });

    // 4. Create Messages in Conv A
    textMsg1 = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Welcome everyone! Please review our event safety guidelines.',
    });

    textMsg2 = await Message.create({
      conversationId: convA._id,
      senderId: attendeeUser._id,
      senderName: attendeeUser.name,
      senderRole: attendeeUser.role,
      text: 'Thank you! What time do the front gates open?',
    });

    imageMsg = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Here is the venue layout map',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/image/upload/v1/venue_map.jpg',
          publicId: 'chat/attachments/venue_map',
          originalName: 'venue_map.jpg',
          mimeType: 'image/jpeg',
          resourceType: 'image',
          size: 450000,
        },
      ],
    });

    docMsg = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: '',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/raw/upload/v1/agenda.pdf',
          publicId: 'chat/attachments/agenda_pdf',
          originalName: 'agenda.pdf',
          mimeType: 'application/pdf',
          resourceType: 'raw',
          size: 1048576,
        },
      ],
    });

    // --- TEST 1: Pin a text message ---
    await t.test('1. Authorized participant can pin a text message in the conversation', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg1._id.toString() },
        user: organizerUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.ok(data.pinnedMessage);
      assert.strictEqual(data.pinnedMessage.messageId.toString(), textMsg1._id.toString());
      assert.strictEqual(data.pinnedMessage.text, textMsg1.text);
      assert.strictEqual(data.pinnedMessage.senderName, organizerUser.name);
      assert.strictEqual(data.pinnedMessage.pinnedBy.toString(), organizerUser._id.toString());

      // Verify DB persistence on Conversation
      const updatedConv = await Conversation.findById(convA._id);
      assert.ok(updatedConv.pinnedMessage);
      assert.strictEqual(updatedConv.pinnedMessage.messageId.toString(), textMsg1._id.toString());
      assert.strictEqual(updatedConv.pinnedMessage.text, textMsg1.text);

      // Verify DB persistence on Message
      const updatedMsg = await Message.findById(textMsg1._id);
      assert.strictEqual(updatedMsg.isPinned, true);
    });

    // --- TEST 2: Pin an attachment message ---
    await t.test('2. Pinning an attachment message preserves attachment metadata', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: docMsg._id.toString() },
        user: attendeeUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.pinnedMessage.hasAttachment, true);
      assert.strictEqual(data.pinnedMessage.attachmentType, 'document');
      assert.strictEqual(data.pinnedMessage.originalName, 'agenda.pdf');

      // Verify previous message isPinned was reset to false
      const prevMsg = await Message.findById(textMsg1._id);
      assert.strictEqual(prevMsg.isPinned, false);

      // Verify new message isPinned is true
      const newPinnedMsg = await Message.findById(docMsg._id);
      assert.strictEqual(newPinnedMsg.isPinned, true);
    });

    // --- TEST 3: Replacing existing pin with a new pin ---
    await t.test('3. Pinning another message atomically replaces previous pin', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg2._id.toString() },
        user: organizerUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const updatedConv = await Conversation.findById(convA._id);
      assert.strictEqual(updatedConv.pinnedMessage.messageId.toString(), textMsg2._id.toString());
      assert.strictEqual(updatedConv.pinnedMessage.text, textMsg2.text);

      // Ensure docMsg is no longer isPinned
      const prevDocMsg = await Message.findById(docMsg._id);
      assert.strictEqual(prevDocMsg.isPinned, false);

      const activePinMsg = await Message.findById(textMsg2._id);
      assert.strictEqual(activePinMsg.isPinned, true);
    });

    // --- TEST 4: Unpin currently pinned message ---
    await t.test('4. Authorized participant can unpin the currently pinned message', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg2._id.toString() },
        user: attendeeUser,
      });

      await unpinMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.unpinnedMessageId.toString(), textMsg2._id.toString());

      const updatedConv = await Conversation.findById(convA._id);
      assert.strictEqual(updatedConv.pinnedMessage, null);

      const refreshedMsg = await Message.findById(textMsg2._id);
      assert.strictEqual(refreshedMsg.isPinned, false);
    });

    // --- TEST 5: Reject pinning a deleted message ---
    await t.test('5. Rejects attempts to pin deleted messages', async () => {
      const deletedMsg = await Message.create({
        conversationId: convA._id,
        senderId: organizerUser._id,
        senderName: organizerUser.name,
        senderRole: organizerUser.role,
        text: 'This message will be deleted',
        isDeleted: true,
        deletedAt: new Date(),
      });

      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: deletedMsg._id.toString() },
        user: organizerUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 400);

      const data = getData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.toLowerCase().includes('cannot pin a deleted message'));
    });

    // --- TEST 6: Reject cross-conversation message pinning ---
    await t.test('6. Rejects pinning a message from another conversation', async () => {
      // Create message in convB
      const foreignMsg = await Message.create({
        conversationId: convB._id,
        senderId: organizerUser._id,
        senderName: organizerUser.name,
        senderRole: organizerUser.role,
        text: 'Message belonging to Conv B',
      });

      // Attempt to pin foreignMsg in Conv A
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: foreignMsg._id.toString() },
        user: organizerUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 404);

      const data = getData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('not found in this conversation'));
    });

    // --- TEST 7: Reject unauthorized pin attempt ---
    await t.test('7. Rejects pin attempt by user without conversation access', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg1._id.toString() },
        user: unauthorizedUser,
      });

      await pinMessage(req, res, next);
      assert.strictEqual(getStatus(), 403);

      const data = getData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Access denied') || data.message.includes('Forbidden'));
    });

    // --- TEST 8: Soft-deleting a pinned message automatically clears the pin ---
    await t.test('8. Soft-deleting a pinned message automatically clears the pin from conversation', async () => {
      // Pin textMsg1 first
      await executePinMessage({
        user: organizerUser,
        conversationId: convA._id.toString(),
        messageId: textMsg1._id.toString(),
      });

      const convBefore = await Conversation.findById(convA._id);
      assert.ok(convBefore.pinnedMessage);
      assert.strictEqual(convBefore.pinnedMessage.messageId.toString(), textMsg1._id.toString());

      // Delete textMsg1
      const { req, res, next, getStatus } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg1._id.toString() },
        user: organizerUser,
      });

      await deleteMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      // Verify conversation pinnedMessage was automatically cleared
      const convAfter = await Conversation.findById(convA._id);
      assert.strictEqual(convAfter.pinnedMessage, null);
    });

    // --- TEST 9: Editing a pinned message synchronizes the pin preview text ---
    await t.test('9. Editing a pinned message synchronizes conversation pinnedMessage text preview', async () => {
      // Pin textMsg2
      await executePinMessage({
        user: attendeeUser,
        conversationId: convA._id.toString(),
        messageId: textMsg2._id.toString(),
      });

      // Edit textMsg2
      const updatedText = 'Updated text: What time do the front gates open for VIPs?';
      const { req, res, next, getStatus } = createMockReqRes({
        params: { id: convA._id.toString(), messageId: textMsg2._id.toString() },
        body: { text: updatedText },
        user: attendeeUser,
      });

      await editMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      // Verify conversation pinnedMessage text was updated
      const updatedConv = await Conversation.findById(convA._id);
      assert.ok(updatedConv.pinnedMessage);
      assert.strictEqual(updatedConv.pinnedMessage.text, updatedText);
    });

    // --- TEST 10: Unpinning an already unpinned message is idempotent ---
    await t.test('10. Unpinning when no message is pinned succeeds idempotently', async () => {
      // Unpin textMsg2
      await executeUnpinMessage({
        user: organizerUser,
        conversationId: convA._id.toString(),
      });

      // Second unpin call
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        user: organizerUser,
      });

      await unpinMessage(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.alreadyUnpinned, true);
    });

  } catch (err) {
    console.error('TEST ERROR:', err);
    throw err;
  } finally {
    // Clean up
    try {
      await Message.deleteMany({
        conversationId: { $in: [convA?._id, convB?._id].filter(Boolean) },
      });
      await Conversation.deleteMany({ _id: { $in: [convA?._id, convB?._id].filter(Boolean) } });
      await Booking.deleteMany({ eventId: { $in: [testEvent?._id, testEventB?._id].filter(Boolean) } });
      await Event.deleteMany({ _id: { $in: [testEvent?._id, testEventB?._id].filter(Boolean) } });
      await User.deleteMany({
        _id: { $in: [organizerUser?._id, attendeeUser?._id, unauthorizedUser?._id].filter(Boolean) },
      });
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
    await mongoose.disconnect();
  }
});
