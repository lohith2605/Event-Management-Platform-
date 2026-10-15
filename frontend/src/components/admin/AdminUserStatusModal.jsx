import { useState } from 'react';
import {
  X,
  AlertTriangle,
  ShieldAlert,
  UserCheck,
  UserX,
} from 'lucide-react';

export default function AdminUserStatusModal({
  user,
  action, // 'suspend' | 'reactivate'
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (!isOpen || !user) return null;

  const isSuspend = action === 'suspend';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSuspend && !reason.trim()) {
      setError('Please provide a reason for suspending this user account.');
      return;
    }
    setError('');
    onConfirm(user._id, { action, reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-2xl overflow-hidden p-6 text-[var(--color-main-text)] space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 ${
                isSuspend
                  ? 'bg-red-500/15 text-red-600 border border-red-500/25'
                  : 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25'
              }`}
            >
              {isSuspend ? <UserX className="w-6 h-6" /> : <UserCheck className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-serif font-extrabold text-base">
                {isSuspend ? 'Suspend User Account' : 'Reactivate User Account'}
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)]">
                {user.name} ({user.email})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSuspend ? (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-700 dark:text-red-300 text-xs space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Security Enforcement Notice</span>
            </span>
            <p className="text-[11px] leading-relaxed">
              Suspending this user will immediately block all their authenticated requests, prevent logins, and halt organizer event management. Bookings and ticket records remain preserved.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-800 dark:text-emerald-200 text-xs leading-relaxed">
            Reactivating this user will restore their sign-in privileges and standard platform dashboard access.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isSuspend && (
            <div className="space-y-1.5">
              <label className="font-bold text-[var(--color-main-text)] block">
                Suspension Reason (Required):
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError('');
                }}
                rows={3}
                placeholder="State the violation or administrative rationale..."
                className="w-full p-2.5 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-red-500"
              />
              {error && <p className="text-[11px] text-red-500 font-semibold">{error}</p>}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-borders)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-colors cursor-pointer ${
                isSuspend
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isProcessing
                ? 'Processing...'
                : isSuspend
                ? 'Confirm Suspension'
                : 'Confirm Reactivation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
