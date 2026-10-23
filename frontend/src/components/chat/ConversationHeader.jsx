import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, X, ShieldCheck, Maximize2, Search, Files, MoreVertical, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { getOtherParticipantId } from '../../utils/chatUtils';
import PinnedMessageBanner from './PinnedMessageBanner';
import DeleteConversationModal from './DeleteConversationModal';

export default function ConversationHeader({
  conversation,
  onBack,
  onClose,
  onExpand,
  onToggleSearch,
  isSearchOpen = false,
  onToggleShared,
  isSharedOpen: propIsSharedOpen,
  isConnected,
  isOnline: propIsOnline,
  showBackButton = true,
}) {
  const { user } = useAuth();
  const chatContext = useChat();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [prevConvId, setPrevConvId] = useState(conversation?._id);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const menuRef = useRef(null);
  const menuButtonRef = useRef(null);

  // Sync menu state when conversation changes
  if (conversation?._id !== prevConvId) {
    setPrevConvId(conversation?._id);
    setIsMenuOpen(false);
  }

  // Click outside and keyboard handling (Escape to close, ArrowDown/Up for focus navigation)
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const items = menuRef.current?.querySelectorAll('button:not([disabled])');
        if (!items || items.length === 0) return;
        const itemsArr = Array.from(items);
        const currentIndex = itemsArr.indexOf(document.activeElement);
        if (event.key === 'ArrowDown') {
          const nextIndex = currentIndex < itemsArr.length - 1 ? currentIndex + 1 : 0;
          itemsArr[nextIndex]?.focus();
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemsArr.length - 1;
          itemsArr[prevIndex]?.focus();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  if (!conversation) return null;

  const isSharedActive =
    propIsSharedOpen !== undefined ? propIsSharedOpen : Boolean(chatContext?.isSharedOpen);
  const handleToggleShared =
    onToggleShared || (chatContext?.toggleSharedContent ? () => chatContext.toggleSharedContent() : null);

  const hasSearch = typeof onToggleSearch === 'function';
  const hasShared = typeof handleToggleShared === 'function';

  const handleSelectSearch = () => {
    setIsMenuOpen(false);
    if (hasSearch) {
      onToggleSearch();
    }
  };

  const handleSelectShared = () => {
    setIsMenuOpen(false);
    if (hasShared) {
      handleToggleShared();
    }
  };

  const handleOpenDeleteModal = () => {
    setIsMenuOpen(false);
    setDeleteError(null);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (isDeleting || !conversation?._id) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const convId = conversation._id || conversation.id;
      const res = await chatContext?.deleteConversation?.(convId);
      if (res && res.error) {
        setDeleteError(res.error);
      } else {
        setIsDeleteModalOpen(false);
        if (typeof onBack === 'function') {
          onBack();
        }
      }
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete conversation.');
    } finally {
      setIsDeleting(false);
    }
  };

  const isOrganizer = user?.role === 'organizer';
  const isAdmin = user?.role === 'admin';

  // Helper to extract clean participant object safely
  const getParticipant = (raw, defaultRole, defaultName) => {
    if (!raw) return { name: defaultName, role: defaultRole };
    if (typeof raw === 'string') {
      return { name: defaultName, role: defaultRole, _id: raw };
    }
    return {
      name: raw.name || defaultName,
      role: raw.role || defaultRole,
      _id: raw._id || raw.id,
    };
  };

  // Determine other participant
  let otherParticipant = null;
  let conversationTypeLabel = '';

  if (conversation.type === 'admin_organizer') {
    conversationTypeLabel = 'Admin Support';
    if (isAdmin) {
      otherParticipant = getParticipant(conversation.organizerId, 'organizer', 'Event Organizer');
    } else {
      otherParticipant = { name: 'Platform Admin', role: 'admin' };
    }
  } else {
    conversationTypeLabel = 'Attendee Inquiry';
    if (isOrganizer) {
      otherParticipant = getParticipant(conversation.attendeeId, 'attendee', 'Attendee');
    } else {
      otherParticipant = getParticipant(conversation.organizerId, 'organizer', 'Event Organizer');
    }
  }

  const rawEvent = conversation.eventId;
  const eventTitle = (typeof rawEvent === 'object' && rawEvent?.title) ? rawEvent.title : 'Event Chat';
  const initial = (otherParticipant?.name && otherParticipant.name[0]) ? otherParticipant.name[0].toUpperCase() : 'U';

  const fallbackOtherId = getOtherParticipantId(conversation, user);
  const targetUserId = otherParticipant?._id || fallbackOtherId;
  const isParticipantOnline =
    typeof propIsOnline === 'boolean'
      ? propIsOnline
      : (typeof chatContext?.isUserOnline === 'function' && targetUserId
          ? chatContext.isUserOnline(targetUserId)
          : false);

  const roleBadge = () => {
    const role = (otherParticipant?.role || 'user').toLowerCase();
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
          <ShieldCheck className="w-2.5 h-2.5" />
          Admin
        </span>
      );
    }
    if (role === 'organizer') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
          Organizer
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
        Attendee
      </span>
    );
  };

  return (
    <div className="flex flex-col shrink-0">
      <div className="p-3.5 sm:p-4 border-b border-[var(--color-borders)] bg-[var(--color-card-bg)] flex items-center justify-between gap-3 shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center p-2 rounded-xl border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer shrink-0"
            title="Back to inbox"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Participant Avatar / Initial */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/25 text-[var(--color-primary-action)] font-black text-sm flex items-center justify-center">
            {initial}
          </div>
          {/* Real-time Online/Offline Presence Indicator */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-card-bg)] transition-colors duration-300 ${
              isParticipantOnline ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            title={isParticipantOnline ? 'Online' : 'Offline'}
            aria-label={`${otherParticipant?.name || 'Participant'} is ${isParticipantOnline ? 'online' : 'offline'}`}
          />
        </div>

        {/* Participant & Event details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-sm text-[var(--color-main-text)] truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-[340px]">
              {otherParticipant?.name || 'Chat'}
            </h3>
            {roleBadge()}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                isParticipantOnline
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
              }`}
              title={isParticipantOnline ? 'Online' : 'Offline'}
              aria-label={`${otherParticipant?.name || 'Participant'} is ${isParticipantOnline ? 'online' : 'offline'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isParticipantOnline ? 'bg-emerald-500' : 'bg-red-500'
                }`}
              />
              {isParticipantOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-secondary-text)] truncate">
            <span className="font-bold text-[var(--color-primary-action)] truncate max-w-[140px] sm:max-w-[220px]">
              {eventTitle}
            </span>
            <span>&bull;</span>
            <span className="text-[10px] opacity-75 shrink-0">{conversationTypeLabel}</span>
          </div>
        </div>
      </div>

      {/* Header Actions: Options Overflow Menu, Expand to Full Page & Close */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Three-Dot Vertical Overflow Options Menu */}
        <div className="relative shrink-0">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`min-w-[36px] min-h-[36px] flex items-center justify-center p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 border ${
              isMenuOpen || isSearchOpen || isSharedActive
                ? 'bg-[var(--color-secondary-bg)] text-[var(--color-primary-action)] border-[var(--color-borders)] shadow-xs'
                : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border-[var(--color-borders)]/60'
            } focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)]`}
            title="Conversation options"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            id="conversation-options-button"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {isMenuOpen && (
            <div
              ref={menuRef}
              id="conversation-options-menu"
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="conversation-options-button"
              className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 text-[var(--color-main-text)]"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleSelectSearch}
                disabled={!hasSearch}
                aria-disabled={!hasSearch}
                title={
                  hasSearch
                    ? isSearchOpen
                      ? 'Close search'
                      : 'Search messages in this conversation'
                    : 'Search messages is not available in this view'
                }
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  !hasSearch
                    ? 'opacity-40 cursor-not-allowed text-[var(--color-secondary-text)]'
                    : isSearchOpen
                    ? 'bg-[var(--color-primary-action)]/10 text-[var(--color-primary-action)] font-bold'
                    : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:bg-[var(--color-secondary-bg)]'
                } focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)]`}
              >
                <Search
                  className={`w-4 h-4 shrink-0 ${
                    isSearchOpen
                      ? 'text-[var(--color-primary-action)]'
                      : 'text-[var(--color-secondary-text)]'
                  }`}
                />
                <span className="flex-1 truncate">Search messages</span>
                {isSearchOpen && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-action)] shrink-0" />
                )}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={handleSelectShared}
                disabled={!hasShared}
                aria-disabled={!hasShared}
                title={
                  hasShared
                    ? isSharedActive
                      ? 'Close shared content'
                      : 'Shared media, documents, and links'
                    : 'Shared storage is not available in this view'
                }
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                  !hasShared
                    ? 'opacity-40 cursor-not-allowed text-[var(--color-secondary-text)]'
                    : isSharedActive
                    ? 'bg-[var(--color-primary-action)]/10 text-[var(--color-primary-action)] font-bold'
                    : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:bg-[var(--color-secondary-bg)]'
                } focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)]`}
              >
                <Files
                  className={`w-4 h-4 shrink-0 ${
                    isSharedActive
                      ? 'text-[var(--color-primary-action)]'
                      : 'text-[var(--color-secondary-text)]'
                  }`}
                />
                <span className="flex-1 truncate">Shared media &amp; files</span>
                {isSharedActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary-action)] shrink-0" />
                )}
              </button>

              {/* Divider */}
              <div className="my-1 border-t border-[var(--color-borders)]/60" />

              {/* Delete chat action */}
              <button
                type="button"
                role="menuitem"
                onClick={handleOpenDeleteModal}
                title="Delete this chat from your inbox"
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 focus-visible:bg-rose-500/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
              >
                <Trash2 className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="flex-1 truncate">Delete chat</span>
              </button>
            </div>
          )}
        </div>

        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            className="min-h-[36px] flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)]/60 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer shrink-0"
            title="Open full chat"
            aria-label="Open full chat"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open full chat</span>
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-transparent hover:border-[var(--color-borders)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer shrink-0"
            title="Close chat"
            aria-label="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
    <PinnedMessageBanner conversation={conversation} />
    <DeleteConversationModal
      isOpen={isDeleteModalOpen}
      onClose={() => {
        if (!isDeleting) {
          setIsDeleteModalOpen(false);
          setDeleteError(null);
        }
      }}
      onConfirm={handleConfirmDelete}
      participantName={otherParticipant?.name || 'the other participant'}
      eventTitle={eventTitle !== 'Event Chat' ? eventTitle : ''}
      loading={isDeleting}
      error={deleteError}
    />
  </div>
);
}
