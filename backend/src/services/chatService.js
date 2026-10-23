import mongoose from 'mongoose';
import Event from '../models/Event.js';
import Booking from '../models/Booking.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';

/**
 * Checks whether an attendee holds a valid, qualifying booking for an event.
 * Excludes cancelled, failed, expired, or refunded bookings.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string|mongoose.Types.ObjectId} eventId
 * @returns {Promise<boolean>}
 */
export const hasQualifyingBooking = async (userId, eventId) => {
  if (!userId || !eventId) return false;

  const targetUserId = userId._id || userId;
  const targetEventId = eventId._id || eventId;

  const qualifyingBooking = await Booking.findOne({
    userId: targetUserId,
    eventId: targetEventId,
    status: 'confirmed',
    paymentStatus: { $nin: ['failed', 'refunded'] },
    refundStatus: { $ne: 'processed' },
  }).lean();

  return Boolean(qualifyingBooking);
};

/**
 * Verifies whether the authenticated user is authorized to participate in a conversation.
 * Enforces event approval rules, ownership rules, and attendee booking requirements.
 *
 * @param {Object} user - The authenticated user document/object (req.user or socket.user)
 * @param {Object} conversation - The conversation document
 * @returns {Promise<{ allowed: boolean, status?: number, message?: string, event?: Object }>}
 */
export const verifyConversationAccess = async (user, conversation) => {
  if (!user || !user._id) {
    return { allowed: false, status: 401, message: 'Authentication required.' };
  }

  if (!conversation) {
    return { allowed: false, status: 404, message: 'Conversation not found.' };
  }

  // 1. Fetch associated Event to check lifecycle and publication status
  const eventId = conversation.eventId?._id || conversation.eventId;
  let event = conversation.eventId?.status ? conversation.eventId : await Event.findById(eventId);
  if (!event) {
    return { allowed: false, status: 404, message: 'Associated event not found.' };
  }

  // Mandatory Rule: Event must be in approved/published state
  if (event.status !== 'published') {
    return {
      allowed: false,
      status: 403,
      message: 'Chat is only accessible after an event has been approved and published by platform administrators.',
    };
  }

  const userIdStr = (user._id || user).toString();
  const organizerIdStr = conversation.organizerId
    ? (conversation.organizerId._id || conversation.organizerId).toString()
    : '';
  const attendeeIdStr = conversation.attendeeId
    ? (conversation.attendeeId._id || conversation.attendeeId).toString()
    : '';

  // 2. Type: admin_organizer
  if (conversation.type === 'admin_organizer') {
    // Only authorized platform admins or the actual event organizer can access
    if (user.role === 'admin') {
      return { allowed: true, event };
    }

    if (userIdStr === organizerIdStr) {
      return { allowed: true, event };
    }

    return {
      allowed: false,
      status: 403,
      message: 'Forbidden: You do not have permission to access this administrator conversation.',
    };
  }

  // 3. Type: attendee_organizer
  if (conversation.type === 'attendee_organizer') {
    // Admins may view/moderate
    if (user.role === 'admin') {
      return { allowed: true, event };
    }

    // Event organizer check
    if (userIdStr === organizerIdStr) {
      return { allowed: true, event };
    }

    // Attendee check: must be the specific attendee and have a qualifying booking
    if (userIdStr === attendeeIdStr) {
      const isQualified = await hasQualifyingBooking(user._id, event._id || eventId);
      if (!isQualified) {
        return {
          allowed: false,
          status: 403,
          message: 'Forbidden: A valid, confirmed booking is required to communicate with the event organizer.',
        };
      }
      return { allowed: true, event };
    }

    return {
      allowed: false,
      status: 403,
      message: 'Forbidden: You are not an authorized participant in this event conversation.',
    };
  }

  return { allowed: false, status: 403, message: 'Forbidden: Unsupported conversation type.' };
};

/**
 * Creates or retrieves an existing conversation safely with full server-side validation.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string|mongoose.Types.ObjectId} params.eventId
 * @param {string} params.type - 'admin_organizer' | 'attendee_organizer'
 * @param {string|mongoose.Types.ObjectId} [params.attendeeId] - Target attendee (if organizer initiating)
 * @returns {Promise<{ conversation: Object }>}
 */
