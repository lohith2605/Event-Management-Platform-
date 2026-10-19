import { useState, useMemo } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ConversationList({
  conversations = [],
  activeConversationId = null,
  onSelectConversation,
  loading = false,
}) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'admin_organizer' | 'attendee_organizer'
  const [unreadOnly, setUnreadOnly] = useState(false);

  const isOrganizer = user?.role === 'organizer';
  const isAdmin = user?.role === 'admin';

  // Format relative timestamp
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
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

      // Search query filter (matches event title, participant names)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const eventTitle = (c.eventId?.title || '').toLowerCase();
        const organizerName = (c.organizerId?.name || '').toLowerCase();
        const attendeeName = (c.attendeeId?.name || '').toLowerCase();
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

  return (
    <div className="flex flex-col h-full bg-[var(--color-card-bg)] border-r border-[var(--color-borders)]">
      {/* Search & Filters */}
      <div className="p-3.5 border-b border-[var(--color-borders)] space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-secondary-text)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[var(--color-primary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:border-[var(--color-primary-action)] transition-all"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {isOrganizer && (
            <>
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  typeFilter === 'all'
                    ? 'bg-[var(--color-primary-action)] text-white'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('admin_organizer')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  typeFilter === 'admin_organizer'
                    ? 'bg-[var(--color-primary-action)] text-white'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                Admin Support
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('attendee_organizer')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${
                  typeFilter === 'attendee_organizer'
                    ? 'bg-[var(--color-primary-action)] text-white'
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
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ml-auto flex items-center gap-1 ${
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
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-borders)]/50">
        {loading ? (
          <div className="p-8 text-center text-xs text-[var(--color-secondary-text)]">
            Loading conversations...
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-secondary-text)] space-y-1">
            <MessageSquare className="w-8 h-8 mx-auto opacity-40 mb-2" />
            <p className="text-xs font-bold text-[var(--color-main-text)]">No conversations found</p>
            <p className="text-[11px]">
              {unreadOnly
                ? 'No unread messages.'
                : 'Conversations with attendees or event organizers will appear here.'}
            </p>
          </div>
        ) : (
          filteredConversations.map((c) => {
            const isActive = c._id === activeConversationId;
            const event = c.eventId || {};

            // Determine other participant
            let otherParticipant = null;
            if (c.type === 'admin_organizer') {
              otherParticipant = isAdmin
                ? c.organizerId || { name: 'Organizer' }
                : { name: 'Platform Admin' };
            } else {
              otherParticipant = isOrganizer
                ? c.attendeeId || { name: 'Attendee' }
                : c.organizerId || { name: 'Organizer' };
            }

            const unread = c.unreadCount || 0;
            const lastMsg = c.lastMessage;
            const timeStr = lastMsg?.createdAt
              ? formatRelativeTime(lastMsg.createdAt)
              : formatRelativeTime(c.updatedAt);

            return (
              <button
                key={c._id}
                type="button"
                onClick={() => onSelectConversation(c)}
                className={`w-full text-left p-3.5 transition-colors flex items-start gap-3 cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-primary-action)]/10 border-l-4 border-[var(--color-primary-action)]'
                    : 'hover:bg-[var(--color-secondary-bg)]/60'
                }`}
              >
                {/* Avatar / Initial */}
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] font-black text-sm flex items-center justify-center shrink-0">
                  {otherParticipant.name ? otherParticipant.name[0].toUpperCase() : 'U'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs font-bold truncate ${
                        unread > 0
                          ? 'text-[var(--color-main-text)] font-extrabold'
                          : 'text-[var(--color-main-text)]'
                      }`}
                    >
                      {otherParticipant.name}
                    </span>
                    <span className="text-[10px] text-[var(--color-secondary-text)] shrink-0 font-medium">
                      {timeStr}
                    </span>
                  </div>

                  <div className="text-[11px] text-[var(--color-primary-action)] font-semibold truncate">
                    {event.title || 'Event Chat'}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-xs truncate ${
                        unread > 0
                          ? 'text-[var(--color-main-text)] font-bold'
                          : 'text-[var(--color-secondary-text)]'
                      }`}
                    >
                      {lastMsg ? (
                        <>
                          <span className="opacity-75">{lastMsg.senderName?.split(' ')[0]}: </span>
                          <span>{lastMsg.text}</span>
                        </>
                      ) : (
                        <span className="italic opacity-60">No messages yet</span>
                      )}
                    </p>

                    {/* Unread badge */}
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[var(--color-primary-action)] text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs animate-scale-in">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
