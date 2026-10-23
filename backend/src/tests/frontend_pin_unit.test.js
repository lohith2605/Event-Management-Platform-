import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirror of snippet derivation in PinnedMessageBanner
function getPinnedSnippet(pinned) {
  if (!pinned) return '';
  if (pinned.text && pinned.text.trim()) {
    return pinned.text.length > 80 ? `${pinned.text.slice(0, 80)}...` : pinned.text;
  }
  if (pinned.hasAttachment) {
    if (pinned.attachmentType === 'document') {
      return `📄 ${pinned.originalName || 'Document'}`;
    }
    return '📷 Image';
  }
  return 'Pinned message';
}

// Pure logic mirror of isPinned evaluation in MessageBubble
function computeIsPinned(message, activeConversation) {
  if (!message) return false;
  const targetMsgId = (message._id || message.id || '').toString();
  const pinnedMsgId = (activeConversation?.pinnedMessage?.messageId || '').toString();
  return Boolean(message.isPinned || (pinnedMsgId && pinnedMsgId === targetMsgId));
}

// Pure logic mirror of ChatContext handleMessagePinned reducer
function handleMessagePinnedState(prevState, payload) {
  const { conversationId, pinnedMessage } = payload || {};
  if (!conversationId || !pinnedMessage) return prevState;

  const targetConvId = conversationId.toString();
  const currentActiveConvId = (prevState.activeConversation?._id || prevState.activeConversation?.id || '').toString();

  let nextActiveConversation = prevState.activeConversation;
  let nextMessages = prevState.messages;

  if (currentActiveConvId === targetConvId) {
    nextActiveConversation = { ...prevState.activeConversation, pinnedMessage };
    const pinnedMsgId = pinnedMessage.messageId.toString();
    nextMessages = prevState.messages.map((m) => ({
      ...m,
      isPinned: (m._id || m.id || '').toString() === pinnedMsgId,
    }));
  }

  const nextConversations = prevState.conversations.map((c) =>
    (c._id || c.id || '').toString() === targetConvId
      ? { ...c, pinnedMessage }
      : c
  );

  return {
    ...prevState,
    activeConversation: nextActiveConversation,
    conversations: nextConversations,
    messages: nextMessages,
  };
}

// Pure logic mirror of ChatContext handleMessageUnpinned reducer
function handleMessageUnpinnedState(prevState, payload) {
  const { conversationId } = payload || {};
  if (!conversationId) return prevState;

  const targetConvId = conversationId.toString();
  const currentActiveConvId = (prevState.activeConversation?._id || prevState.activeConversation?.id || '').toString();

  let nextActiveConversation = prevState.activeConversation;
  let nextMessages = prevState.messages;

  if (currentActiveConvId === targetConvId) {
    nextActiveConversation = { ...prevState.activeConversation, pinnedMessage: null };
    nextMessages = prevState.messages.map((m) =>
      m.isPinned ? { ...m, isPinned: false } : m
    );
  }

  const nextConversations = prevState.conversations.map((c) =>
    (c._id || c.id || '').toString() === targetConvId
      ? { ...c, pinnedMessage: null }
      : c
  );

  return {
    ...prevState,
    activeConversation: nextActiveConversation,
    conversations: nextConversations,
    messages: nextMessages,
  };
}

test('Frontend Pin & Unpin Unit Tests — Logic Mirrors & State Reducers', async (t) => {
  await t.test('1. Pinned snippet derives short text directly', () => {
    const snippet = getPinnedSnippet({ text: 'Hello team!' });
    assert.strictEqual(snippet, 'Hello team!');
  });

  await t.test('2. Pinned snippet truncates text longer than 80 characters with ellipsis', () => {
    const longText = 'This is an exceptionally long announcement text that exceeds eighty characters in total length to verify truncation behavior.';
    const snippet = getPinnedSnippet({ text: longText });
    assert.strictEqual(snippet.length, 83); // 80 chars + '...'
    assert.ok(snippet.endsWith('...'));
  });

  await t.test('3. Pinned snippet returns document attachment indicator with filename', () => {
    const snippet = getPinnedSnippet({
      text: '',
      hasAttachment: true,
      attachmentType: 'document',
      originalName: 'Contract.pdf',
    });
    assert.strictEqual(snippet, '📄 Contract.pdf');
  });

  await t.test('4. Pinned snippet returns image attachment indicator', () => {
    const snippet = getPinnedSnippet({
      text: '',
      hasAttachment: true,
      attachmentType: 'image',
      originalName: 'photo.jpg',
    });
    assert.strictEqual(snippet, '📷 Image');
  });

  await t.test('5. Pinned snippet falls back to default label when text and attachment empty', () => {
    const snippet = getPinnedSnippet({});
    assert.strictEqual(snippet, 'Pinned message');
  });

  await t.test('6. isPinned evaluates true if message.isPinned is true or matches activeConversation.pinnedMessage', () => {
    const msgA = { _id: 'msg1', text: 'First', isPinned: true };
    const msgB = { _id: 'msg2', text: 'Second', isPinned: false };
    const activeConv = { _id: 'c1', pinnedMessage: { messageId: 'msg2' } };

    assert.strictEqual(computeIsPinned(msgA, null), true);
    assert.strictEqual(computeIsPinned(msgB, null), false);
    assert.strictEqual(computeIsPinned(msgB, activeConv), true);
  });

  await t.test('7. handleMessagePinnedState updates activeConversation, conversations, and sets isPinned on matching message', () => {
    const initialState = {
      activeConversation: { _id: 'c1', title: 'Main Chat' },
      conversations: [
        { _id: 'c1', title: 'Main Chat', pinnedMessage: null },
        { _id: 'c2', title: 'Other Chat', pinnedMessage: null },
      ],
      messages: [
        { _id: 'm1', text: 'Old message', isPinned: true },
        { _id: 'm2', text: 'New pin message', isPinned: false },
      ],
    };

    const newPinned = {
      messageId: 'm2',
      text: 'New pin message',
      senderName: 'Lohith',
    };

    const nextState = handleMessagePinnedState(initialState, {
      conversationId: 'c1',
      pinnedMessage: newPinned,
    });

    assert.strictEqual(nextState.activeConversation.pinnedMessage.messageId, 'm2');
    assert.strictEqual(nextState.conversations[0].pinnedMessage.messageId, 'm2');
    assert.strictEqual(nextState.conversations[1].pinnedMessage, null);

    // Old pin cleared, new pin set
    assert.strictEqual(nextState.messages[0].isPinned, false);
    assert.strictEqual(nextState.messages[1].isPinned, true);
  });

  await t.test('8. handleMessageUnpinnedState safely clears pinned message across active conversation and conversations', () => {
    const initialState = {
      activeConversation: { _id: 'c1', pinnedMessage: { messageId: 'm2' } },
      conversations: [
        { _id: 'c1', pinnedMessage: { messageId: 'm2' } },
      ],
      messages: [
        { _id: 'm1', text: 'First', isPinned: false },
        { _id: 'm2', text: 'Second', isPinned: true },
      ],
    };

    const nextState = handleMessageUnpinnedState(initialState, { conversationId: 'c1' });

    assert.strictEqual(nextState.activeConversation.pinnedMessage, null);
    assert.strictEqual(nextState.conversations[0].pinnedMessage, null);
    assert.strictEqual(nextState.messages[1].isPinned, false);
  });
});
