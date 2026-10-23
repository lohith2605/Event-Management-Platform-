import { useEffect, useRef } from 'react';
import { Trash2, AlertTriangle, Loader2, X } from 'lucide-react';

export default function DeleteConversationModal({
  isOpen,
  onClose,
  onConfirm,
  participantName = 'the other participant',
  eventTitle = '',
  loading = false,
  error = null,
}) {
  const cancelBtnRef = useRef(null);
  const modalRef = useRef(null);

  // Auto-focus the Cancel button for safety when opened, and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      cancelBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-chat-title"
      aria-describedby="delete-chat-desc"
      onClick={() => {
        if (!loading) onClose();
      }}
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-2xl p-5 sm:p-6 text-[var(--color-main-text)] animate-in zoom-in-95 duration-150 relative"
      >
        {/* Close icon button */}
        {!loading && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-start gap-3.5">
          {/* Warning Icon Badge */}
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <h3
              id="delete-chat-title"
              className="text-base font-extrabold text-[var(--color-main-text)] font-serif"
            >
              Delete chat from inbox
            </h3>
            <p
              id="delete-chat-desc"
              className="mt-2 text-xs text-[var(--color-secondary-text)] leading-relaxed"
            >
              Delete this chat {eventTitle ? `for "${eventTitle}"` : ''} from your inbox? The other participant ({participantName}) will still have their conversation and message history.
            </p>

            {error && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-2.5">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete chat</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
