import { useState } from 'react';
import { Pin, PinOff, Loader2, ArrowRight } from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { extractId } from '../../utils/chatUtils';

export default function PinnedMessageBanner({ conversation }) {
  const { jumpToMessage, unpinMessage } = useChat();
  const [isUnpinning, setIsUnpinning] = useState(false);
  const [unpinError, setUnpinError] = useState('');

  const pinned = conversation?.pinnedMessage;
  if (!pinned || !pinned.messageId) return null;

  const handleJump = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!pinned.messageId || !jumpToMessage) return;
    await jumpToMessage(pinned.messageId);
  };

  const handleUnpin = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isUnpinning || !unpinMessage) return;

    try {
      setIsUnpinning(true);
      setUnpinError('');
      const convId = extractId(conversation._id || conversation.id);
      const msgId = extractId(pinned.messageId);
      const res = await unpinMessage(convId, msgId);
      if (res && res.error) {
        setUnpinError(res.error);
        setTimeout(() => setUnpinError(''), 3500);
      }
    } catch (err) {
      setUnpinError(err.message || 'Failed to unpin message.');
      setTimeout(() => setUnpinError(''), 3500);
    } finally {
      setIsUnpinning(false);
    }
  };

  const getSnippet = () => {
    if (pinned.text && pinned.text.trim()) {
      return pinned.text.length > 80 ? `${pinned.text.slice(0, 80)}...` : pinned.text;
    }
    if (pinned.hasAttachment) {
      if (pinned.attachmentType === 'document') {
        return `📄 ${pinned.originalName || 'Document'}`;
      }
      return '📷 Image';
    }
    return 'Pinned message';
  };

  return (
    <div
      role="region"
      aria-label="Pinned message banner"
      className="px-3.5 py-2 bg-amber-500/10 dark:bg-amber-500/15 border-b border-amber-500/25 flex items-center justify-between gap-3 shrink-0 text-xs text-[var(--color-main-text)] transition-all animate-fade-in"
    >
      {/* Clickable jump region */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleJump}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleJump(e);
          }
        }}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer select-none group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg p-0.5"
        title="Click to jump to pinned message"
        aria-label={`Jump to pinned message from ${pinned.senderName || 'Participant'}`}
      >
        <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
          <Pin className="w-3.5 h-3.5 rotate-45" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-[10px] uppercase font-black tracking-wider text-amber-600 dark:text-amber-400">
              Pinned
            </span>
            <span className="text-[10px] text-[var(--color-secondary-text)]">&bull;</span>
            <span className="text-xs font-bold truncate max-w-[140px] sm:max-w-[200px]">
              {pinned.senderName || 'Participant'}
            </span>
            {pinned.senderRole && (
              <span className="text-[9px] uppercase tracking-wider font-semibold opacity-75 hidden sm:inline">
                ({pinned.senderRole})
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-secondary-text)] group-hover:text-[var(--color-main-text)] truncate transition-colors">
            {getSnippet()}
          </p>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
          <span>Jump</span>
          <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* Unpin action button */}
      <div className="flex items-center gap-1 shrink-0">
        {unpinError && (
          <span className="text-[10px] text-red-500 font-medium hidden sm:inline">
            {unpinError}
          </span>
        )}
        <button
          type="button"
          onClick={handleUnpin}
          disabled={isUnpinning}
          className="p-1.5 rounded-lg text-[var(--color-secondary-text)] hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50"
          title="Unpin message"
          aria-label="Unpin message"
        >
          {isUnpinning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
          ) : (
            <PinOff className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
