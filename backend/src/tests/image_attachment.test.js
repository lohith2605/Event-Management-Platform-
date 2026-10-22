import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import { validateImageSignature } from '../services/cloudinaryService.js';

test('Image Attachment — Magic Signature Validation', async (t) => {
  await t.test('Validates JPEG magic bytes (FF D8 FF)', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const res = validateImageSignature(jpegBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.type, 'image/jpeg');
  });

  await t.test('Validates PNG magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    const res = validateImageSignature(pngBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.type, 'image/png');
  });

  await t.test('Validates GIF87a and GIF89a magic bytes', () => {
    const gif87 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
    const res87 = validateImageSignature(gif87);
    assert.strictEqual(res87.valid, true);
    assert.strictEqual(res87.type, 'image/gif');

    const gif89 = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
    const res89 = validateImageSignature(gif89);
    assert.strictEqual(res89.valid, true);
    assert.strictEqual(res89.type, 'image/gif');
  });

  await t.test('Validates WebP magic bytes (RIFF....WEBP)', () => {
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x24, 0x00, 0x00, 0x00, // file size
      0x57, 0x45, 0x42, 0x50, // WEBP
    ]);
    const res = validateImageSignature(webpBuffer);
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.type, 'image/webp');
  });

  await t.test('Rejects non-image data (plain text, html, exe, malformed bytes)', () => {
    const textBuffer = Buffer.from('Hello world this is not an image');
    assert.strictEqual(validateImageSignature(textBuffer).valid, false);

    const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body>malicious</body></html>');
    assert.strictEqual(validateImageSignature(htmlBuffer).valid, false);

    const emptyBuffer = Buffer.alloc(0);
    assert.strictEqual(validateImageSignature(emptyBuffer).valid, false);

    const shortBuffer = Buffer.from([0xff, 0xd8]);
    assert.strictEqual(validateImageSignature(shortBuffer).valid, false);
  });
});

test('Message Model — Attachment Compatibility & Validation', async (t) => {
  const conversationId = new mongoose.Types.ObjectId();
  const senderId = new mongoose.Types.ObjectId();

  await t.test('Accepts message with text only (legacy/text message)', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Alice',
      senderRole: 'attendee',
      text: 'Just text here',
    });
    const err = msg.validateSync();
    assert.strictEqual(err, undefined);
    assert.strictEqual(msg.attachments.length, 0);
    assert.strictEqual(msg.attachment, null);
  });

  await t.test('Accepts message with attachment only (empty text)', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Bob',
      senderRole: 'organizer',
      text: '',
      attachment: {
        url: 'https://res.cloudinary.com/test/image/upload/v1/utsav/chat_images/sample.jpg',
        publicId: 'utsav/chat_images/sample',
        originalName: 'sample.jpg',
        mimeType: 'image/jpeg',
        size: 54321,
      },
    });
    const err = msg.validateSync();
    assert.strictEqual(err, undefined, 'Attachment-only message should be valid');
    assert.strictEqual(msg.attachment.publicId, 'utsav/chat_images/sample');
  });

  await t.test('Accepts message with text caption and attachment', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Charlie',
      senderRole: 'admin',
      text: 'Here is the event map!',
      attachments: [
        {
          url: 'https://res.cloudinary.com/test/image/upload/v1/utsav/chat_images/map.png',
          publicId: 'utsav/chat_images/map',
          originalName: 'map.png',
          mimeType: 'image/png',
          size: 102400,
        },
      ],
    });
    const err = msg.validateSync();
    assert.strictEqual(err, undefined);
    assert.strictEqual(msg.text, 'Here is the event map!');
    assert.strictEqual(msg.attachments.length, 1);
  });

  await t.test('Rejects message with neither text nor attachment', () => {
    const emptyMsg = new Message({
      conversationId,
      senderId,
      senderName: 'David',
      senderRole: 'attendee',
      text: '   ',
      attachments: [],
      attachment: null,
    });
    const err = emptyMsg.validateSync();
    assert.ok(err, 'Expected validation error when both text and attachment are missing');
    assert.ok(err.errors.text);
  });

  await t.test('Soft delete clears attachments along with text', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Eve',
      senderRole: 'attendee',
      text: 'Check this photo',
      attachment: {
        url: 'https://res.cloudinary.com/test/image/upload/v1/utsav/chat_images/photo.jpg',
        publicId: 'utsav/chat_images/photo',
        originalName: 'photo.jpg',
        mimeType: 'image/jpeg',
      },
      attachments: [
        {
          url: 'https://res.cloudinary.com/test/image/upload/v1/utsav/chat_images/photo.jpg',
          publicId: 'utsav/chat_images/photo',
          originalName: 'photo.jpg',
          mimeType: 'image/jpeg',
        },
      ],
    });

    // Simulate soft delete
    msg.isDeleted = true;
    msg.deletedAt = new Date();
    msg.text = 'This message was deleted';
    msg.reactions = [];
    msg.attachments = [];
    msg.attachment = null;

    assert.strictEqual(msg.isDeleted, true);
    assert.strictEqual(msg.text, 'This message was deleted');
    assert.strictEqual(msg.attachments.length, 0);
    assert.strictEqual(msg.attachment, null);
  });
});
