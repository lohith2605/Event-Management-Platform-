import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import {
  fetchConversationsApi,
  fetchConversationByIdApi,
  createOrGetConversationApi,
  fetchMessagesApi,
  sendMessageApi,
  markConversationReadApi,
  fetchUnreadChatCountApi,
} from '../api/chat';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected, dismissChatToast } = useSocket();

  // State
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState(new Map()); // userId -> { userName }
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);

  // Loading & Error states
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatError, setChatError] = useState(null);

  // References for current active conversation without stale closures
  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
    if (typeof window !== 'undefined') {
      window.__utsavActiveConversationId = activeConversation?._id ? activeConversation._id.toString() : null;
    }
  }, [activeConversation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__utsavIsChatDrawerOpen = isChatDrawerOpen;
    }
  }, [isChatDrawerOpen]);

  // Determine if a given conversation is actively open on screen in UTSAV
  const isConversationActiveOnScreen = useCallback(
    (convId) => {
      if (!convId || !activeConversation?._id) return false;
      if (activeConversation._id.toString() !== convId.toString()) return false;

      // Chat drawer is open
      if (isChatDrawerOpen) return true;

      // Or on messages page / tab
      if (typeof window !== 'undefined') {
        const path = window.location.pathname || '';
        const search = window.location.search || '';
        if (path.includes('/messages')) return true;
        if (path.includes('/organizer') && search.includes('tab=messages')) return true;
      }

      return false;
    },
    [activeConversation, isChatDrawerOpen]
  );

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__utsavIsConversationOpen = isConversationActiveOnScreen;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__utsavIsConversationOpen;
      }
    };
  }, [isConversationActiveOnScreen]);

  const typingTimeoutRef = useRef(null);

  // 1. Fetch conversations and total unread count
  const refreshConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingConversations(true);
      const [convRes, unreadRes] = await Promise.all([
        fetchConversationsApi().catch(() => ({ conversations: [] })),
        fetchUnreadChatCountApi().catch(() => ({ unreadCount: 0 })),
      ]);

      if (convRes && Array.isArray(convRes.conversations)) {
        setConversations(convRes.conversations);
      }
      if (unreadRes && typeof unreadRes.unreadCount === 'number') {
        setUnreadChatCount(unreadRes.unreadCount);
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err.message);
    } finally {
      setLoadingConversations(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__utsavRefreshConversations = refreshConversations;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__utsavRefreshConversations;
      }
    };
  }, [refreshConversations]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshConversations();
    } else {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      setUnreadChatCount(0);
      setIsChatDrawerOpen(false);
      setTypingUsers(new Map());
    }
  }, [isAuthenticated, refreshConversations]);

  // 2. Mark active conversation as read
  const markAsRead = useCallback(
    async (convId) => {
      if (!convId) return;
      try {
        // Optimistic local state update
        setConversations((prev) =>
          prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
        );

        // Emit socket mark_read event if connected
        if (socket && socket.connected) {
          socket.emit('mark_read', { conversationId: convId });
        }

        // Call REST endpoint
        await markConversationReadApi(convId);

        // Refresh global unread count
        const unreadRes = await fetchUnreadChatCountApi().catch(() => null);
        if (unreadRes && typeof unreadRes.unreadCount === 'number') {
          setUnreadChatCount(unreadRes.unreadCount);
        }
      } catch (err) {
        console.warn('Failed to mark conversation as read:', err);
      }
    },
    [socket]
  );

  // 3. Open a conversation and fetch message history
  const openConversation = useCallback(
    async (conversationOrId, { autoOpenDrawer = true } = {}) => {
      setChatError(null);
      setTypingUsers(new Map());

      // If passing null/undefined/falsy, deselect active conversation (leave room and clear thread)
      if (!conversationOrId) {
        if (activeConversationRef.current && socket && socket.connected) {
          socket.emit('leave_conversation', {
            conversationId: activeConversationRef.current._id,
          });
        }
        setActiveConversation(null);
        setMessages([]);
        setLoadingMessages(false);
        return;
      }

      let conv = null;
      let convId = null;

      if (typeof conversationOrId === 'string') {
        convId = conversationOrId;
        conv = conversations.find((c) => c._id === convId);
        if (!conv) {
          try {
            setLoadingMessages(true);
            const res = await fetchConversationByIdApi(convId);
            if (res && res.conversation) {
              conv = res.conversation;
            }
          } catch (err) {
            setChatError(err.message || 'Unable to load conversation.');
            setLoadingMessages(false);
            return;
          }
        }
      } else if (conversationOrId && conversationOrId._id) {
        conv = conversationOrId;
        convId = conv._id;
      }

      if (!conv || !convId) return;

      // Dismiss any in-app chat toasts for this conversation
      if (typeof dismissChatToast === 'function') {
        dismissChatToast(convId);
      } else if (typeof window !== 'undefined' && typeof window.__utsavDismissChatToast === 'function') {
        window.__utsavDismissChatToast(convId);
      }

      // Synchronously record active conversation ID and drawer state
      if (typeof window !== 'undefined') {
        window.__utsavActiveConversationId = convId.toString();
        if (autoOpenDrawer) {
          window.__utsavIsChatDrawerOpen = true;
        }
      }

      // Leave previous room if changing conversation
      if (
        activeConversationRef.current &&
        activeConversationRef.current._id !== convId &&
        socket &&
        socket.connected
      ) {
        socket.emit('leave_conversation', {
          conversationId: activeConversationRef.current._id,
        });
      }

      setActiveConversation(conv);
      if (autoOpenDrawer) {
        setIsChatDrawerOpen(true);
      }

      // Join socket room
      if (socket && socket.connected) {
        socket.emit('join_conversation', { conversationId: convId });
      }

      // Fetch message history
      setLoadingMessages(true);
      try {
        const res = await fetchMessagesApi(convId, { limit: 50 });
        if (res && Array.isArray(res.messages)) {
          setMessages(res.messages);
          setHasMoreMessages(res.messages.length >= 50);
        } else {
          setMessages([]);
          setHasMoreMessages(false);
        }

        // Mark as read
        markAsRead(convId);
      } catch (err) {
        setChatError(err.message || 'Failed to load messages.');
      } finally {
        setLoadingMessages(false);
      }
    },
    [conversations, socket, markAsRead, dismissChatToast]
  );

  // Expose openConversation to window context for native desktop notification click handling
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__utsavOpenConversation = openConversation;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__utsavOpenConversation;
      }
    };
  }, [openConversation]);

  // 4. Start or retrieve conversation atomically by event ID and type
  const startOrOpenConversation = useCallback(
    async ({ eventId, type, attendeeId, autoOpenDrawer = true }) => {
      setChatError(null);
      try {
        setLoadingMessages(true);
        if (autoOpenDrawer) {
          setIsChatDrawerOpen(true);
        }

        const res = await createOrGetConversationApi({ eventId, type, attendeeId });
        if (res && res.conversation) {
          await openConversation(res.conversation, { autoOpenDrawer });
          // Ensure it is in the conversations list
          setConversations((prev) => {
            const exists = prev.some((c) => c._id === res.conversation._id);
            if (exists) {
              return prev.map((c) => (c._id === res.conversation._id ? res.conversation : c));
            }
            return [res.conversation, ...prev];
          });
          return { success: true, conversation: res.conversation };
        }
      } catch (err) {
        const errMsg = err.message || 'Failed to initiate conversation.';
        setChatError(errMsg);
        return { success: false, error: errMsg };
      } finally {
        setLoadingMessages(false);
      }
    },
    [openConversation]
  );

  // 5. Close active chat
  const closeChat = useCallback(() => {
    if (activeConversationRef.current && socket && socket.connected) {
      socket.emit('leave_conversation', {
        conversationId: activeConversationRef.current._id,
      });
    }
    setActiveConversation(null);
    setIsChatDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.__utsavActiveConversationId = null;
      window.__utsavIsChatDrawerOpen = false;
    }
    setMessages([]);
    setTypingUsers(new Map());
    setChatError(null);
  }, [socket]);

  // Leave / deselect active conversation (returns to inbox without closing drawer)
  const leaveConversation = useCallback(() => {
    if (activeConversationRef.current && socket && socket.connected) {
      socket.emit('leave_conversation', {
        conversationId: activeConversationRef.current._id,
      });
    }
    setActiveConversation(null);
    if (typeof window !== 'undefined') {
      window.__utsavActiveConversationId = null;
    }
    setMessages([]);
    setTypingUsers(new Map());
    setChatError(null);
    setLoadingMessages(false);
  }, [socket]);

  // 6. Load older messages (pagination)
  const loadOlderMessages = useCallback(async () => {
    if (!activeConversation || loadingMoreMessages || !hasMoreMessages || messages.length === 0) {
      return;
    }

    const oldestMessage = messages[0];
    if (!oldestMessage || !oldestMessage.createdAt) return;

    try {
      setLoadingMoreMessages(true);
      const res = await fetchMessagesApi(activeConversation._id, {
        limit: 50,
        before: oldestMessage.createdAt,
      });

      if (res && Array.isArray(res.messages) && res.messages.length > 0) {
        // Prepend older messages avoiding duplicates
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newOlder = res.messages.filter((m) => !existingIds.has(m._id));
          return [...newOlder, ...prev];
        });
        setHasMoreMessages(res.messages.length >= 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.warn('Failed to load older messages:', err);
    } finally {
      setLoadingMoreMessages(false);
    }
  }, [activeConversation, loadingMoreMessages, hasMoreMessages, messages]);

  // 7. Send message
  const sendMessage = useCallback(
    async (text) => {
      if (!activeConversation) return { success: false, error: 'No active conversation.' };
      const trimmed = (text || '').trim();
      if (!trimmed) return { success: false, error: 'Message cannot be empty.' };
      if (trimmed.length > 2000) {
        return { success: false, error: 'Message cannot exceed 2000 characters.' };
      }

      setSendingMessage(true);
      setChatError(null);

      // Stop typing
      if (socket && socket.connected) {
        socket.emit('typing_stop', { conversationId: activeConversation._id });
      }

      try {
        let sentMessage = null;

        // Try Socket.IO with acknowledgment first
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket send timed out. Falling back to HTTP.'));
            }, 3000);

            socket.emit(
              'send_message',
              { conversationId: activeConversation._id, text: trimmed },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack.message);
                } else {
                  reject(new Error(ack?.error || 'Failed to send message via socket.'));
                }
              }
            );
          });

          try {
            sentMessage = await socketPromise;
          } catch (socketErr) {
            console.warn('Socket message delivery failed, falling back to REST:', socketErr.message);
            const restRes = await sendMessageApi(activeConversation._id, trimmed);
            sentMessage = restRes?.message;
          }
        } else {
          // Socket disconnected, send via REST
          const restRes = await sendMessageApi(activeConversation._id, trimmed);
          sentMessage = restRes?.message;
        }

        if (sentMessage) {
          // De-duplicate and append to messages timeline
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === sentMessage._id);
            if (exists) return prev;
            return [...prev, sentMessage];
          });

          // Update lastMessage on conversation
          setConversations((prev) =>
            prev.map((c) =>
              c._id === activeConversation._id
                ? {
                    ...c,
                    lastMessage: {
                      text: sentMessage.text,
                      senderId: sentMessage.senderId,
                      senderName: sentMessage.senderName,
                      senderRole: sentMessage.senderRole,
                      createdAt: sentMessage.createdAt,
                    },
                    updatedAt: sentMessage.createdAt,
                  }
                : c
            )
          );

          return { success: true, message: sentMessage };
        }

        throw new Error('No message response received.');
      } catch (err) {
        const errorMsg = err.message || 'Failed to send message.';
        setChatError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setSendingMessage(false);
      }
    },
    [activeConversation, socket]
  );

  // 8. Typing indicators
  const sendTyping = useCallback(
    (isTyping) => {
      if (!activeConversation || !socket || !socket.connected) return;

      if (isTyping) {
        socket.emit('typing_start', { conversationId: activeConversation._id });

        // Auto-stop typing after 3 seconds of inactivity
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          if (socket && socket.connected && activeConversationRef.current) {
            socket.emit('typing_stop', { conversationId: activeConversationRef.current._id });
          }
        }, 3000);
      } else {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        socket.emit('typing_stop', { conversationId: activeConversation._id });
      }
    },
    [activeConversation, socket]
  );

  // 9. Real-time socket event listeners
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Incoming message broadcast
    const handleNewMessage = (payload) => {
      if (!payload || !payload.message || !payload.conversationId) return;
      const { conversationId, message } = payload;
      const currentActive = activeConversationRef.current;

      // Update conversations list metadata (lastMessage and unread count)
      setConversations((prev) => {
        const exists = prev.some((c) => c._id === conversationId);
        if (exists) {
          return prev.map((c) => {
            if (c._id === conversationId) {
              const isCurrentlyOpen = currentActive && currentActive._id === conversationId;
              return {
                ...c,
                lastMessage: {
                  text: message.text,
                  senderId: message.senderId,
                  senderName: message.senderName,
                  senderRole: message.senderRole,
                  createdAt: message.createdAt,
                },
                unreadCount: isCurrentlyOpen ? 0 : (c.unreadCount || 0) + 1,
                updatedAt: message.createdAt,
              };
            }
            return c;
          });
        }
        // If not in list, trigger fresh fetch
        refreshConversations();
        return prev;
      });

      // If this conversation is currently open
      if (currentActive && currentActive._id === conversationId) {
        setMessages((prev) => {
          const alreadyExists = prev.some((m) => m._id === message._id);
          if (alreadyExists) return prev;
          return [...prev, message];
        });

        // Clear typing indicator for the sender
        setTypingUsers((prev) => {
          const updated = new Map(prev);
          updated.delete(message.senderId);
          return updated;
        });

        // Mark as read immediately if it's someone else's message
        if (message.senderId !== user?._id) {
          markAsRead(conversationId);
        }
      } else {
        // Increment global unread count
        if (message.senderId !== user?._id) {
          setUnreadChatCount((prev) => prev + 1);
        }
      }
    };

    // Typing status broadcast
    const handleTypingStatus = (payload) => {
      if (!payload || !payload.conversationId) return;
      const currentActive = activeConversationRef.current;
      if (!currentActive || currentActive._id !== payload.conversationId) return;

      if (payload.userId === user?._id) return; // Don't show typing for self

      setTypingUsers((prev) => {
        const updated = new Map(prev);
        if (payload.isTyping) {
          updated.set(payload.userId, { userName: payload.userName || 'User' });
        } else {
          updated.delete(payload.userId);
        }
        return updated;
      });
    };

    // Read receipts broadcast
    const handleMessagesRead = (payload) => {
      if (!payload || !payload.conversationId) return;
      const currentActive = activeConversationRef.current;
      if (!currentActive || currentActive._id !== payload.conversationId) return;

      const { userId, readAt } = payload;
      setMessages((prev) =>
        prev.map((m) => {
          const alreadyRead = (m.readBy || []).some(
            (r) => (r.userId?._id || r.userId) === userId
          );
          if (!alreadyRead) {
            return {
              ...m,
              readBy: [...(m.readBy || []), { userId, readAt: readAt || new Date() }],
            };
          }
          return m;
        })
      );
    };

    // Chat-specific error broadcast
    const handleChatError = (payload) => {
      if (payload && payload.error) {
        setChatError(payload.error);
      }
    };

    // Reconnection handling: Re-join active room and synchronize messages
    const handleReconnect = () => {
      const currentActive = activeConversationRef.current;
      if (currentActive && currentActive._id) {
        socket.emit('join_conversation', { conversationId: currentActive._id });
        // Refresh message history to recover messages sent during disconnect
        fetchMessagesApi(currentActive._id, { limit: 50 }).then((res) => {
          if (res && Array.isArray(res.messages)) {
            setMessages(res.messages);
          }
        });
      }
      refreshConversations();
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing_status', handleTypingStatus);
    socket.on('messages_read', handleMessagesRead);
    socket.on('chat_error', handleChatError);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing_status', handleTypingStatus);
      socket.off('messages_read', handleMessagesRead);
      socket.off('chat_error', handleChatError);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, isAuthenticated, user?._id, refreshConversations, markAsRead]);

  const value = {
    conversations,
    activeConversation,
    messages,
    hasMoreMessages,
    unreadChatCount,
    typingUsers,
    isChatDrawerOpen,
    setIsChatDrawerOpen,
    loadingConversations,
    loadingMessages,
    loadingMoreMessages,
    sendingMessage,
    chatError,
    refreshConversations,
    openConversation,
    leaveConversation,
    startOrOpenConversation,
    closeChat,
    loadOlderMessages,
    sendMessage,
    sendTyping,
    markAsRead,
    isConnected,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
