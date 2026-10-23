import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { getOtherParticipantId, extractId } from '../utils/chatUtils';
import {
  fetchConversationsApi,
  fetchConversationByIdApi,
  createOrGetConversationApi,
  fetchMessagesApi,
  sendMessageApi,
  markConversationReadApi,
  fetchUnreadChatCountApi,
  toggleReactionApi,
  editMessageApi,
  deleteMessageApi,
  uploadChatAttachmentApi,
  uploadChatImageApi,
  downloadAttachmentApi,
  searchMessagesApi,
  forwardMessageApi,
  pinMessageApi,
  unpinMessageApi,
  fetchSharedContentApi,
  deleteConversationApi,
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
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [forwardingMessage, setForwardingMessage] = useState(null);
  const [isSharedOpen, setIsSharedOpen] = useState(false);
  const [sharedInitialTab, setSharedInitialTab] = useState('media');
  const highlightTimeoutRef = useRef(null);

  const toggleSharedContent = useCallback((tab = 'media') => {
    setIsSharedOpen((prev) => {
      if (!prev) {
        if (tab) setSharedInitialTab(tab);
        return true;
      }
      return false;
    });
  }, []);

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

  // Target recipient participant ID for current active conversation
  const otherParticipantId = useMemo(() => {
    return getOtherParticipantId(activeConversation, user);
  }, [activeConversation, user]);

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
      setReplyingTo(null);
      setForwardingMessage(null);
    }
  }, [isAuthenticated, refreshConversations]);

  // 2. Mark active conversation as read
  const markAsRead = useCallback(
    async (convId) => {
      const idToMark = extractId(convId);
      if (!idToMark) return;
      try {
        // Optimistic local state update
        setConversations((prev) =>
          prev.map((c) => (extractId(c._id) === idToMark ? { ...c, unreadCount: 0 } : c))
        );

        // Emit socket mark_read event if connected
        if (socket && socket.connected) {
          socket.emit('mark_read', { conversationId: idToMark });
        }

        // Call REST endpoint
        await markConversationReadApi(idToMark);

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
      setReplyingTo(null);
      setForwardingMessage(null);

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
        conv = conversations.find((c) => extractId(c._id) === convId);
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
      } else if (conversationOrId && (conversationOrId._id || conversationOrId.id)) {
        conv = conversationOrId;
        convId = extractId(conv._id || conv.id);
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
        extractId(activeConversationRef.current._id) !== convId &&
        socket &&
        socket.connected
      ) {
        socket.emit('leave_conversation', {
          conversationId: extractId(activeConversationRef.current._id),
        });
      }

      setActiveConversation(conv);
      setIsSharedOpen(false);
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
          const newConvId = extractId(res.conversation._id);
          setConversations((prev) => {
            const exists = prev.some((c) => extractId(c._id) === newConvId);
            if (exists) {
              return prev.map((c) => (extractId(c._id) === newConvId ? res.conversation : c));
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
    setIsSharedOpen(false);
    setReplyingTo(null);
    setForwardingMessage(null);
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
    setIsSharedOpen(false);
    setReplyingTo(null);
    setForwardingMessage(null);
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

  // 6b. Search messages within the active conversation
  const searchMessages = useCallback(
    async (conversationId, { query, page = 1, limit = 20 } = {}, signal) => {
      const convId = extractId(conversationId || activeConversation?._id);
      if (!convId) throw new Error('No active conversation specified for message search.');
      return searchMessagesApi(convId, { query, page, limit }, signal);
    },
    [activeConversation]
  );

  // 6c. Jump directly to a target message in the timeline (auto-loading older messages if necessary)
  const jumpToMessage = useCallback(
    async (targetMessageId, messageCreatedAt) => {
      const cleanMsgId = extractId(targetMessageId);
      if (!cleanMsgId) return { success: false, error: 'Invalid message ID.' };

      const currentConv = activeConversation || activeConversationRef.current;
      if (!currentConv) return { success: false, error: 'No active conversation.' };
      const convId = extractId(currentConv._id || currentConv.id);

      // Helper to trigger scroll and highlight
      const triggerHighlightAndScroll = (id) => {
        setHighlightedMessageId(id);
        if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = setTimeout(() => {
          setHighlightedMessageId(null);
        }, 3000);

        requestAnimationFrame(() => {
          setTimeout(() => {
            const el = document.getElementById(`chat-message-${id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 80);
        });
      };

      // Case 1: Target message is already present in loaded messages
      const alreadyLoaded = messages.some((m) => extractId(m._id || m.id) === cleanMsgId);
      if (alreadyLoaded) {
        triggerHighlightAndScroll(cleanMsgId);
        return { success: true, alreadyLoaded: true };
      }

      // Case 2: Target message is older and not yet loaded into state
      try {
        setLoadingMoreMessages(true);
        const oldestLoadedMessage = messages[0];
        const before = oldestLoadedMessage?.createdAt || messageCreatedAt;

        const res = await fetchMessagesApi(convId, {
          limit: 50,
          before,
          includeMessageId: cleanMsgId,
        });

        if (res && Array.isArray(res.messages) && res.messages.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => extractId(m._id || m.id)));
            const newOlder = res.messages.filter((m) => !existingIds.has(extractId(m._id || m.id)));
            return [...newOlder, ...prev];
          });
          setHasMoreMessages(res.messages.length >= 50);

          triggerHighlightAndScroll(cleanMsgId);
          return { success: true, loaded: true };
        } else {
          return { success: false, notFound: true, error: 'Message could not be found in history.' };
        }
      } catch (err) {
        console.warn('Failed to load target message:', err);
        return { success: false, error: err.message || 'Failed to jump to message.' };
      } finally {
        setLoadingMoreMessages(false);
      }
    },
    [activeConversation, messages]
  );

  // 7. Send message (supports text and/or image attachment)
  const sendMessage = useCallback(
    async (payload) => {
      const currentConv = activeConversation || activeConversationRef.current;
      if (!currentConv) return { success: false, error: 'No active conversation.' };

      let textVal = '';
      let fileVal = null;
      let attachmentVal = null;

      if (typeof payload === 'string') {
        textVal = payload;
      } else if (payload && typeof payload === 'object') {
        textVal = payload.text || '';
        fileVal = payload.file || null;
        attachmentVal = payload.attachment || null;
      }

      const trimmed = textVal.trim();
      if (!trimmed && !fileVal && !attachmentVal) {
        return { success: false, error: 'Message cannot be empty.' };
      }
      if (trimmed.length > 2000) {
        return { success: false, error: 'Message cannot exceed 2000 characters.' };
      }

      setSendingMessage(true);
      setChatError(null);

      // Stop typing
      if (socket && socket.connected) {
        socket.emit('typing_stop', { conversationId: currentConv._id });
      }

      try {
        // Upload attachment file first if provided
        let attachment = attachmentVal;
        if (fileVal) {
          const uploadRes = await uploadChatAttachmentApi(currentConv._id, fileVal);
          if (uploadRes && uploadRes.attachment) {
            attachment = uploadRes.attachment;
          } else {
            throw new Error('Attachment upload failed.');
          }
        }

        const replyToMessageId = payload?.replyToMessageId || replyingTo?._id || null;

        const messagePayload = {
          conversationId: currentConv._id,
          text: trimmed,
          attachment,
          attachments: attachment ? [attachment] : [],
          ...(replyToMessageId ? { replyToMessageId } : {}),
        };

        let sentMessage = null;

        // Try Socket.IO with acknowledgment first
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket send timed out. Falling back to HTTP.'));
            }, 4000);

            socket.emit(
              'send_message',
              messagePayload,
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
            const restRes = await sendMessageApi(currentConv._id, messagePayload);
            sentMessage = restRes?.message;
          }
        } else {
          // Socket disconnected, send via REST
          const restRes = await sendMessageApi(currentConv._id, messagePayload);
          sentMessage = restRes?.message;
        }

        if (sentMessage) {
          // De-duplicate and append to messages timeline
          setMessages((prev) => {
            const exists = prev.some((m) => m._id === sentMessage._id);
            if (exists) return prev;
            return [...prev, sentMessage];
          });

          let previewText = sentMessage.text;
          if (!previewText) {
            const att = sentMessage.attachment || (sentMessage.attachments && sentMessage.attachments[0]);
            if (att) {
              if (att.resourceType === 'raw' || (att.mimeType && !att.mimeType.startsWith('image/'))) {
                previewText = `📄 ${att.originalName || 'Document'}`;
              } else {
                previewText = '📷 Image';
              }
            }
          }

          // Update lastMessage on conversation
          const activeConvId = extractId(currentConv._id);
          setConversations((prev) =>
            prev.map((c) =>
              extractId(c._id) === activeConvId
                ? {
                    ...c,
                    lastMessage: {
                      text: previewText,
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

          // Clear reply state on successful send
          setReplyingTo(null);

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
    [activeConversation, socket, replyingTo]
  );

  // 8. Forward message to a destination conversation
  const forwardMessage = useCallback(
    async (targetConversationId, sourceMessageId) => {
      if (!targetConversationId || !sourceMessageId) {
        return { success: false, error: 'Destination conversation and source message are required.' };
      }

      setSendingMessage(true);
      setChatError(null);

      try {
        let forwardedMessage = null;

        // Try Socket.IO forward_message first
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket forward timed out. Falling back to HTTP.'));
            }, 4000);

            socket.emit(
              'forward_message',
              { sourceMessageId, targetConversationId },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack.message);
                } else {
                  reject(new Error(ack?.error || 'Failed to forward message via socket.'));
                }
              }
            );
          });

          try {
            forwardedMessage = await socketPromise;
          } catch (socketErr) {
            console.warn('Socket forward delivery failed, falling back to REST:', socketErr.message);
            const restRes = await forwardMessageApi(targetConversationId, sourceMessageId);
            forwardedMessage = restRes?.message;
          }
        } else {
          // Socket disconnected, send via REST
          const restRes = await forwardMessageApi(targetConversationId, sourceMessageId);
          forwardedMessage = restRes?.message;
        }

        if (forwardedMessage) {
          const currentActive = activeConversationRef.current;
          const currentActiveId = extractId(currentActive?._id);
          const destId = extractId(targetConversationId);

          // If the target conversation is currently active on screen, append to timeline
          if (currentActiveId && currentActiveId === destId) {
            setMessages((prev) => {
              const exists = prev.some((m) => extractId(m._id || m.id) === extractId(forwardedMessage._id || forwardedMessage.id));
              if (exists) return prev;
              return [...prev, forwardedMessage];
            });
          }

          // Update destination conversation in conversations list
          let previewText = forwardedMessage.text;
          if (!previewText) {
            const att = forwardedMessage.attachment || (forwardedMessage.attachments && forwardedMessage.attachments[0]);
            if (att) {
              if (att.resourceType === 'raw' || (att.mimeType && !att.mimeType.startsWith('image/'))) {
                previewText = `📄 ${att.originalName || 'Document'}`;
              } else {
                previewText = '📷 Image';
              }
            }
          }

          setConversations((prev) =>
            prev.map((c) =>
              extractId(c._id) === destId
                ? {
                    ...c,
                    lastMessage: {
                      text: previewText,
                      senderId: forwardedMessage.senderId,
                      senderName: forwardedMessage.senderName,
                      senderRole: forwardedMessage.senderRole,
                      createdAt: forwardedMessage.createdAt,
                    },
                    updatedAt: forwardedMessage.createdAt,
                  }
                : c
            )
          );

          setForwardingMessage(null);
          return { success: true, message: forwardedMessage };
        }

        throw new Error('No forwarded message response received.');
      } catch (err) {
        const errorMsg = err.message || 'Failed to forward message.';
        setChatError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setSendingMessage(false);
      }
    },
    [socket]
  );

  // 9. Pin message in a conversation (replaces any previous pin)
  const pinMessage = useCallback(
    async (arg1, arg2) => {
      let cleanConvId;
      let cleanMsgId;
      if (arg2 !== undefined) {
        cleanConvId = extractId(arg1) || extractId(activeConversation?._id);
        cleanMsgId = extractId(arg2);
      } else {
        cleanConvId = extractId(activeConversation?._id);
        cleanMsgId = extractId(arg1);
      }

      if (!cleanConvId || !cleanMsgId) {
        return { success: false, error: 'Conversation ID and Message ID are required.' };
      }

      try {
        let pinnedResult = null;
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket pin timed out. Falling back to HTTP.'));
            }, 4000);

            socket.emit(
              'pin_message',
              { conversationId: cleanConvId, messageId: cleanMsgId },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack);
                } else {
                  reject(new Error(ack?.error || 'Failed to pin message via socket.'));
                }
              }
            );
          });

          try {
            pinnedResult = await socketPromise;
          } catch (socketErr) {
            console.warn('Socket pin delivery failed, falling back to REST:', socketErr.message);
            pinnedResult = await pinMessageApi(cleanConvId, cleanMsgId);
          }
        } else {
          pinnedResult = await pinMessageApi(cleanConvId, cleanMsgId);
        }

        if (pinnedResult && pinnedResult.pinnedMessage) {
          const pinnedMsg = pinnedResult.pinnedMessage;
          setActiveConversation((prev) =>
            prev && extractId(prev._id) === cleanConvId
              ? { ...prev, pinnedMessage: pinnedMsg }
              : prev
          );
          setConversations((prev) =>
            prev.map((c) =>
              extractId(c._id) === cleanConvId ? { ...c, pinnedMessage: pinnedMsg } : c
            )
          );
          setMessages((prev) =>
            prev.map((m) => ({
              ...m,
              isPinned: extractId(m._id || m.id) === cleanMsgId,
            }))
          );
          return { success: true, pinnedMessage: pinnedMsg };
        }

        throw new Error('Invalid response from pin service.');
      } catch (err) {
        const errorMsg = err.message || 'Failed to pin message.';
        setChatError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [socket, activeConversation]
  );

  // 10. Unpin currently pinned message in a conversation
  const unpinMessage = useCallback(
    async (arg1, arg2) => {
      let cleanConvId;
      let cleanMsgId;
      if (arg2 !== undefined) {
        cleanConvId = extractId(arg1) || extractId(activeConversation?._id);
        cleanMsgId = extractId(arg2);
      } else if (arg1 !== undefined) {
        const idStr = extractId(arg1);
        if (activeConversation && extractId(activeConversation._id) === idStr) {
          cleanConvId = idStr;
          cleanMsgId = undefined;
        } else {
          cleanConvId = extractId(activeConversation?._id) || idStr;
          cleanMsgId = idStr;
        }
      } else {
        cleanConvId = extractId(activeConversation?._id);
        cleanMsgId = undefined;
      }

      if (!cleanConvId) {
        return { success: false, error: 'Conversation ID is required.' };
      }

      try {
        let unpinResult = null;
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket unpin timed out. Falling back to HTTP.'));
            }, 4000);

            socket.emit(
              'unpin_message',
              { conversationId: cleanConvId, messageId: cleanMsgId },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack);
                } else {
                  reject(new Error(ack?.error || 'Failed to unpin message via socket.'));
                }
              }
            );
          });

          try {
            unpinResult = await socketPromise;
          } catch (socketErr) {
            console.warn('Socket unpin delivery failed, falling back to REST:', socketErr.message);
            unpinResult = await unpinMessageApi(cleanConvId, cleanMsgId);
          }
        } else {
          unpinResult = await unpinMessageApi(cleanConvId, cleanMsgId);
        }

        if (unpinResult && (unpinResult.success || unpinResult.unpinnedMessageId !== undefined)) {
          setActiveConversation((prev) =>
            prev && extractId(prev._id) === cleanConvId
              ? { ...prev, pinnedMessage: null }
              : prev
          );
          setConversations((prev) =>
            prev.map((c) =>
              extractId(c._id) === cleanConvId ? { ...c, pinnedMessage: null } : c
            )
          );
          setMessages((prev) =>
            prev.map((m) => (m.isPinned ? { ...m, isPinned: false } : m))
          );
          return { success: true };
        }

        throw new Error('Invalid response from unpin service.');
      } catch (err) {
        const errorMsg = err.message || 'Failed to unpin message.';
        setChatError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [socket, activeConversation]
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

  // Ensure the active conversation room is joined whenever socket connects or active conversation changes
  useEffect(() => {
    if (socket && isConnected && activeConversation?._id) {
      socket.emit('join_conversation', {
        conversationId: activeConversation._id.toString(),
      });
    }
  }, [socket, isConnected, activeConversation?._id]);

  // 9. Emoji reaction toggle with optimistic UI and server reconciliation
  const toggleReaction = useCallback(
    async (messageId, emoji) => {
      const currentConv = activeConversation || activeConversationRef.current;
      if (!currentConv || !messageId || !emoji) return;

      const currentUserId = extractId(user?._id || user?.id || user);
      if (!currentUserId) return;

      const targetMsgId = extractId(messageId);
      if (!targetMsgId) return;

      // 1. Optimistic update
      let snapshotMessages = null;
      setMessages((prev) => {
        snapshotMessages = prev;
        return prev.map((msg) => {
          const mId = extractId(msg._id || msg.id);
          if (mId !== targetMsgId) return msg;

          const currentReactions = Array.isArray(msg.reactions) ? msg.reactions : [];
          const existingIndex = currentReactions.findIndex(
            (r) => r.emoji === emoji && extractId(r.userId || r.user) === currentUserId
          );

          let updatedReactions;
          if (existingIndex > -1) {
            // Remove reaction
            updatedReactions = currentReactions.filter((_, idx) => idx !== existingIndex);
          } else {
            // Add reaction
            updatedReactions = [
              ...currentReactions,
              {
                emoji,
                userId: currentUserId,
                userName: user?.name || 'User',
                createdAt: new Date().toISOString(),
              },
            ];
          }

          return {
            ...msg,
            reactions: updatedReactions,
          };
        });
      });

      try {
        let serverReactions = null;
        const convId = extractId(currentConv._id || currentConv.id);

        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket reaction timed out. Falling back to HTTP.'));
            }, 3000);

            socket.emit(
              'toggle_reaction',
              { conversationId: convId, messageId: targetMsgId, emoji },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack.reactions);
                } else {
                  reject(new Error(ack?.error || 'Failed to toggle reaction via socket.'));
                }
              }
            );
          });

          try {
            serverReactions = await socketPromise;
          } catch {
            // Fallback to REST API
            const res = await toggleReactionApi(convId, targetMsgId, emoji);
            serverReactions = res?.reactions;
          }
        } else {
          // Socket disconnected, send via REST API
          const res = await toggleReactionApi(convId, targetMsgId, emoji);
          serverReactions = res?.reactions;
        }

        // Reconcile with verified server response
        if (Array.isArray(serverReactions)) {
          setMessages((prev) =>
            prev.map((m) =>
              extractId(m._id || m.id) === targetMsgId
                ? { ...m, reactions: serverReactions }
                : m
            )
          );
        }
      } catch (err) {
        console.warn('Reaction toggle failed:', err.message);
        setChatError(err.message || 'Failed to update reaction.');
        if (snapshotMessages) {
          setMessages(snapshotMessages);
        }
      }
    },
    [activeConversation, socket, isConnected, user]
  );

  // 10. Edit message with optimistic update and server confirmation
  const editMessage = useCallback(
    async (messageId, text) => {
      const currentConv = activeConversation || activeConversationRef.current;
      if (!currentConv) return { success: false, error: 'No active conversation.' };

      const targetMsgId = extractId(messageId);
      if (!targetMsgId) return { success: false, error: 'Invalid message ID.' };

      const trimmed = (text || '').trim();
      if (!trimmed) {
        return { success: false, error: 'Message cannot be empty.' };
      }
      if (trimmed.length > 2000) {
        return { success: false, error: 'Message cannot exceed 2000 characters.' };
      }

      // Check for unchanged content
      const existingMsg = messages.find((m) => extractId(m._id || m.id) === targetMsgId);
      if (existingMsg && existingMsg.text === trimmed) {
        return { success: true, unchanged: true, message: existingMsg };
      }

      const convId = extractId(currentConv._id || currentConv.id);
      const snapshotMessages = messages;
      const now = new Date().toISOString();

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) =>
          extractId(m._id || m.id) === targetMsgId
            ? { ...m, text: trimmed, isEdited: true, editedAt: now }
            : m
        )
      );

      // Optimistically update conversation lastMessage preview if this is the last message
      setConversations((prev) =>
        prev.map((c) => {
          if (extractId(c._id) === convId && c.lastMessage) {
            const isLast =
              !c.lastMessage.createdAt ||
              (existingMsg &&
                new Date(c.lastMessage.createdAt).getTime() ===
                  new Date(existingMsg.createdAt).getTime());
            if (isLast) {
              return {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  text: trimmed,
                },
              };
            }
          }
          return c;
        })
      );

      try {
        let updatedMsg = null;
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket edit timed out. Falling back to HTTP.'));
            }, 3000);

            socket.emit(
              'edit_message',
              { conversationId: convId, messageId: targetMsgId, text: trimmed },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack.message);
                } else {
                  reject(new Error(ack?.error || 'Failed to edit message via socket.'));
                }
              }
            );
          });

          try {
            updatedMsg = await socketPromise;
          } catch {
            const res = await editMessageApi(convId, targetMsgId, trimmed);
            updatedMsg = res?.message;
          }
        } else {
          const res = await editMessageApi(convId, targetMsgId, trimmed);
          updatedMsg = res?.message;
        }

        if (updatedMsg) {
          setMessages((prev) =>
            prev.map((m) =>
              extractId(m._id || m.id) === targetMsgId ? updatedMsg : m
            )
          );
          return { success: true, message: updatedMsg };
        }
        return { success: true };
      } catch (err) {
        console.warn('Edit message failed:', err.message);
        setChatError(err.message || 'Failed to edit message.');
        setMessages(snapshotMessages);
        return { success: false, error: err.message };
      }
    },
    [activeConversation, messages, socket]
  );

  // 11. Delete message with soft-delete optimistic update and server confirmation
  const deleteMessage = useCallback(
    async (messageId) => {
      const currentConv = activeConversation || activeConversationRef.current;
      if (!currentConv) return { success: false, error: 'No active conversation.' };

      const targetMsgId = extractId(messageId);
      if (!targetMsgId) return { success: false, error: 'Invalid message ID.' };

      const convId = extractId(currentConv._id || currentConv.id);
      const snapshotMessages = messages;
      const existingMsg = messages.find((m) => extractId(m._id || m.id) === targetMsgId);
      const now = new Date().toISOString();

      // Optimistic soft delete
      setMessages((prev) =>
        prev.map((m) => {
          if (extractId(m._id || m.id) === targetMsgId) {
            return {
              ...m,
              isDeleted: true,
              deletedAt: now,
              text: 'This message was deleted',
              reactions: [],
            };
          }
          if (
            m.replyToMessageId &&
            extractId(m.replyToMessageId) === targetMsgId &&
            m.replySnapshot
          ) {
            return {
              ...m,
              replySnapshot: {
                ...m.replySnapshot,
                isDeleted: true,
                text: 'This message was deleted',
                hasAttachment: false,
                attachmentType: null,
                originalName: '',
              },
            };
          }
          return m;
        })
      );

      // Optimistically update conversation lastMessage preview
      setConversations((prev) =>
        prev.map((c) => {
          if (extractId(c._id) === convId && c.lastMessage) {
            const isLast =
              !c.lastMessage.createdAt ||
              (existingMsg &&
                new Date(c.lastMessage.createdAt).getTime() ===
                  new Date(existingMsg.createdAt).getTime());
            if (isLast) {
              return {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  text: 'This message was deleted',
                },
              };
            }
          }
          return c;
        })
      );

      try {
        let deletedMsg = null;
        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket delete timed out. Falling back to HTTP.'));
            }, 3000);

            socket.emit(
              'delete_message',
              { conversationId: convId, messageId: targetMsgId },
              (ack) => {
                clearTimeout(timeout);
                if (ack && ack.success) {
                  resolve(ack.message);
                } else {
                  reject(new Error(ack?.error || 'Failed to delete message via socket.'));
                }
              }
            );
          });

          try {
            deletedMsg = await socketPromise;
          } catch {
            const res = await deleteMessageApi(convId, targetMsgId);
            deletedMsg = res?.message;
          }
        } else {
          const res = await deleteMessageApi(convId, targetMsgId);
          deletedMsg = res?.message;
        }

        if (deletedMsg) {
          setMessages((prev) =>
            prev.map((m) =>
              extractId(m._id || m.id) === targetMsgId ? deletedMsg : m
            )
          );
        }
        return { success: true };
      } catch (err) {
        console.warn('Delete message failed:', err.message);
        setChatError(err.message || 'Failed to delete message.');
        setMessages(snapshotMessages);
        return { success: false, error: err.message };
      }
    },
    [activeConversation, messages, socket]
  );

  // 12. Delete conversation from requester's inbox
  const deleteConversation = useCallback(
    async (conversationId) => {
      const targetId = extractId(conversationId);
      if (!targetId) return { success: false, error: 'Invalid conversation ID.' };

      try {
        setChatError(null);
        let res = null;

        if (socket && socket.connected) {
          const socketPromise = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Socket delete timed out. Falling back to HTTP.'));
            }, 3000);

            socket.emit('delete_conversation', { conversationId: targetId }, (ack) => {
              clearTimeout(timeout);
              if (ack && ack.success) {
                resolve(ack);
              } else {
                reject(new Error(ack?.error || 'Failed to delete conversation via socket.'));
              }
            });
          });

          try {
            res = await socketPromise;
          } catch {
            res = await deleteConversationApi(targetId);
          }
        } else {
          res = await deleteConversationApi(targetId);
        }

        // 1. Remove from local conversations list
        setConversations((prev) => prev.filter((c) => extractId(c._id) !== targetId));

        // 2. If the deleted conversation is currently active on screen:
        // Clear active conversation selection, leave socket room, clear thread & transient state
        const currentActiveId = extractId(activeConversationRef.current?._id);
        if (currentActiveId === targetId) {
          leaveConversation();
        }

        // 3. Re-sync unread badge count
        const unreadRes = await fetchUnreadChatCountApi().catch(() => null);
        if (unreadRes && typeof unreadRes.unreadCount === 'number') {
          setUnreadChatCount(unreadRes.unreadCount);
        }

        return { success: true, result: res };
      } catch (err) {
        const errorMsg = err.message || 'Failed to delete conversation.';
        setChatError(errorMsg);
        return { success: false, error: errorMsg };
      }
    },
    [socket, leaveConversation]
  );

  // 13. Real-time socket event listeners
  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Incoming message broadcast
    const handleNewMessage = (payload) => {
      if (!payload || !payload.message || !payload.conversationId) return;
      const { conversationId, message } = payload;
      const currentActive = activeConversationRef.current;

      // Update conversations list metadata (lastMessage and unread count)
      let previewText = message.text;
      if (!previewText) {
        const att = message.attachment || (message.attachments && message.attachments[0]);
        if (att) {
          if (att.resourceType === 'raw' || (att.mimeType && !att.mimeType.startsWith('image/'))) {
            previewText = `📄 ${att.originalName || 'Document'}`;
          } else {
            previewText = '📷 Image';
          }
        }
      }

      const targetConvId = extractId(conversationId);
      const currentActiveId = extractId(currentActive?._id);

      setConversations((prev) => {
        const exists = prev.some((c) => extractId(c._id) === targetConvId);
        if (exists) {
          return prev.map((c) => {
            if (extractId(c._id) === targetConvId) {
              const isCurrentlyOpen = Boolean(currentActiveId && currentActiveId === targetConvId);
              return {
                ...c,
                lastMessage: {
                  text: previewText,
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
      if (currentActiveId && currentActiveId === targetConvId) {
        setMessages((prev) => {
          const alreadyExists = prev.some((m) => extractId(m._id || m.id) === extractId(message._id || message.id));
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
        const currentUserId = extractId(user);
        const msgSenderId = extractId(message.senderId);
        if (currentUserId && msgSenderId && msgSenderId !== currentUserId) {
          markAsRead(targetConvId);
        }
      } else {
        // Increment global unread count
        const currentUserId = extractId(user);
        const msgSenderId = extractId(message.senderId);
        if (currentUserId && msgSenderId && msgSenderId !== currentUserId) {
          setUnreadChatCount((prev) => prev + 1);
        }
      }
    };

    // Typing status broadcast
    const handleTypingStatus = (payload) => {
      if (!payload || !payload.conversationId) return;
      const currentActive = activeConversationRef.current;
      if (!currentActive || extractId(currentActive._id || currentActive.id) !== extractId(payload.conversationId)) return;

      if (extractId(payload.userId) === extractId(user)) return; // Don't show typing for self

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
      const targetConvId = extractId(payload.conversationId);
      const currentActive = activeConversationRef.current;
      const currentActiveId = extractId(currentActive?._id);
      if (!currentActive || currentActiveId !== targetConvId) return;

      const { userId, readAt } = payload;
      const readUserId = extractId(userId);
      if (!readUserId) return;

      setMessages((prev) =>
        prev.map((m) => {
          const alreadyRead = (m.readBy || []).some(
            (r) => extractId(r.userId || r.user) === readUserId
          );
          if (!alreadyRead) {
            return {
              ...m,
              readBy: [...(m.readBy || []), { userId: readUserId, readAt: readAt || new Date() }],
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

    // Reconnection handling: Re-join active room and synchronize messages and pin state
    const handleReconnect = () => {
      const currentActive = activeConversationRef.current;
      if (currentActive && currentActive._id) {
        socket.emit('join_conversation', { conversationId: currentActive._id });
        fetchConversationByIdApi(currentActive._id).then((convRes) => {
          if (convRes && convRes.conversation) {
            setActiveConversation(convRes.conversation);
          }
        });
        fetchMessagesApi(currentActive._id, { limit: 50 }).then((res) => {
          if (res && Array.isArray(res.messages)) {
            setMessages(res.messages);
          }
        });
      }
      refreshConversations();
    };

    // Emoji reaction update broadcast
    const handleReactionUpdated = (payload) => {
      if (!payload || !payload.messageId || !payload.conversationId) return;
      const currentActive = activeConversationRef.current;
      if (!currentActive || extractId(currentActive._id || currentActive.id) !== extractId(payload.conversationId)) return;

      const targetMsgId = extractId(payload.messageId);
      setMessages((prev) =>
        prev.map((m) =>
          extractId(m._id || m.id) === targetMsgId
            ? { ...m, reactions: payload.reactions || [] }
            : m
        )
      );
    };

    // Real-time message edit broadcast
    const handleMessageEdited = (payload) => {
      if (!payload || !payload.message || !payload.conversationId) return;
      const { conversationId, message } = payload;
      const currentActive = activeConversationRef.current;

      if (currentActive && extractId(currentActive._id || currentActive.id) === extractId(conversationId)) {
        setMessages((prev) =>
          prev.map((m) =>
            extractId(m._id || m.id) === extractId(message._id) ? message : m
          )
        );
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (extractId(c._id) === extractId(conversationId) && c.lastMessage) {
            const isLast =
              !c.lastMessage.createdAt ||
              new Date(c.lastMessage.createdAt).getTime() ===
                new Date(message.createdAt).getTime();
            if (isLast) {
              return {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  text: message.text,
                },
              };
            }
          }
          return c;
        })
      );
    };

    // Real-time message delete broadcast
    const handleMessageDeleted = (payload) => {
      if (!payload || !payload.messageId || !payload.conversationId) return;
      const { conversationId, messageId, message } = payload;
      const currentActive = activeConversationRef.current;
      const targetMsgId = extractId(messageId);

      if (currentActive && extractId(currentActive._id || currentActive.id) === extractId(conversationId)) {
        setMessages((prev) =>
          prev.map((m) => {
            if (extractId(m._id || m.id) === targetMsgId) {
              return (
                message || {
                  ...m,
                  isDeleted: true,
                  text: 'This message was deleted',
                  reactions: [],
                  deletedAt: new Date().toISOString(),
                }
              );
            }
            if (
              m.replyToMessageId &&
              extractId(m.replyToMessageId) === targetMsgId &&
              m.replySnapshot
            ) {
              return {
                ...m,
                replySnapshot: {
                  ...m.replySnapshot,
                  isDeleted: true,
                  text: 'This message was deleted',
                  hasAttachment: false,
                  attachmentType: null,
                  originalName: '',
                },
              };
            }
            return m;
          })
        );
      }

      setConversations((prev) =>
        prev.map((c) => {
          if (extractId(c._id) === extractId(conversationId) && c.lastMessage) {
            return {
              ...c,
              lastMessage: {
                ...c.lastMessage,
                text: 'This message was deleted',
              },
            };
          }
          return c;
        })
      );
    };

    // Real-time message pinned broadcast
    const handleMessagePinned = (payload) => {
      if (!payload || !payload.conversationId || !payload.pinnedMessage) return;
      const { conversationId, pinnedMessage } = payload;
      const targetConvId = extractId(conversationId);
      const currentActive = activeConversationRef.current;

      if (currentActive && extractId(currentActive._id || currentActive.id) === targetConvId) {
        setActiveConversation((prev) => (prev ? { ...prev, pinnedMessage } : prev));
        const pinnedMsgId = extractId(pinnedMessage.messageId);
        setMessages((prev) =>
          prev.map((m) => ({
            ...m,
            isPinned: extractId(m._id || m.id) === pinnedMsgId,
          }))
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          extractId(c._id) === targetConvId ? { ...c, pinnedMessage } : c
        )
      );
    };

    // Real-time message unpinned broadcast
    const handleMessageUnpinned = (payload) => {
      if (!payload || !payload.conversationId) return;
      const { conversationId } = payload;
      const targetConvId = extractId(conversationId);
      const currentActive = activeConversationRef.current;

      if (currentActive && extractId(currentActive._id || currentActive.id) === targetConvId) {
        setActiveConversation((prev) => (prev ? { ...prev, pinnedMessage: null } : prev));
        setMessages((prev) =>
          prev.map((m) => (m.isPinned ? { ...m, isPinned: false } : m))
        );
      }

      setConversations((prev) =>
        prev.map((c) =>
          extractId(c._id) === targetConvId ? { ...c, pinnedMessage: null } : c
        )
      );
    };

    // Real-time conversation deleted from inbox broadcast
    const handleConversationDeleted = (payload) => {
      if (!payload || !payload.conversationId) return;
      const targetId = extractId(payload.conversationId);
      setConversations((prev) => prev.filter((c) => extractId(c._id) !== targetId));
      if (extractId(activeConversationRef.current?._id) === targetId) {
        leaveConversation();
      }
      fetchUnreadChatCountApi()
        .then((r) => {
          if (r && typeof r.unreadCount === 'number') setUnreadChatCount(r.unreadCount);
        })
        .catch(() => {});
    };

    socket.on('new_message', handleNewMessage);
    socket.on('typing_status', handleTypingStatus);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_reaction_updated', handleReactionUpdated);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('message_pinned', handleMessagePinned);
    socket.on('message_unpinned', handleMessageUnpinned);
    socket.on('conversation_deleted', handleConversationDeleted);
    socket.on('chat_error', handleChatError);
    socket.on('reconnect', handleReconnect);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing_status', handleTypingStatus);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_reaction_updated', handleReactionUpdated);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('message_pinned', handleMessagePinned);
      socket.off('message_unpinned', handleMessageUnpinned);
      socket.off('conversation_deleted', handleConversationDeleted);
      socket.off('chat_error', handleChatError);
      socket.off('reconnect', handleReconnect);
    };
  }, [socket, isAuthenticated, user, refreshConversations, markAsRead, leaveConversation]);

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
    toggleReaction,
    editMessage,
    deleteMessage,
    uploadChatImage: uploadChatImageApi,
    uploadChatAttachment: uploadChatAttachmentApi,
    downloadAttachment: downloadAttachmentApi,
    searchMessages,
    jumpToMessage,
    highlightedMessageId,
    setHighlightedMessageId,
    replyingTo,
    setReplyingTo,
    forwardingMessage,
    setForwardingMessage,
    forwardMessage,
    pinMessage,
    unpinMessage,
    isSharedOpen,
    setIsSharedOpen,
    sharedInitialTab,
    setSharedInitialTab,
    toggleSharedContent,
    fetchSharedContent: fetchSharedContentApi,
    deleteConversation,
    isConnected,
    otherParticipantId,
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
