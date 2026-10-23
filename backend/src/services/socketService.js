import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message, { ALLOWED_EMOJIS } from '../models/Message.js';
import { verifyConversationAccess, buildReplySnapshot, executeForwardMessage, executePinMessage, executeUnpinMessage, executeDeleteConversation, restoreConversationVisibility } from './chatService.js';
import logger from '../utils/logger.js';

let ioInstance = null;

/**
 * Safely parse cookies from HTTP header string
 */
const parseCookies = (cookieHeader) => {
  const list = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return list;

  cookieHeader.split(';').forEach((cookie) => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    if (!name) return;
    const value = parts.slice(1).join('=').trim();
    try {
      list[name] = decodeURIComponent(value);
    } catch {
      list[name] = value;
    }
  });

  return list;
};

/**
 * Initialize Socket.IO with HTTP Server & strict authentication
 */
export const initSocket = (httpServer) => {
  const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : []),
  ];

  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Secure Authentication Middleware
  ioInstance.use(async (socket, next) => {
    try {
      let token = null;

      // 1. Check HTTP-Only cookie from request headers
      const cookies = parseCookies(socket.request?.headers?.cookie);
      if (cookies.token) {
        token = cookies.token;
      }

      // 2. Fallback to handshake auth payload (for clients passing token explicitly)
      if (!token && socket.handshake?.auth?.token) {
        token = socket.handshake.auth.token;
      }

      // 3. Fallback to authorization header in handshake
      if (!token && socket.handshake?.headers?.authorization) {
        const authHeader = socket.handshake.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        }
      }

      if (!token) {
        return next(new Error('Authentication error: Missing authentication token.'));
      }

      // Verify JWT token
      const jwtSecret = process.env.JWT_SECRET || 'utsav_super_secure_jwt_secret_key_2026_events_platform';
      const decoded = jwt.verify(token, jwtSecret);

      if (!decoded || !decoded.id) {
        return next(new Error('Authentication error: Invalid token payload.'));
      }

      // Verify user in MongoDB
      const user = await User.findById(decoded.id).select('_id name email role city isSuspended');
      if (!user) {
        return next(new Error('Authentication error: User no longer exists.'));
      }

      if (user.isSuspended) {
        return next(new Error('Authentication error: Account is suspended.'));
      }

      // Attach verified user identity to socket
      socket.user = user;
      socket.userId = user._id.toString();
      socket.userRole = user.role;

      return next();
    } catch (err) {
      return next(new Error('Authentication error: Session expired or invalid.'));
    }
  });

  // Connection Handler
  ioInstance.on('connection', (socket) => {
    const userId = socket.userId;
    const role = socket.userRole;

    // Join private room dedicated to this authenticated user
    const userRoom = `user:${userId}`;
    socket.join(userRoom);

    // Join role-based room (e.g. role:attendee, role:organizer, role:admin)
    const roleRoom = `role:${role}`;
    socket.join(roleRoom);

    logger.info(`Socket connected: user=${userId} (${role}), socketId=${socket.id}`);

    // Client heartbeat
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // =========================================================================
    // REAL-TIME EVENT CHAT HANDLERS
    // =========================================================================

    /**
     * Join an authorized conversation room
     */
    socket.on('join_conversation', async (data, callback) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          const errRes = { success: false, error: 'Invalid conversation ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const errRes = { success: false, error: 'Conversation not found.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        // Strict server-side verification: user role, event approval, booking validity
        const access = await verifyConversationAccess(socket.user, conversation);
        if (!access.allowed) {
          const errRes = { success: false, error: access.message || 'Forbidden: Access denied to conversation.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const roomName = `conversation:${conversationId}`;
        socket.join(roomName);
        logger.info(`Socket user ${socket.userId} safely joined chat room ${roomName}`);

        const successRes = { success: true, conversationId };
        if (typeof callback === 'function') callback(successRes);
        socket.emit('joined_conversation', successRes);
      } catch (err) {
        logger.error('Error in join_conversation socket event:', err);
        const errRes = { success: false, error: 'Internal server error joining conversation.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Leave a conversation room
     */
    socket.on('leave_conversation', (data) => {
      const { conversationId } = data || {};
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        logger.info(`Socket user ${socket.userId} left chat room conversation:${conversationId}`);
      }
    });

    /**
     * Send message via socket with server-side persistence & validation
     */
    socket.on('send_message', async (data, callback) => {
      try {
        const { conversationId, text, attachment, attachments, replyToMessageId } = data || {};

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          const errRes = { success: false, error: 'Invalid conversation ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
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
          const errRes = { success: false, error: 'Message must contain text content or an attachment.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (trimmedText.length > 2000) {
          const errRes = { success: false, error: 'Message cannot exceed 2000 characters.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const errRes = { success: false, error: 'Conversation not found.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        // Verify authorization & qualifying booking
        const access = await verifyConversationAccess(socket.user, conversation);
        if (!access.allowed) {
          const errRes = { success: false, error: access.message || 'Forbidden: Access denied.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        // Validate reply reference if specified (prevents cross-conversation or non-existent references)
        let replySnapshot = null;
        let validatedReplyId = null;
        if (replyToMessageId) {
          if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
            const errRes = { success: false, error: 'Invalid reply message ID format.' };
            if (typeof callback === 'function') callback(errRes);
            socket.emit('chat_error', errRes);
            return;
          }

          const originalMessage = await Message.findOne({
            _id: replyToMessageId,
            conversationId: conversation._id,
          });

          if (!originalMessage) {
            const errRes = { success: false, error: 'Referenced reply message not found in this conversation.' };
            if (typeof callback === 'function') callback(errRes);
            socket.emit('chat_error', errRes);
            return;
          }

          validatedReplyId = originalMessage._id;
          replySnapshot = buildReplySnapshot(originalMessage);
        }

        // Create message strictly using authenticated socket user identity
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: socket.user._id,
          senderName: socket.user.name,
          senderRole: socket.user.role,
          replyToMessageId: validatedReplyId,
          replySnapshot,
          text: trimmedText,
          attachments: cleanAttachments,
          attachment: cleanAttachments[0] || null,
          readBy: [{ userId: socket.user._id, readAt: new Date() }],
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

        // Update conversation metadata
        conversation.lastMessage = {
          text: previewText,
          senderId: socket.user._id,
          senderName: socket.user.name,
          senderRole: socket.user.role,
          createdAt: message.createdAt,
        };

        const unreadMap = conversation.unreadCounts || new Map();
        let recipientIds = [];
        if (conversation.type === 'admin_organizer') {
          if (socket.user.role === 'admin') {
            recipientIds.push(conversation.organizerId.toString());
          } else {
            recipientIds.push('admin');
          }
        } else if (conversation.type === 'attendee_organizer') {
          if (socket.userId === conversation.organizerId.toString()) {
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
        const restoreUserIds = [socket.user._id];
        if (conversation.type === 'admin_organizer') {
          if (socket.user.role === 'admin') {
            restoreUserIds.push(conversation.organizerId);
          }
        } else if (conversation.type === 'attendee_organizer') {
          if (socket.userId === conversation.organizerId.toString()) {
            restoreUserIds.push(conversation.attendeeId);
          } else {
            restoreUserIds.push(conversation.organizerId);
          }
        }
        await restoreConversationVisibility(conversation._id, restoreUserIds);

        // Broadcast to conversation room
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
              senderName: socket.user.name,
              text: previewText,
            });
          } else {
            emitToUser(rId, 'chat_notification', {
              conversationId: conversation._id,
              eventId: conversation.eventId,
              senderName: socket.user.name,
              text: previewText,
            });
          }
        });

        const successRes = { success: true, message };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in send_message socket event:', err);
        const errRes = { success: false, error: 'Internal server error sending message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Forward message via socket with server-side validation & persistence
     */
    socket.on('forward_message', async (data, callback) => {
      try {
        const { sourceMessageId, targetConversationId } = data || {};

        const { message, targetConversation, recipientIds, previewText } =
          await executeForwardMessage({
            user: socket.user,
            sourceMessageId,
            targetConversationId,
          });

        // Broadcast to destination conversation room
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
              senderName: socket.user.name,
              text: previewText,
            });
          } else {
            emitToUser(rId, 'chat_notification', {
              conversationId: targetConversation._id,
              eventId: targetConversation.eventId,
              senderName: socket.user.name,
              text: previewText,
            });
          }
        });

        const successRes = { success: true, message };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in forward_message socket event:', err);
        const errRes = { success: false, error: err.message || 'Failed to forward message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Pin message via socket with server-side validation & persistence
     */
    socket.on('pin_message', async (data, callback) => {
      try {
        const { conversationId, messageId } = data || {};
        const { conversation, message, pinnedMessage } = await executePinMessage({
          user: socket.user,
          conversationId,
          messageId,
        });

        emitToConversation(conversation._id, 'message_pinned', {
          conversationId: conversation._id,
          pinnedMessage,
        });

        const successRes = { success: true, pinnedMessage, message };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in pin_message socket event:', err);
        const errRes = { success: false, error: err.message || 'Failed to pin message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Unpin message via socket
     */
    socket.on('unpin_message', async (data, callback) => {
      try {
        const { conversationId, messageId } = data || {};
        const { conversation, unpinnedMessageId, alreadyUnpinned } = await executeUnpinMessage({
          user: socket.user,
          conversationId,
          messageId,
        });

        emitToConversation(conversation._id, 'message_unpinned', {
          conversationId: conversation._id,
          unpinnedMessageId,
        });

        const successRes = { success: true, unpinnedMessageId, alreadyUnpinned };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in unpin_message socket event:', err);
        const errRes = { success: false, error: err.message || 'Failed to unpin message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Typing indicators
     */
    socket.on('typing_start', (data) => {
      const { conversationId } = data || {};
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing_status', {
          conversationId,
          userId: socket.userId,
          userName: socket.user.name,
          isTyping: true,
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data || {};
      if (conversationId) {
        socket.to(`conversation:${conversationId}`).emit('typing_status', {
          conversationId,
          userId: socket.userId,
          userName: socket.user.name,
          isTyping: false,
        });
      }
    });

    /**
     * Mark messages read via socket
     */
    socket.on('mark_read', async (data, callback) => {
      try {
        const { conversationId } = data || {};
        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const access = await verifyConversationAccess(socket.user, conversation);
        if (!access.allowed) return;

        const unreadMap = conversation.unreadCounts || new Map();
        if (typeof unreadMap.set === 'function') {
          unreadMap.set(socket.userId, 0);
        } else {
          unreadMap[socket.userId] = 0;
        }
        conversation.unreadCounts = unreadMap;
        await conversation.save();

        await Message.updateMany(
          {
            conversationId: conversation._id,
            'readBy.userId': { $ne: socket.user._id },
          },
          {
            $push: {
              readBy: { userId: socket.user._id, readAt: new Date() },
            },
          }
        );

        const readPayload = {
          conversationId: conversation._id.toString(),
          userId: socket.userId,
          readAt: new Date(),
        };
        emitToConversation(conversation._id, 'messages_read', readPayload);

        // Also notify direct participants' private user rooms to guarantee delivery
        const orgIdStr = conversation.organizerId ? (conversation.organizerId._id || conversation.organizerId).toString() : '';
        const attIdStr = conversation.attendeeId ? (conversation.attendeeId._id || conversation.attendeeId).toString() : '';
        if (orgIdStr && orgIdStr !== socket.userId) {
          emitToUser(orgIdStr, 'messages_read', readPayload);
        }
        if (attIdStr && attIdStr !== socket.userId) {
          emitToUser(attIdStr, 'messages_read', readPayload);
        }

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        logger.error('Error in mark_read socket event:', err);
      }
    });

    /**
     * Toggle reaction on a message via socket with concurrency-safe atomic persistence
     */
    socket.on('toggle_reaction', async (data, callback) => {
      try {
        const { conversationId, messageId, emoji } = data || {};

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId) ||
            !messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
          const errRes = { success: false, error: 'Invalid conversation or message ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (!emoji || typeof emoji !== 'string' || !ALLOWED_EMOJIS.includes(emoji)) {
          const errRes = { success: false, error: `Invalid emoji. Supported: ${ALLOWED_EMOJIS.join(' ')}` };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const errRes = { success: false, error: 'Conversation not found.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const access = await verifyConversationAccess(socket.user, conversation);
        if (!access.allowed) {
          const errRes = { success: false, error: access.message || 'Access denied.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
        if (!message) {
          const errRes = { success: false, error: 'Message not found in this conversation.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const userId = socket.user._id;
        const userName = socket.user.name || 'User';

        // 1. Try pulling if existing
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

        // 2. If not pulled, push with atomic anti-duplication guard
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

        // 3. Fallback to latest message if concurrent write
        if (!updatedMessage) {
          updatedMessage = await Message.findOne({ _id: messageId, conversationId: conversation._id });
        }

        const reactions = updatedMessage ? updatedMessage.reactions || [] : [];

        // Broadcast to all participants in this conversation
        emitToConversation(conversation._id, 'message_reaction_updated', {
          conversationId: conversation._id,
          messageId: message._id,
          reactions,
        });

        const successRes = { success: true, messageId: message._id, reactions };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in toggle_reaction socket event:', err);
        const errRes = { success: false, error: 'Internal server error processing reaction.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Edit message via socket with strict author validation & persistence
     */
    socket.on('edit_message', async (data, callback) => {
      try {
        const { conversationId, messageId, text } = data || {};

        if (
          !conversationId || !mongoose.Types.ObjectId.isValid(conversationId) ||
          !messageId || !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          const errRes = { success: false, error: 'Invalid conversation or message ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
        if (!message) {
          const errRes = { success: false, error: 'Message not found in this conversation.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        // Enforce author ownership
        if (message.senderId.toString() !== socket.userId) {
          const errRes = { success: false, error: 'Forbidden: You can only edit your own messages.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (message.isDeleted) {
          const errRes = { success: false, error: 'Cannot edit a message that has been deleted.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const trimmed = typeof text === 'string' ? text.trim() : '';
        const hasAttachments =
          (Array.isArray(message.attachments) && message.attachments.length > 0) ||
          Boolean(message.attachment && message.attachment.url);

        if (!trimmed && !hasAttachments) {
          const errRes = { success: false, error: 'Message text cannot be empty.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (trimmed.length > 2000) {
          const errRes = { success: false, error: 'Message cannot exceed 2000 characters.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (message.text === trimmed) {
          const successRes = { success: true, message, unchanged: true };
          if (typeof callback === 'function') callback(successRes);
          return;
        }

        message.text = trimmed;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        if (
          conversation.lastMessage &&
          conversation.lastMessage.createdAt &&
          new Date(conversation.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
        ) {
          conversation.lastMessage.text = trimmed || (hasAttachments ? '📷 Image' : '');
          await conversation.save();
        }

        // Keep pinned message preview synchronized
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

        emitToConversation(conversation._id, 'message_edited', {
          conversationId: conversation._id,
          message,
        });

        const successRes = { success: true, message };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in edit_message socket event:', err);
        const errRes = { success: false, error: 'Internal server error editing message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Delete message via socket with strict author validation & soft-delete
     */
    socket.on('delete_message', async (data, callback) => {
      try {
        const { conversationId, messageId } = data || {};

        if (
          !conversationId || !mongoose.Types.ObjectId.isValid(conversationId) ||
          !messageId || !mongoose.Types.ObjectId.isValid(messageId)
        ) {
          const errRes = { success: false, error: 'Invalid conversation or message ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          const errRes = { success: false, error: 'Conversation not found.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const access = await verifyConversationAccess(socket.user, conversation);
        if (!access.allowed) {
          const errRes = { success: false, error: access.message || 'Access denied.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const message = await Message.findOne({ _id: messageId, conversationId: conversation._id });
        if (!message) {
          const errRes = { success: false, error: 'Message not found in this conversation.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        // Enforce author ownership
        if (message.senderId.toString() !== socket.userId) {
          const errRes = { success: false, error: 'Forbidden: You can only delete your own messages.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (message.isDeleted) {
          const errRes = { success: false, error: 'Message is already deleted.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

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

        if (
          conversation.lastMessage &&
          conversation.lastMessage.createdAt &&
          new Date(conversation.lastMessage.createdAt).getTime() === new Date(message.createdAt).getTime()
        ) {
          conversation.lastMessage.text = 'This message was deleted';
          await conversation.save();
        }

        // If pinned, clear pin safely
        if (
          conversation.pinnedMessage &&
          conversation.pinnedMessage.messageId &&
          conversation.pinnedMessage.messageId.toString() === message._id.toString()
        ) {
          conversation.pinnedMessage = null;
          await conversation.save();
          emitToConversation(conversation._id, 'message_unpinned', {
            conversationId: conversation._id,
            unpinnedMessageId: message._id,
          });
        }

        emitToConversation(conversation._id, 'message_deleted', {
          conversationId: conversation._id,
          messageId: message._id,
          message,
        });

        const successRes = { success: true, messageId: message._id, message };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in delete_message socket event:', err);
        const errRes = { success: false, error: 'Internal server error deleting message.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    /**
     * Delete / hide a conversation for the authenticated socket user
     */
    socket.on('delete_conversation', async (data, callback) => {
      try {
        const { conversationId } = data || {};
        const result = await executeDeleteConversation({
          user: socket.user,
          conversationId,
        });

        // Notify socket user room
        emitToUser(socket.userId, 'conversation_deleted', {
          conversationId: result.conversation._id,
        });

        const successRes = {
          success: true,
          conversationId: result.conversation._id,
          wasAlreadyDeleted: result.wasAlreadyDeleted,
        };
        if (typeof callback === 'function') callback(successRes);
      } catch (err) {
        logger.error('Error in delete_conversation socket event:', err);
        const errRes = { success: false, error: err.message || 'Failed to delete conversation.' };
        if (typeof callback === 'function') callback(errRes);
        socket.emit('chat_error', errRes);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: user=${userId}, reason=${reason}`);
    });
  });

  return ioInstance;
};

/**
 * Access the active Socket.IO server instance
 */
export const getIO = () => {
  return ioInstance;
};

/**
 * Emit event to a specific authenticated user's private room
 */
export const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return false;
  const targetRoom = `user:${userId.toString()}`;
  ioInstance.to(targetRoom).emit(event, payload);
  return true;
};

/**
 * Emit event to all users with a specific role
 */
export const emitToRole = (role, event, payload) => {
  if (!ioInstance || !role) return false;
  const targetRoom = `role:${role}`;
  ioInstance.to(targetRoom).emit(event, payload);
  return true;
};

/**
 * Emit event to all sockets in a specific conversation room
 */
export const emitToConversation = (conversationId, event, payload) => {
  if (!ioInstance || !conversationId) return false;
  const targetRoom = `conversation:${conversationId.toString()}`;
  ioInstance.to(targetRoom).emit(event, payload);
  return true;
};

/**
 * Broadcast event to all connected authenticated clients
 */
export const broadcastEvent = (event, payload) => {
  if (!ioInstance) return false;
  ioInstance.emit(event, payload);
  return true;
};

