import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
  AlertTriangle,
  XCircle,
  Clock,
  CreditCard,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

/**
 * Format relative timestamps (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
const formatTimeAgo = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 172800) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

/**
 * Get distinct icon & colors by notification type
 */
const getNotificationVisuals = (type) => {
  switch (type) {
    case 'event_published':
      return {
        icon: Sparkles,
        iconBg: 'bg-amber-500/15 text-amber-500',
        badgeColor: 'border-amber-500/30',
      };
    case 'booking_confirmed':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-emerald-500/15 text-emerald-500',
        badgeColor: 'border-emerald-500/30',
      };
    case 'booking_cancelled':
      return {
        icon: XCircle,
        iconBg: 'bg-rose-500/15 text-rose-500',
        badgeColor: 'border-rose-500/30',
      };
    case 'event_approved':
      return {
        icon: CheckCircle2,
        iconBg: 'bg-green-500/15 text-green-500',
        badgeColor: 'border-green-500/30',
      };
    case 'event_rejected':
      return {
        icon: AlertTriangle,
        iconBg: 'bg-rose-500/15 text-rose-500',
        badgeColor: 'border-rose-500/30',
      };
    case 'event_reminder':
      return {
        icon: Clock,
        iconBg: 'bg-blue-500/15 text-blue-500',
        badgeColor: 'border-blue-500/30',
      };
    case 'refund_updated':
      return {
        icon: CreditCard,
        iconBg: 'bg-cyan-500/15 text-cyan-500',
        badgeColor: 'border-cyan-500/30',
      };
    default:
      return {
        icon: Bell,
        iconBg: 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]',
        badgeColor: 'border-[var(--color-borders)]',
      };
  }
};

export default function NotificationDropdown({ className = '', align = 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { role } = useAuth();
  const {
    unreadCount,
    notifications,
    isConnected,
    markAsRead,
    markAllAsRead,
    loading,
  } = useSocket();

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);

    if (notif.link) {
      navigate(notif.link);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (role === 'attendee') {
      navigate('/attendee/notifications');
    } else if (role === 'organizer') {
      navigate('/organizer/dashboard');
    } else if (role === 'admin') {
      navigate('/admin?tab=notifications');
    }
  };

  const recentNotifications = (notifications || []).slice(0, 8);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        title={unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'Notifications'}
        className={`relative p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
          isOpen
            ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] border border-[var(--color-primary-action)] shadow-sm'
            : 'bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/50 border border-[var(--color-borders)] text-[var(--color-main-text)] hover:text-[var(--color-primary-action)]'
        }`}
      >
        <Bell className="w-4 h-4 shrink-0" />

        {/* Live Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse ring-2 ring-[var(--color-primary-bg)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          className={`absolute mt-2 w-[340px] sm:w-[380px] max-w-[90vw] bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
          style={{ maxHeight: '82vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/40">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-[var(--color-main-text)]">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Real-time Socket Connection Status Indicator */}
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--color-card-bg)] border border-[var(--color-borders)]"
                title={isConnected ? 'Real-time Socket.IO connected' : 'Socket reconnecting...'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="text-[var(--color-secondary-text)]">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Mark All Read Action */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>
          </div>

          {/* Notification Items List */}
          <div className="divide-y divide-[var(--color-borders)]/60 max-h-[360px] overflow-y-auto">
            {recentNotifications.length > 0 ? (
              recentNotifications.map((notif) => {
                const { icon: VisualIcon, iconBg } = getNotificationVisuals(notif.type);
                return (
                  <div
                    key={notif._id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`group px-4 py-3 flex items-start gap-3 transition-colors cursor-pointer hover:bg-[var(--color-secondary-bg)]/60 ${
                      !notif.isRead
                        ? 'bg-[var(--color-primary-action)]/[0.04]'
                        : 'opacity-85'
                    }`}
                  >
                    {/* Visual Icon */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${iconBg}`}
                    >
                      <VisualIcon className="w-4 h-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-1.5">
                        <h4
                          className={`text-xs font-bold truncate leading-snug ${
                            !notif.isRead
                              ? 'text-[var(--color-main-text)]'
                              : 'text-[var(--color-secondary-text)]'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-[var(--color-secondary-text)]/70 shrink-0 whitespace-nowrap">
                          {formatTimeAgo(notif.createdAt)}
                        </span>
                      </div>

                      <p className="text-[11px] text-[var(--color-secondary-text)] line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>

                      {notif.link && (
                        <div className="pt-0.5 flex items-center gap-1 text-[10px] font-semibold text-[var(--color-primary-action)]">
                          <span>View Details</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                        </div>
                      )}
                    </div>

                    {/* Unread indicator / mark read quick button */}
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notif._id);
                        }}
                        title="Mark as read"
                        className="mt-1 w-2 h-2 rounded-full bg-[var(--color-primary-action)] shrink-0 hover:scale-150 transition-transform cursor-pointer"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-10 text-center space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] flex items-center justify-center mx-auto text-[var(--color-secondary-text)]">
                  <Bell className="w-5 h-5 opacity-50" />
                </div>
                <p className="text-xs font-bold text-[var(--color-main-text)]">
                  No notifications yet
                </p>
                <p className="text-[11px] text-[var(--color-secondary-text)] max-w-xs mx-auto leading-relaxed">
                  You’ll receive instant updates when events are published, passes are issued, or schedules change.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {role === 'attendee' && (
            <div className="px-4 py-2.5 border-t border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/30 text-center">
              <button
                type="button"
                onClick={handleViewAll}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
              >
                View all notifications in dashboard &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
