import {
  X,
  Bell,
  CheckCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Sparkles,
} from 'lucide-react';

export default function AdminNotificationsModal({
  notifications = [],
  unreadCount = 0,
  isOpen,
  onClose,
  onMarkRead,
  onMarkAllRead,
  onNotificationClick,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col text-[var(--color-main-text)]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-borders)] flex items-center justify-between shrink-0 bg-[var(--color-secondary-bg)]/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center font-bold">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-extrabold text-base">
                Platform Alerts & Notices
              </h3>
              <p className="text-[11px] text-[var(--color-secondary-text)]">
                {unreadCount > 0
                  ? `${unreadCount} unread administrative notification${unreadCount > 1 ? 's' : ''}`
                  : 'All notifications read'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllRead}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--color-secondary-text)]">
              <Bell className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto mb-2 opacity-50" />
              <p className="font-bold text-[var(--color-main-text)]">No Administrative Notices</p>
              <p className="text-[11px] mt-0.5">
                New organizer event submissions and critical alerts will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => onNotificationClick && onNotificationClick(notif)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                  !notif.isRead
                    ? 'bg-[var(--color-primary-action)]/5 border-[var(--color-primary-action)]/30 shadow-xs'
                    : 'bg-[var(--color-secondary-bg)]/30 border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)]/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[var(--color-main-text)]">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-primary-action)] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-secondary-text)] leading-relaxed">
                      {notif.message}
                    </p>
                    <span className="text-[10px] text-[var(--color-secondary-text)] font-mono block pt-0.5">
                      {new Date(notif.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(notif._id);
                      }}
                      className="text-[10px] font-bold text-[var(--color-primary-action)] hover:underline shrink-0"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--color-secondary-bg)]/50 border-t border-[var(--color-borders)] flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] text-white hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
