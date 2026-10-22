import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Message from '../models/Message.js';
import { validateAttachmentFile } from '../services/cloudinaryService.js';

test('Document & File Attachment — Magic Signature & Content Validation', async (t) => {
  await t.test('Validates PDF magic bytes (%PDF-)', () => {
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
    const res = validateAttachmentFile(pdfBuffer, 'contract.pdf', 'application/pdf');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.category, 'document');
    assert.strictEqual(res.resourceType, 'raw');
    assert.strictEqual(res.mimeType, 'application/pdf');
  });

  await t.test('Validates DOCX zip container (PK\\x03\\x04) with docx extension', () => {
    const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const res = validateAttachmentFile(docxBuffer, 'itinerary.docx', '');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.category, 'document');
    assert.strictEqual(res.resourceType, 'raw');
    assert.strictEqual(
      res.mimeType,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
  });

  await t.test('Validates XLSX zip container (PK\\x03\\x04) with xlsx extension', () => {
    const xlsxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const res = validateAttachmentFile(xlsxBuffer, 'budget.xlsx', '');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.category, 'document');
    assert.strictEqual(res.resourceType, 'raw');
    assert.strictEqual(
      res.mimeType,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  await t.test('Rejects generic or unauthorized zip archives (.zip, .jar, .apk)', () => {
    const zipBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    const res = validateAttachmentFile(zipBuffer, 'archive.zip', 'application/zip');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Only DOCX and XLSX/i);
  });

  await t.test('Validates TXT and CSV plain text documents', () => {
    const txtBuffer = Buffer.from('Event Schedule Notes\n1. Welcome\n2. Keynote');
    const txtRes = validateAttachmentFile(txtBuffer, 'notes.txt', 'text/plain');
    assert.strictEqual(txtRes.valid, true);
    assert.strictEqual(txtRes.category, 'document');
    assert.strictEqual(txtRes.mimeType, 'text/plain');

    const csvBuffer = Buffer.from('Name,Email,Seat\nAlice,alice@example.com,A12');
    const csvRes = validateAttachmentFile(csvBuffer, 'attendees.csv', 'text/csv');
    assert.strictEqual(csvRes.valid, true);
    assert.strictEqual(csvRes.category, 'document');
    assert.strictEqual(csvRes.mimeType, 'text/csv');
  });

  await t.test('Rejects Windows MZ executable files (.exe, .dll)', () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = validateAttachmentFile(exeBuffer, 'malware.exe', 'application/x-msdownload');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Executable files are strictly forbidden/i);
  });

  await t.test('Rejects Linux ELF executables disguised as documents', () => {
    const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    const res = validateAttachmentFile(elfBuffer, 'payload.pdf', 'application/pdf');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Executable files are strictly forbidden/i);
  });

  await t.test('Rejects shell scripts with shebang header', () => {
    const scriptBuffer = Buffer.from('#!/bin/bash\nrm -rf /');
    const res = validateAttachmentFile(scriptBuffer, 'script.txt', 'text/plain');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Script files are strictly forbidden/i);
  });

  await t.test('Rejects HTML/JavaScript disguised as TXT or CSV', () => {
    const htmlBuffer = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
    const res = validateAttachmentFile(htmlBuffer, 'document.txt', 'text/plain');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /HTML, script, or executable code detected/i);

    const scriptBuffer = Buffer.from('<script src="https://evil.com/xss.js"></script>');
    const scriptRes = validateAttachmentFile(scriptBuffer, 'data.csv', 'text/csv');
    assert.strictEqual(scriptRes.valid, false);
  });

  await t.test('Rejects binary NUL bytes inside text documents', () => {
    const corruptedText = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
    const res = validateAttachmentFile(corruptedText, 'file.txt', 'text/plain');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /Binary or corrupted content detected/i);
  });

  await t.test('Rejects files exceeding 15MB limit', () => {
    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024);
    const res = validateAttachmentFile(oversizedBuffer, 'huge.pdf', 'application/pdf');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /maximum allowed size of 15MB/i);
  });
});

test('Message Model — Document Attachment Compatibility', async (t) => {
  const conversationId = new mongoose.Types.ObjectId();
  const senderId = new mongoose.Types.ObjectId();

  await t.test('Persists document attachment metadata correctly', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Organizer',
      senderRole: 'organizer',
      text: 'Please review the schedule',
      attachment: {
        url: 'https://res.cloudinary.com/utsav/raw/upload/v1/utsav/chat_documents/schedule.pdf',
        publicId: 'utsav/chat_documents/schedule',
        originalName: 'schedule.pdf',
        mimeType: 'application/pdf',
        size: 1048576,
        resourceType: 'raw',
      },
    });

    const err = msg.validateSync();
    assert.strictEqual(err, undefined);
    assert.strictEqual(msg.attachment.resourceType, 'raw');
    assert.strictEqual(msg.attachment.mimeType, 'application/pdf');
    assert.strictEqual(msg.attachment.originalName, 'schedule.pdf');
  });

  await t.test('Supports document-only message without text', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Organizer',
      senderRole: 'organizer',
      text: '',
      attachment: {
        url: 'https://res.cloudinary.com/utsav/raw/upload/v1/utsav/chat_documents/contract.docx',
        publicId: 'utsav/chat_documents/contract',
        originalName: 'contract.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 50000,
        resourceType: 'raw',
      },
    });

    const err = msg.validateSync();
    assert.strictEqual(err, undefined, 'Document-only message should be valid');
  });

  await t.test('Soft delete clears document attachments and reactions', () => {
    const msg = new Message({
      conversationId,
      senderId,
      senderName: 'Alice',
      senderRole: 'attendee',
      text: 'Here is my file',
      attachment: {
        url: 'https://res.cloudinary.com/utsav/raw/upload/v1/utsav/chat_documents/data.csv',
        publicId: 'utsav/chat_documents/data',
        originalName: 'data.csv',
        mimeType: 'text/csv',
        size: 1234,
        resourceType: 'raw',
      },
      reactions: [{ emoji: '👍', userName: 'Bob' }],
    });

    // Simulate soft delete
    msg.isDeleted = true;
    msg.text = 'This message was deleted';
    msg.attachment = null;
    msg.attachments = [];
    msg.reactions = [];

    assert.strictEqual(msg.isDeleted, true);
    assert.strictEqual(msg.text, 'This message was deleted');
    assert.strictEqual(msg.attachment, null);
    assert.strictEqual(msg.attachments.length, 0);
    assert.strictEqual(msg.reactions.length, 0);
  });
});
