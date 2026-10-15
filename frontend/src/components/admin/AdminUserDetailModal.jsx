import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  ShieldCheck,
  ShieldAlert,
  Ticket,
  FileText,
  Star,
  CheckCircle,
  XCircle,
} from 'lucide-react';

export default function AdminUserDetailModal({
  user,
  activitySummary = {},
  isOpen,
  onClose,
}) {
  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[85vh] flex flex-col text-[var(--color-main-text)]">
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--color-borders)] flex items-center justify-between shrink-0 bg-[var(--color-secondary-bg)]/40">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] border border-[var(--color-primary-action)]/30 flex items-center justify-center text-lg font-black">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-extrabold text-base sm:text-lg">
                  {user.name}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]">
                  {user.role}
                </span>
                {user.isSuspended && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-600 border border-red-500/30">
                    Suspended
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--color-secondary-text)]">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
          {/* Suspension notice if applicable */}
          {user.isSuspended && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 space-y-1">
              <span className="font-bold flex items-center gap-1.5 text-xs">
                <ShieldAlert className="w-4 h-4" />
                <span>Account Is Suspended</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Reason: {user.suspensionReason || 'No specific reason recorded.'}
              </p>
            </div>
          )}

          {/* User Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
                Email Address
              </span>
              <p className="font-semibold text-[var(--color-main-text)]">{user.email}</p>
            </div>

            <div className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
                Phone Number
              </span>
              <p className="font-semibold text-[var(--color-main-text)]">
                {user.phone || 'Not provided'}
              </p>
            </div>

            <div className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
                City / Location
              </span>
              <p className="font-semibold text-[var(--color-main-text)]">
                {user.city || 'Not specified'}
              </p>
            </div>

            <div className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
                Account Created
              </span>
              <p className="font-semibold text-[var(--color-main-text)]">
                {new Date(user.createdAt).toLocaleDateString([], {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>

          {user.bio && (
            <div className="p-3.5 bg-[var(--color-secondary-bg)]/30 border border-[var(--color-borders)] rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
                Bio / Background
              </span>
              <p className="text-[11px] leading-relaxed italic text-[var(--color-main-text)]">
                &ldquo;{user.bio}&rdquo;
              </p>
            </div>
          )}

          {/* Activity Section */}
          <div className="space-y-3 pt-2 border-t border-[var(--color-borders)]">
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--color-secondary-text)]">
              {user.role === 'organizer' ? 'Hosted Events & Bookings' : 'Attendee History & Reservations'}
            </h4>

            {user.role === 'organizer' ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-[var(--color-secondary-bg)]/50 rounded-xl">
                    <span className="text-[10px] text-[var(--color-secondary-text)] block">Total Events</span>
                    <strong className="text-sm text-[var(--color-main-text)]">
                      {activitySummary.eventCounts?.total || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-700 dark:text-emerald-400">
                    <span className="text-[10px] block">Published</span>
                    <strong className="text-sm">
                      {activitySummary.eventCounts?.published || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-700 dark:text-purple-400">
                    <span className="text-[10px] block">Bookings</span>
                    <strong className="text-sm">
                      {activitySummary.totalBookingsReceived || 0}
                    </strong>
                  </div>
                </div>

                {Array.isArray(activitySummary.events) && activitySummary.events.length > 0 ? (
                  <div className="divide-y divide-[var(--color-borders)] border border-[var(--color-borders)] rounded-xl overflow-hidden">
                    {activitySummary.events.map((evt) => (
                      <div key={evt._id} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--color-secondary-bg)]/30">
                        <div className="min-w-0 max-w-[260px]">
                          <span className="font-bold block truncate">{evt.title}</span>
                          <span className="text-[10px] text-[var(--color-secondary-text)]">{evt.date} &bull; {evt.city}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-[var(--color-secondary-bg)]">
                          {evt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-[var(--color-secondary-text)] py-4">
                    This organizer has not submitted any events yet.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-[var(--color-secondary-bg)]/50 rounded-xl">
                    <span className="text-[10px] text-[var(--color-secondary-text)] block">Total Bookings</span>
                    <strong className="text-sm text-[var(--color-main-text)]">
                      {activitySummary.totalBookings || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-700 dark:text-emerald-400">
                    <span className="text-[10px] block">Confirmed</span>
                    <strong className="text-sm">
                      {activitySummary.confirmedBookings || 0}
                    </strong>
                  </div>
                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-700 dark:text-amber-400">
                    <span className="text-[10px] block">Reviews Given</span>
                    <strong className="text-sm">
                      {activitySummary.totalReviews || 0}
                    </strong>
                  </div>
                </div>

                {Array.isArray(activitySummary.recentBookings) && activitySummary.recentBookings.length > 0 ? (
                  <div className="divide-y divide-[var(--color-borders)] border border-[var(--color-borders)] rounded-xl overflow-hidden">
                    {activitySummary.recentBookings.map((bk) => (
                      <div key={bk._id} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--color-secondary-bg)]/30">
                        <div className="min-w-0 max-w-[260px]">
                          <span className="font-mono font-bold block">{bk.bookingReference}</span>
                          <span className="text-[10px] text-[var(--color-secondary-text)]">{bk.eventId?.title || 'Event'}</span>
                        </div>
                        <span className="font-black text-xs">
                          {bk.totalAmount === 0 ? 'Free' : `₹${bk.totalAmount}`}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-[var(--color-secondary-text)] py-4">
                    This attendee has not placed any bookings yet.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
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
