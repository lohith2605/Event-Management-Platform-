import { useState } from 'react';
import { X, AlertTriangle, XCircle } from 'lucide-react';

export default function CancelEventModal({ event, isOpen, onClose, onConfirm, isCancelling }) {
  if (!isOpen || !event) return null;

  const [reason, setReason] = useState('Unforeseen scheduling or venue conflict');

  const handleSubmit = async (e) => {
    e.preventDefault();
    await onConfirm(event._id, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[var(--color-main-text)]">
                Cancel Event
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)]">
                {event.title}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
          <strong>Important:</strong> Cancelling this event will immediately close registrations and notify all registered attendees via platform notifications. Existing ticket holds and order history will remain preserved.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-[var(--color-main-text)] mb-1">
              Cancellation Reason for Attendees:
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear explanation for registered attendees..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--color-input-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-rose-500 transition-colors resize-y"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] transition-colors cursor-pointer"
            >
              Keep Event Active
            </button>
            <button
              type="submit"
              disabled={isCancelling}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              <XCircle className="w-4 h-4" />
              <span>{isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
