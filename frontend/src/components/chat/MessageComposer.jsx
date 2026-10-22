import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';

export default function MessageComposer({
  onSendMessage,
  onTyping,
  disabled = false,
  sending = false,
}) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Auto-resize textarea height as text grows up to 140px
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        140,
        Math.max(40, textareaRef.current.scrollHeight)
      )}px`;
    }
  }, [text]);

  // Clean up typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    if (val.length <= 2000) {
      setText(val);
      if (onTyping) {
        onTyping(true);
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          onTyping(false);
        }, 2000);
      }
    }
  };

  const isSending = Boolean(sending || isSubmitting);

  const handleSubmit = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending || disabled || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    if (onTyping) {
      onTyping(false);
    }
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    try {
      const res = await onSendMessage(trimmed);
      if (res && res.success) {
        setText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
      // If sending failed, text remains preserved in state for retry!
    } catch {
      // Draft preserved on error
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > 2000;
  const isNearLimit = charCount >= 1800;

  return (
    <div className="p-3 sm:p-4 border-t border-[var(--color-borders)] bg-[var(--color-card-bg)] shrink-0 space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0 relative rounded-2xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)]/80 focus-within:border-[var(--color-primary-action)] focus-within:ring-2 focus-within:ring-[var(--color-primary-action)]/20 transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => onTyping && onTyping(false)}
            placeholder={isSending ? "Sending message..." : "Type a message... (Enter to send, Shift+Enter for new line)"}
            aria-label="Type a message"
            disabled={disabled || isSending}
            maxLength={2000}
            className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-transparent text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] resize-none focus:outline-hidden leading-relaxed min-h-[40px] max-h-[140px]"
          />

          {/* Character Counter */}
          {charCount > 0 && (
            <div
              className={`absolute right-2.5 bottom-1 text-[9px] font-mono font-bold select-none ${
                isOverLimit
                  ? 'text-red-500'
                  : isNearLimit
                  ? 'text-amber-500'
                  : 'text-[var(--color-secondary-text)]'
              }`}
            >
              {charCount} / 2000
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim() || isSending || disabled || isOverLimit}
          className="min-w-[44px] min-h-[44px] p-2.5 sm:p-3 rounded-2xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white font-bold transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] focus-visible:ring-offset-2"
          title={isSending ? "Sending..." : "Send message"}
          aria-label={isSending ? "Sending message..." : "Send message"}
        >
          {isSending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
