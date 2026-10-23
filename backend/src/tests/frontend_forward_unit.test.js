import test from 'node:test';
import assert from 'node:assert/strict';

// Pure logic mirror of conversation filtering in ForwardMessageModal
function filterConversations(conversations, searchQuery, currentUserRole) {
  if (!conversations || !Array.isArray(conversations)) return [];
  const q = (searchQuery || '').toLowerCase().trim();

  return conversations.filter((c) => {
    if (!c || !c._id) return false;
    if (!q) return true;

    const eventTitle = (c.eventId?.title || '').toLowerCase();
    let otherName = '';

    if (c.type === 'admin_organizer') {
      otherName = currentUserRole === 'admin'
        ? (c.organizerId?.name || 'Event Organizer')
        : 'Platform Admin';
    } else {
      otherName = currentUserRole === 'organizer'
        ? (c.attendeeId?.name || 'Attendee')
        : (c.organizerId?.name || 'Event Organizer');
    }

    const lastText = (c.lastMessage?.text || '').toLowerCase();

    return (
      eventTitle.includes(q) ||
      otherName.toLowerCase().includes(q) ||
      lastText.includes(q)
    );
  });
}

// Pure logic mirror of preview formatting in ForwardMessageModal
function getForwardPreview(message) {
  if (!message) return { title: '', body: '', hasAttachment: false, attachmentType: null };

  const sender = message.senderName || 'Participant';
  const role = message.senderRole ? `(${message.senderRole})` : '';
  const title = `Forwarded message from ${sender} ${role}`.trim();

  const primaryAttachment =
    message.attachment || (message.attachments && message.attachments[0]) || null;

  let attachmentType = null;
  let attachmentName = '';

  if (primaryAttachment) {
    const isImage =
      primaryAttachment.resourceType === 'image' ||
      (primaryAttachment.mimeType && primaryAttachment.mimeType.startsWith('image/'));
    attachmentType = isImage ? 'image' : 'document';
    attachmentName = primaryAttachment.originalName || (isImage ? 'Image' : 'Document');
  }

  return {
    title,
    sender,
    text: message.text || '',
    hasAttachment: Boolean(primaryAttachment),
    attachmentType,
    attachmentName,
  };
}

// Pure logic mirror of ChatContext timeline append & de-duplication
function appendForwardedMessage(existingMessages, newMessage, currentActiveConvId) {
  if (!newMessage || !newMessage._id) return existingMessages;
  const targetConvId = newMessage.conversationId?.toString();
  if (!targetConvId || targetConvId !== currentActiveConvId?.toString()) {
    return existingMessages; // Not active conversation on screen
  }

  const alreadyExists = existingMessages.some(
    (m) => (m._id || m.id)?.toString() === (newMessage._id || newMessage.id)?.toString()
  );
  if (alreadyExists) return existingMessages;

  return [...existingMessages, newMessage];
}