export const findOrCreateConversation = async ({ user, eventId, type, attendeeId }) => {
  if (!mongoose.Types.ObjectId.isValid(eventId)) {
    const error = new Error('Invalid event ID format.');
    error.status = 400;
    throw error;
  }

  if (!['admin_organizer', 'attendee_organizer'].includes(type)) {
    const error = new Error("Invalid conversation type. Must be 'admin_organizer' or 'attendee_organizer'.");
    error.status = 400;
    throw error;
  }

  const event = await Event.findById(eventId);
  if (!event) {
    const error = new Error('Event not found.');
    error.status = 404;
    throw error;
  }

  if (event.status !== 'published') {
    const error = new Error('Chat conversations can only be initiated for approved and published events.');
    error.status = 403;
    throw error;
  }

  const organizerId = event.organizerId;
  if (!organizerId) {
    const error = new Error('Event does not have a linked organizer.');
    error.status = 400;
    throw error;
  }

  let finalAttendeeId = null;
  const participants = [organizerId];

  if (type === 'admin_organizer') {
    // Only platform admin or the event's actual organizer can initiate
    const isOwner = user._id.toString() === organizerId.toString();
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      const error = new Error('Forbidden: Only the event organizer or platform administrators can open this conversation.');
      error.status = 403;
      throw error;
    }

    if (isAdmin) {
      participants.push(user._id);
    }

    // Atomic find or create
    let conversation = await Conversation.findOne({
      eventId: event._id,
      type: 'admin_organizer',
    })
      .populate('eventId', 'title date venue city image status format')
      .populate('organizerId', 'name email role avatar')
      .populate('participants', 'name email role avatar');

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: 'admin_organizer',
          eventId: event._id,
          organizerId,
          attendeeId: null,
          participants,
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('eventId', 'title date venue city image status format')
          .populate('organizerId', 'name email role avatar')
          .populate('participants', 'name email role avatar');
      } catch (err) {
        // Handle duplicate key race condition
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            eventId: event._id,
            type: 'admin_organizer',
          })
            .populate('eventId', 'title date venue city image status format')
            .populate('organizerId', 'name email role avatar')
            .populate('participants', 'name email role avatar');
        } else {
          throw err;
        }
      }
    }

    return { conversation };
  }

  // Type: attendee_organizer
  if (type === 'attendee_organizer') {
    const isOwner = user._id.toString() === organizerId.toString();
    const isAdmin = user.role === 'admin';

    if (isOwner || isAdmin) {
      // Organizer or admin initiating: attendeeId must be supplied and valid
      if (!attendeeId || !mongoose.Types.ObjectId.isValid(attendeeId)) {
        const error = new Error('A valid attendee ID is required when an organizer opens an attendee conversation.');
        error.status = 400;
        throw error;
      }
      finalAttendeeId = attendeeId;
    } else {
      // Authenticated attendee initiating for themselves
      finalAttendeeId = user._id;
    }

    // Verify target attendee exists
    const attendeeUser = await User.findById(finalAttendeeId);
    if (!attendeeUser) {
      const error = new Error('Attendee not found.');
      error.status = 404;
      throw error;
    }

    // Verify attendee holds a genuine, qualifying booking for this event
    const isQualified = await hasQualifyingBooking(finalAttendeeId, event._id);
    if (!isQualified) {
      const error = new Error('Forbidden: A confirmed, valid booking is required to communicate with the event organizer.');
      error.status = 403;
      throw error;
    }

    participants.push(finalAttendeeId);

    // Atomic find or create
    let conversation = await Conversation.findOne({
      eventId: event._id,
      attendeeId: finalAttendeeId,
      type: 'attendee_organizer',
    })
      .populate('eventId', 'title date venue city image status format')
      .populate('organizerId', 'name email role avatar')
      .populate('attendeeId', 'name email role avatar')
      .populate('participants', 'name email role avatar');

    if (!conversation) {
      try {
        conversation = await Conversation.create({
          type: 'attendee_organizer',
          eventId: event._id,
          organizerId,
          attendeeId: finalAttendeeId,
          participants,
        });

        conversation = await Conversation.findById(conversation._id)
          .populate('eventId', 'title date venue city image status format')
          .populate('organizerId', 'name email role avatar')
          .populate('attendeeId', 'name email role avatar')
          .populate('participants', 'name email role avatar');
      } catch (err) {
        // Handle duplicate key race condition
        if (err.code === 11000) {
          conversation = await Conversation.findOne({
            eventId: event._id,
            attendeeId: finalAttendeeId,
            type: 'attendee_organizer',
          })
            .populate('eventId', 'title date venue city image status format')
            .populate('organizerId', 'name email role avatar')
            .populate('attendeeId', 'name email role avatar')
            .populate('participants', 'name email role avatar');
        } else {
          throw err;
        }
      }
    }

    return { conversation };
  }

  const error = new Error('Unsupported conversation type.');
  error.status = 400;
  throw error;
};

