import { motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  Ticket,
  Calendar,
  AlertCircle,
  CheckCircle2,
  PieChart,
  Users,
  Sparkles,
} from 'lucide-react';

export default function AnalyticsTab({ analytics, loading, error, onRefresh }) {
  const shouldReduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[var(--color-secondary-text)] font-medium">
          Loading revenue and attendance analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3 text-xs">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold">Failed to load analytics</h4>
          <p className="opacity-90 mt-0.5">{error}</p>
        </div>
      </div>
    );
  }

  const summary = analytics?.summary || {};
  const statusCounts = analytics?.statusCounts || {};
  const revenueOverTime = analytics?.revenueOverTime || [];
  const ticketTypeDistribution = analytics?.ticketTypeDistribution || [];
  const eventPerformance = analytics?.eventPerformance || [];

  const maxTimelineBookings = Math.max(1, ...revenueOverTime.map((d) => d.bookingsCount || 0));

  return (
    <div className="space-y-8">
      {/* Integrity Transparency Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-start gap-3 text-xs leading-relaxed shadow-xs">
        <Sparkles className="w-5 h-5 text-[var(--color-golden-accent)] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[var(--color-main-text)]">
            Financial & Attendance Reporting
          </span>
          <p className="text-[var(--color-secondary-text)] mt-0.5">
            Revenue figures reflect confirmed ticket sales. Pending orders and reservations are tracked separately to provide accurate reconciliation.
          </p>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
            Total Authored Events
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-main-text)] mt-2">
            {summary.totalEvents ?? 0}
          </div>
          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 font-medium">
            {summary.upcomingCount ?? 0} upcoming • {summary.completedCount ?? 0} past
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
            Confirmed Passes Issued
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-primary-action)] mt-2">
            {summary.totalTicketsSold ?? 0}
          </div>
          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 font-medium">
            Genuine verified registrations
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
            Confirmed Revenue
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
            ₹{(summary.totalConfirmedRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 font-medium">
            Successful transactions only
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
            Live Publication Rate
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-golden-accent)] mt-2">
            {summary.totalEvents > 0
              ? `${Math.round(((statusCounts.published || 0) / summary.totalEvents) * 100)}%`
              : '0%'}
          </div>
          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 font-medium">
            {statusCounts.published || 0} of {summary.totalEvents || 0} approved live
          </p>
        </div>
      </div>

      {/* Main Charts: Registrations Over Time & Event Capacity Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Registrations Timeline Chart */}
        <div className="lg:col-span-7 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-primary-action)]" />
              <span>Registrations & Bookings Timeline</span>
            </h3>
            <span className="text-[11px] font-semibold text-[var(--color-secondary-text)]">
              Daily aggregates
            </span>
          </div>

          {revenueOverTime.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--color-secondary-text)] space-y-2">
              <TrendingUp className="w-8 h-8 mx-auto opacity-30 text-[var(--color-secondary-text)]" />
              <p>No historical registration timelines recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Responsive SVG Bar Chart */}
              <div className="h-52 w-full flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-[var(--color-borders)]">
                {revenueOverTime.map((item, idx) => {
                  const heightPercent = Math.max(
                    8,
                    Math.round(((item.bookingsCount || 0) / maxTimelineBookings) * 100)
                  );
                  return (
                    <div
                      key={item._id || idx}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                        <div className="px-2 py-1 rounded bg-[var(--color-dark-panel)] text-[var(--color-primary-text)] text-[10px] font-bold whitespace-nowrap shadow-md">
                          {item.bookingsCount} orders • ₹{item.confirmedRevenue || 0}
                        </div>
                        <div className="w-1.5 h-1.5 bg-[var(--color-dark-panel)] rotate-45 -mt-0.5" />
                      </div>

                      {/* Bar */}
                      <div
                        className="w-full max-w-[40px] rounded-t-lg bg-[var(--color-primary-action)] group-hover:bg-[var(--color-primary-action-hover)] transition-all"
                        style={{ height: `${heightPercent}%` }}
                      />

                      {/* Date label */}
                      <span className="text-[9px] font-medium text-[var(--color-secondary-text)] mt-2 truncate w-full text-center">
                        {item._id ? item._id.slice(5) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--color-secondary-text)] font-medium">
                <span>Total Days with Activity: {revenueOverTime.length}</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary-action)]" />
                  <span>Orders Placed</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Capacity Utilization by Event */}
        <div className="lg:col-span-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>Capacity Utilization</span>
            </h3>
          </div>

          {eventPerformance.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--color-secondary-text)] space-y-2">
              <Users className="w-8 h-8 mx-auto opacity-30 text-[var(--color-secondary-text)]" />
              <p>No active event capacity records available.</p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {eventPerformance.map((evt) => (
                <div key={evt.eventId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--color-main-text)] truncate max-w-[200px]">
                      {evt.title}
                    </span>
                    <span className="text-[11px] font-extrabold text-[var(--color-primary-action)] shrink-0">
                      {evt.utilizationRate}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary-action)] transition-all duration-500"
                      style={{ width: `${evt.utilizationRate}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-secondary-text)]">
                    <span>
                      {evt.ticketsSold} / {evt.totalCapacity} passes
                    </span>
                    <span>{evt.spotsLeft} seats remaining</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Tier Breakdown & Status Distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Ticket Tier Breakdown */}
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <Ticket className="w-4 h-4 text-[var(--color-primary-action)]" />
            <span>Ticket Sales by Tier</span>
          </h3>

          {ticketTypeDistribution.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-secondary-text)]">
              No tier sales records registered yet.
            </div>
          ) : (
            <div className="space-y-3">
              {ticketTypeDistribution.map((tier) => (
                <div
                  key={tier._id}
                  className="p-3.5 rounded-xl bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[var(--color-main-text)]">
                      {tier._id || 'Standard Admission'}
                    </span>
                    <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                      Confirmed Sales: {tier.ticketsSold} passes
                    </p>
                  </div>
                  <span className="font-extrabold text-[var(--color-primary-action)]">
                    ₹{tier.revenue?.toLocaleString('en-IN') || 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Publication Lifecycle Status */}
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] p-6 space-y-4 shadow-xs">
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[var(--color-golden-accent)]" />
            <span>Event Lifecycle Distribution</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                Published Live
              </span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {statusCounts.published || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                Under Review
              </span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                {statusCounts.pending || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--color-secondary-bg)]/50 border border-[var(--color-borders)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
                Drafts
              </span>
              <div className="text-2xl font-black text-[var(--color-main-text)] mt-1">
                {statusCounts.draft || 0}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-500/10 border border-zinc-500/20">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
                Cancelled / Rejected
              </span>
              <div className="text-2xl font-black text-zinc-600 dark:text-zinc-400 mt-1">
                {(statusCounts.cancelled || 0) + (statusCounts.rejected || 0)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
