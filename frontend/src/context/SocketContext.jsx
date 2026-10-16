import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../api/attendee';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [latestNotification, setLatestNotification] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);
  const toastedIdsRef = useRef(new Set());

  // Dismiss a toast by its unique ID
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Safely display a visible toast with de-duplication against repeated events
  const addToast = useCallback((notification) => {
    if (!notification) return;
    const notifId = notification._id
      ? notification._id.toString()
      : `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // De-duplication check: ensure notification ID has not already been toasted
    if (toastedIdsRef.current.has(notifId)) {
      return;
    }
    toastedIdsRef.current.add(notifId);

    // Additional event-level de-duplication for published events (user room + role room)
    const eventId = notification.metadata?.eventId || notification.eventId;
    if (eventId) {
      const eventKey = `pub_${eventId}`;
      if (eventKey !== notifId) {
        if (toastedIdsRef.current.has(eventKey)) {
          return;
        }
        toastedIdsRef.current.add(eventKey);
      }
    }

    const toastItem = {
      id: notifId,
      notification,
      type: notification.type || 'system',
      title: notification.title || 'Notification',
      message: notification.message || '',
      link: notification.link || '',
      createdAt: notification.createdAt || new Date().toISOString(),
    };

    setToasts((prev) => [toastItem, ...prev.slice(0, 3)]); // Maximum 4 toasts stacked
  }, []);

  // Expose dev helper for instant E2E toast inspection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__utsavAddToast = addToast;
    }
  }, [addToast]);

  // Fetch initial notifications and unread count from database
  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await fetchNotificationsApi();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setUnreadCount(typeof res.unreadCount === 'number' ? res.unreadCount : 0);
      }
    } catch (err) {
      console.warn('Failed to fetch initial notifications:', err?.message || err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial fetch on authentication state change
  useEffect(() => {
    if (isAuthenticated) {
      refreshNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      setLatestNotification(null);
      setToasts([]);
      toastedIdsRef.current.clear();
    }
  }, [isAuthenticated, refreshNotifications]);

  // Initialize and manage single persistent Socket.IO connection
  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Connect to backend via Vite proxy or direct window origin
    const socketClient = io({
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socketClient;
    setSocket(socketClient);

    socketClient.on('connect', () => {
      setIsConnected(true);
    });

    socketClient.on('disconnect', (reason) => {
      setIsConnected(false);
    });

    socketClient.on('connect_error', (error) => {
      setIsConnected(false);
    });

    // Reconnection handler: Reconcile notification state from DB
    socketClient.on('reconnect', () => {
      setIsConnected(true);
      refreshNotifications();
    });

    // Real-time private notification receiver
    socketClient.on('notification', (payload) => {
      if (!payload || !payload.notification) return;

      const newNotif = payload.notification;

      setNotifications((prev) => {
        // Prevent duplicate entries in state
        const exists = prev.some((n) => n._id === newNotif._id);
        if (exists) {
          return prev.map((n) => (n._id === newNotif._id ? newNotif : n));
        }
        return [newNotif, ...prev];
      });

      // Synchronize unread badge count
      if (typeof payload.unreadCount === 'number') {
        setUnreadCount(payload.unreadCount);
      } else {
        setUnreadCount((prev) => prev + 1);
      }

      setLatestNotification(newNotif);

      // Trigger visible toast popup for genuinely new incoming socket notification
      addToast(newNotif);
    });

    // Real-time role broadcast for newly published events
    socketClient.on('event_published', (publishedEvent) => {
      // Re-sync notifications in case an individual notification was dispatched concurrently
      refreshNotifications();

      if (publishedEvent && publishedEvent.eventId) {
        addToast({
          _id: `pub_${publishedEvent.eventId}`,
          title: `New Event in ${publishedEvent.city || 'India'}: ${publishedEvent.title}`,
          message: `"${publishedEvent.title}" has just been published in ${publishedEvent.category || 'Events'}! Explore passes, dates, and live schedules.`,
          type: 'event_published',
          link: publishedEvent.link || `/attendee?q=${encodeURIComponent(publishedEvent.title)}`,
          metadata: { eventId: publishedEvent.eventId },
          createdAt: new Date().toISOString(),
        });
      }
    });

    return () => {
      socketClient.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated, user?._id, refreshNotifications, addToast]);

  // Mark single notification as read
  const markAsRead = async (id) => {
    try {
      // Optimistic local update
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      // Persist to MongoDB
      const res = await markNotificationReadApi(id);
      if (res && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.warn('Failed to mark notification as read:', err);
      // Revert / re-sync on failure
      refreshNotifications();
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Optimistic update
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);

      // Persist to MongoDB
      const res = await markAllNotificationsReadApi();
      if (res && typeof res.unreadCount === 'number') {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.warn('Failed to mark all notifications read:', err);
      refreshNotifications();
    }
  };

  const value = {
    socket,
    isConnected,
    unreadCount,
    setUnreadCount,
    notifications,
    latestNotification,
    toasts,
    dismissToast,
    addToast,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