/**
 * Safely constructs a server-validated reply snapshot from an original message.
 * Prevents client-side spoofing of sender names, timestamps, or media types.
 *
 * @param {Object} originalMessage
 * @returns {Object|null}
 */
export const buildReplySnapshot = (originalMessage) => {
  if (!originalMessage) return null;

  let attachmentType = null;
  let originalName = '';
  const origAtt =
    originalMessage.attachment ||
    (Array.isArray(originalMessage.attachments) && originalMessage.attachments[0]) ||
    null;

  if (origAtt) {
    if (origAtt.resourceType === 'raw' || (origAtt.mimeType && !origAtt.mimeType.startsWith('image/'))) {
      attachmentType = 'document';
    } else {
      attachmentType = 'image';
    }
    originalName = origAtt.originalName || '';
  }

  const isDeleted = Boolean(originalMessage.isDeleted);

  return {
    messageId: originalMessage._id,
    senderId: originalMessage.senderId,
    senderName: originalMessage.senderName || 'Participant',
    senderRole: originalMessage.senderRole || 'attendee',
    text: isDeleted ? 'This message was deleted' : (originalMessage.text || '').slice(0, 300),
    hasAttachment: Boolean(origAtt && !isDeleted),
    attachmentType: isDeleted ? null : attachmentType,
    originalName: isDeleted ? '' : originalName,
    isDeleted,
  };
};

/**
 * Safely executes the message forwarding business logic.
 * Validates requester access to both source and target conversations,
 * verifies source message accessibility, copies safe content & attachments,
 * attributes the new message to the requester, and updates conversation metadata.
 *
 * @param {Object} params
 * @param {Object} params.user - The authenticated user performing the forward
 * @param {string|mongoose.Types.ObjectId} params.sourceMessageId - Source message ID
 * @param {string|mongoose.Types.ObjectId} params.targetConversationId - Destination conversation ID
 * @returns {Promise<{ message: Object, targetConversation: Object, recipientIds: string[], previewText: string }>}
 */
