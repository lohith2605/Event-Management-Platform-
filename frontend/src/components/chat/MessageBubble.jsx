import { Check, CheckCheck } from 'lucide-react';

export default function MessageBubble({ message, isOwn, otherParticipantId }) {
  if (!message) return null;

  // Format readable timestamp
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Determine read receipt status
  const isReadByRecipient = () => {
    if (!isOwn || !message.readBy || !otherParticipantId) return false;
    return message.readBy.some(
      (r) => (r.userId?._id || r.userId)?.toString() === otherParticipantId.toString()
    );
  };

  const read = isReadByRecipient();

  return (
    <div className={`flex flex-col mb-3 ${isOwn ? 'items-end' : 'items-start'}`}>
      {/* Sender name on incoming message */}
      {!isOwn && (
        <span className="text-[10px] font-bold text-[var(--color-secondary-text)] mb-1 px-1">
          {message.senderName || 'Participant'}
          {message.senderRole && (
            <span className="ml-1 text-[9px] uppercase tracking-wider opacity-75 font-semibold">
              ({message.senderRole})
            </span>
          )}
        </span>
      )}

      {/* Message bubble */}
      <div
        className={`max-w-[85%] sm:max-w-[75%] md:max-w-[70%] rounded-2xl px-4 py-2.5 shadow-xs text-xs sm:text-sm break-words [word-break:break-word] [overflow-wrap:anywhere] whitespace-pre-wrap leading-relaxed ${
          isOwn
            ? 'bg-[var(--color-primary-action)] text-white rounded-br-xs'
            : 'bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] rounded-bl-xs'
        }`}
      >
        {/* Render text strictly as plain text (never HTML) */}
        {message.text}

        {/* Timestamp and delivery receipts */}
        <div
          className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none font-medium ${
            isOwn ? 'text-white/80' : 'text-[var(--color-secondary-text)]'
          }`}
        >
          {formatTime(message.createdAt) && (
            <time dateTime={message.createdAt}>{formatTime(message.createdAt)}</time>
          )}

          {isOwn && (
            <span
              title={read ? 'Read by recipient' : 'Sent and delivered'}
              aria-label={read ? 'Read by recipient' : 'Sent and delivered'}
            >
              {read ? (
                <CheckCheck className="w-3.5 h-3.5 text-cyan-200" aria-hidden="true" />
              ) : (
                <Check className="w-3.5 h-3.5 text-white/70" aria-hidden="true" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
