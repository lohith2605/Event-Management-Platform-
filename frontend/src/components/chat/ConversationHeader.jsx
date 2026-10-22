import { ArrowLeft, X, ShieldCheck, Maximize2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ConversationHeader({
  conversation,
  onBack,
  onClose,
  onExpand,
  isConnected = true,
  showBackButton = true,
}) {
  const { user } = useAuth();
  if (!conversation) return null;

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
          {/* Real-time Connection Indicator */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[var(--color-card-bg)] ${
              isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}
            title={isConnected ? 'Connected in real time' : 'Reconnecting...'}
          />
        </div>

        {/* Participant & Event details */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-sm text-[var(--color-main-text)] truncate max-w-[140px] xs:max-w-[180px] sm:max-w-[260px] md:max-w-[340px]">
              {otherParticipant?.name || 'Chat'}
            </h3>
            {roleBadge()}
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

      {/* Header Actions: Expand to Full Page & Close */}
      <div className="flex items-center gap-1.5 shrink-0">
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
  );
}