export const executeForwardMessage = async ({ user, sourceMessageId, targetConversationId }) => {
  if (!user || !user._id) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  if (!sourceMessageId || !mongoose.Types.ObjectId.isValid(sourceMessageId)) {
    const error = new Error('Invalid source message ID format.');
    error.status = 400;
    throw error;
  }

  if (!targetConversationId || !mongoose.Types.ObjectId.isValid(targetConversationId)) {
    const error = new Error('Invalid destination conversation ID format.');
    error.status = 400;
    throw error;
  }

  // 1. Fetch source message
  const sourceMessage = await Message.findById(sourceMessageId);
  if (!sourceMessage) {
    const error = new Error('Source message not found.');
    error.status = 404;
    throw error;
  }

  if (sourceMessage.isDeleted) {
    const error = new Error('Cannot forward a deleted message.');
    error.status = 400;
    throw error;
  }

  // 2. Fetch and authorize source conversation access
  const sourceConversation = await Conversation.findById(sourceMessage.conversationId);
  if (!sourceConversation) {
    const error = new Error('Source conversation not found.');
    error.status = 404;
    throw error;
  }

  const sourceAccess = await verifyConversationAccess(user, sourceConversation);
  if (!sourceAccess.allowed) {
    const error = new Error('You are not authorized to access the source conversation.');
    error.status = 403;
    throw error;
  }

  // 3. Fetch and authorize destination conversation access
  const targetConversation = await Conversation.findById(targetConversationId);
  if (!targetConversation) {
    const error = new Error('Destination conversation not found.');
    error.status = 404;
    throw error;
  }

  const targetAccess = await verifyConversationAccess(user, targetConversation);
  if (!targetAccess.allowed) {
    const error = new Error('You are not authorized to access the destination conversation.');
    error.status = 403;
    throw error;
  }

  // 4. Validate content presence
  const trimmedText = typeof sourceMessage.text === 'string' ? sourceMessage.text.trim() : '';
  const cleanAttachments = [];

  if (Array.isArray(sourceMessage.attachments) && sourceMessage.attachments.length > 0) {
    sourceMessage.attachments.forEach((att) => {
      if (att && typeof att.url === 'string' && att.url.startsWith('https://res.cloudinary.com/')) {
        cleanAttachments.push({
          url: att.url,
          publicId: att.publicId || att.public_id,
          originalName: att.originalName || '',
          mimeType: att.mimeType || '',
          size: att.size || att.fileSize || 0,
          resourceType: att.resourceType || 'image',
          width: att.width || null,
          height: att.height || null,
        });
      }
    });
  } else if (
    sourceMessage.attachment &&
    typeof sourceMessage.attachment.url === 'string' &&
    sourceMessage.attachment.url.startsWith('https://res.cloudinary.com/')
  ) {
    const att = sourceMessage.attachment;
    cleanAttachments.push({
      url: att.url,
      publicId: att.publicId || att.public_id,
      originalName: att.originalName || '',
      mimeType: att.mimeType || '',
      size: att.size || att.fileSize || 0,
      resourceType: att.resourceType || 'image',
      width: att.width || null,
      height: att.height || null,
    });
  }

  if (!trimmedText && cleanAttachments.length === 0) {
    const error = new Error('Cannot forward a message with no text content or valid attachments.');
    error.status = 400;
    throw error;
  }

  // 5. Create new forwarded message in target conversation
  // Note: Actual sender identity is strictly attributed to the authenticated forwarder
  const newMessage = await Message.create({
    conversationId: targetConversation._id,
    senderId: user._id,
    senderName: user.name,
    senderRole: user.role,
    isForwarded: true,
    forwardedFromMessageId: sourceMessage._id,
    forwardedFromSenderName: sourceMessage.senderName || 'Participant',
    text: trimmedText,
    attachments: cleanAttachments,
    attachment: cleanAttachments[0] || null,
    readBy: [{ userId: user._id, readAt: new Date() }],
    replyToMessageId: null,
    replySnapshot: null,
    reactions: [],
    isEdited: false,
    editedAt: null,
    isDeleted: false,
  });

  // 6. Update target conversation preview & unread counts
  let previewText = newMessage.text;
  if (!previewText && cleanAttachments.length > 0) {
    const att = cleanAttachments[0];
    if (att.resourceType === 'raw' || (att.mimeType && !att.mimeType.startsWith('image/'))) {
      previewText = `📄 ${att.originalName || 'Document'}`;
    } else {
      previewText = '📷 Image';
    }
  }

  targetConversation.lastMessage = {
    text: previewText,
    senderId: user._id,
    senderName: user.name,
    senderRole: user.role,
    createdAt: newMessage.createdAt,
  };

  const unreadMap = targetConversation.unreadCounts || new Map();
  const senderIdStr = user._id.toString();
  let recipientIds = [];

  if (targetConversation.type === 'admin_organizer') {
    if (user.role === 'admin') {
      recipientIds.push(targetConversation.organizerId.toString());
    } else {
      recipientIds.push('admin');
    }
  } else if (targetConversation.type === 'attendee_organizer') {
    if (senderIdStr === targetConversation.organizerId.toString()) {
      recipientIds.push(targetConversation.attendeeId.toString());
    } else {
      recipientIds.push(targetConversation.organizerId.toString());
    }
  }

  recipientIds.forEach((rId) => {
    const current = typeof unreadMap.get === 'function' ? unreadMap.get(rId) || 0 : unreadMap[rId] || 0;
    if (typeof unreadMap.set === 'function') {
      unreadMap.set(rId, current + 1);
    } else {
      unreadMap[rId] = current + 1;
    }
  });

  targetConversation.unreadCounts = unreadMap;
  await targetConversation.save();

  // Restore visibility for forwarder and target recipients if previously hidden
  const restoreUserIds = [user._id];
  if (targetConversation.type === 'admin_organizer') {
    if (user.role === 'admin') {
      restoreUserIds.push(targetConversation.organizerId);
    }
  } else if (targetConversation.type === 'attendee_organizer') {
    if (senderIdStr === targetConversation.organizerId.toString()) {
      restoreUserIds.push(targetConversation.attendeeId);
    } else {
      restoreUserIds.push(targetConversation.organizerId);
    }
  }
  await restoreConversationVisibility(targetConversation._id, restoreUserIds);

  return {
    message: newMessage,
    targetConversation,
    recipientIds,
    previewText,
  };
};

