import { useEffect, useRef } from 'react';
import { Loader2, AlertCircle, MessageSquare, ArrowUp } from 'lucide-react';
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

  // Auto-scroll to bottom on initial load or when new message arrives at bottom
  useEffect(() => {
    if (!loading && messages.length > prevMessagesCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages, loading]);

  // Initial scroll to bottom when finished loading
  useEffect(() => {
    if (!loading && messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [loading]);

  // Group messages by date
  const formatDateSeparator = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
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

  // Typing users list
  const typingList = Array.from(typingUsers.values());

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[var(--color-primary-bg)]/40 space-y-2 relative"
    >
      {/* Access Denied or Network Error Banner */}
      {error && (
        <div className="p-3.5 mb-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-bold text-[11px] hover:bg-red-700 transition-colors cursor-pointer shrink-0"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-[var(--color-secondary-text)] space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs font-semibold">Loading conversation history...</p>
        </div>
      ) : messages.length === 0 ? (
        /* Empty State */
        <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-[var(--color-secondary-text)]">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] mb-3 shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h4 className="font-bold text-sm text-[var(--color-main-text)]">No messages yet</h4>
          <p className="text-xs max-w-xs mt-1">
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
                onClick={onLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] shadow-xs transition-colors cursor-pointer disabled:opacity-50"
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
            const showDate =
              !prevMsg ||
              new Date(prevMsg.createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

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

      {/* Auto-scroll Anchor */}
      <div ref={bottomRef} />
    </div>
  );
}
