import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message, { ALLOWED_EMOJIS } from '../models/Message.js';
import Event from '../models/Event.js';
import {
  verifyConversationAccess,
  findOrCreateConversation,
} from '../services/chatService.js';
import {
  emitToConversation,
  emitToUser,
  emitToRole,
} from '../services/socketService.js';
import {
  uploadChatAttachmentToCloudinary,
  uploadChatImageToCloudinary,
  streamAttachmentFromCloudinary,
} from '../services/cloudinaryService.js';

/**
 * @desc    Get all conversations accessible to the authenticated user
 * @route   GET /api/chat/conversations
 * @access  Private
 */
export const getUserConversations = async (req, res, next) => {
  try {
    const user = req.user;
    let query = {};

    if (user.role === 'admin') {
      // Platform Admins can view all admin_organizer conversations
      query = { type: 'admin_organizer' };
    } else if (user.role === 'organizer') {
      // Organizers view conversations where they are the event organizer
      query = { organizerId: user._id };
    } else {
      // Attendees view conversations where they are the registered attendee
      query = { attendeeId: user._id, type: 'attendee_organizer' };
    }

    const conversations = await Conversation.find(query)
      .populate('eventId', 'title date venue city image status format')
      .populate('organizerId', 'name email avatar role')
      .populate('attendeeId', 'name email avatar role')
      .populate('participants', 'name email avatar role')
      .sort({ updatedAt: -1 })
      .lean();

    // Map conversations to include computed unread count for this user
    const formatted = conversations.map((c) => {
      const unreadMap = c.unreadCounts || {};
      const unread = typeof unreadMap.get === 'function'
        ? unreadMap.get(user._id.toString()) || 0
        : unreadMap[user._id.toString()] || 0;

      return {
        ...c,
        unreadCount: unread,
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      conversations: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single conversation by ID with access verification
 * @route   GET /api/chat/conversations/:id
 * @access  Private
 */
export const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    const conversation = await Conversation.findById(id)
      .populate('eventId', 'title date venue city image status format organizer organizerId')
      .populate('organizerId', 'name email avatar role')
      .populate('attendeeId', 'name email avatar role')
      .populate('participants', 'name email avatar role');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Server-side access & eligibility verification
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    const unreadMap = conversation.unreadCounts || {};
    const unread = typeof unreadMap.get === 'function'
      ? unreadMap.get(req.user._id.toString()) || 0
      : unreadMap[req.user._id.toString()] || 0;

    const convObj = conversation.toObject();
    convObj.unreadCount = unread;

    res.status(200).json({
      success: true,
      conversation: convObj,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create or retrieve an authorized conversation
 * @route   POST /api/chat/conversations
 * @access  Private
 */
export const createOrGetConversation = async (req, res, next) => {
  try {
    const { eventId, type, attendeeId } = req.body;

    if (!eventId || !type) {
      return res.status(400).json({
        success: false,
        message: 'Event ID and conversation type are required.',
      });
    }

    const result = await findOrCreateConversation({
      user: req.user,
      eventId,
      type,
      attendeeId,
    });

    res.status(200).json({
      success: true,
      conversation: result.conversation,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * @desc    Get message history for a conversation with pagination
 * @route   GET /api/chat/conversations/:id/messages
 * @access  Private
 */
export const getConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    const query = { conversationId: conversation._id };
    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // Fetch messages in chronological order (or reverse for pagination)
    const rawMessages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

    const messages = rawMessages.map((m) => {
      if (m.isDeleted) {
        return {
          ...m,
          text: 'This message was deleted',
          reactions: [],
          attachments: [],
          attachment: null,
        };
      }
      return m;
    });

    // Reverse to chronological order (oldest to newest) for client rendering
    messages.reverse();

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send a message within an authorized conversation
 * @route   POST /api/chat/conversations/:id/messages
 * @access  Private
 */
export const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text, attachment, attachments } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    // Validate and sanitize attachments
    const cleanAttachments = [];
    if (
      attachment &&
      typeof attachment.url === 'string' &&
      attachment.url.startsWith('https://res.cloudinary.com/')
    ) {
      cleanAttachments.push(attachment);
    } else if (Array.isArray(attachments)) {
      attachments.forEach((att) => {
        if (
          att &&
          typeof att.url === 'string' &&
          att.url.startsWith('https://res.cloudinary.com/')
        ) {
          cleanAttachments.push(att);
        }
      });
    }

    const trimmedText = typeof text === 'string' ? text.trim() : '';

    if (!trimmedText && cleanAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message must contain text content or an attachment.',
      });
    }

    if (trimmedText.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access & eligibility verification
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Create message with verified sender identity derived strictly from authenticated user
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      text: trimmedText,
      attachments: cleanAttachments,
      attachment: cleanAttachments[0] || null,
      readBy: [{ userId: req.user._id, readAt: new Date() }],
    });

    let previewText = message.text;
    if (!previewText && cleanAttachments.length > 0) {
      const att = cleanAttachments[0];
      if (att.resourceType === 'raw' || (att.mimeType && !att.mimeType.startsWith('image/'))) {
        previewText = `📄 ${att.originalName || 'Document'}`;
      } else {
        previewText = '📷 Image';
      }
    }

    // Update conversation lastMessage metadata
    conversation.lastMessage = {
      text: previewText,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      createdAt: message.createdAt,
    };

    // Increment unread count for other participants
    const unreadMap = conversation.unreadCounts || new Map();
    const senderIdStr = req.user._id.toString();

    // Determine target recipient IDs for unread counts
    let recipientIds = [];
    if (conversation.type === 'admin_organizer') {
      if (req.user.role === 'admin') {
        // Recipient is the organizer
        recipientIds.push(conversation.organizerId.toString());
      } else {
        // Organizer sent message; unread for admins
        recipientIds.push('admin');
      }
    } else if (conversation.type === 'attendee_organizer') {
      if (senderIdStr === conversation.organizerId.toString()) {
        recipientIds.push(conversation.attendeeId.toString());
      } else {
        recipientIds.push(conversation.organizerId.toString());
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

    conversation.unreadCounts = unreadMap;
    await conversation.save();

    // Broadcast in real time via Socket.IO
    emitToConversation(conversation._id, 'new_message', {
      conversationId: conversation._id,
      message,
    });

    // Notify individual recipient private rooms
    recipientIds.forEach((rId) => {
      if (rId === 'admin') {
        emitToRole('admin', 'chat_notification', {
          conversationId: conversation._id,
          eventId: conversation.eventId,
          senderName: req.user.name,
          text: previewText,
        });
      } else {
        emitToUser(rId, 'chat_notification', {
          conversationId: conversation._id,
          eventId: conversation.eventId,
          senderName: req.user.name,
          text: previewText,
        });
      }
    });

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all messages in a conversation as read by authenticated user
 * @route   PUT /api/chat/conversations/:id/read
 * @access  Private
 */
export const markConversationRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Reset unread counter for current user
    const userIdStr = req.user._id.toString();
    const unreadMap = conversation.unreadCounts || new Map();
    if (typeof unreadMap.set === 'function') {
      unreadMap.set(userIdStr, 0);
    } else {
      unreadMap[userIdStr] = 0;
    }
    conversation.unreadCounts = unreadMap;
    await conversation.save();

    // Mark messages as read by current user in Message collection
    await Message.updateMany(
      {
        conversationId: conversation._id,
        'readBy.userId': { $ne: req.user._id },
      },
      {
        $push: {
          readBy: { userId: req.user._id, readAt: new Date() },
        },
      }
    );

    // Broadcast read receipt via Socket.IO
    emitToConversation(conversation._id, 'messages_read', {
      conversationId: conversation._id,
      userId: req.user._id,
      readAt: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Conversation marked as read.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get total unread message count for authenticated user
 * @route   GET /api/chat/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const user = req.user;
    let query = {};

    if (user.role === 'admin') {
      query = { type: 'admin_organizer' };
    } else if (user.role === 'organizer') {
      query = { organizerId: user._id };
    } else {
      query = { attendeeId: user._id, type: 'attendee_organizer' };
    }

    const conversations = await Conversation.find(query).select('unreadCounts').lean();
    let totalUnread = 0;
    const userIdStr = user.role === 'admin' ? 'admin' : user._id.toString();

    conversations.forEach((c) => {
      const unreadMap = c.unreadCounts || {};
      const count = typeof unreadMap.get === 'function'
        ? unreadMap.get(userIdStr) || 0
        : unreadMap[userIdStr] || 0;
      totalUnread += count;
    });

    res.status(200).json({
      success: true,
      unreadCount: totalUnread,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle emoji reaction on a message
 * @route   POST /api/chat/conversations/:id/messages/:messageId/reactions
 * @access  Private
 */
export const toggleReaction = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;
    const { emoji } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation or message ID format.',
      });
    }

    if (!emoji || typeof emoji !== 'string' || !ALLOWED_EMOJIS.includes(emoji)) {
      return res.status(400).json({
        success: false,
        message: `Invalid emoji. Supported emojis: ${ALLOWED_EMOJIS.join(' ')}`,
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization check
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Verify message exists in this conversation
    const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation.',
      });
    }

    const userId = req.user._id;
    const userName = req.user.name || 'User';

    // Atomic toggle:
    // 1. Try pulling the reaction if it already exists for this user and emoji
    let updatedMessage = await Message.findOneAndUpdate(
      {
        _id: messageId,
        conversationId: conversation._id,
        $or: [
          { reactions: { $elemMatch: { emoji, userId } } },
          { reactions: { $elemMatch: { emoji, user: userId } } },
        ],
      },
      {
        $pull: {
          reactions: {
            emoji,
            $or: [{ userId }, { user: userId }],
          },
        },
      },
      { new: true }
    );

    // 2. If it wasn't pulled, it wasn't present. Add it atomically with concurrency guard
    if (!updatedMessage) {
      updatedMessage = await Message.findOneAndUpdate(
        {
          _id: messageId,
          conversationId: conversation._id,
          reactions: {
            $not: {
              $elemMatch: {
                emoji,
                $or: [{ userId }, { user: userId }],
              },
            },
          },
        },
        {
          $push: {
            reactions: {
              emoji,
              userId,
              userName,
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );
    }

    // 3. Fallback: if concurrent update happened, fetch current state
    if (!updatedMessage) {
      updatedMessage = await Message.findOne({ _id: messageId, conversationId: conversation._id });
    }

    const reactions = updatedMessage ? updatedMessage.reactions || [] : [];

    // Broadcast reaction update to authorized conversation participants
    emitToConversation(conversation._id, 'message_reaction_updated', {
      conversationId: conversation._id,
      messageId: message._id,
      reactions,
    });

    res.status(200).json({
      success: true,
      messageId: message._id,
      reactions,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Edit a message within an authorized conversation
 * @route   PUT /api/chat/conversations/:id/messages/:messageId
 * @access  Private
 */
export const editMessage = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation or message ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization check
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Verify message exists in this conversation
    const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation.',
      });
    }

    // Check author ownership (never trust client sender ID)
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit your own messages.',
      });
    }

    // Cannot edit deleted messages
    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit a message that has been deleted.',
      });
    }

    const trimmed = typeof text === 'string' ? text.trim() : '';
    const hasAttachments =
      (Array.isArray(message.attachments) && message.attachments.length > 0) ||
      Boolean(message.attachment && message.attachment.url);

    // If message has no attachments, empty text is rejected
    if (!trimmed && !hasAttachments) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty.',
      });
    }

    if (trimmed.length > 2000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 2000 characters.',
      });
    }

    // Prevent unnecessary updates when the content has not changed
    if (message.text === trimmed) {
      return res.status(200).json({
        success: true,
        message,
        unchanged: true,
      });
    }

    message.text = trimmed;
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    // If this was the last message of the conversation, update conversation preview
    if (
      conversation.lastMessage &&
      conversation.lastMessage.createdAt &&
      new Date(conversation.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
    ) {
      conversation.lastMessage.text = trimmed || (hasAttachments ? '📷 Image' : '');
      await conversation.save();
    }

    // Broadcast to authorized participants in room
    emitToConversation(conversation._id, 'message_edited', {
      conversationId: conversation._id,
      message,
    });

    res.status(200).json({
      success: true,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Soft-delete a message within an authorized conversation
 * @route   DELETE /api/chat/conversations/:id/messages/:messageId
 * @access  Private
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation or message ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization check
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Verify message exists in this conversation
    const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation.',
      });
    }

    // Check author ownership (never trust client sender ID)
    if (message.senderId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own messages.',
      });
    }

    if (message.isDeleted) {
      return res.status(400).json({
        success: false,
        message: 'Message is already deleted.',
      });
    }

    // Soft delete: clear original text, reactions, attachments, mark isDeleted
    message.isDeleted = true;
    message.deletedAt = new Date();
    message.text = 'This message was deleted';
    message.reactions = [];
    message.attachments = [];
    message.attachment = null;
    await message.save();

    // If this was the last message, update conversation preview
    if (
      conversation.lastMessage &&
      conversation.lastMessage.createdAt &&
      new Date(conversation.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
    ) {
      conversation.lastMessage.text = 'This message was deleted';
      await conversation.save();
    }

    // Broadcast message_deleted to conversation room
    emitToConversation(conversation._id, 'message_deleted', {
      conversationId: conversation._id,
      messageId: message._id,
      message,
    });

    res.status(200).json({
      success: true,
      messageId: message._id,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload an attachment (image or document) for a conversation
 * @route   POST /api/chat/conversations/:id/upload
 * @access  Private
 */
export const uploadChatAttachment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization check
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    const file = req.file || (req.files && (req.files.file?.[0] || req.files.image?.[0]));
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded.',
      });
    }

    const attachment = await uploadChatAttachmentToCloudinary(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    res.status(200).json({
      success: true,
      attachment,
    });
  } catch (error) {
    next(error);
  }
};

