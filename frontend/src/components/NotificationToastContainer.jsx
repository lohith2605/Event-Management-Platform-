import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  CreditCard,
  AlertTriangle,
  Bell,
  ArrowRight,
  MessageSquare,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';

/**
 * Visual configuration and custom headlines per notification type
 */
const getToastMeta = (type) => {
  switch (type) {
    case 'chat_message':
      return {
        tag: 'New Message',
        tagBg: 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] border-[var(--color-primary-action)]/30',
        borderColor: 'border-[var(--color-primary-action)]/40',
        accentColor: 'bg-[var(--color-primary-action)]',
        icon: MessageSquare,
        actionLabel: 'Open chat',
      };
    case 'event_published':
      return {
        tag: 'New Announcement',
        tagBg: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
        borderColor: 'border-amber-500/40',
        accentColor: 'bg-amber-500',
        icon: Sparkles,
        actionLabel: 'View event',
      };
    case 'booking_confirmed':
      return {
        tag: 'Booking Confirmed!',
        tagBg: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
        borderColor: 'border-emerald-500/40',
        accentColor: 'bg-emerald-500',
        icon: CheckCircle2,
        actionLabel: 'View ticket',
      };
    case 'booking_cancelled':
      return {
        tag: 'Booking Cancelled',
        tagBg: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
        borderColor: 'border-rose-500/40',
        accentColor: 'bg-rose-500',
        icon: XCircle,
        actionLabel: 'View bookings',
      };
    case 'refund_updated':
      return {
        tag: 'Refund Status Updated',
        tagBg: 'bg-cyan-500/15 text-cyan-500 border-cyan-500/30',
        borderColor: 'border-cyan-500/40',
        accentColor: 'bg-cyan-500',
        icon: CreditCard,
        actionLabel: 'View refund',
      };
    case 'event_reminder':
      return {
        tag: 'Event Reminder',
        tagBg: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
        borderColor: 'border-blue-500/40',
        accentColor: 'bg-blue-500',
        icon: Clock,
        actionLabel: 'View ticket',
      };
    case 'event_approved':
      return {
        tag: 'Event Approved & Live!',
        tagBg: 'bg-green-500/15 text-green-500 border-green-500/30',
        borderColor: 'border-green-500/40',
        accentColor: 'bg-green-500',
        icon: CheckCircle2,
        actionLabel: 'View event',
      };
    case 'event_rejected':
      return {
        tag: 'Event Submission Update',
        tagBg: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
        borderColor: 'border-rose-500/40',
        accentColor: 'bg-rose-500',
        icon: AlertTriangle,
        actionLabel: 'View submissions',
      };
    default:
      return {
        tag: 'Notification',
        tagBg: 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] border-[var(--color-primary-action)]/30',
        borderColor: 'border-[var(--color-borders)]',
        accentColor: 'bg-[var(--color-primary-action)]',
        icon: Bell,
        actionLabel: 'View details',
      };
  }
};

/**
 * Single Toast Notification Card
 */
function ToastItem({ toast, onDismiss, onAction }) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const DURATION_MS = 6000;
  const INTERVAL_MS = 60;

  const { tag, tagBg, borderColor, accentColor, icon: VisualIcon, actionLabel } = getToastMeta(
    toast.type
  );

  // Auto-dismiss countdown with hover-pause support
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - (INTERVAL_MS / DURATION_MS) * 100;
        if (next <= 0) {
          clearInterval(timer);
          onDismiss(toast.id);
          return 0;
        }
        return next;
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [isPaused, onDismiss, toast.id]);

  const handleActionClick = (e) => {
    e.stopPropagation();
    onAction(toast);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      onClick={handleActionClick}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-[var(--color-card-bg)]/95 backdrop-blur-md border ${borderColor} shadow-2xl transition-all duration-200 hover:shadow-3xl animate-in fade-in slide-in-from-top-4 cursor-pointer`}
    >
      {/* Top Tag & Header */}
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Category Tag Pill */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${tagBg}`}
            >
              <VisualIcon className="w-3 h-3 shrink-0" />
              <span>{tag}</span>
            </span>
            <span className="text-[10px] font-medium text-[var(--color-secondary-text)]/70">
              Just now
            </span>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            aria-label="Dismiss notification"
            className="p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notification Content */}
        <div className="space-y-1">
          <h4 className="text-xs sm:text-sm font-extrabold text-[var(--color-main-text)] leading-snug line-clamp-1">
            {toast.type === 'event_published' && !toast.title.toLowerCase().includes('new event just dropped')
              ? `New event just dropped! ${toast.notification?.metadata?.eventTitle || toast.title.replace(/^New Event in [^:]+:\s*/i, '')}`
              : toast.title}
          </h4>
          <p className="text-[11px] sm:text-xs text-[var(--color-secondary-text)] line-clamp-2 leading-relaxed">
            {toast.message}
          </p>
        </div>

        {/* Action Button */}
        {(toast.link || toast.conversationId) && (
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleActionClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-action-hover)] transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <span>{actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {isPaused && (
              <span className="text-[10px] text-[var(--color-secondary-text)] font-medium italic">
                Paused on hover
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dismissal Progress Bar */}
      <div className="h-1 w-full bg-[var(--color-borders)]/40 overflow-hidden">
        <div
          className={`h-full ${accentColor} transition-[width] duration-75 ease-linear`}
          style={{ width: `${Math.max(0, progress)}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Toast Container overlaying top-right on desktop & top-inset on mobile
 */
export default function NotificationToastContainer() {
  const { toasts, dismissToast, markAsRead } = useSocket();
  const { openConversation } = useChat();
  const navigate = useNavigate();

  if (!toasts || toasts.length === 0) return null;

  const handleAction = async (toast) => {
    // 1. Mark as read in MongoDB & local state if persistent notification
    if (toast.notification?._id) {
      await markAsRead(toast.notification._id);
    }
    // 2. Dismiss toast
    dismissToast(toast.id);
    // 3. Open conversation directly if chat message with conversationId
    if (toast.type === 'chat_message' && toast.conversationId) {
      if (typeof openConversation === 'function') {
        openConversation(toast.conversationId, { autoOpenDrawer: true });
        return;
      }
    }
    // 4. Navigate to target URL
    if (toast.link) {
      navigate(toast.link);
    }
  };

  return (
    <aside
      aria-label="Live notifications"
      className="fixed z-[9999] pointer-events-none flex flex-col gap-3 top-4 right-4 sm:max-w-md max-sm:inset-x-3 w-auto"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onAction={handleAction}
        />
      ))}
    </aside>
  );
}
