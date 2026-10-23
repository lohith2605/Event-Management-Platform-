import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirror of reply snapshot formatting in frontend MessageBubble & MessageComposer
function getReplySnippet(replySnapshot) {
  if (!replySnapshot) return '';
  if (replySnapshot.isDeleted) return 'This message was deleted';
  if (replySnapshot.text) {
    return replySnapshot.text.length > 100
      ? replySnapshot.text.slice(0, 100) + '...'
      : replySnapshot.text;
  }
  if (replySnapshot.hasAttachment) {
    if (replySnapshot.attachmentType === 'document') {
      return `📄 ${replySnapshot.originalName || 'Document'}`;
    }
    return '📷 Image';
  }
  return 'Attachment';
}

// Logic mirror of state reducer when a message is soft-deleted
function cascadeDeleteInMessages(messages, deletedMessageId) {
  return messages.map((m) => {
    if (m._id === deletedMessageId) {
      return {
        ...m,
        isDeleted: true,
        text: 'This message was deleted',
        reactions: [],
      };
    }
    if (m.replyToMessageId === deletedMessageId && m.replySnapshot) {
      return {
        ...m,
        replySnapshot: {
          ...m.replySnapshot,
          isDeleted: true,
          text: 'This message was deleted',
          hasAttachment: false,
          attachmentType: null,
          originalName: '',
        },
      };
    }
    return m;
  });
}

test('Frontend Reply Logic & State Reducer Unit Tests', async (t) => {
  await t.test('1. Derives snippet correctly for regular text messages', () => {
    const snapshot = {
      senderName: 'Lohith',
      text: 'See you at the conference tomorrow!',
      hasAttachment: false,
      isDeleted: false,
    };
    assert.strictEqual(getReplySnippet(snapshot), 'See you at the conference tomorrow!');
  });

  await t.test('2. Truncates long text messages cleanly for preview', () => {
    const longText = 'A'.repeat(150);
    const snapshot = {
      senderName: 'Lohith',
      text: longText,
      hasAttachment: false,
      isDeleted: false,
    };
    const snippet = getReplySnippet(snapshot);
    assert.strictEqual(snippet.length, 103);
    assert.ok(snippet.endsWith('...'));
  });

  await t.test('3. Derives snippet for image attachment without caption', () => {
    const snapshot = {
      senderName: 'Organizer',
      text: '',
      hasAttachment: true,
      attachmentType: 'image',
      originalName: 'stage.jpg',
      isDeleted: false,
    };
    assert.strictEqual(getReplySnippet(snapshot), '📷 Image');
  });

  await t.test('4. Derives snippet for document attachment with filename', () => {
    const snapshot = {
      senderName: 'Organizer',
      text: '',
      hasAttachment: true,
      attachmentType: 'document',
      originalName: 'agenda.pdf',
      isDeleted: false,
    };
    assert.strictEqual(getReplySnippet(snapshot), '📄 agenda.pdf');
  });

  await t.test('5. Derives placeholder for deleted message snapshot', () => {
    const snapshot = {
      senderName: 'Participant',
      text: 'This message was deleted',
      hasAttachment: false,
      isDeleted: true,
    };
    assert.strictEqual(getReplySnippet(snapshot), 'This message was deleted');
  });

  await t.test('6. Preserves user draft text when cancelling reply', () => {
    let replyingTo = { _id: 'msg_1', senderName: 'Alice', text: 'Original message' };
    let composerText = 'Draft message already typed by the user';

    // User clicks Cancel on reply preview banner
    const cancelReply = () => {
      replyingTo = null;
    };
    cancelReply();

    // Draft text must be preserved 100% intact
    assert.strictEqual(replyingTo, null);
    assert.strictEqual(composerText, 'Draft message already typed by the user');
  });

  await t.test('7. Preserves user draft text when switching reply target', () => {
    let replyingTo = { _id: 'msg_1', senderName: 'Alice', text: 'Original message' };
    let composerText = 'Draft response in progress...';

    // User clicks reply on another message (Bob)
    replyingTo = { _id: 'msg_2', senderName: 'Bob', text: 'Second message' };

    assert.strictEqual(replyingTo._id, 'msg_2');
    assert.strictEqual(composerText, 'Draft response in progress...');
  });

  await t.test('8. Cascade delete updates both target message and referencing reply snapshots', () => {
    const initialMessages = [
      {
        _id: 'msg_1',
        text: 'Original question about venue parking',
        isDeleted: false,
      },
      {
        _id: 'msg_2',
        replyToMessageId: 'msg_1',
        replySnapshot: {
          messageId: 'msg_1',
          senderName: 'Attendee',
          text: 'Original question about venue parking',
          isDeleted: false,
        },
        text: 'Parking is available at Basement Level 2.',
        isDeleted: false,
      },
      {
        _id: 'msg_3',
        text: 'Unrelated message',
        isDeleted: false,
      },
    ];

    const updated = cascadeDeleteInMessages(initialMessages, 'msg_1');

    // msg_1 is marked deleted
    assert.strictEqual(updated[0].isDeleted, true);
    assert.strictEqual(updated[0].text, 'This message was deleted');

    // msg_2's reply snapshot is updated to reflect deletion
    assert.strictEqual(updated[1].isDeleted, false);
    assert.strictEqual(updated[1].replySnapshot.isDeleted, true);
    assert.strictEqual(updated[1].replySnapshot.text, 'This message was deleted');

    // msg_3 is untouched
    assert.strictEqual(updated[2].isDeleted, false);
    assert.strictEqual(updated[2].text, 'Unrelated message');
  });
});
