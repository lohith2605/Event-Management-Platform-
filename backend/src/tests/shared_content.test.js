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
import { getSharedContent } from '../controllers/chatController.js';

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

test('Chat Shared Content Feature — Backend Validation, Security & Controller Tests', async (t) => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const timestamp = Date.now();

  let organizerUser, attendeeUser, unauthorizedUser;
  let testEvent, testEventB;
  let convA, convB;
  let imgMsg1, imgMsg2, deletedImgMsg, foreignImgMsg;
  let docMsg1, docMsg2;
  let linkMsg1, linkMsg2;

  try {
    // 1. Setup Test Users
    organizerUser = await User.create({
      name: 'Shared Test Organizer',
      email: `shared_org_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'organizer',
    });

    attendeeUser = await User.create({
      name: 'Shared Test Attendee',
      email: `shared_att_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    unauthorizedUser = await User.create({
      name: 'Shared Test Outsider',
      email: `shared_outsider_${timestamp}@test.com`,
      password: 'Password123!',
      role: 'attendee',
    });

    // 2. Setup Events and Bookings
    testEvent = await Event.create({
      title: `Shared Feature Event A ${timestamp}`,
      description: 'Test Event for shared storage',
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
      title: `Shared Feature Event B ${timestamp}`,
      description: 'Second Test Event for shared storage',
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
      bookingReference: `UTSAV-SHR-A-${timestamp}`,
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

    // 4. Create Test Messages in Conv A

    // Media (Images)
    imgMsg1 = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Here is the main banner design',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/image/upload/v1/banner_2026.jpg',
          publicId: 'chat/attachments/banner_2026',
          originalName: 'banner_2026.jpg',
          mimeType: 'image/jpeg',
          resourceType: 'image',
          size: 512000,
          width: 1920,
          height: 1080,
        },
      ],
    });

    imgMsg2 = await Message.create({
      conversationId: convA._id,
      senderId: attendeeUser._id,
      senderName: attendeeUser.name,
      senderRole: attendeeUser.role,
      text: 'Floor map photo',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/image/upload/v1/floor_map.png',
          publicId: 'chat/attachments/floor_map',
          originalName: 'floor_map.png',
          mimeType: 'image/png',
          resourceType: 'image',
          size: 780000,
          width: 1200,
          height: 800,
        },
      ],
    });

    deletedImgMsg = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Deleted image message',
      isDeleted: true,
      deletedAt: new Date(),
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/image/upload/v1/deleted_photo.jpg',
          publicId: 'chat/attachments/deleted_photo',
          originalName: 'deleted_photo.jpg',
          mimeType: 'image/jpeg',
          resourceType: 'image',
          size: 300000,
        },
      ],
    });

    // Foreign message in Conv B (must not appear in Conv A shared queries)
    foreignImgMsg = await Message.create({
      conversationId: convB._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Conv B only banner',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/image/upload/v1/conv_b_banner.jpg',
          publicId: 'chat/attachments/conv_b_banner',
          originalName: 'conv_b_banner.jpg',
          mimeType: 'image/jpeg',
          resourceType: 'image',
          size: 200000,
        },
      ],
    });

    // Documents (PDF & Spreadsheet)
    docMsg1 = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Event schedule and speaker list',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/raw/upload/v1/schedule.pdf',
          publicId: 'chat/attachments/schedule_pdf',
          originalName: 'schedule.pdf',
          mimeType: 'application/pdf',
          resourceType: 'raw',
          size: 1048576,
        },
      ],
    });

    docMsg2 = await Message.create({
      conversationId: convA._id,
      senderId: attendeeUser._id,
      senderName: attendeeUser.name,
      senderRole: attendeeUser.role,
      text: 'Attendee team breakdown spreadsheet',
      attachments: [
        {
          url: 'https://res.cloudinary.com/utsav/raw/upload/v1/roster.xlsx',
          publicId: 'chat/attachments/roster_xlsx',
          originalName: 'roster.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          resourceType: 'raw',
          size: 24500,
        },
      ],
    });

    // Links
    linkMsg1 = await Message.create({
      conversationId: convA._id,
      senderId: organizerUser._id,
      senderName: organizerUser.name,
      senderRole: organizerUser.role,
      text: 'Please check our live stage schedule at https://utsav.com/stage-schedule and keynote docs at https://docs.utsav.com/keynote.',
    });

    linkMsg2 = await Message.create({
      conversationId: convA._id,
      senderId: attendeeUser._id,
      senderName: attendeeUser.name,
      senderRole: attendeeUser.role,
      text: 'Check this external venue review: https://maps.google.com/venue-review and ignore dangerous javascript:alert(1).',
    });

    // --- TEST 1: Query Shared Media ---
    await t.test('1. Query shared media returns active images in conversation and excludes deleted/foreign items', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'media', page: '1', limit: '30' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.type, 'media');
      assert.strictEqual(data.count, 2);
      assert.strictEqual(data.items.length, 2);

      // Verify items contain expected image attachments
      const filenames = data.items.map((i) => i.attachment?.originalName);
      assert.ok(filenames.includes('banner_2026.jpg'));
      assert.ok(filenames.includes('floor_map.png'));
      assert.ok(!filenames.includes('deleted_photo.jpg'));
      assert.ok(!filenames.includes('conv_b_banner.jpg'));

      // Verify metadata fields
      const item = data.items[0];
      assert.ok(item.messageId);
      assert.ok(item.senderName);
      assert.ok(item.createdAt);
      assert.strictEqual(item.type, 'media');
      assert.strictEqual(item.attachment.resourceType, 'image');
    });

    // --- TEST 2: Query Shared Documents ---
    await t.test('2. Query shared documents returns documents with correct metadata and excludes images', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'documents', page: '1', limit: '30' },
        user: attendeeUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.type, 'documents');
      assert.strictEqual(data.count, 2);

      const docNames = data.items.map((i) => i.attachment?.originalName);
      assert.ok(docNames.includes('schedule.pdf'));
      assert.ok(docNames.includes('roster.xlsx'));
      assert.ok(!docNames.includes('banner_2026.jpg'));

      const pdfItem = data.items.find((i) => i.attachment?.originalName === 'schedule.pdf');
      assert.ok(pdfItem);
      assert.strictEqual(pdfItem.attachment.mimeType, 'application/pdf');
      assert.strictEqual(pdfItem.attachment.size, 1048576);
    });

    // --- TEST 3: Query Shared Links ---
    await t.test('3. Query shared links extracts safe HTTP/HTTPS URLs and rejects dangerous schemes', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'links', page: '1', limit: '30' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.type, 'links');

      const extractedUrls = data.items.map((i) => i.url);
      assert.ok(extractedUrls.includes('https://utsav.com/stage-schedule'));
      assert.ok(extractedUrls.includes('https://docs.utsav.com/keynote'));
      assert.ok(extractedUrls.includes('https://maps.google.com/venue-review'));

      // Ensure dangerous schemes were completely excluded
      assert.ok(!extractedUrls.some((u) => u.startsWith('javascript:') || u.startsWith('data:')));

      const firstLink = data.items[0];
      assert.ok(firstLink.messageId);
      assert.ok(firstLink.domain);
      assert.ok(firstLink.textSnippet);
    });

    // --- TEST 4: Pagination & Limit Parameters ---
    await t.test('4. Respects pagination parameters page and limit', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'media', page: '1', limit: '1' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.count, 1);
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.limit, 1);
      assert.strictEqual(data.pagination.totalCount, 2);
      assert.strictEqual(data.pagination.totalPages, 2);
      assert.strictEqual(data.pagination.hasMore, true);
    });

    // --- TEST 5: Reject Invalid Content Type ---
    await t.test('5. Rejects invalid content type with 400 Bad Request', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'invalid_type' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 400);

      const data = getData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Supported types: media, documents, links'));
    });

    // --- TEST 6: Reject Unauthorized Access ---
    await t.test('6. Rejects shared content query from user without conversation access with 403 Forbidden', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'media' },
        user: unauthorizedUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 403);

      const data = getData();
      assert.strictEqual(data.success, false);
      assert.ok(data.message.includes('Access denied') || data.message.includes('Forbidden'));
    });

    // --- TEST 7: Invalid Conversation ID ---
    await t.test('7. Rejects malformed conversation ID with 400 Bad Request', async () => {
      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: 'invalid-id' },
        query: { type: 'media' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 400);
      const data = getData();
      assert.strictEqual(data.success, false);
    });

    // --- TEST 8: Soft-deleted message disappears from shared content ---
    await t.test('8. Soft-deleting a message removes it from shared media results', async () => {
      // Soft-delete imgMsg2
      imgMsg2.isDeleted = true;
      imgMsg2.deletedAt = new Date();
      await imgMsg2.save();

      const { req, res, next, getStatus, getData } = createMockReqRes({
        params: { id: convA._id.toString() },
        query: { type: 'media' },
        user: organizerUser,
      });

      await getSharedContent(req, res, next);
      assert.strictEqual(getStatus(), 200);

      const data = getData();
      assert.strictEqual(data.count, 1);
      assert.strictEqual(data.items[0].attachment?.originalName, 'banner_2026.jpg');
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
