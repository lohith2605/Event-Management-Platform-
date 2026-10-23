import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  X,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  MessageSquare,
  CornerDownRight,
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';

/**
 * Safely renders text with matching search terms highlighted using pure React elements.
 * Completely immune to XSS injection (no dangerouslySetInnerHTML).
 */
export function SafeHighlight({ text = '', query = '' }) {
  if (!query || !text) return <span>{text}</span>;
  const trimmed = query.trim();
  if (!trimmed) return <span>{text}</span>;

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === trimmed.toLowerCase();
        return isMatch ? (
          <mark
            key={index}
            className="bg-amber-400/35 dark:bg-amber-400/25 text-[var(--color-main-text)] font-bold px-0.5 rounded-xs"
          >
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
}

export default function MessageSearchPanel({
  conversationId,
  isOpen = false,
  onClose,
  onSelectMessage,
}) {
  const { searchMessages, jumpToMessage } = useChat();

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 1,
    hasMore: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jumpingId, setJumpingId] = useState(null);
  const [jumpFeedback, setJumpFeedback] = useState('');

  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);
  const searchRequestIdRef = useRef(0);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      // Reset state when closed
      setQuery('');
      setDebouncedQuery('');
      setResults([]);
      setError(null);
      setPage(1);
      setJumpFeedback('');
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    }
  }, [isOpen]);

  // Debounce query input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1); // Reset to page 1 on new query
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  // Execute search API request
  const executeSearch = useCallback(
    async (targetQuery, targetPage = 1) => {
      if (!conversationId || !targetQuery) {
        setResults([]);
        setPagination({ page: 1, limit: 20, totalCount: 0, totalPages: 1, hasMore: false });
        setLoading(false);
        setError(null);
        return;
      }

      // Cancel previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const currentReqId = ++searchRequestIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const data = await searchMessages(
          conversationId,
          { query: targetQuery, page: targetPage, limit: 20 },
          controller.signal
        );

        // Discard stale responses if a newer search request was triggered
        if (currentReqId !== searchRequestIdRef.current) return;

        if (data && data.success) {
          setResults(Array.isArray(data.messages) ? data.messages : []);
          if (data.pagination) {
            setPagination(data.pagination);
          }
        } else {
          setResults([]);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (currentReqId !== searchRequestIdRef.current) return;
        setError(err.message || 'Failed to search messages. Please check your connection.');
        setResults([]);
      } finally {
        if (currentReqId === searchRequestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [conversationId, searchMessages]
  );

  // Trigger search when debouncedQuery or page changes
  useEffect(() => {
    if (debouncedQuery) {
      executeSearch(debouncedQuery, page);
    } else {
      setResults([]);
      setError(null);
      setLoading(false);
    }
  }, [debouncedQuery, page, executeSearch]);

  const handleClear = () => {
    setQuery('');
    setDebouncedQuery('');
    setResults([]);
    setError(null);
    setPage(1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (query) {
        handleClear();
      } else if (onClose) {
        onClose();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed && trimmed !== debouncedQuery) {
        setDebouncedQuery(trimmed);
        setPage(1);
      }
    }
  };

  const handleSelectResult = async (msg) => {
    if (!msg || !msg._id) return;
    setJumpingId(msg._id);
    setJumpFeedback('Navigating to message...');

    try {
      if (onSelectMessage) {
        onSelectMessage(msg);
      } else if (jumpToMessage) {
        const jumpRes = await jumpToMessage(msg._id, msg.createdAt);
        if (!jumpRes.success) {
          setJumpFeedback(jumpRes.error || 'Unable to locate message.');
          setTimeout(() => setJumpFeedback(''), 3000);
          return;
        }
      }
      setJumpFeedback('');
    } catch (err) {
      setJumpFeedback(err.message || 'Failed to navigate to message.');
      setTimeout(() => setJumpFeedback(''), 3000);
    } finally {
      setJumpingId(null);
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today, ${time}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
  };

  const renderRoleBadge = (role) => {
    const r = (role || 'attendee').toLowerCase();
    if (r === 'admin') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-xs text-[9px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400">
          <ShieldCheck className="w-2.5 h-2.5" />
          Admin
        </span>
      );
    }
    if (r === 'organizer') {
      return (
        <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-xs text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400">
          Organizer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded-xs text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400">
        Attendee
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div
      role="search"
      aria-label="Search conversation messages"
      className="border-b border-[var(--color-borders)] bg-[var(--color-card-bg)] shadow-xs transition-all duration-200 shrink-0 z-10"
    >
      {/* Search Input Bar */}
      <div className="p-3 sm:p-3.5 flex items-center gap-2">
        <div className="relative flex-1 flex items-center min-w-0">
          <div className="absolute left-3 pointer-events-none text-[var(--color-secondary-text)]">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary-action)]" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>

          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages in this conversation..."
            maxLength={100}
            aria-label="Search messages in conversation"
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-[var(--color-primary-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:ring-2 focus:ring-[var(--color-primary-action)] transition-all"
          />

          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] transition-colors cursor-pointer shrink-0"
            title="Close search"
            aria-label="Close message search"
          >
            Done
          </button>
        )}
      </div>

      {/* Temporary Jump Feedback / Loading Toast */}
      {jumpFeedback && (
        <div className="px-3.5 py-1.5 bg-amber-500/10 border-t border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-semibold flex items-center gap-1.5 animate-fade-in">
          <Loader2 className="w-3 h-3 animate-spin shrink-0" />
          <span>{jumpFeedback}</span>
        </div>
      )}

      {/* Results / Error / No Results Dropdown Container */}
      {debouncedQuery && (
        <div className="border-t border-[var(--color-borders)] bg-[var(--color-primary-bg)]/40 max-h-72 sm:max-h-80 overflow-y-auto">
          {/* Error Banner with Retry */}
          {error ? (
            <div className="p-4 flex flex-col items-center justify-center text-center space-y-2">
              <div className="flex items-center gap-2 text-red-500 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={() => executeSearch(debouncedQuery, page)}
                className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loading && results.length === 0 ? (
            /* Loading State */
            <div className="py-8 flex flex-col items-center justify-center text-[var(--color-secondary-text)] space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-action)]" />
              <p className="text-xs font-semibold">Searching message history...</p>
            </div>
          ) : results.length === 0 ? (
            /* No Results State */
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center text-[var(--color-secondary-text)] space-y-1.5">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)]">
                <Search className="w-4 h-4" />
              </div>
              <p className="text-xs font-bold text-[var(--color-main-text)]">
                No matching messages
              </p>
              <p className="text-[11px] max-w-xs">
                No messages found matching &ldquo;<span className="font-semibold">{debouncedQuery}</span>&rdquo; in this conversation.
              </p>
            </div>
          ) : (
            /* Results List */
            <div className="divide-y divide-[var(--color-borders)]/50">
              {/* Results Summary Header & Pagination Controls */}
              <div className="px-3.5 py-2 bg-[var(--color-card-bg)] flex items-center justify-between text-[11px] text-[var(--color-secondary-text)] sticky top-0 z-10 border-b border-[var(--color-borders)]/50">
                <span className="font-semibold">
                  Found <strong className="text-[var(--color-main-text)]">{pagination.totalCount}</strong>{' '}
                  match{pagination.totalCount === 1 ? '' : 'es'}
                </span>

                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px]">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page <= 1 || loading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="p-1 rounded-md border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] disabled:opacity-40 transition-colors cursor-pointer"
                      title="Previous page"
                      aria-label="Previous page of results"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={page >= pagination.totalPages || loading}
                      onClick={() => setPage((p) => p + 1)}
                      className="p-1 rounded-md border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] disabled:opacity-40 transition-colors cursor-pointer"
                      title="Next page"
                      aria-label="Next page of results"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Match Items */}
              {results.map((msg) => {
                const isSelected = jumpingId === msg._id;
                return (
                  <button
                    key={msg._id}
                    type="button"
                    onClick={() => handleSelectResult(msg)}
                    disabled={isSelected}
                    className="w-full text-left p-3 hover:bg-[var(--color-secondary-bg)]/80 focus-visible:bg-[var(--color-secondary-bg)] focus-visible:outline-hidden transition-colors cursor-pointer group flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-xs font-bold text-[var(--color-main-text)] truncate max-w-[150px]">
                          {msg.senderName || 'Participant'}
                        </span>
                        {renderRoleBadge(msg.senderRole)}
                        <span className="text-[10px] text-[var(--color-secondary-text)]">
                          &bull; {formatTimestamp(msg.createdAt)}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--color-main-text)] line-clamp-2 leading-relaxed">
                        <SafeHighlight text={msg.text} query={debouncedQuery} />
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center pt-1 text-[var(--color-primary-action)] opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold mr-1 hidden sm:inline">Jump</span>
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