test('Frontend Message Forwarding Logic & Component Helpers', async (t) => {
  const mockConversations = [
    {
      _id: 'conv_1',
      type: 'attendee_organizer',
      eventId: { title: 'UTSAV Tech Summit 2026' },
      organizerId: { name: 'Priya Sharma' },
      attendeeId: { name: 'Rahul Verma' },
      lastMessage: { text: 'Welcome to the summit!' },
    },
    {
      _id: 'conv_2',
      type: 'attendee_organizer',
      eventId: { title: 'Global Music Carnival' },
      organizerId: { name: 'DJ Ankit' },
      attendeeId: { name: 'Rahul Verma' },
      lastMessage: { text: 'Tickets have been validated' },
    },
    {
      _id: 'conv_3',
      type: 'admin_organizer',
      eventId: { title: 'UTSAV Tech Summit 2026' },
      organizerId: { name: 'Priya Sharma' },
      lastMessage: { text: 'Payout inquiry support thread' },
    },
  ];

  await t.test('1. Filters conversations by event title', () => {
    const results = filterConversations(mockConversations, 'Carnival', 'attendee');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]._id, 'conv_2');
  });

  await t.test('2. Filters conversations by participant name', () => {
    const results = filterConversations(mockConversations, 'Priya', 'admin');
    assert.strictEqual(results.length, 2);
  });

  await t.test('3. Filters conversations by last message snippet', () => {
    const results = filterConversations(mockConversations, 'payout', 'attendee');
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0]._id, 'conv_3');
  });

  await t.test('4. Returns empty list when search does not match any conversation', () => {
    const results = filterConversations(mockConversations, 'NonExistentEventXYZ', 'attendee');
    assert.strictEqual(results.length, 0);
  });

  await t.test('5. Previews text-only message correctly', () => {
    const msg = {
      _id: 'msg_101',
      senderName: 'Lohith',
      senderRole: 'organizer',
      text: 'Session starts in Hall A at 10 AM.',
    };
    const preview = getForwardPreview(msg);
    assert.strictEqual(preview.sender, 'Lohith');
    assert.strictEqual(preview.text, 'Session starts in Hall A at 10 AM.');
    assert.strictEqual(preview.hasAttachment, false);
    assert.strictEqual(preview.attachmentType, null);
  });

  await t.test('6. Previews image message correctly', () => {
    const msg = {
      _id: 'msg_102',
      senderName: 'Lohith',
      senderRole: 'organizer',
      attachment: {
        resourceType: 'image',
        mimeType: 'image/jpeg',
        originalName: 'venue_map.jpg',
        url: 'https://res.cloudinary.com/utsav/venue_map.jpg',
      },
    };
    const preview = getForwardPreview(msg);
    assert.strictEqual(preview.hasAttachment, true);
    assert.strictEqual(preview.attachmentType, 'image');
    assert.strictEqual(preview.attachmentName, 'venue_map.jpg');
  });

  await t.test('7. Previews document message correctly', () => {
    const msg = {
      _id: 'msg_103',
      senderName: 'Lohith',
      senderRole: 'organizer',
      attachments: [
        {
          resourceType: 'raw',
          mimeType: 'application/pdf',
          originalName: 'Brochure.pdf',
          url: 'https://res.cloudinary.com/utsav/Brochure.pdf',
        },
      ],
    };
    const preview = getForwardPreview(msg);
    assert.strictEqual(preview.hasAttachment, true);
    assert.strictEqual(preview.attachmentType, 'document');
    assert.strictEqual(preview.attachmentName, 'Brochure.pdf');
  });

  await t.test('8. Appends forwarded message to timeline if destination is active on screen', () => {
    const existing = [{ _id: 'm1', text: 'Hello' }];
    const forwarded = { _id: 'm2', conversationId: 'conv_1', text: 'Forwarded text', isForwarded: true };

    const updated = appendForwardedMessage(existing, forwarded, 'conv_1');
    assert.strictEqual(updated.length, 2);
    assert.strictEqual(updated[1]._id, 'm2');
  });

  await t.test('9. Prevents duplicate messages in timeline when socket and REST both arrive', () => {
    const existing = [
      { _id: 'm1', text: 'Hello' },
      { _id: 'm2', conversationId: 'conv_1', text: 'Forwarded text', isForwarded: true },
    ];
    const duplicate = { _id: 'm2', conversationId: 'conv_1', text: 'Forwarded text', isForwarded: true };

    const updated = appendForwardedMessage(existing, duplicate, 'conv_1');
    assert.strictEqual(updated.length, 2);
  });

  await t.test('10. Does not append to active timeline if forwarded to a different conversation', () => {
    const existing = [{ _id: 'm1', text: 'Hello' }];
    const forwardedToOther = { _id: 'm3', conversationId: 'conv_99', text: 'Other' };

    const updated = appendForwardedMessage(existing, forwardedToOther, 'conv_1');
    assert.strictEqual(updated.length, 1);
  });
});