export const uploadChatImage = uploadChatAttachment;

/**
 * @desc    Download or stream a verified chat attachment securely
 * @route   GET /api/chat/conversations/:id/messages/:messageId/download
 * @access  Private
 */
export const downloadAttachment = async (req, res, next) => {
  try {
    const { id, messageId } = req.params;
    const { action } = req.query; // 'download' or 'open'

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation or message ID format.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Verify participant authorization
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    const message = await Message.findById(messageId);
    if (!message || message.conversationId.toString() !== conversation._id.toString()) {
      return res.status(404).json({
        success: false,
        message: 'Message not found in this conversation.',
      });
    }

    if (message.isDeleted) {
      return res.status(410).json({
        success: false,
        message: 'Attachment is no longer available because this message was deleted.',
      });
    }

    const attachment =
      message.attachment ||
      (Array.isArray(message.attachments) && message.attachments.length > 0
        ? message.attachments[0]
        : null);

    if (!attachment || !attachment.url) {
      return res.status(404).json({
        success: false,
        message: 'No attachment found for this message.',
      });
    }

    // Stream file from Cloudinary with safe download headers
    const isInline = action === 'open' && attachment.mimeType === 'application/pdf';

    await streamAttachmentFromCloudinary(attachment.url, res, {
      filename: attachment.originalName || 'attachment',
      mimeType: attachment.mimeType || 'application/octet-stream',
      isInline,
    });
  } catch (error) {
    next(error);
  }
};



