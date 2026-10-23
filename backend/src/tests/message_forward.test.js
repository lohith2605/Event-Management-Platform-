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
import { forwardMessage } from '../controllers/chatController.js';

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

test('Chat Message Forward Feature — Backend Validation, Security & Controller Tests', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  let convA, convB, convC, eventA, eventB, organizerUserA, organizerUserB, attendeeUserA, attendeeUserB;
  try {
    const timestamp = Date.now();

    // Create test users
    organizerUserA = await User.create({
    name: 'Forward Org A',
    email: `fwd_org_a_${timestamp}@test.com`,
    password: 'Password123!',
    role: 'organizer',
  });

    organizerUserB = await User.create({
      name: 'Forward Org B',
      email: `fwd_org_b_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeUserA = await User.create({
      name: 'Forward Attendee A',
      email: `fwd_att_a_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    attendeeUserB = await User.create({
      name: 'Forward Attendee B',
      email: `fwd_att_b_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    // Create test events
    eventA = await Event.create({
      title: `Forward Event A ${timestamp}`,
      description: 'Event A for forwarding tests',
      organizer: organizerUserA.name,
      organizerId: organizerUserA._id,
      category: 'Technology',
      date: 'Sat Nov 14 2026',
      isoDate: new Date(Date.now() + 86400000),
      city: 'Mumbai',
      venue: 'Convention Center A',
      status: 'published',
    });

    eventB = await Event.create({
      title: `Forward Event B ${timestamp}`,
      description: 'Event B for forwarding tests',
      organizer: organizerUserB.name,
      organizerId: organizerUserB._id,
      category: 'Music',
      date: 'Sun Nov 15 2026',
      isoDate: new Date(Date.now() + 86400000),
      city: 'Bangalore',
      venue: 'Open Arena B',
      status: 'published',
    });

    // Create bookings for eligibility
    await Booking.create({
      bookingReference: `UTSAV-FWD-A-${timestamp}`,
      userId: attendeeUserA._id,
      eventId: eventA._id,
      attendeeName: attendeeUserA.name,
      attendeeEmail: attendeeUserA.email,
      tickets: 1,
      quantity: 1,
      unitPrice: 100,
      totalAmount: 100,
      totalPrice: 100,
      status: 'confirmed',
    });

    await Booking.create({
      bookingReference: `UTSAV-FWD-B-${timestamp}`,
      userId: attendeeUserA._id,
      eventId: eventB._id,
      attendeeName: attendeeUserA.name,
      attendeeEmail: attendeeUserA.email,
      tickets: 1,
      quantity: 1,
      unitPrice: 250,
      totalAmount: 250,
      totalPrice: 250,
      status: 'confirmed',
    });

    await Booking.create({
      bookingReference: `UTSAV-FWD-C-${timestamp}`,
      userId: attendeeUserB._id,
      eventId: eventB._id,
      attendeeName: attendeeUserB.name,
      attendeeEmail: attendeeUserB.email,
      tickets: 1,
      quantity: 1,
      unitPrice: 150,
      totalAmount: 150,
      totalPrice: 150,
      status: 'confirmed',
    });

    // Create conversations
    // Conv A: Attendee A <-> Organizer A
    convA = await Conversation.create({
      eventId: eventA._id,
      organizerId: organizerUserA._id,
      attendeeId: attendeeUserA._id,
      type: 'attendee_organizer',
      status: 'active',
    });

    // Conv B: Attendee A <-> Organizer B
    convB = await Conversation.create({
      eventId: eventB._id,
      organizerId: organizerUserB._id,
      attendeeId: attendeeUserA._id,
      type: 'attendee_organizer',
      status: 'active',
    });

    // Conv C: Attendee B <-> Organizer B (Attendee A has NO access here)
    convC = await Conversation.create({
      eventId: eventB._id,
      organizerId: organizerUserB._id,
      attendeeId: attendeeUserB._id,
      type: 'attendee_organizer',
      status: 'active',
    });

  // Create seed messages in Conv A
  const textMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUserA._id,
    senderName: organizerUserA.name,
    senderRole: organizerUserA.role,
    text: 'Keynote starts promptly tomorrow at 9:00 AM.',
    reactions: [{ emoji: '👍', userId: attendeeUserA._id, userName: attendeeUserA.name }],
  });

  const imageMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUserA._id,
    senderName: organizerUserA.name,
    senderRole: organizerUserA.role,
    text: '',
    attachment: {
      url: 'https://res.cloudinary.com/utsav/image/upload/v12345/venue_floorplan.png',
      publicId: 'utsav/chat_images/venue_floorplan',
      resourceType: 'image',
      originalName: 'venue_floorplan.png',
      width: 1200,
      height: 800,
      size: 450000,
    },
    attachments: [
      {
        url: 'https://res.cloudinary.com/utsav/image/upload/v12345/venue_floorplan.png',
        publicId: 'utsav/chat_images/venue_floorplan',
        resourceType: 'image',
        originalName: 'venue_floorplan.png',
        width: 1200,
        height: 800,
        size: 450000,
      },
    ],
  });

  const docMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUserA._id,
    senderName: organizerUserA.name,
    senderRole: organizerUserA.role,
    text: '',
    attachment: {
      url: 'https://res.cloudinary.com/utsav/raw/upload/v12345/speaker_schedule.pdf',
      publicId: 'utsav/chat_attachments/speaker_schedule',
      resourceType: 'raw',
      mimeType: 'application/pdf',
      originalName: 'speaker_schedule.pdf',
      size: 1200000,
    },
    attachments: [
      {
        url: 'https://res.cloudinary.com/utsav/raw/upload/v12345/speaker_schedule.pdf',
        publicId: 'utsav/chat_attachments/speaker_schedule',
        resourceType: 'raw',
        mimeType: 'application/pdf',
        originalName: 'speaker_schedule.pdf',
        size: 1200000,
      },
    ],
  });

  const mixedMsg = await Message.create({
    conversationId: convA._id,
    senderId: organizerUserA._id,
    senderName: organizerUserA.name,
    senderRole: organizerUserA.role,
    text: 'Please review the attached event guide before attending.',
    attachment: {
      url: 'https://res.cloudinary.com/utsav/image/upload/v12345/event_guide.jpg',
      publicId: 'utsav/chat_images/event_guide',
      resourceType: 'image',
      originalName: 'event_guide.jpg',
      size: 320000,
    },
    attachments: [
      {
        url: 'https://res.cloudinary.com/utsav/image/upload/v12345/event_guide.jpg',
        publicId: 'utsav/chat_images/event_guide',
        resourceType: 'image',
        originalName: 'event_guide.jpg',
        size: 320000,
      },
    ],
  });

  await t.test('1. Forwarding text message creates new message in target conversation with proper attribution', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: textMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    assert.strictEqual(data.success, true);
    assert.ok(data.message);

    const fwdMsg = data.message;
    // Target conversation checks
    assert.strictEqual(fwdMsg.conversationId.toString(), convB._id.toString());
    assert.notStrictEqual(fwdMsg._id.toString(), textMsg._id.toString());

    // Sender identity must strictly be the user who forwarded (never impersonate original sender)
    assert.strictEqual(fwdMsg.senderId.toString(), attendeeUserA._id.toString());
    assert.strictEqual(fwdMsg.senderName, attendeeUserA.name);
    assert.strictEqual(fwdMsg.senderRole, attendeeUserA.role);

    // Forward metadata
    assert.strictEqual(fwdMsg.isForwarded, true);
    assert.strictEqual(fwdMsg.forwardedFromMessageId.toString(), textMsg._id.toString());
    assert.strictEqual(fwdMsg.forwardedFromSenderName, organizerUserA.name);

    // Content checks
    assert.strictEqual(fwdMsg.text, textMsg.text);

    // Isolated state checks (reactions & replies must not be copied)
    assert.strictEqual(fwdMsg.reactions.length, 0);
    assert.strictEqual(fwdMsg.replyToMessageId, null);

    // Target conversation lastMessage and unread count checks
    const updatedConvB = await Conversation.findById(convB._id);
    assert.strictEqual(updatedConvB.lastMessage.text, textMsg.text);
    assert.strictEqual(updatedConvB.lastMessage.senderId.toString(), attendeeUserA._id.toString());

    const orgUnread = updatedConvB.unreadCounts.get(organizerUserB._id.toString());
    assert.ok(orgUnread >= 1, 'Target recipient unread count must increment');
  });

  await t.test('2. Forwarding image attachment safely preserves storage references without duplicate re-uploads', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: imageMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    const fwdMsg = data.message;

    assert.strictEqual(fwdMsg.isForwarded, true);
    assert.strictEqual(fwdMsg.attachments.length, 1);
    assert.strictEqual(fwdMsg.attachments[0].url, imageMsg.attachments[0].url);
    assert.strictEqual(fwdMsg.attachments[0].publicId, imageMsg.attachments[0].publicId);
    assert.strictEqual(fwdMsg.attachments[0].originalName, 'venue_floorplan.png');

    // Conversation preview should show camera icon
    const updatedConvB = await Conversation.findById(convB._id);
    assert.strictEqual(updatedConvB.lastMessage.text, '📷 Image');
  });

  await t.test('3. Forwarding document attachment safely preserves document metadata and type', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: docMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    const fwdMsg = data.message;

    assert.strictEqual(fwdMsg.isForwarded, true);
    assert.strictEqual(fwdMsg.attachments.length, 1);
    assert.strictEqual(fwdMsg.attachments[0].resourceType, 'raw');
    assert.strictEqual(fwdMsg.attachments[0].mimeType, 'application/pdf');
    assert.strictEqual(fwdMsg.attachments[0].originalName, 'speaker_schedule.pdf');

    // Conversation preview should show document icon and name
    const updatedConvB = await Conversation.findById(convB._id);
    assert.strictEqual(updatedConvB.lastMessage.text, '📄 speaker_schedule.pdf');
  });

  await t.test('4. Forwarding mixed message preserves both text and attachment', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: mixedMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 201);
    const data = getData();
    const fwdMsg = data.message;

    assert.strictEqual(fwdMsg.isForwarded, true);
    assert.strictEqual(fwdMsg.text, mixedMsg.text);
    assert.strictEqual(fwdMsg.attachments.length, 1);
    assert.strictEqual(fwdMsg.attachments[0].originalName, 'event_guide.jpg');

    const updatedConvB = await Conversation.findById(convB._id);
    assert.strictEqual(updatedConvB.lastMessage.text, mixedMsg.text);
  });

  await t.test('5. Rejects forward attempt when user has NO access to the source conversation', async () => {
    // Attendee B tries to forward textMsg from Conv A (which Attendee B cannot view)
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convC._id.toString() },
      body: { sourceMessageId: textMsg._id.toString() },
      user: attendeeUserB,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 403);
    const data = getData();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('not authorized to access the source conversation'));
  });

  await t.test('6. Rejects forward attempt when user has NO access to the destination conversation', async () => {
    // Attendee A tries to forward into Conv C (which belongs to Attendee B and Org B)
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convC._id.toString() },
      body: { sourceMessageId: textMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 403);
    const data = getData();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('not authorized to access the destination conversation'));
  });

  await t.test('7. Rejects forward attempt when source message has been deleted', async () => {
    // Soft delete a message in Conv A
    const deletedMsg = await Message.create({
      conversationId: convA._id,
      senderId: organizerUserA._id,
      senderName: organizerUserA.name,
      senderRole: organizerUserA.role,
      text: 'This message will be deleted',
      isDeleted: true,
      deletedAt: new Date(),
    });

    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: deletedMsg._id.toString() },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 400);
    const data = getData();
    assert.strictEqual(data.success, false);
    assert.ok(data.message.includes('deleted'));
  });

  await t.test('8. Rejects forward attempt with missing or invalid sourceMessageId', async () => {
    const { req, res, next, getStatus, getData } = createMockReqRes({
      params: { id: convB._id.toString() },
      body: { sourceMessageId: 'invalid-object-id' },
      user: attendeeUserA,
    });

    await forwardMessage(req, res, next);
    assert.strictEqual(getStatus(), 400);
    const data = getData();
    assert.strictEqual(data.success, false);
  });

  await t.test('9. Original message remains completely unmodified after forwarding', async () => {
    const refreshedTextMsg = await Message.findById(textMsg._id);
    assert.strictEqual(refreshedTextMsg.isForwarded, false);
    assert.strictEqual(Boolean(refreshedTextMsg.forwardedFromMessageId), false);
    assert.strictEqual(refreshedTextMsg.reactions.length, 1);
  });

  } catch (err) {
    console.error('TEST ERROR:', err);
    throw err;
  } finally {
    // Clean up
    try {
      await Message.deleteMany({
        conversationId: { $in: [convA?._id, convB?._id, convC?._id].filter(Boolean) },
      });
      await Conversation.deleteMany({ _id: { $in: [convA?._id, convB?._id, convC?._id].filter(Boolean) } });
      await Booking.deleteMany({ eventId: { $in: [eventA?._id, eventB?._id].filter(Boolean) } });
      await Event.deleteMany({ _id: { $in: [eventA?._id, eventB?._id].filter(Boolean) } });
      await User.deleteMany({
        _id: { $in: [organizerUserA?._id, organizerUserB?._id, attendeeUserA?._id, attendeeUserB?._id].filter(Boolean) },
      });
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr.message);
    }
    await mongoose.disconnect();
  }
});
