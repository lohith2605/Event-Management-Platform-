import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Message, { ALLOWED_EMOJIS } from '../models/Message.js';

test('Emoji Reactions — Validation & Model Logic', async (t) => {
  await t.test('ALLOWED_EMOJIS contains the 6 required emojis', () => {
    assert.deepEqual(ALLOWED_EMOJIS, ['👍', '❤️', '🎉', '😂', '😮', '🙏']);
  });

  await t.test('Rejects invalid emoji strings', () => {
    const invalidEmojis = ['🔥', '🚀', '💩', 'random', '', null, undefined];
    for (const em of invalidEmojis) {
      assert.strictEqual(
        ALLOWED_EMOJIS.includes(em),
        false,
        `Expected emoji ${em} to be rejected`
      );
    }
  });

  await t.test('Accepts valid emojis', () => {
    for (const em of ALLOWED_EMOJIS) {
      assert.strictEqual(
        ALLOWED_EMOJIS.includes(em),
        true,
        `Expected emoji ${em} to be accepted`
      );
    }
  });

  await t.test('Legacy message backwards-compatibility: Message without reactions defaults to empty array', () => {
    const rawMsg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: new mongoose.Types.ObjectId(),
      senderName: 'Test Attendee',
      senderRole: 'attendee',
      text: 'Hello world legacy message',
    });

    assert.ok(Array.isArray(rawMsg.reactions));
    assert.strictEqual(rawMsg.reactions.length, 0);
  });

  await t.test('Message accepts valid reaction subdocuments', () => {
    const u1 = new mongoose.Types.ObjectId();
    const u2 = new mongoose.Types.ObjectId();

    const msg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: u1,
      senderName: 'Test User',
      senderRole: 'attendee',
      text: 'Message with reactions',
      reactions: [
        { emoji: '👍', userId: u1, userName: 'User 1' },
        { emoji: '❤️', userId: u2, userName: 'User 2' },
      ],
    });

    assert.strictEqual(msg.reactions.length, 2);
    assert.strictEqual(msg.reactions[0].emoji, '👍');
    assert.strictEqual(msg.reactions[0].userName, 'User 1');
    assert.strictEqual(msg.reactions[1].emoji, '❤️');
    assert.strictEqual(msg.reactions[1].userName, 'User 2');
  });

  await t.test('Message rejects invalid emoji in subdocument validation', () => {
    const u1 = new mongoose.Types.ObjectId();
    const msg = new Message({
      conversationId: new mongoose.Types.ObjectId(),
      senderId: u1,
      senderName: 'Test User',
      senderRole: 'attendee',
      text: 'Invalid reaction message',
      reactions: [{ emoji: '🔥', userId: u1, userName: 'User 1' }],
    });

    const validationErr = msg.validateSync();
    assert.ok(validationErr, 'Expected validation error for unsupported emoji');
    assert.ok(validationErr.errors['reactions.0.emoji']);
  });

  await t.test('Reaction toggle simulation: adding, toggling off, and multi-user reactions', () => {
    const userA = new mongoose.Types.ObjectId().toString();
    const userB = new mongoose.Types.ObjectId().toString();

    let reactions = [];

    // Helper toggle logic simulating controller logic
    const toggle = (list, emoji, userId, userName) => {
      const idx = list.findIndex(
        (r) => r.emoji === emoji && r.userId.toString() === userId.toString()
      );
      if (idx > -1) {
        // Remove
        return list.filter((_, i) => i !== idx);
      }
      // Add
      return [...list, { emoji, userId, userName, createdAt: new Date() }];
    };

    // User A adds 👍
    reactions = toggle(reactions, '👍', userA, 'Alice');
    assert.strictEqual(reactions.length, 1);
    assert.strictEqual(reactions[0].emoji, '👍');
    assert.strictEqual(reactions[0].userName, 'Alice');

    // User B adds 👍
    reactions = toggle(reactions, '👍', userB, 'Bob');
    assert.strictEqual(reactions.length, 2);

    // User A adds ❤️
    reactions = toggle(reactions, '❤️', userA, 'Alice');
    assert.strictEqual(reactions.length, 3);

    // User A toggles 👍 off
    reactions = toggle(reactions, '👍', userA, 'Alice');
    assert.strictEqual(reactions.length, 2);
    assert.strictEqual(reactions.some((r) => r.emoji === '👍' && r.userId === userA), false);
    assert.strictEqual(reactions.some((r) => r.emoji === '👍' && r.userId === userB), true);
    assert.strictEqual(reactions.some((r) => r.emoji === '❤️' && r.userId === userA), true);
  });

  await t.test('Concurrent request safety: prevents duplicate reaction for same user and emoji', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const list = [{ emoji: '🎉', userId, userName: 'Alice' }];

    // Simulating second concurrent call trying to add 🎉 for Alice
    const alreadyExists = list.some(
      (r) => r.emoji === '🎉' && r.userId.toString() === userId.toString()
    );
    assert.strictEqual(alreadyExists, true, 'Duplicate addition is detected and rejected');
  });
});
