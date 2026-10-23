import { useState, useMemo } from 'react';
import { Search, MessageSquare, X, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getOtherParticipantId } from '../../utils/chatUtils';
import DeleteConversationModal from './DeleteConversationModal';

// Helper to safely extract participant name even if unpopulated
const getParticipantName = (participant, fallback) => {
  if (!participant) return fallback;
  if (typeof participant === 'string') return fallback;
  return participant.name && participant.name.trim() ? participant.name.trim() : fallback;
};

// Safe relative timestamp formatter
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function ConversationList({
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  loading = false,
}) {
  const { user } = useAuth();
  const chatContext = useChat();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'admin_organizer' | 'attendee_organizer'
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const isOrganizer = user?.role === 'organizer';
  const isAdmin = user?.role === 'admin';

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      // Type filter
      if (typeFilter !== 'all' && c.type !== typeFilter) {
        return false;
      }

      // Unread only filter
      if (unreadOnly && (!c.unreadCount || c.unreadCount <= 0)) {
        return false;
      }

      // Search query filter (matches event title, participant names, and last message snippet)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const eventTitle = (c.eventId?.title || '').toLowerCase();
        const organizerName = getParticipantName(c.organizerId, '').toLowerCase();
        const attendeeName = getParticipantName(c.attendeeId, '').toLowerCase();
        const lastMsgText = (c.lastMessage?.text || '').toLowerCase();

        return (
          eventTitle.includes(q) ||
          organizerName.includes(q) ||
          attendeeName.includes(q) ||
          lastMsgText.includes(q)
        );
      }

      return true;
    });
  }, [conversations, typeFilter, unreadOnly, searchQuery]);

  const handleConfirmDelete = async () => {
    if (isDeleting || !convToDelete?._id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const convId = convToDelete._id || convToDelete.id;
      const res = await chatContext?.deleteConversation?.(convId);
      if (res && res.error) {
        setDeleteError(res.error);
      } else {
        setConvToDelete(null);
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete conversation.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-card-bg)]">
      {/* Search & Filters */}
      <div className="p-3.5 border-b border-[var(--color-borders)] space-y-2.5 shrink-0">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-secondary-text)] pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full pl-8 pr-8 py-1.5 rounded-xl bg-[var(--color-primary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:border-[var(--color-primary-action)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)]/20 transition-all font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
              title="Clear search"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {isOrganizer && (
            <>
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] ${
                  typeFilter === 'all'
                    ? 'bg-[var(--color-primary-action)] text-white shadow-2xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('admin_organizer')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] ${
                  typeFilter === 'admin_organizer'
                    ? 'bg-[var(--color-primary-action)] text-white shadow-2xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                Admin Support
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('attendee_organizer')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] ${
                  typeFilter === 'attendee_organizer'
                    ? 'bg-[var(--color-primary-action)] text-white shadow-2xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                Attendee Inquiries
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setUnreadOnly((prev) => !prev)}
            aria-pressed={unreadOnly}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ml-auto flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] ${
              unreadOnly
                ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
            }`}
          >
            <span>Unread</span>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div
        role="region"
        aria-label="Conversation Inbox"
        className="flex-1 overflow-y-auto divide-y divide-[var(--color-borders)]/50"
      >
        {loading ? (
          <div className="p-4 space-y-3" role="status" aria-label="Loading conversations">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center gap-3 animate-pulse p-2 rounded-xl">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-secondary-bg)] shrink-0" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="h-3 bg-[var(--color-secondary-bg)] rounded-md w-3/4" />
                  <div className="h-2.5 bg-[var(--color-secondary-bg)] rounded-md w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-secondary-text)] space-y-2 my-auto">
            <MessageSquare className="w-8 h-8 mx-auto opacity-35 mb-2" />
            <p className="text-xs font-bold text-[var(--color-main-text)]">
              {searchQuery.trim()
                ? 'No matching conversations'
                : unreadOnly
                ? 'No unread conversations'
                : 'No conversations found'}
            </p>
            <p className="text-[11px] max-w-xs mx-auto leading-relaxed">
              {searchQuery.trim() ? (
                <>
                  No conversations matched &ldquo;{searchQuery.trim()}&rdquo;.
                </>
              ) : unreadOnly ? (
                'You have read all your incoming messages.'
              ) : (
                'Conversations with attendees or event organizers will appear here.'
              )}
            </p>
            {searchQuery.trim() && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/50 border border-[var(--color-borders)] text-xs font-bold text-[var(--color-main-text)] transition-colors cursor-pointer"
                >
                  Clear search
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c._id === activeConversationId;
            const event = c.eventId || {};

            // Determine other participant name with safe fallback
            let otherParticipantName = 'Participant';
            if (c.type === 'admin_organizer') {
              otherParticipantName = isAdmin
                ? getParticipantName(c.organizerId, 'Event Organizer')
                : 'Platform Admin';
            } else {
              otherParticipantName = isOrganizer
                ? getParticipantName(c.attendeeId, 'Attendee')
                : getParticipantName(c.organizerId, 'Event Organizer');
            }

            const unread = typeof c.unreadCount === 'number' ? c.unreadCount : 0;
            const lastMsg = c.lastMessage;
            const hasLastMsgText = lastMsg && typeof lastMsg.text === 'string' && lastMsg.text.trim();
            const timeStr = lastMsg?.createdAt
              ? formatRelativeTime(lastMsg.createdAt)
              : formatRelativeTime(c.updatedAt);

            const otherParticipantId = getOtherParticipantId(c, user);
            const isOtherOnline =
              typeof chatContext?.isUserOnline === 'function' && otherParticipantId
                ? chatContext.isUserOnline(otherParticipantId)
                : false;

            return (
              <div
                key={c._id}
                className={`relative group transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary-action)]/10 border-l-4 border-[var(--color-primary-action)]'
                    : 'hover:bg-[var(--color-secondary-bg)]/60'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectConversation(c)}
                  aria-selected={isActive}
                  className="w-full text-left p-3.5 flex items-start gap-3 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary-action)]"
                >
                  {/* Avatar / Initial with Real-time Online/Offline Presence Indicator */}
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] font-black text-sm flex items-center justify-center shrink-0">
                      {otherParticipantName ? otherParticipantName[0].toUpperCase() : 'U'}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--color-card-bg)] transition-colors duration-300 ${
                        isOtherOnline ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                      title={isOtherOnline ? 'Online' : 'Offline'}
                      aria-label={`${otherParticipantName} is ${isOtherOnline ? 'online' : 'offline'}`}
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-1 pr-6 sm:pr-7">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-xs truncate ${
                          unread > 0
                            ? 'text-[var(--color-main-text)] font-extrabold'
                            : 'text-[var(--color-main-text)] font-bold'
                        }`}
                      >
                        {otherParticipantName}
                      </span>
                      {timeStr && (
                        <span className="text-[10px] text-[var(--color-secondary-text)] shrink-0 font-medium">
                          {timeStr}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-[var(--color-primary-action)] font-semibold truncate">
                      {event.title || 'Event Chat'}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={`text-xs truncate ${
                          unread > 0
                            ? 'text-[var(--color-main-text)] font-semibold'
                            : 'text-[var(--color-secondary-text)]'
                        }`}
                      >
                        {hasLastMsgText ? (
                          <>
                            <span className="opacity-75">
                              {lastMsg.senderName ? `${lastMsg.senderName.split(' ')[0]}: ` : ''}
                            </span>
                            <span>{lastMsg.text}</span>
                          </>
                        ) : (
                          <span className="italic opacity-60">No messages yet</span>
                        )}
                      </p>

                      {/* Unread badge */}
                      {unread > 0 && (
                        <span
                          aria-label={`${unread} unread message${unread > 1 ? 's' : ''}`}
                          className="min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary-action)] text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs animate-scale-in"
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {/* Quick Delete Action Button on hover/focus */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setConvToDelete(c);
                  }}
                  aria-label={`Delete chat with ${otherParticipantName}`}
                  title="Delete chat from inbox"
                  className="absolute right-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1.5 rounded-lg text-[var(--color-secondary-text)] hover:text-rose-500 hover:bg-rose-500/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 transition-all cursor-pointer z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConversationModal
        isOpen={Boolean(convToDelete)}
        onClose={() => {
          if (!isDeleting) {
            setConvToDelete(null);
            setDeleteError(null);
          }
        }}
        onConfirm={handleConfirmDelete}
        participantName={
          convToDelete
            ? convToDelete.type === 'admin_organizer'
              ? isAdmin
                ? getParticipantName(convToDelete.organizerId, 'Event Organizer')
                : 'Platform Admin'
              : isOrganizer
              ? getParticipantName(convToDelete.attendeeId, 'Attendee')
              : getParticipantName(convToDelete.organizerId, 'Event Organizer')
            : 'the other participant'
        }
        eventTitle={convToDelete?.eventId?.title || ''}
        loading={isDeleting}
        error={deleteError}
      />
    </div>
  );
}
