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
  sendMessage,
  deleteMessage,
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

test('Chat Message Reply Feature — Backend Validation, Security & Controller Tests', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const timestamp = Date.now();

  // Create test users
  const organizerUser = await User.create({
    name: 'Reply Test Organizer',
    email: `reply_org_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  const attendeeUser = await User.create({
    name: 'Reply Test Attendee',
    email: `reply_att_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  const attendeeOtherUser = await User.create({
    name: 'Reply Other Attendee',
    email: `reply_other_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  // Create published event
  const testEvent = await Event.create({
    title: `Reply Test Event ${timestamp}`,
    description: 'Testing reply to message functionality',
    organizer: organizerUser.name,
    organizerId: organizerUser._id,
    date: 'Sat Nov 14 2026',
    isoDate: new Date(Date.now() + 86400000 * 10),
    city: 'Hyderabad',
    venue: 'Convention Center',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
    format: 'In-Person',
    status: 'published',
    category: 'Technology',
  });

  // Confirmed booking for attendeeUser with valid schema fields
  await Booking.create({
    bookingReference: `UTSAV-RPLY-${timestamp}`,
    userId: attendeeUser._id,
    eventId: testEvent._id,
    attendeeName: attendeeUser.name,
    attendeeEmail: attendeeUser.email,
    tickets: 1,
    quantity: 1,
    unitPrice: 100,
    totalAmount: 100,
    status: 'confirmed',
    paymentStatus: 'completed',
    amount: 100,
  });

  // Primary conversation A (attendeeUser <-> organizerUser)
  const convA = await Conversation.create({
    eventId: testEvent._id,
    organizerId: organizerUser._id,
    attendeeId: attendeeUser._id,
    type: 'attendee_organizer',
    participants: [organizerUser._id, attendeeUser._id],
  });

  // Secondary conversation B (attendeeOtherUser <-> organizerUser)
  const convB = await Conversation.create({
    eventId: testEvent._id,
    organizerId: organizerUser._id,
    attendeeId: attendeeOtherUser._id,
    type: 'attendee_organizer',
    participants: [organizerUser._id, attendeeOtherUser._id],
  });

  // Original text message in Conv A
  const textMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'Hello attendee! Welcome to the event.',
  });

  // Original image message in Conv A
  const imageMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'Here is the event banner',
    attachment: {
      url: 'https://res.cloudinary.com/test/image/upload/banner.png',
      publicId: 'banner_123',
      originalName: 'banner.png',
      mimeType: 'image/png',
      size: 50000,
      resourceType: 'image',
    },
    attachments: [
      {
        url: 'https://res.cloudinary.com/test/image/upload/banner.png',
        publicId: 'banner_123',
        originalName: 'banner.png',
        mimeType: 'image/png',
        size: 50000,
        resourceType: 'image',
      },
    ],
  });

  // Original document message in Conv A
  const docMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'Please review the guidelines document.',
    attachment: {
      url: 'https://res.cloudinary.com/test/raw/upload/guidelines.pdf',
      publicId: 'guidelines_123',
      originalName: 'guidelines.pdf',
      mimeType: 'application/pdf',
      size: 120000,
      resourceType: 'raw',
    },
    attachments: [
      {
        url: 'https://res.cloudinary.com/test/raw/upload/guidelines.pdf',
        publicId: 'guidelines_123',
        originalName: 'guidelines.pdf',
        mimeType: 'application/pdf',
        size: 120000,
        resourceType: 'raw',
      },
    ],
  });

  // Original message in Conv B
  const convBMsg = await Message.create({
    conversationId: convB._id,
    senderId: organizerUser._id,
    senderName: organizerUser.name,
    senderRole: organizerUser.role,
    text: 'Message in Conversation B',
  });

  t.after(async () => {
    await Message.deleteMany({ conversationId: { $in: [convA._id, convB._id] } });
    await Conversation.deleteMany({ _id: { $in: [convA._id, convB._id] } });
    await Booking.deleteMany({ eventId: testEvent._id });
    await Event.deleteMany({ _id: testEvent._id });
    await User.deleteMany({ _id: { $in: [organizerUser._id, attendeeUser._id, attendeeOtherUser._id] } });
    await mongoose.disconnect();
  });

  await t.test('1. Replying to a text message creates verified reply reference and snapshot', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Thank you for the warm welcome!',
        replyToMessageId: textMsg._id.toString(),
      },
      user: attendeeUser,
    });

    try {
      await sendMessage(req, res, next);
      if (getStatus() !== 201) {
        console.error('DEBUG Subtest 1: status=', getStatus(), 'data=', getData());
      }
      assert.strictEqual(getStatus(), 201);
      const data = getData();
      assert.strictEqual(data.success, true);
      assert.ok(data.message);
      assert.strictEqual(data.message.replyToMessageId.toString(), textMsg._id.toString());
      assert.ok(data.message.replySnapshot);
      assert.strictEqual(data.message.replySnapshot.messageId.toString(), textMsg._id.toString());
      assert.strictEqual(data.message.replySnapshot.senderName, organizerUser.name);
      assert.strictEqual(data.message.replySnapshot.senderRole, organizerUser.role);
      assert.strictEqual(data.message.replySnapshot.text, 'Hello attendee! Welcome to the event.');
      assert.strictEqual(data.message.replySnapshot.hasAttachment, false);
      assert.strictEqual(data.message.replySnapshot.isDeleted, false);
    } catch (err) {
      console.error('DEBUG Subtest 1 threw:', err);
      throw err;
    }
  });

  await t.test('2. Replying to an image message captures attachmentType: image in snapshot', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'The banner looks great!',
        replyToMessageId: imageMsg._id.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.message.replySnapshot.hasAttachment, true);
    assert.strictEqual(data.message.replySnapshot.attachmentType, 'image');
    assert.strictEqual(data.message.replySnapshot.originalName, 'banner.png');
  });

  await t.test('3. Replying to a document message captures attachmentType: document in snapshot', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'I have downloaded the guidelines.',
        replyToMessageId: docMsg._id.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.message.replySnapshot.hasAttachment, true);
    assert.strictEqual(data.message.replySnapshot.attachmentType, 'document');
    assert.strictEqual(data.message.replySnapshot.originalName, 'guidelines.pdf');
  });

  await t.test('4. Rejects invalid reply message ID format with 400 Bad Request', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Reply with invalid ID',
        replyToMessageId: 'invalid-object-id',
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.strictEqual(getData().message, 'Invalid reply message ID format.');
  });

  await t.test('5. Rejects cross-conversation reply reference with 400 Bad Request', async () => {
    // Attempting to reply to a message from convB inside convA
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Trying cross-conversation reference',
        replyToMessageId: convBMsg._id.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.strictEqual(getData().message, 'Referenced reply message not found in this conversation.');
  });

  await t.test('6. Rejects non-existent reply message ID with 400 Bad Request', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Trying non-existent message reference',
        replyToMessageId: fakeId.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 400);
    assert.strictEqual(getData().success, false);
    assert.strictEqual(getData().message, 'Referenced reply message not found in this conversation.');
  });

  await t.test('7. Ignores client-supplied fake snapshot or sender spoofing', async () => {
    // Attacker tries to inject a custom replySnapshot claiming the sender is 'Platform Admin'
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Spoofed snapshot attempt',
        replyToMessageId: textMsg._id.toString(),
        replySnapshot: {
          senderName: 'Platform Admin Hacked',
          senderRole: 'admin',
          text: 'You have won a free lottery!',
        },
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    // Server must construct snapshot from DB originalMessage, completely ignoring body.replySnapshot
    assert.strictEqual(data.message.replySnapshot.senderName, organizerUser.name);
    assert.strictEqual(data.message.replySnapshot.senderRole, organizerUser.role);
    assert.strictEqual(data.message.replySnapshot.text, 'Hello attendee! Welcome to the event.');
  });

  await t.test('8. Cascade on soft-delete: Deleting original message marks referencing reply snapshots as deleted', async () => {
    // Create a temporary message to be replied to then deleted
    const msgToDelete = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'This will be deleted shortly',
    });

    // Send reply to this message
    const { req: replyReq, res: replyRes, next: replyNext, getStatus: getReplyStatus, getData: getReplyData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Replying before deletion',
        replyToMessageId: msgToDelete._id.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(replyReq, replyRes, replyNext);
    assert.strictEqual(getReplyStatus(), 201);
    const replyMessage = getReplyData().message;
    assert.strictEqual(replyMessage.replySnapshot.isDeleted, false);

    // Now soft-delete msgToDelete as organizer
    const { req: delReq, res: delRes, next: delNext, getStatus: getDelStatus } = createMockReqRes({
      params: { id: convA._id.toString(), messageId: msgToDelete._id.toString() },
      user: organizerUser,
    });

    await deleteMessage(delReq, delRes, delNext);
    assert.strictEqual(getDelStatus(), 200);

    // Verify referencing reply was updated in the database
    const updatedReply = await Message.findById(replyMessage._id);
    assert.strictEqual(updatedReply.replySnapshot.isDeleted, true);
    assert.strictEqual(updatedReply.replySnapshot.text, 'This message was deleted');
  });

  await t.test('9. Replying to an already soft-deleted message generates deleted snapshot placeholder', async () => {
    // Create an already deleted message
    const alreadyDeleted = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'This message was deleted',
      isDeleted: true,
      deletedAt: new Date(),
    });

    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      body: {
        text: 'Replying to deleted message',
        replyToMessageId: alreadyDeleted._id.toString(),
      },
      user: attendeeUser,
    });

    await sendMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.message.replySnapshot.isDeleted, true);
    assert.strictEqual(data.message.replySnapshot.text, 'This message was deleted');
  });

  await t.test('10. Jump loading: getConversationMessages encompasses original reply message with includeMessageId', async () => {
    // Target original message is textMsg
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convA._id.toString() },
      query: {
        limit: '2',
        includeMessageId: textMsg._id.toString(),
      },
      user: attendeeUser,
    });

    await getConversationMessages(req, res, next);
    assert.strictEqual(getStatus(), 200);
    const data = getData();
    assert.strictEqual(data.success, true);
    const includesOriginal = data.messages.some((m) => m._id.toString() === textMsg._id.toString());
    assert.strictEqual(includesOriginal, true, 'Original replied message must be fetched when includeMessageId is provided');
  });
});