/**
 * Pin a message in a conversation.
 * Replaces any existing pinned message in the conversation.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string|mongoose.Types.ObjectId} params.conversationId
 * @param {string|mongoose.Types.ObjectId} params.messageId
 * @returns {Promise<{ conversation: Object, message: Object, pinnedMessage: Object }>}
 */
export const executePinMessage = async ({ user, conversationId, messageId }) => {
  if (!user || !user._id) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error('Invalid conversation ID format.');
    error.status = 400;
    throw error;
  }

  if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
    const error = new Error('Invalid message ID format.');
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  // Access authorization
  const access = await verifyConversationAccess(user, conversation);
  if (!access.allowed) {
    const error = new Error(access.message || 'Forbidden: Access denied to conversation.');
    error.status = access.status || 403;
    throw error;
  }

  // Find target message strictly in this conversation
  const message = await Message.findOne({
    _id: messageId,
    conversationId: conversation._id,
  });

  if (!message) {
    const error = new Error('Message not found in this conversation.');
    error.status = 404;
    throw error;
  }

  // Reject pinning deleted messages
  if (message.isDeleted) {
    const error = new Error('Cannot pin a deleted message.');
    error.status = 400;
    throw error;
  }

  const hasAttachment =
    (Array.isArray(message.attachments) && message.attachments.length > 0) ||
    Boolean(message.attachment && message.attachment.url);

  let attachmentType = null;
  let originalName = '';

  if (hasAttachment) {
    const firstAtt = message.attachment || message.attachments[0];
    if (firstAtt) {
      const isDoc =
        firstAtt.resourceType === 'raw' ||
        (firstAtt.mimeType && !firstAtt.mimeType.startsWith('image/'));
      attachmentType = isDoc ? 'document' : 'image';
      originalName = firstAtt.originalName || (isDoc ? 'Document' : 'Image');
    }
  }

  const pinnedMessage = {
    messageId: message._id,
    text: message.text || '',
    senderId: message.senderId,
    senderName: message.senderName || 'Participant',
    senderRole: message.senderRole || 'attendee',
    hasAttachment,
    attachmentType,
    originalName,
    pinnedBy: user._id,
    pinnedByName: user.name || 'Participant',
    pinnedAt: new Date(),
  };

  // Update conversation
  conversation.pinnedMessage = pinnedMessage;
  await conversation.save();

  // Reset any other pinned messages in this conversation and mark this one
  await Message.updateMany(
    { conversationId: conversation._id, isPinned: true },
    { $set: { isPinned: false } }
  );
  message.isPinned = true;
  await message.save();

  return {
    conversation,
    message,
    pinnedMessage,
  };
};

/**
 * Unpin the currently pinned message in a conversation.
 *
 * @param {Object} params
 * @param {Object} params.user - Authenticated user
 * @param {string|mongoose.Types.ObjectId} params.conversationId
 * @param {string|mongoose.Types.ObjectId} [params.messageId] - Optional specific message ID to unpin
 * @returns {Promise<{ conversation: Object, unpinnedMessageId: string|null, alreadyUnpinned: boolean }>}
 */
