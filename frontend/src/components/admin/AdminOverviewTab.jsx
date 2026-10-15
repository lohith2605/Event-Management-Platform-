import {
  Users,
  Calendar,
  Ticket,
  IndianRupee,
  ShieldAlert,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileText,
  UserCheck,
} from 'lucide-react';

export default function AdminOverviewTab({
  stats,
  recentPendingEvents = [],
  recentBookings = [],
  recentAuditLogs = [],
  loading,
  error,
  onRefresh,
  onSelectEvent,
  onNavigateTab,
}) {
  if (loading) {
    return (
      <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-4">
        <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-[var(--color-secondary-text)]">
          Loading platform metrics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 dark:text-red-400 space-y-3">
        <div className="flex items-center gap-2 font-bold text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Error Loading Platform Overview Metrics</span>
        </div>
        <p className="text-xs">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const pendingCount = stats?.events?.pendingEvents ?? stats?.pendingEvents ?? 0;
  const userStats = stats?.users || {};
  const eventStats = stats?.events || {};
  const bookingStats = stats?.bookings || {};
  const finances = stats?.finances || {
    grossVolume: 0,
    completedPaymentsVolume: 0,
    refundedVolume: 0,
    netAmount: 0,
  };

  return (
    <div className="space-y-6">
      {/* 1. Urgent Moderation Alert Banner */}
      {pendingCount > 0 ? (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-amber-900 dark:text-amber-200">
                {pendingCount} Event{pendingCount > 1 ? 's' : ''} Awaiting Administrative Approval
              </h2>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Submitted organizer events remain hidden from public discovery until reviewed and approved by an administrator.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('events', { status: 'pending' })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <span>Review Submissions</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              <strong>All Submissions Moderated:</strong> No events are currently waiting in the approval queue.
            </span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 hover:underline flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      )}

      {/* 2. Core Real Platform Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1: Users */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Registered Users
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--color-main-text)]">
            {userStats.totalUsers ?? stats?.totalUsers ?? 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5 pt-1 border-t border-[var(--color-borders)]/50">
            <div className="flex justify-between">
              <span>Attendees:</span>
              <strong className="text-[var(--color-main-text)]">
                {userStats.totalAttendees ?? stats?.totalAttendees ?? 0}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Organizers:</span>
              <strong className="text-purple-600 dark:text-purple-400">
                {userStats.totalOrganizers ?? stats?.totalOrganizers ?? 0}
              </strong>
            </div>
            {userStats.suspendedUsers > 0 && (
              <div className="flex justify-between text-red-600 dark:text-red-400 font-bold">
                <span>Suspended:</span>
                <span>{userStats.suspendedUsers}</span>
              </div>
            )}
          </div>
        </div>

        {/* Metric 2: Events Ecosystem */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Events Ecosystem
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--color-main-text)]">
            {eventStats.totalEvents ?? stats?.totalEvents ?? 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5 pt-1 border-t border-[var(--color-borders)]/50">
            <div className="flex justify-between">
              <span>Published / Live:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {eventStats.publishedEvents ?? stats?.publishedEvents ?? 0}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Pending Review:</span>
              <strong className="text-amber-600 dark:text-amber-400">
                {eventStats.pendingEvents ?? pendingCount}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Rejected / Draft:</span>
              <span>
                {(eventStats.rejectedEvents || 0) + (eventStats.draftEvents || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Metric 3: Bookings & Passes */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Total Bookings
            </span>
            <div className="w-8 h-8 rounded-lg bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)] flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--color-main-text)]">
            {bookingStats.totalBookings ?? 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5 pt-1 border-t border-[var(--color-borders)]/50">
            <div className="flex justify-between">
              <span>Confirmed:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {bookingStats.confirmedBookings ?? 0}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Passes Issued:</span>
              <strong className="text-[var(--color-main-text)]">
                {bookingStats.totalTicketsSold ?? 0}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Cancelled:</span>
              <strong className="text-red-600 dark:text-red-400">
                {bookingStats.cancelledBookings ?? 0}
              </strong>
            </div>
          </div>
        </div>

        {/* Metric 4: Financial Summary */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Financial Volume
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[var(--color-main-text)]">
            ₹{finances.grossVolume.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] space-y-0.5 pt-1 border-t border-[var(--color-borders)]/50">
            <div className="flex justify-between">
              <span>Completed:</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                ₹{finances.completedPaymentsVolume.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Refunded:</span>
              <strong className="text-red-600 dark:text-red-400">
                ₹{finances.refundedVolume.toLocaleString('en-IN')}
              </strong>
            </div>
            <div className="flex justify-between font-bold pt-0.5 border-t border-[var(--color-borders)]/30">
              <span>Net Volume:</span>
              <strong className="text-[var(--color-primary-action)]">
                ₹{finances.netAmount.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Operational Sections: Left Pending & Bookings | Right Audit & Systems */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Moderation Queue & Recent Bookings */}
        <div className="space-y-6">
          {/* Pending Events Queue */}
          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--color-main-text)]">
                  Pending Moderation Queue
                </h3>
                <p className="text-[11px] text-[var(--color-secondary-text)]">
                  Recent submissions requiring administrative decision
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('events', { status: 'pending' })}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View All ({pendingCount})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentPendingEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="font-semibold text-[var(--color-main-text)]">Queue Clean</p>
                <p className="text-[11px] mt-0.5">There are no pending event submissions at this time.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-borders)]">
                {recentPendingEvents.map((evt) => (
                  <div key={evt._id} className="py-3.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[var(--color-main-text)] truncate">
                          {evt.title}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 shrink-0">
                          {evt.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5 truncate">
                        By <strong>{evt.organizer}</strong> &bull; {evt.city} &bull; {evt.date} &bull; {evt.price}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectEvent(evt._id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--color-primary-action)] text-white hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer shrink-0"
                    >
                      Review
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Bookings Overview */}
          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--color-main-text)]">
                  Recent Platform Bookings
                </h3>
                <p className="text-[11px] text-[var(--color-secondary-text)]">
                  Latest tickets and passes reserved across events
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('bookings')}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>All Bookings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentBookings.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl">
                <Ticket className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-[var(--color-main-text)]">No Bookings Yet</p>
                <p className="text-[11px] mt-0.5">Attendee bookings will appear here in real-time.</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-borders)]">
                {recentBookings.map((bk) => (
                  <div key={bk._id} className="py-3 flex items-center justify-between gap-3 first:pt-1 last:pb-1 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[var(--color-main-text)]">
                          {bk.bookingReference}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            bk.status === 'confirmed'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : bk.status === 'cancelled'
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {bk.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5 truncate">
                        {bk.attendeeName} &bull; {bk.eventId?.title || 'Event'} ({bk.quantity} pass{bk.quantity > 1 ? 'es' : ''})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-[var(--color-main-text)]">
                        {bk.totalAmount === 0 ? 'Free' : `₹${bk.totalAmount}`}
                      </span>
                      <span className="block text-[10px] text-[var(--color-secondary-text)] uppercase font-semibold">
                        {bk.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Audit Trail & Security Indicators */}
        <div className="space-y-6">
          {/* Platform Activity Feed */}
          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm text-[var(--color-main-text)]">
                  Platform Activity Log
                </h3>
                <p className="text-[11px] text-[var(--color-secondary-text)]">
                  Recent administrative decisions and governance activity
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('audit-logs')}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Full Audit</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {recentAuditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl">
                <FileText className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto mb-2 opacity-60" />
                <p className="font-semibold text-[var(--color-main-text)]">No Administrative Actions Logged</p>
                <p className="text-[11px] mt-0.5">Approvals, rejections, and suspensions will be audited here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentAuditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="p-3 bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] rounded-xl text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--color-main-text)] flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            log.action.includes('approved')
                              ? 'bg-emerald-500'
                              : log.action.includes('rejected') || log.action.includes('suspended')
                              ? 'bg-red-500'
                              : 'bg-amber-500'
                          }`}
                        />
                        <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-main-text)] font-medium">
                      {log.targetTitle || log.details || 'Target resource updated'}
                    </p>
                    {log.reason && (
                      <p className="text-[10px] text-[var(--color-secondary-text)] italic">
                        Reason: &ldquo;{log.reason}&rdquo;
                      </p>
                    )}
                    <div className="text-[10px] text-[var(--color-secondary-text)] flex items-center gap-1">
                      <span>By: {log.adminName} ({log.adminEmail})</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
