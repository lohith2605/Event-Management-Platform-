import { ArrowLeft, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function ConversationHeader({
  conversation,
  onBack,
  onClose,
  isConnected = true,
  showBackButton = true,
}) {
  const { user } = useAuth();
  if (!conversation) return null;

  const event = conversation.eventId || {};
  const isOrganizer = user?.role === 'organizer';
  const isAdmin = user?.role === 'admin';

  // Determine other participant
  let otherParticipant = null;
  let conversationTypeLabel = '';

  if (conversation.type === 'admin_organizer') {
    conversationTypeLabel = 'Admin Support';
    if (isAdmin) {
      otherParticipant = conversation.organizerId || { name: 'Event Organizer', role: 'organizer' };
    } else {
      otherParticipant = { name: 'Platform Admin', role: 'admin' };
    }
  } else {
    conversationTypeLabel = 'Attendee Inquiry';
    if (isOrganizer) {
      otherParticipant = conversation.attendeeId || { name: 'Attendee', role: 'attendee' };
    } else {
      otherParticipant = conversation.organizerId || { name: 'Event Organizer', role: 'organizer' };
    }
  }

  const roleBadge = () => {
    const role = otherParticipant?.role || 'user';
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
      <div className="flex items-center gap-3 min-w-0">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-xl border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer shrink-0"
            title="Back to inbox"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Participant Avatar / Initial */}
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/25 text-[var(--color-primary-action)] font-black text-sm flex items-center justify-center">
            {otherParticipant?.name ? otherParticipant.name[0].toUpperCase() : 'U'}
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
            <h3 className="font-extrabold text-sm text-[var(--color-main-text)] truncate max-w-[160px] sm:max-w-[220px]">
              {otherParticipant?.name || 'Chat'}
            </h3>
            {roleBadge()}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-secondary-text)] truncate">
            <span className="font-bold text-[var(--color-primary-action)]">
              {event?.title || 'Event Chat'}
            </span>
            <span>&bull;</span>
            <span className="text-[10px] opacity-75">{conversationTypeLabel}</span>
          </div>
        </div>
      </div>

      {/* Close Action */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-transparent hover:border-[var(--color-borders)] transition-colors cursor-pointer shrink-0"
          title="Close chat"
          aria-label="Close chat"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
