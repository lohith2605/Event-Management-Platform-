import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { verifyConversationAccess } from './chatService.js';
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
        const { conversationId, text } = data || {};

        if (!conversationId || !mongoose.Types.ObjectId.isValid(conversationId)) {
          const errRes = { success: false, error: 'Invalid conversation ID format.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        if (!text || typeof text !== 'string' || !text.trim()) {
          const errRes = { success: false, error: 'Message text cannot be empty.' };
          if (typeof callback === 'function') callback(errRes);
          socket.emit('chat_error', errRes);
          return;
        }

        const trimmedText = text.trim();
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

        // Create message strictly using authenticated socket user identity
        const message = await Message.create({
          conversationId: conversation._id,
          senderId: socket.user._id,
          senderName: socket.user.name,
          senderRole: socket.user.role,
          text: trimmedText,
          readBy: [{ userId: socket.user._id, readAt: new Date() }],
        });

        // Update conversation metadata
        conversation.lastMessage = {
          text: message.text,
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

        // Broadcast to conversation room
        emitToConversation(conversation._id, 'new_message', {
          conversationId: conversation._id,
          message,
        });

        // Notify individual recipient private rooms
        recipientIds.forEach((rId) => {
          if (rId !== 'admin') {
            emitToUser(rId, 'chat_notification', {
              conversationId: conversation._id,
              eventId: conversation.eventId,
              senderName: socket.user.name,
              text: message.text,
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

        emitToConversation(conversation._id, 'messages_read', {
          conversationId: conversation._id,
          userId: socket.userId,
          readAt: new Date(),
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        logger.error('Error in mark_read socket event:', err);
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

