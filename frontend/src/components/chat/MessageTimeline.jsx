import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle, MessageSquare, ArrowUp, ArrowDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { useAuth } from '../../context/AuthContext';

export default function MessageTimeline({
  messages = [],
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  typingUsers = new Map(),
  error = null,
  onRetry,
  otherParticipantId,
}) {
  const { user } = useAuth();
  const bottomRef = useRef(null);
  const containerRef = useRef(null);
  const prevMessagesCountRef = useRef(messages.length);
  const prevFirstMsgIdRef = useRef(messages[0]?._id);
  const prevLastMsgIdRef = useRef(messages[messages.length - 1]?._id);
  const scrollSnapshotRef = useRef(null);

  // Floating "New messages below" indicator state
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const isNearBottomRef = useRef(true);

  // Monitor scroll position
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    isNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowScrollBottom(false);
    }
  }, []);

  // Pre-fetch scroll snapshot before loading older messages
  const handleLoadOlder = useCallback(() => {
    const el = containerRef.current;
    if (el) {
      scrollSnapshotRef.current = {
        scrollHeight: el.scrollHeight,
        scrollTop: el.scrollTop,
      };
    }
    if (onLoadMore) {
      onLoadMore();
    }
  }, [onLoadMore]);

  // Handle message changes: prepend (older) vs append (new)
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || loading) return;

    const currentFirstId = messages[0]?._id;
    const currentLastId = messages[messages.length - 1]?._id;
    const countIncreased = messages.length > prevMessagesCountRef.current;

    // Case 1: Older messages were prepended at top
    if (countIncreased && currentFirstId !== prevFirstMsgIdRef.current && currentLastId === prevLastMsgIdRef.current) {
      if (scrollSnapshotRef.current) {
        const heightDifference = el.scrollHeight - scrollSnapshotRef.current.scrollHeight;
        el.scrollTop = scrollSnapshotRef.current.scrollTop + heightDifference;
        scrollSnapshotRef.current = null;
      }
    }
    // Case 2: New message was appended at bottom
    else if (currentLastId !== prevLastMsgIdRef.current && countIncreased) {
      const lastMsg = messages[messages.length - 1];
      const isOwnMessage = (lastMsg?.senderId?._id || lastMsg?.senderId)?.toString() === user?._id?.toString();

      if (isOwnMessage || isNearBottomRef.current) {
        // User sent the message or is already at bottom: scroll smoothly
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        setShowScrollBottom(false);
      } else {
        // User is reading earlier history: show unobtrusive pill
        setShowScrollBottom(true);
      }
    }

    prevMessagesCountRef.current = messages.length;
    prevFirstMsgIdRef.current = currentFirstId;
    prevLastMsgIdRef.current = currentLastId;
  }, [messages, loading, user?._id]);

  // Initial scroll to bottom when conversation finishes initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
    }
  }, [loading]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBottom(false);
    isNearBottomRef.current = true;
  };

  // Safe date group separator
  const formatDateSeparator = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Safe check for day boundary between consecutive messages
  const isDifferentDay = (d1, d2) => {
    if (!d1 || !d2) return true;
    const t1 = new Date(d1).getTime();
    const t2 = new Date(d2).getTime();
    if (isNaN(t1) || isNaN(t2)) return false;
    return new Date(d1).toDateString() !== new Date(d2).toDateString();
  };

  // Typing users list
  const typingList = Array.from(typingUsers.values());

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Message Timeline"
      className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 bg-[var(--color-primary-bg)]/30 space-y-2 relative"
    >
      {/* Access Denied or Network Error Banner */}
      {error && (
        <div className="p-3.5 mb-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2 animate-fade-in shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold truncate">{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-400 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-[var(--color-secondary-text)] space-y-3 my-auto">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs font-semibold">Loading conversation history...</p>
        </div>
      ) : messages.length === 0 ? (
        /* Empty State */
        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-[var(--color-secondary-text)] my-auto">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] mb-3 shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-[var(--color-main-text)]">No messages yet</h4>
          <p className="text-xs max-w-xs mt-1 leading-relaxed">
            Send a message to start this private conversation. Messages are delivered in real time.
          </p>
        </div>
      ) : (
        <>
          {/* Pagination: Load Older Messages */}
          {hasMore && (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                onClick={handleLoadOlder}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="w-3.5 h-3.5" />
                )}
                <span>Load older messages</span>
              </button>
            </div>
          )}

          {/* Timeline Messages */}
          {messages.map((msg, index) => {
            const isOwn = (msg.senderId?._id || msg.senderId)?.toString() === user?._id?.toString();
            const prevMsg = messages[index - 1];
            const showDate = !prevMsg || isDifferentDay(prevMsg.createdAt, msg.createdAt);

            return (
              <div key={msg._id || `msg_${index}`}>
                {showDate && (
                  <div className="flex items-center justify-center my-3">
                    <span className="px-3 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] shadow-2xs">
                      {formatDateSeparator(msg.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  otherParticipantId={otherParticipantId}
                />
              </div>
            );
          })}
        </>
      )}

      {/* Typing Indicators */}
      {typingList.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-secondary-text)] italic py-1 px-2 animate-fade-in">
          <div className="flex gap-1 items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-action)] animate-bounce" />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-action)] animate-bounce"
              style={{ animationDelay: '0.15s' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-action)] animate-bounce"
              style={{ animationDelay: '0.3s' }}
            />
          </div>
          <span className="font-semibold text-[11px]">
            {typingList.map((t) => t.userName).join(', ')}{' '}
            {typingList.length === 1 ? 'is' : 'are'} typing...
          </span>
        </div>
      )}

      {/* Floating "New messages below" Button */}
      {showScrollBottom && (
        <div className="sticky bottom-2 flex justify-center z-20 pointer-events-none">
          <button
            type="button"
            onClick={scrollToBottom}
            className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--color-primary-action)] text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all cursor-pointer animate-bounce"
            title="Scroll to latest messages"
            aria-label="Scroll to latest messages"
          >
            <span>New messages</span>
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Auto-scroll Anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