export const executeUnpinMessage = async ({ user, conversationId, messageId }) => {
  if (!user || !user._id) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error('Invalid conversation ID format.');
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  // Access authorization
  const access = await verifyConversationAccess(user, conversation);
  if (!access.allowed) {
    const error = new Error(access.message || 'Forbidden: Access denied to conversation.');
    error.status = access.status || 403;
    throw error;
  }

  // If no message is pinned
  if (!conversation.pinnedMessage || !conversation.pinnedMessage.messageId) {
    return {
      conversation,
      unpinnedMessageId: null,
      alreadyUnpinned: true,
    };
  }

  const currentPinnedId = conversation.pinnedMessage.messageId.toString();

  // If messageId was provided, verify it matches the currently pinned message
  if (messageId && mongoose.Types.ObjectId.isValid(messageId)) {
    if (currentPinnedId !== messageId.toString()) {
      // It was already replaced or unpinned
      return {
        conversation,
        unpinnedMessageId: currentPinnedId,
        alreadyUnpinned: true,
      };
    }
  }

  const unpinnedMessageId = conversation.pinnedMessage.messageId;

  // Clear pinned message in conversation
  conversation.pinnedMessage = null;
  conversation.markModified('pinnedMessage');
  await conversation.save();

  // Reset isPinned on messages in this conversation
  await Message.updateMany(
    { conversationId: conversation._id, isPinned: true },
    { $set: { isPinned: false } }
  );

  return {
    conversation,
    unpinnedMessageId,
    alreadyUnpinned: false,
  };
};

/**
 * Restores conversation visibility for specified user IDs when genuine message activity occurs.
 * Does not affect other participants' deletion status.
 *
 * @param {string|mongoose.Types.ObjectId} conversationId
 * @param {Array<string|mongoose.Types.ObjectId>} userIds
 * @returns {Promise<void>}
 */
export const restoreConversationVisibility = async (conversationId, userIds = []) => {
  if (!conversationId || !Array.isArray(userIds) || userIds.length === 0) return;

  const validObjectIds = userIds
    .map((id) => {
      if (!id) return null;
      const rawId = id._id || id;
      return mongoose.Types.ObjectId.isValid(rawId) ? new mongoose.Types.ObjectId(rawId) : null;
    })
    .filter(Boolean);

  if (validObjectIds.length === 0) return;

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $pull: {
        deletedFor: {
          userId: { $in: validObjectIds },
        },
      },
    }
  );
};

/**
 * Executes per-user conversation deletion (hiding from requester's inbox).
 * Preserves the conversation, message history, attachments, reactions, and pins for other participants.
 *
 * @param {Object} params
 * @param {Object} params.user - The authenticated user requesting deletion
 * @param {string|mongoose.Types.ObjectId} params.conversationId
 * @returns {Promise<{ conversation: Object, wasAlreadyDeleted: boolean }>}
 */
export const executeDeleteConversation = async ({ user, conversationId }) => {
  if (!user || !user._id) {
    const error = new Error('Authentication required.');
    error.status = 401;
    throw error;
  }

  if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
    const error = new Error('Invalid conversation ID format.');
    error.status = 400;
    throw error;
  }

  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const error = new Error('Conversation not found.');
    error.status = 404;
    throw error;
  }

  // Access authorization: user must have authorized access to this conversation
  const access = await verifyConversationAccess(user, conversation);
  if (!access.allowed) {
    const error = new Error(access.message || 'Forbidden: Access denied to conversation.');
    error.status = access.status || 403;
    throw error;
  }

  const userIdStr = user._id.toString();
  const deletedForList = Array.isArray(conversation.deletedFor) ? conversation.deletedFor : [];
  const alreadyDeleted = deletedForList.some(
    (item) => item && item.userId && item.userId.toString() === userIdStr
  );

  if (alreadyDeleted) {
    return {
      conversation,
      wasAlreadyDeleted: true,
    };
  }

  // Atomically record deletion for this user only
  const updatedConversation = await Conversation.findByIdAndUpdate(
    conversation._id,
    {
      $push: {
        deletedFor: {
          userId: user._id,
          deletedAt: new Date(),
        },
      },
    },
    { new: true }
  );

  // Clear unread count for this user in this conversation
  const unreadKey = user.role === 'admin' ? 'admin' : userIdStr;
  const unreadMap = updatedConversation.unreadCounts || new Map();
  if (typeof unreadMap.set === 'function') {
    unreadMap.set(unreadKey, 0);
  } else {
    unreadMap[unreadKey] = 0;
  }
  updatedConversation.unreadCounts = unreadMap;
  await updatedConversation.save();

  return {
    conversation: updatedConversation,
    wasAlreadyDeleted: false,
  };
};


