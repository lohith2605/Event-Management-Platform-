import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
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
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .lean();

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
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID format.',
      });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message text cannot be empty.',
      });
    }

    const trimmedText = text.trim();
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
      readBy: [{ userId: req.user._id, readAt: new Date() }],
    });

    // Update conversation lastMessage metadata
    conversation.lastMessage = {
      text: message.text,
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
          text: message.text,
        });
      } else {
        emitToUser(rId, 'chat_notification', {
          conversationId: conversation._id,
          eventId: conversation.eventId,
          senderName: req.user.name,
          text: message.text,
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
