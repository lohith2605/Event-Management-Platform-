import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message, { ALLOWED_EMOJIS } from '../models/Message.js';
import Event from '../models/Event.js';
import {
  verifyConversationAccess,
  findOrCreateConversation,
  buildReplySnapshot,
  executeForwardMessage,
  executePinMessage,
  executeUnpinMessage,
  executeDeleteConversation,
  restoreConversationVisibility,
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
    let query = {
      'deletedFor.userId': { $ne: user._id },
    };

    if (user.role === 'admin') {
      // Platform Admins can view all admin_organizer conversations
      query.type = 'admin_organizer';
    } else if (user.role === 'organizer') {
      // Organizers view conversations where they are the event organizer
      query.organizerId = user._id;
    } else {
      // Attendees view conversations where they are the registered attendee
      query.attendeeId = user._id;
      query.type = 'attendee_organizer';
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

    // Check if conversation has been hidden/deleted by the requesting user
    if (conversation.deletedFor && Array.isArray(conversation.deletedFor)) {
      const isHidden = conversation.deletedFor.some(
        (d) => d && d.userId && d.userId.toString() === req.user._id.toString()
      );
      if (isHidden) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found.',
        });
      }
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
    const { limit = 50, before, includeMessageId } = req.query;

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

    let parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

    // If an includeMessageId is specified (e.g. jumping to a matching search result),
    // calculate the count needed to encompass the target message in this fetch
    if (includeMessageId && mongoose.Types.ObjectId.isValid(includeMessageId)) {
      const targetMsg = await Message.findOne({
        _id: includeMessageId,
        conversationId: conversation._id,
      }).lean();

      if (targetMsg && targetMsg.createdAt) {
        const countQuery = {
          conversationId: conversation._id,
          createdAt: { $gte: targetMsg.createdAt },
        };
        if (query.createdAt && query.createdAt.$lt) {
          countQuery.createdAt.$lt = query.createdAt.$lt;
        }
        const countToTarget = await Message.countDocuments(countQuery);
        // Include target message plus a small buffer of older messages (up to max 250)
        parsedLimit = Math.min(250, Math.max(parsedLimit, countToTarget + 10));
      }
    }

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
 * @desc    Search full message history within an authorized conversation
 * @route   GET /api/chat/conversations/:id/messages/search?q=<query>&page=1&limit=20
 * @access  Private
 */
