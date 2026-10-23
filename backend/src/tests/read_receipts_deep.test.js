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
import { extractId, getOtherParticipantId } from '../../../frontend/src/utils/chatUtils.js';

test('Read Receipts Deep Diagnostics', async (t) => {
  await mongoose.connect(process.env.MONGODB_URI);

  const orgId = new mongoose.Types.ObjectId();
  const attId = new mongoose.Types.ObjectId();
  const eventId = new mongoose.Types.ObjectId();

  // Create conversation
  const conv = await Conversation.create({
    type: 'attendee_organizer',
    eventId,
    organizerId: orgId,
    attendeeId: attId,
    participants: [orgId, attId],
    unreadCounts: { [attId.toString()]: 0 },
  });

  // Create message sent by organizer
  const msg = await Message.create({
    conversationId: conv._id,
    senderId: orgId,
    senderName: 'Organizer Alice',
    senderRole: 'organizer',
    text: 'Hello Attendee Bob!',
    readBy: [{ userId: orgId, readAt: new Date() }],
  });

  await t.test('1. Initial message state has organizer in readBy', () => {
    assert.equal(msg.readBy.length, 1);
    assert.equal(msg.readBy[0].userId.toString(), orgId.toString());
  });

  await t.test('2. Attendee marks read via Message.updateMany', async () => {
    const updateResult = await Message.updateMany(
      {
        conversationId: conv._id,
        'readBy.userId': { $ne: attId },
      },
      {
        $push: {
          readBy: { userId: attId, readAt: new Date() },
        },
      }
    );

    assert.equal(updateResult.modifiedCount, 1, 'Should modify exactly 1 message');

    const updatedMsg = await Message.findById(msg._id).lean();
    assert.equal(updatedMsg.readBy.length, 2, 'Should now have 2 readBy entries');
    console.log('updatedMsg.readBy:', updatedMsg.readBy);

    const hasAtt = updatedMsg.readBy.some(
      (r) => extractId(r.userId) === extractId(attId)
    );
    assert.equal(hasAtt, true, 'readBy should contain attendee ID');
  });

  await t.test('3. Test frontend read receipt detection with lean message from API', async () => {
    const apiMsg = await Message.findById(msg._id).lean();

    // In frontend, organizer user:
    const organizerUser = {
      _id: orgId.toString(),
      id: orgId.toString(),
      role: 'organizer',
      name: 'Organizer Alice',
    };

    // Populated conversation as returned by API
    const populatedConv = {
      _id: conv._id.toString(),
      type: 'attendee_organizer',
      eventId: { _id: eventId.toString(), title: 'Event' },
      organizerId: { _id: orgId.toString(), name: 'Alice', role: 'organizer' },
      attendeeId: { _id: attId.toString(), name: 'Bob', role: 'attendee' },
      participants: [{ _id: orgId.toString() }, { _id: attId.toString() }],
    };

    const otherPartId = getOtherParticipantId(populatedConv, organizerUser);
    assert.equal(otherPartId, attId.toString(), 'otherParticipantId must resolve to attendeeId');

    // Simulate MessageBubble isReadByRecipient
    const isOwn = Boolean(extractId(organizerUser) && extractId(apiMsg.senderId) === extractId(organizerUser));
    assert.equal(isOwn, true, 'isOwn must be true for organizer');

    const isRead = (() => {
      if (!isOwn || !apiMsg.readBy || apiMsg.isDeleted) return false;
      if (otherPartId) {
        return apiMsg.readBy.some(
          (r) => extractId(r.userId) === extractId(otherPartId)
        );
      }
      const senderIdStr = extractId(apiMsg.senderId);
      return apiMsg.readBy.some((r) => {
        const readerIdStr = extractId(r.userId);
        return readerIdStr && readerIdStr !== senderIdStr;
      });
    })();

    assert.equal(isRead, true, 'isReadByRecipient must evaluate to true after reload');
  });

  await t.test('4. Test frontend handleMessagesRead real-time socket event', () => {
    // Initial message in state
    const clientMsg = {
      _id: msg._id.toString(),
      conversationId: conv._id.toString(),
      senderId: orgId.toString(),
      senderName: 'Organizer Alice',
      text: 'Hello Attendee Bob!',
      readBy: [{ userId: orgId.toString(), readAt: new Date().toISOString() }],
    };

    let messages = [clientMsg];

    // Payload from socket
    const payload = {
      conversationId: conv._id.toString(),
      userId: attId.toString(),
      readAt: new Date().toISOString(),
    };

    // Simulate handleMessagesRead from ChatContext.jsx
    const readUserId = extractId(payload.userId);
    messages = messages.map((m) => {
      const alreadyRead = (m.readBy || []).some(
        (r) => extractId(r.userId) === readUserId
      );
      if (!alreadyRead) {
        return {
          ...m,
          readBy: [...(m.readBy || []), { userId: payload.userId, readAt: payload.readAt }],
        };
      }
      return m;
    });

    const updatedClientMsg = messages[0];
    assert.equal(updatedClientMsg.readBy.length, 2);

    // Test MessageBubble isReadByRecipient
    const isOwn = true;
    const otherPartId = attId.toString();

    const isRead = (() => {
      if (!isOwn || !updatedClientMsg.readBy || updatedClientMsg.isDeleted) return false;
      if (otherPartId) {
        return updatedClientMsg.readBy.some(
          (r) => extractId(r.userId) === extractId(otherPartId)
        );
      }
      const senderIdStr = extractId(updatedClientMsg.senderId);
      return updatedClientMsg.readBy.some((r) => {
        const readerIdStr = extractId(r.userId);
        return readerIdStr && readerIdStr !== senderIdStr;
      });
    })();

    assert.equal(isRead, true, 'Real-time updated message must evaluate to read = true');
  });

  // Cleanup
  await Message.deleteMany({ conversationId: conv._id });
  await Conversation.findByIdAndDelete(conv._id);
  await mongoose.disconnect();
});
