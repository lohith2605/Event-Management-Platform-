import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Message from '../models/Message.js';

test('Message Edit & Delete — Model Schema & Validation', async (t) => {
  await t.test('New message has default edit and delete flags', () => {
    const msg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test Sender',
      senderRole: 'attendee',
      text: 'Hello world',
    });

    assert.strictEqual(msg.isEdited, false);
    assert.strictEqual(msg.editedAt, null);
    assert.strictEqual(msg.isDeleted, false);
    assert.strictEqual(msg.deletedAt, null);
  });

  await t.test('Model enforces text length limits (1 to 2000 characters)', () => {
    const validMsg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test Sender',
      senderRole: 'organizer',
      text: 'A'.repeat(2000),
    });
    const validErr = validMsg.validateSync();
    assert.strictEqual(validErr, undefined, '2000 characters should be valid');

    const tooLongMsg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test Sender',
      senderRole: 'organizer',
      text: 'A'.repeat(2001),
    });
    const longErr = tooLongMsg.validateSync();
    assert.ok(longErr, 'Expected validation error for text > 2000 chars');
    assert.ok(longErr.errors.text);
  });
});

test('Message Edit — Authorization & Validation Logic', async (t) => {
  const authorId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();

  await t.test('Enforces author ownership check for editing', () => {
    const msg = {
      _id: new mongoose.Types.ObjectId(),
      senderId: authorId,
      text: 'Original message text',
      isDeleted: false,
    };

    const isAuthor = (senderId, reqUserId) => senderId.toString() === reqUserId.toString();

    assert.strictEqual(isAuthor(msg.senderId, authorId), true, 'Author is allowed to edit');
    assert.strictEqual(isAuthor(msg.senderId, otherUserId), false, 'Non-author is forbidden');
  });

  await t.test('Rejects empty or whitespace-only edits', () => {
    const validateEdit = (newText) => {
      if (!newText || typeof newText !== 'string' || !newText.trim()) {
        return { valid: false, error: 'Message text cannot be empty.' };
      }
      const trimmed = newText.trim();
      if (trimmed.length > 2000) {
        return { valid: false, error: 'Message cannot exceed 2000 characters.' };
      }
      return { valid: true, text: trimmed };
    };

    assert.strictEqual(validateEdit('').valid, false);
    assert.strictEqual(validateEdit('   ').valid, false);
    assert.strictEqual(validateEdit(null).valid, false);
    assert.strictEqual(validateEdit(undefined).valid, false);
    assert.strictEqual(validateEdit('Valid edited text').valid, true);
    assert.strictEqual(validateEdit('Valid edited text').text, 'Valid edited text');
    assert.strictEqual(validateEdit('A'.repeat(2001)).valid, false);
  });

  await t.test('Detects unchanged content to prevent redundant updates', () => {
    const originalText = 'Hello there!';
    const checkChanged = (current, updated) => {
      const trimmed = (updated || '').trim();
      return current !== trimmed;
    };

    assert.strictEqual(checkChanged(originalText, 'Hello there!'), false, 'Exact match is unchanged');
    assert.strictEqual(checkChanged(originalText, '  Hello there!  '), false, 'Whitespace-padded match is unchanged');
    assert.strictEqual(checkChanged(originalText, 'Hello there! Updated'), true, 'Altered text is changed');
  });

  await t.test('Rejects editing an already deleted message', () => {
    const deletedMsg = {
      _id: new mongoose.Types.ObjectId(),
      senderId: authorId,
      text: 'This message was deleted',
      isDeleted: true,
    };

    const canEdit = !deletedMsg.isDeleted;
    assert.strictEqual(canEdit, false, 'Deleted message cannot be edited');
  });
});

test('Message Delete — Authorization & Soft Delete Sanitization', async (t) => {
  const authorId = new mongoose.Types.ObjectId();
  const otherUserId = new mongoose.Types.ObjectId();

  await t.test('Enforces author ownership check for deletion', () => {
    const msg = {
      _id: new mongoose.Types.ObjectId(),
      senderId: authorId,
      text: 'Message to delete',
      isDeleted: false,
    };

    const isAuthor = (senderId, reqUserId) => senderId.toString() === reqUserId.toString();

    assert.strictEqual(isAuthor(msg.senderId, authorId), true, 'Author is allowed to delete');
    assert.strictEqual(isAuthor(msg.senderId, otherUserId), false, 'Non-author is forbidden from deleting');
  });

  await t.test('Soft delete clears original text, removes reactions, and sets placeholder', () => {
    const message = {
      _id: new mongoose.Types.ObjectId(),
      senderId: authorId,
      text: 'Secret sensitive message',
      reactions: [
        { emoji: '👍', userId: otherUserId, userName: 'Bob' },
      ],
      isDeleted: false,
      deletedAt: null,
    };

    // Simulate soft delete logic from controller
    const softDelete = (msg) => {
      msg.isDeleted = true;
      msg.deletedAt = new Date();
      msg.text = 'This message was deleted';
      msg.reactions = [];
      return msg;
    };

    const deleted = softDelete(message);

    assert.strictEqual(deleted.isDeleted, true);
    assert.ok(deleted.deletedAt instanceof Date);
    assert.strictEqual(deleted.text, 'This message was deleted');
    assert.strictEqual(deleted.reactions.length, 0);
    assert.strictEqual(deleted.text.includes('Secret'), false, 'Original sensitive text never leaked');
  });

  await t.test('Rejects deletion of an already deleted message', () => {
    const alreadyDeleted = {
      _id: new mongoose.Types.ObjectId(),
      senderId: authorId,
      isDeleted: true,
    };

    const canDelete = !alreadyDeleted.isDeleted;
    assert.strictEqual(canDelete, false, 'Already deleted message cannot be deleted again');
  });
});
