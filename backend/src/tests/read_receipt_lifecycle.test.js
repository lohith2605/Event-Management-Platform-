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
import User from '../models/User.js';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import {
  findOrCreateConversation,
  verifyConversationAccess,
  hasQualifyingBooking,
} from '../services/chatService.js';
import {
  markConversationRead,
  getConversationById,
  getConversationMessages,
  sendMessage,
} from '../controllers/chatController.js';
import { extractId, getOtherParticipantId } from '../../../frontend/src/utils/chatUtils.js';

test('Read Receipts Full Lifecycle Diagnostics', async (t) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

  // 1. Setup users: Organizer Alice & Attendee Bob
  const organizer = await User.create({
    name: 'Organizer Alice',
    email: `alice_${Date.now()}@test.com`,
    password: 'Password123!',
    role: 'organizer',
  });

  const attendee = await User.create({
    name: 'Attendee Bob',
    email: `bob_${Date.now()}@test.com`,
    password: 'Password123!',
    role: 'attendee',
  });

  // 2. Setup published event
  const event = await Event.create({
    title: 'UTSAV Tech Fest 2026',
    description: 'Annual technology symposium and coding gala.',
    organizer: organizer.name,
    organizerId: organizer._id,
    date: new Date(Date.now() + 86400000 * 10),
    isoDate: new Date(Date.now() + 86400000 * 10).toISOString(),
    venue: 'Auditorium A',
    city: 'Hyderabad',
    status: 'published',
    category: 'Technology',
    capacity: 500,
    price: 0,
    isFree: true,
  });

  // 3. Setup confirmed booking for Attendee Bob
  const booking = await Booking.create({
    bookingReference: `UTSAV-TEST-${Date.now()}`,
    userId: attendee._id,
    eventId: event._id,
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    status: 'confirmed',
    paymentStatus: 'free',
    paymentMethod: 'free_pass',
    attendeeName: attendee.name,
    attendeeEmail: attendee.email,
  });

  // 4. Create conversation between Alice and Bob
  const { conversation } = await findOrCreateConversation({
    user: organizer,
    eventId: event._id,
    type: 'attendee_organizer',
    attendeeId: attendee._id,
  });

  assert(conversation, 'Conversation must be created');
  console.log('Created conversation:', {
    _id: conversation._id,
    type: conversation.type,
    organizerId: conversation.organizerId,
    attendeeId: conversation.attendeeId,
  });

  let messageDoc = null;

  await t.test('Step A: verifyConversationAccess on populated conversation from findOrCreateConversation', async () => {
    const accessOrg = await verifyConversationAccess(organizer, conversation);
    console.log('Access check organizer:', accessOrg);
    assert.equal(accessOrg.allowed, true, 'Organizer should have access');

    const accessAtt = await verifyConversationAccess(attendee, conversation);
    console.log('Access check attendee:', accessAtt);
    assert.equal(accessAtt.allowed, true, 'Attendee should have access');
  });

  await t.test('Step B: getConversationById controller test', async () => {
    const req = {
      params: { id: conversation._id.toString() },
      user: attendee,
    };
    let resData = null;
    let resStatus = 200;
    const res = {
      status(s) {
        resStatus = s;
        return this;
      },
      json(d) {
        resData = d;
        return this;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await getConversationById(req, res, next);
    console.log('getConversationById resStatus:', resStatus, 'resData:', resData);
    assert.equal(resStatus, 200, 'getConversationById must succeed with 200');
    assert.equal(resData.success, true);
  });

  await t.test('Step C: Organizer sends message via sendMessage controller', async () => {
    const req = {
      params: { id: conversation._id.toString() },
      body: { text: 'Hello Bob! Are you attending the workshop?' },
      user: organizer,
    };
    let resData = null;
    let resStatus = 200;
    const res = {
      status(s) {
        resStatus = s;
        return this;
      },
      json(d) {
        resData = d;
        return this;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await sendMessage(req, res, next);
    assert.equal(resStatus, 201, 'sendMessage must return 201');
    assert(resData.message, 'Message must be returned');
    messageDoc = resData.message;

    // Check readBy initially
    assert.equal(messageDoc.readBy.length, 1);
    assert.equal(extractId(messageDoc.readBy[0].userId), extractId(organizer._id));

    // Check organizer UI read status
    const otherPartId = getOtherParticipantId(conversation, organizer);
    console.log('Organizer otherParticipantId:', otherPartId, 'Attendee ID:', attendee._id.toString());
    assert.equal(otherPartId, attendee._id.toString());

    const isOwnOrg = Boolean(extractId(organizer) && extractId(messageDoc.senderId) === extractId(organizer));
    const isReadOrg = (() => {
      if (!isOwnOrg || !messageDoc.readBy || messageDoc.isDeleted) return false;
      return messageDoc.readBy.some((r) => extractId(r.userId) === extractId(otherPartId));
    })();
    assert.equal(isReadOrg, false, 'Message should NOT be read yet');
  });

  await t.test('Step D: Attendee calls markConversationRead controller', async () => {
    const req = {
      params: { id: conversation._id.toString() },
      user: attendee,
    };
    let resData = null;
    let resStatus = 200;
    const res = {
      status(s) {
        resStatus = s;
        return this;
      },
      json(d) {
        resData = d;
        return this;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await markConversationRead(req, res, next);
    console.log('markConversationRead resStatus:', resStatus, 'resData:', resData);
    assert.equal(resStatus, 200, 'markConversationRead must succeed with 200');

    // Verify DB updated
    const updatedMsg = await Message.findById(messageDoc._id).lean();
    console.log('Message readBy in DB after markConversationRead:', updatedMsg.readBy);
    assert.equal(updatedMsg.readBy.length, 2, 'Message readBy should have 2 entries in DB');

    const hasBobInDb = updatedMsg.readBy.some((r) => extractId(r.userId) === extractId(attendee._id));
    assert.equal(hasBobInDb, true, 'Message readBy in DB must contain Attendee Bob');
  });

  await t.test('Step E: Organizer receives real-time messages_read payload and MessageBubble reflects read state', () => {
    // Simulated organizer message state in ChatContext
    let clientMessages = [
      {
        _id: messageDoc._id.toString(),
        conversationId: conversation._id.toString(),
        senderId: organizer._id.toString(),
        senderName: organizer.name,
        text: messageDoc.text,
        readBy: [{ userId: organizer._id.toString(), readAt: new Date().toISOString() }],
      },
    ];

    // Payload received by organizer via socket
    const payload = {
      conversationId: conversation._id.toString(),
      userId: attendee._id.toString(),
      readAt: new Date().toISOString(),
    };

    // ChatContext.jsx handleMessagesRead logic
    const targetConvId = extractId(payload.conversationId);
    const readUserId = extractId(payload.userId);
    clientMessages = clientMessages.map((m) => {
      const alreadyRead = (m.readBy || []).some(
        (r) => extractId(r.userId || r.user) === readUserId
      );
      if (!alreadyRead) {
        return {
          ...m,
          readBy: [...(m.readBy || []), { userId: readUserId, readAt: payload.readAt }],
        };
      }
      return m;
    });

    // MessageBubble.jsx isReadByRecipient check
    const otherPartId = getOtherParticipantId(conversation, organizer);
    const isOwnOrg = true;
    const msg = clientMessages[0];
    const isReadNow = (() => {
      if (!isOwnOrg || !msg.readBy || msg.isDeleted) return false;
      const recipientId = otherPartId;
      if (recipientId) {
        return msg.readBy.some(
          (r) => extractId(r.userId || r.user) === extractId(recipientId)
        );
      }
      return false;
    })();

    assert.equal(isReadNow, true, 'Organizer must immediately see double tick without refresh');
  });

  await t.test('Step F: Reopening/refreshing conversation preserves read state (getConversationMessages)', async () => {
    const req = {
      params: { id: conversation._id.toString() },
      query: { limit: 50 },
      user: organizer,
    };
    let resData = null;
    let resStatus = 200;
    const res = {
      status(s) {
        resStatus = s;
        return this;
      },
      json(d) {
        resData = d;
        return this;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await getConversationMessages(req, res, next);
    assert.equal(resStatus, 200, 'getConversationMessages must return 200');
    assert(Array.isArray(resData.messages) && resData.messages.length > 0);

    const reloadedMsg = resData.messages[0];
    const otherPartId = getOtherParticipantId(conversation, organizer);
    const isOwn = Boolean(extractId(organizer) && extractId(reloadedMsg.senderId) === extractId(organizer));
    const isReadAfterRefresh = (() => {
      if (!isOwn || !reloadedMsg.readBy || reloadedMsg.isDeleted) return false;
      return reloadedMsg.readBy.some(
        (r) => extractId(r.userId || r.user) === extractId(otherPartId)
      );
    })();

    assert.equal(isReadAfterRefresh, true, 'Read receipt must persist after page refresh');
  });

  await t.test('Step G: Unauthorized user cannot mark another conversation as read', async () => {
    const intruder = await User.create({
      name: 'Intruder Charlie',
      email: `intruder_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    const req = {
      params: { id: conversation._id.toString() },
      user: intruder,
    };
    let resData = null;
    let resStatus = 200;
    const res = {
      status(s) {
        resStatus = s;
        return this;
      },
      json(d) {
        resData = d;
        return this;
      },
    };
    const next = (err) => {
      if (err) throw err;
    };

    await markConversationRead(req, res, next);
    console.log('Intruder markConversationRead status:', resStatus, 'message:', resData?.message);
    assert.equal(resStatus, 403, 'Unauthorized user must be rejected with 403');
    await User.findByIdAndDelete(intruder._id);
  });

  await t.test('Step H: Admin-organizer conversation read receipt flow', async () => {
    const adminUser = await User.create({
      name: 'Platform Admin',
      email: `admin_${Date.now()}@test.com`,
      password: 'Password123!',
      role: 'admin',
    });

    const { conversation: adminConv } = await findOrCreateConversation({
      user: adminUser,
      eventId: event._id,
      type: 'admin_organizer',
    });

    assert(adminConv, 'Admin-organizer conversation created');

    // Organizer sends message to admin
    const sendReq = {
      params: { id: adminConv._id.toString() },
      body: { text: 'Hello Platform Admin! Need help.' },
      user: organizer,
    };
    let sendResData = null;
    let sendResStatus = 200;
    const sendRes = {
      status(s) {
        sendResStatus = s;
        return this;
      },
      json(d) {
        sendResData = d;
        return this;
      },
    };
    await sendMessage(sendReq, sendRes, (err) => { if (err) throw err; });
    assert.equal(sendResStatus, 201);
    const adminMsg = sendResData.message;

    // Admin marks as read
    const readReq = {
      params: { id: adminConv._id.toString() },
      user: adminUser,
    };
    let readResData = null;
    let readResStatus = 200;
    const readRes = {
      status(s) {
        readResStatus = s;
        return this;
      },
      json(d) {
        readResData = d;
        return this;
      },
    };
    await markConversationRead(readReq, readRes, (err) => { if (err) throw err; });
    assert.equal(readResStatus, 200);

    const updatedAdminMsg = await Message.findById(adminMsg._id).lean();
    assert.equal(updatedAdminMsg.readBy.length, 2);
    const hasAdmin = updatedAdminMsg.readBy.some((r) => extractId(r.userId) === extractId(adminUser._id));
    assert.equal(hasAdmin, true, 'Message readBy contains admin ID');

    // Cleanup admin artifacts
    await Message.deleteMany({ conversationId: adminConv._id });
    await Conversation.findByIdAndDelete(adminConv._id);
    await User.findByIdAndDelete(adminUser._id);
  });

  // Cleanup
  await Booking.deleteMany({ eventId: event._id });
  await Message.deleteMany({ conversationId: conversation._id });
  await Conversation.findByIdAndDelete(conversation._id);
  await Event.findByIdAndDelete(event._id);
  await User.deleteMany({ _id: { $in: [organizer._id, attendee._id] } });
  await mongoose.disconnect();
  } catch (err) {
    console.error('FATAL TEST ERROR:', err);
    await mongoose.disconnect();
    throw err;
  }
});