export const searchConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { q, page = 1, limit = 20 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    if (typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required and cannot be empty.',
      });
    }

    const queryStr = q.trim();
    if (queryStr.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Search query cannot exceed 100 characters.',
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.',
      });
    }

    // Access authorization check (verifies publication status, roles, bookings)
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    // Safely escape regex characters to prevent regex injection or ReDoS
    const escapedQuery = queryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedQuery, 'i');

    // Strictly isolate query to this conversation, exclude deleted messages
    const filter = {
      conversationId: conversation._id,
      isDeleted: { $ne: true },
      text: { $regex: regex },
    };

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (parsedPage - 1) * parsedLimit;

    // Execute count and paginated query in parallel
    const [totalCount, rawMatches] = await Promise.all([
      Message.countDocuments(filter),
      Message.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .select('_id conversationId senderId senderName senderRole text createdAt isEdited editedAt')
        .lean(),
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit) || 1;
    const hasMore = parsedPage < totalPages;

    res.status(200).json({
      success: true,
      query: queryStr,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalCount,
        totalPages,
        hasMore,
      },
      count: rawMatches.length,
      messages: rawMatches,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get shared content (media, documents, links) within an authorized conversation
 * @route   GET /api/chat/conversations/:id/shared?type=media&page=1&limit=30
 * @access  Private
 */
export const getSharedContent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type = 'media', page = 1, limit = 30 } = req.query;

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

    // Access authorization check (verifies publication status, roles, bookings)
    const access = await verifyConversationAccess(req.user, conversation);
    if (!access.allowed) {
      return res.status(access.status || 403).json({
        success: false,
        message: access.message || 'Access denied.',
      });
    }

    const contentType = (type || 'media').toLowerCase().trim();
    if (!['media', 'documents', 'links'].includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid content type. Supported types: media, documents, links.',
      });
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (parsedPage - 1) * parsedLimit;

    let items = [];
    let totalCount = 0;

    if (contentType === 'media') {
      const filter = {
        conversationId: conversation._id,
        isDeleted: { $ne: true },
        $or: [
          { 'attachment.url': { $exists: true, $ne: '' }, 'attachment.resourceType': 'image' },
          { 'attachment.url': { $exists: true, $ne: '' }, 'attachment.mimeType': /^image\//i },
          { 'attachments.url': { $exists: true, $ne: '' }, 'attachments.resourceType': 'image' },
          { 'attachments.url': { $exists: true, $ne: '' }, 'attachments.mimeType': /^image\//i },
        ],
      };

      const [count, rawMessages] = await Promise.all([
        Message.countDocuments(filter),
        Message.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .select('_id conversationId senderId senderName senderRole text attachment attachments createdAt')
          .lean(),
      ]);

      totalCount = count;
      items = rawMessages
        .map((m) => {
          const att = m.attachment || (Array.isArray(m.attachments) ? m.attachments[0] : null);
          if (!att || !att.url) return null;
          return {
            _id: m._id,
            messageId: m._id,
            type: 'media',
            senderId: m.senderId,
            senderName: m.senderName,
            senderRole: m.senderRole,
            createdAt: m.createdAt,
            text: m.text || '',
            attachment: {
              url: att.url,
              publicId: att.publicId,
              originalName: att.originalName || 'Image',
              mimeType: att.mimeType || 'image/jpeg',
              size: att.size || 0,
              resourceType: 'image',
              width: att.width || null,
              height: att.height || null,
            },
          };
        })
        .filter(Boolean);
    } else if (contentType === 'documents') {
      const filter = {
        conversationId: conversation._id,
        isDeleted: { $ne: true },
        $or: [
          {
            'attachment.url': { $exists: true, $ne: '' },
            'attachment.resourceType': { $ne: 'image' },
            'attachment.mimeType': { $not: /^image\//i },
          },
          {
            'attachments.url': { $exists: true, $ne: '' },
            'attachments.resourceType': { $ne: 'image' },
            'attachments.mimeType': { $not: /^image\//i },
          },
        ],
      };

      const [count, rawMessages] = await Promise.all([
        Message.countDocuments(filter),
        Message.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .select('_id conversationId senderId senderName senderRole text attachment attachments createdAt')
          .lean(),
      ]);

      totalCount = count;
      items = rawMessages
        .map((m) => {
          const doc = m.attachment || (Array.isArray(m.attachments) ? m.attachments[0] : null);
          if (!doc || !doc.url) return null;
          return {
            _id: m._id,
            messageId: m._id,
            type: 'document',
            senderId: m.senderId,
            senderName: m.senderName,
            senderRole: m.senderRole,
            createdAt: m.createdAt,
            text: m.text || '',
            attachment: {
              url: doc.url,
              publicId: doc.publicId,
              originalName: doc.originalName || 'Document',
              mimeType: doc.mimeType || 'application/octet-stream',
              size: doc.size || 0,
              resourceType: doc.resourceType || 'raw',
            },
          };
        })
        .filter(Boolean);
    } else if (contentType === 'links') {
      const filter = {
        conversationId: conversation._id,
        isDeleted: { $ne: true },
        text: { $regex: /https?:\/\/[^\s]+/i },
      };

      const [count, rawMessages] = await Promise.all([
        Message.countDocuments(filter),
        Message.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parsedLimit)
          .select('_id conversationId senderId senderName senderRole text createdAt')
          .lean(),
      ]);

      totalCount = count;
      const extractedLinks = [];
      rawMessages.forEach((m) => {
        const text = m.text || '';
        const urlRegex = /https?:\/\/[^\s<>"]+/gi;
        const matches = text.match(urlRegex) || [];
        const seenUrls = new Set();
        matches.forEach((rawUrl) => {
          try {
            const cleaned = rawUrl.replace(/[.,;:)]+$/, '');
            const parsed = new URL(cleaned);
            if (
              (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
              !seenUrls.has(cleaned)
            ) {
              seenUrls.add(cleaned);
              extractedLinks.push({
                _id: `${m._id}_link_${extractedLinks.length}`,
                messageId: m._id,
                type: 'link',
                url: cleaned,
                domain: parsed.hostname.replace(/^www\./, ''),
                senderId: m.senderId,
                senderName: m.senderName,
                senderRole: m.senderRole,
                createdAt: m.createdAt,
                textSnippet: text.length > 250 ? `${text.slice(0, 250)}...` : text,
              });
            }
          } catch {
            // Ignore malformed URL
          }
        });
      });
      items = extractedLinks;
    }

    const totalPages = Math.ceil(totalCount / parsedLimit) || 1;
    const hasMore = parsedPage < totalPages;

    res.status(200).json({
      success: true,
      type: contentType,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalCount,
        totalPages,
        hasMore,
      },
      count: items.length,
      items,
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
    const { text, attachment, attachments, replyToMessageId } = req.body;

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

    // Validate reply reference if specified (prevents cross-conversation or non-existent references)
    let replySnapshot = null;
    let validatedReplyId = null;
    if (replyToMessageId) {
      if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid reply message ID format.',
        });
      }

      const originalMessage = await Message.findOne({
        _id: replyToMessageId,
        conversationId: conversation._id,
      });

      if (!originalMessage) {
        return res.status(400).json({
          success: false,
          message: 'Referenced reply message not found in this conversation.',
        });
      }

      validatedReplyId = originalMessage._id;
      replySnapshot = buildReplySnapshot(originalMessage);
    }

    // Create message with verified sender identity derived strictly from authenticated user
    const message = await Message.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      replyToMessageId: validatedReplyId,
      replySnapshot,
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

    // Restore visibility for sender and target recipients if previously hidden
    const restoreUserIds = [req.user._id];
    if (conversation.type === 'admin_organizer') {
      if (req.user.role === 'admin') {
        restoreUserIds.push(conversation.organizerId);
      }
    } else if (conversation.type === 'attendee_organizer') {
      if (senderIdStr === conversation.organizerId.toString()) {
        restoreUserIds.push(conversation.attendeeId);
      } else {
        restoreUserIds.push(conversation.organizerId);
      }
    }
    await restoreConversationVisibility(conversation._id, restoreUserIds);

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
 * @desc    Forward a verified message into an authorized destination conversation
 * @route   POST /api/chat/conversations/:id/messages/forward
 * @access  Private
 */
export const forwardMessage = async (req, res, next) => {
  try {
    const targetConversationId = req.params.id || req.body.targetConversationId;
    const { sourceMessageId } = req.body;

    const { message, targetConversation, recipientIds, previewText } =
      await executeForwardMessage({
        user: req.user,
        sourceMessageId,
        targetConversationId,
      });

    // Broadcast in real time to the destination conversation room
    emitToConversation(targetConversation._id, 'new_message', {
      conversationId: targetConversation._id,
      message,
    });

    // Notify individual recipient private rooms
    recipientIds.forEach((rId) => {
      if (rId === 'admin') {
        emitToRole('admin', 'chat_notification', {
          conversationId: targetConversation._id,
          eventId: targetConversation.eventId,
          senderName: req.user.name,
          text: previewText,
        });
      } else {
        emitToUser(rId, 'chat_notification', {
          conversationId: targetConversation._id,
          eventId: targetConversation.eventId,
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
    const readPayload = {
      conversationId: conversation._id.toString(),
      userId: req.user._id.toString(),
      readAt: new Date(),
    };
    emitToConversation(conversation._id, 'messages_read', readPayload);

    // Also notify direct participants' private user rooms to guarantee delivery
    const orgIdStr = conversation.organizerId ? (conversation.organizerId._id || conversation.organizerId).toString() : '';
    const attIdStr = conversation.attendeeId ? (conversation.attendeeId._id || conversation.attendeeId).toString() : '';
    const currentUserIdStr = req.user._id.toString();
    if (orgIdStr && orgIdStr !== currentUserIdStr) {
      emitToUser(orgIdStr, 'messages_read', readPayload);
    }
    if (attIdStr && attIdStr !== currentUserIdStr) {
      emitToUser(attIdStr, 'messages_read', readPayload);
    }

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
    let query = {
      'deletedFor.userId': { $ne: user._id },
    };

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

    // If this message was pinned, keep the pinned preview synchronized
    if (
      conversation.pinnedMessage &&
      conversation.pinnedMessage.messageId &&
      conversation.pinnedMessage.messageId.toString() === message._id.toString()
    ) {
      conversation.pinnedMessage.text = trimmed;
      await conversation.save();
      emitToConversation(conversation._id, 'message_pinned', {
        conversationId: conversation._id,
        pinnedMessage: conversation.pinnedMessage,
      });
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

    // Cascade update to any replies in this conversation quoting this deleted message
    await Message.updateMany(
      { conversationId: conversation._id, replyToMessageId: message._id },
      {
        $set: {
          'replySnapshot.isDeleted': true,
          'replySnapshot.text': 'This message was deleted',
          'replySnapshot.hasAttachment': false,
          'replySnapshot.attachmentType': null,
          'replySnapshot.originalName': '',
        },
      }
    );

    // If this was the last message, update conversation preview
    if (
      conversation.lastMessage &&
      conversation.lastMessage.createdAt &&
      new Date(conversation.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
    ) {
      conversation.lastMessage.text = 'This message was deleted';
      await conversation.save();
    }

    // If this message was pinned, clear the pin safely
    if (
      conversation.pinnedMessage &&
      conversation.pinnedMessage.messageId &&
      conversation.pinnedMessage.messageId.toString() === message._id.toString()
    ) {
      conversation.pinnedMessage = null;
      conversation.markModified('pinnedMessage');
      await conversation.save();
      emitToConversation(conversation._id, 'message_unpinned', {
        conversationId: conversation._id,
        unpinnedMessageId: message._id,
      });
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

/**
 * @desc    Pin a message in an authorized conversation
 * @route   POST /api/chat/conversations/:id/messages/:messageId/pin
 * @route   POST /api/chat/conversations/:id/pin
 * @access  Private
 */
export const pinMessage = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const messageId = req.params.messageId || req.body.messageId;

    const { conversation, message, pinnedMessage } = await executePinMessage({
      user: req.user,
      conversationId,
      messageId,
    });

    // Broadcast in real-time to the conversation room
    emitToConversation(conversation._id, 'message_pinned', {
      conversationId: conversation._id,
      pinnedMessage,
    });

    res.status(200).json({
      success: true,
      conversationId: conversation._id,
      pinnedMessage,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Unpin the currently pinned message in an authorized conversation
 * @route   DELETE /api/chat/conversations/:id/messages/:messageId/pin
 * @route   DELETE /api/chat/conversations/:id/pin
 * @route   POST /api/chat/conversations/:id/unpin
 * @access  Private
 */
export const unpinMessage = async (req, res, next) => {
  try {
    const conversationId = req.params.id;
    const messageId = req.params.messageId || req.body.messageId;

    const { conversation, unpinnedMessageId, alreadyUnpinned } = await executeUnpinMessage({
      user: req.user,
      conversationId,
      messageId,
    });

    // Broadcast in real-time to the conversation room
    emitToConversation(conversation._id, 'message_unpinned', {
      conversationId: conversation._id,
      unpinnedMessageId,
    });

    res.status(200).json({
      success: true,
      conversationId: conversation._id,
      unpinnedMessageId,
      alreadyUnpinned: Boolean(alreadyUnpinned),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete / hide a conversation for the authenticated user only
 * @route   DELETE /api/chat/conversations/:id
 * @access  Private
 */
export const deleteConversation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await executeDeleteConversation({
      user: req.user,
      conversationId: id,
    });

    // Scoped Socket.IO notification to requester's private user room only
    emitToUser(req.user._id.toString(), 'conversation_deleted', {
      conversationId: result.conversation._id.toString(),
    });

    res.status(200).json({
      success: true,
      message: 'Conversation deleted from your inbox.',
      conversationId: result.conversation._id.toString(),
      wasAlreadyDeleted: result.wasAlreadyDeleted,
    });
  } catch (error) {
    next(error);
  }
};



