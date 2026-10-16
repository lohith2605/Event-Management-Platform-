import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
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
 * Broadcast event to all connected authenticated clients
 */
export const broadcastEvent = (event, payload) => {
  if (!ioInstance) return false;
  ioInstance.emit(event, payload);
  return true;
};
