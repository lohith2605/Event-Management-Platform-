import { useState } from 'react';
import {
  Users,
  Calendar,
  Ticket,
  IndianRupee,
  ShieldAlert,
  ShieldCheck,
  Clock,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  FileText,
  TrendingUp,
  BarChart3,
  Layers,
  MessageSquareQuote,
  Tag,
  Activity,
  Receipt,
  UserCheck,
  Sparkles,
  ExternalLink,
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
  const [chartMetric, setChartMetric] = useState('bookings'); // 'bookings' | 'revenue'

  if (loading) {
    return (
      <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-4 shadow-xs">
        <div className="w-9 h-9 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-[var(--color-secondary-text)]">
          Aggregating platform metrics and governance data...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 dark:text-red-400 space-y-3 shadow-xs">
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
  const reviewStats = stats?.reviews || {};
  const bookingTrends = stats?.bookingTrends || [];

  // Chart max calculation
  const maxTrendBookings = Math.max(1, ...bookingTrends.map((d) => d.bookingsCount || 0));
  const maxTrendRevenue = Math.max(1, ...bookingTrends.map((d) => d.confirmedRevenue || 0));

  // Event distribution percentages
  const totalEvents = eventStats.totalEvents || 0;
  const publishedPct = totalEvents > 0 ? Math.round(((eventStats.publishedEvents || 0) / totalEvents) * 100) : 0;
  const pendingPct = totalEvents > 0 ? Math.round(((eventStats.pendingEvents || 0) / totalEvents) * 100) : 0;
  const draftPct = totalEvents > 0 ? Math.round(((eventStats.draftEvents || 0) / totalEvents) * 100) : 0;
  const rejectedPct = totalEvents > 0 ? Math.round(((eventStats.rejectedEvents || 0) / totalEvents) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          A. PAGE HEADING AND CONTROLS
          ========================================================================= */}
      <div className="p-5 sm:p-6 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black font-serif tracking-tight text-[var(--color-main-text)]">
              Platform Overview
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live System</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] mt-1">
            Real-time platform metrics, governance queues, financial health, and system activity.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5 shrink-0">
          {stats?.timestamp && (
            <span className="text-[11px] text-[var(--color-secondary-text)] hidden sm:inline-flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Synced {new Date(stats.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </span>
          )}

          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/60 text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            title="Refresh metrics from database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('events', { status: 'pending' })}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              pendingCount > 0
                ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs animate-pulse'
                : 'bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white shadow-xs'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Moderation Queue ({pendingCount})</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          B. FOUR COMPACT KPI CARDS
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* KPI 1: Registered Users */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col justify-between space-y-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Registered Users
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black tracking-tight text-[var(--color-main-text)]">
              {(userStats.totalUsers ?? stats?.totalUsers ?? 0).toLocaleString()}
            </div>
            <div className="mt-2.5 pt-2 border-t border-[var(--color-borders)]/60 text-[11px] text-[var(--color-secondary-text)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Attendees:</span>
                <strong className="text-[var(--color-main-text)] font-mono">
                  {userStats.totalAttendees ?? 0}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Organizers:</span>
                <strong className="text-purple-600 dark:text-purple-400 font-mono">
                  {userStats.totalOrganizers ?? 0}
                </strong>
              </div>
              {userStats.suspendedUsers > 0 && (
                <div className="flex items-center justify-between text-red-600 dark:text-red-400 font-bold">
                  <span>Suspended:</span>
                  <span className="font-mono">{userStats.suspendedUsers}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Events Ecosystem */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col justify-between space-y-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Events Ecosystem
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black tracking-tight text-[var(--color-main-text)]">
              {(eventStats.totalEvents ?? stats?.totalEvents ?? 0).toLocaleString()}
            </div>
            <div className="mt-2.5 pt-2 border-t border-[var(--color-borders)]/60 text-[11px] text-[var(--color-secondary-text)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Live / Published:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {eventStats.publishedEvents ?? 0}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Review:</span>
                <strong className={`font-mono ${pendingCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-[var(--color-main-text)]'}`}>
                  {pendingCount}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Draft / Revisions:</span>
                <span className="font-mono">
                  {(eventStats.draftEvents || 0) + (eventStats.rejectedEvents || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 3: Total Bookings */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col justify-between space-y-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Total Bookings
            </span>
            <div className="w-8 h-8 rounded-xl bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)] flex items-center justify-center">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black tracking-tight text-[var(--color-main-text)]">
              {(bookingStats.totalBookings ?? 0).toLocaleString()}
            </div>
            <div className="mt-2.5 pt-2 border-t border-[var(--color-borders)]/60 text-[11px] text-[var(--color-secondary-text)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Confirmed:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {bookingStats.confirmedBookings ?? 0}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Passes Issued:</span>
                <strong className="text-[var(--color-main-text)] font-mono">
                  {bookingStats.totalTicketsSold ?? 0}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Cancelled:</span>
                <strong className="text-red-600 dark:text-red-400 font-mono">
                  {bookingStats.cancelledBookings ?? 0}
                </strong>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 4: Financial Volume */}
        <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col justify-between space-y-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-[var(--color-secondary-text)]">
              Financial Volume
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black tracking-tight text-[var(--color-main-text)]">
              ₹{finances.grossVolume.toLocaleString('en-IN')}
            </div>
            <div className="mt-2.5 pt-2 border-t border-[var(--color-borders)]/60 text-[11px] text-[var(--color-secondary-text)] space-y-1">
              <div className="flex items-center justify-between">
                <span>Completed:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{finances.completedPaymentsVolume.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Refunded:</span>
                <strong className="text-red-600 dark:text-red-400 font-mono">
                  ₹{finances.refundedVolume.toLocaleString('en-IN')}
                </strong>
              </div>
              <div className="flex items-center justify-between font-bold pt-0.5 border-t border-[var(--color-borders)]/40">
                <span>Net Volume:</span>
                <strong className="text-[var(--color-primary-action)] font-mono">
                  ₹{finances.netAmount.toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          C. PLATFORM ANALYTICS SECTION
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Analytics 1: Booking & Revenue Timeline Chart */}
        <div className="lg:col-span-7 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--color-primary-action)]" />
                <span>Platform Transaction & Booking Trends</span>
              </h2>
              <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                Daily aggregated activity recorded across the platform
              </p>
            </div>

            {/* Toggle metric */}
            <div className="inline-flex rounded-xl p-0.5 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setChartMetric('bookings')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === 'bookings'
                    ? 'bg-[var(--color-card-bg)] text-[var(--color-main-text)] shadow-xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                }`}
              >
                Orders
              </button>
              <button
                type="button"
                onClick={() => setChartMetric('revenue')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMetric === 'revenue'
                    ? 'bg-[var(--color-card-bg)] text-[var(--color-main-text)] shadow-xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                }`}
              >
                Revenue (₹)
              </button>
            </div>
          </div>

          {bookingTrends.length === 0 ? (
            <div className="py-16 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl space-y-2">
              <BarChart3 className="w-8 h-8 mx-auto opacity-30 text-[var(--color-secondary-text)]" />
              <p className="font-semibold text-[var(--color-main-text)]">No Historical Trend Data</p>
              <p className="text-[11px] max-w-xs mx-auto">
                Timeline activity will render automatically once attendees start reserving passes and completing bookings.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Responsive SVG/CSS Bar Graph */}
              <div className="h-52 w-full flex items-end gap-2 sm:gap-3 pt-6 pb-2 border-b border-[var(--color-borders)]">
                {bookingTrends.map((item, idx) => {
                  const val = chartMetric === 'bookings' ? (item.bookingsCount || 0) : (item.confirmedRevenue || 0);
                  const maxVal = chartMetric === 'bookings' ? maxTrendBookings : maxTrendRevenue;
                  const heightPercent = Math.max(8, Math.round((val / maxVal) * 100));

                  return (
                    <div
                      key={item._id || idx}
                      className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-12 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <div className="px-2.5 py-1.5 rounded-lg bg-[var(--color-dark-panel)] text-[var(--color-primary-text)] text-[10px] font-bold whitespace-nowrap shadow-lg space-y-0.5">
                          <div className="font-mono">{item._id}</div>
                          <div className="text-[var(--color-golden-accent)]">
                            {item.bookingsCount} orders &bull; ₹{(item.confirmedRevenue || 0).toLocaleString('en-IN')}
                          </div>
                        </div>
                        <div className="w-1.5 h-1.5 bg-[var(--color-dark-panel)] rotate-45 -mt-0.5" />
                      </div>

                      {/* Bar with gradient and active hover */}
                      <div
                        className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                          chartMetric === 'bookings'
                            ? 'bg-[var(--color-primary-action)] group-hover:bg-[var(--color-primary-action-hover)]'
                            : 'bg-emerald-600 dark:bg-emerald-500 group-hover:bg-emerald-700'
                        }`}
                        style={{ height: `${heightPercent}%` }}
                      />

                      {/* Date label */}
                      <span className="text-[9px] font-mono text-[var(--color-secondary-text)] mt-2 truncate w-full text-center">
                        {item._id ? item._id.slice(5) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-[var(--color-secondary-text)] font-medium pt-1">
                <span>Active Activity Days: <strong>{bookingTrends.length}</strong></span>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-primary-action)]" />
                    <span>Orders</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>Revenue</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Analytics 2: Event Catalog Status Distribution */}
        <div className="lg:col-span-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-golden-accent)]" />
                <span>Event Catalog Distribution</span>
              </h2>
              <span className="text-xs font-bold text-[var(--color-main-text)]">
                {totalEvents} total
              </span>
            </div>
            <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
              Breakdown of authored event states across the platform
            </p>

            {/* Proportional Progress Distribution */}
            <div className="mt-4 space-y-3.5">
              {/* Published */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-main-text)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Live / Published</span>
                  </span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                    {eventStats.publishedEvents ?? 0} ({publishedPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${publishedPct}%` }} />
                </div>
              </div>

              {/* Pending Moderation */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-main-text)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Awaiting Moderation</span>
                  </span>
                  <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">
                    {pendingCount} ({pendingPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${pendingPct}%` }} />
                </div>
              </div>

              {/* Draft / Incomplete */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-main-text)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Drafts by Organizers</span>
                  </span>
                  <span className="font-mono text-[var(--color-main-text)] font-semibold">
                    {eventStats.draftEvents ?? 0} ({draftPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${draftPct}%` }} />
                </div>
              </div>

              {/* Rejected / Returned */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--color-main-text)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>Rejected / Returned</span>
                  </span>
                  <span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">
                    {eventStats.rejectedEvents ?? 0} ({rejectedPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full transition-all duration-500" style={{ width: `${rejectedPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Review Health Widget */}
          <div className="p-3.5 rounded-xl bg-[var(--color-secondary-bg)]/50 border border-[var(--color-borders)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <MessageSquareQuote className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>
                <strong>Community Reviews:</strong> {(reviewStats.totalReviews || 0)} published
              </span>
            </div>
            {reviewStats.flaggedReviews > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {reviewStats.flaggedReviews} flagged
              </span>
            ) : (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Flagged</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          D. PENDING EVENT APPROVALS (PROMINENT ACTIONABLE QUEUE)
          ========================================================================= */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2 rounded-xl shrink-0 ${pendingCount > 0 ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-sm sm:text-base text-[var(--color-main-text)]">
                  Pending Event Approvals
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                    pendingCount > 0
                      ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {pendingCount} Awaiting Decision
                </span>
              </div>
              <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                Organizers submit events for administrative verification before publication to the public catalog.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('events', { status: 'pending' })}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer shrink-0"
          >
            <span>Open Moderation Module</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentPendingEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl space-y-1">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto opacity-80 mb-1" />
            <p className="font-bold text-sm text-[var(--color-main-text)]">Approval Queue Is Clean</p>
            <p className="text-[11px] text-[var(--color-secondary-text)]">
              All submitted events have been reviewed. New organizer submissions will appear here instantly.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-borders)] text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                  <th className="py-2.5 pr-4">Event Details</th>
                  <th className="py-2.5 px-3">Organizer</th>
                  <th className="py-2.5 px-3">Schedule & Venue</th>
                  <th className="py-2.5 px-3">Pricing</th>
                  <th className="py-2.5 px-3">Submitted</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)]">
                {recentPendingEvents.map((evt) => (
                  <tr key={evt._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="font-bold text-[var(--color-main-text)]">{evt.title}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400">
                          {evt.category}
                        </span>
                        <span className="text-[10px] text-[var(--color-secondary-text)]">{evt.format || 'In-Person'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-[var(--color-main-text)]">{evt.organizer}</span>
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[var(--color-secondary-text)]">
                      <div>{evt.date}</div>
                      <div className="text-[10px]">{evt.city}</div>
                    </td>
                    <td className="py-3 px-3 font-semibold text-[var(--color-main-text)]">
                      {evt.price}
                    </td>
                    <td className="py-3 px-3 text-[11px] text-[var(--color-secondary-text)] font-mono">
                      {evt.createdAt ? new Date(evt.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Recent'}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectEvent(evt._id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] text-white hover:bg-[var(--color-primary-action-hover)] shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Review</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          E & F. OPERATIONAL ACTIVITY & RECENT BOOKINGS (TWO BALANCED COLUMNS)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* F. Recent Bookings Table (7 cols on lg) */}
        <div className="lg:col-span-7 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-[var(--color-main-text)] flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[var(--color-primary-action)]" />
                <span>Recent Platform Bookings</span>
              </h2>
              <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                Latest admission passes and tickets reserved by attendees
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>All Bookings</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentBookings.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl space-y-1">
              <Ticket className="w-7 h-7 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-1" />
              <p className="font-bold text-[var(--color-main-text)]">No Bookings Found</p>
              <p className="text-[11px]">Real registrations will appear here chronologically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-borders)] text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                    <th className="py-2.5 pr-3">Reference</th>
                    <th className="py-2.5 px-3">Attendee & Event</th>
                    <th className="py-2.5 px-2 text-center">Passes</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 pl-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-borders)]">
                  {recentBookings.map((bk) => (
                    <tr key={bk._id} className="hover:bg-[var(--color-secondary-bg)]/20 transition-colors">
                      <td className="py-3 pr-3 font-mono font-bold text-[var(--color-main-text)]">
                        {bk.bookingReference}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-[var(--color-main-text)] truncate max-w-[180px]">
                          {bk.attendeeName}
                        </div>
                        <div className="text-[11px] text-[var(--color-secondary-text)] truncate max-w-[180px]">
                          {bk.eventId?.title || 'Event'}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center font-mono font-semibold">
                        {bk.quantity}
                      </td>
                      <td className="py-3 px-3 font-black text-[var(--color-main-text)]">
                        {bk.totalAmount === 0 ? 'Free' : `₹${bk.totalAmount.toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            bk.status === 'confirmed'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : bk.status === 'cancelled'
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {bk.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* E. Recent Platform Activity Log (5 cols on lg) */}
        <div className="lg:col-span-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-sm sm:text-base text-[var(--color-main-text)] flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Platform Activity Log</span>
              </h2>
              <p className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                Audit trail of administrative governance actions
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('audit-logs')}
              className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>Full Audit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentAuditLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-[var(--color-secondary-text)] border border-dashed border-[var(--color-borders)] rounded-xl space-y-1">
              <FileText className="w-7 h-7 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-1" />
              <p className="font-bold text-[var(--color-main-text)]">No Actions Logged</p>
              <p className="text-[11px]">Administrative decisions will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentAuditLogs.map((log) => {
                const isPositive = log.action.includes('approved') || log.action.includes('reactivated') || log.action.includes('published');
                const isNegative = log.action.includes('rejected') || log.action.includes('suspended') || log.action.includes('cancelled');

                return (
                  <div
                    key={log._id}
                    className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)]/80 text-xs space-y-1 hover:border-[var(--color-borders)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[var(--color-main-text)] flex items-center gap-1.5 truncate">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${
                            isPositive ? 'bg-emerald-500' : isNegative ? 'bg-red-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] font-mono shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--color-main-text)] font-medium truncate">
                      {log.targetTitle || log.details || 'Target resource updated'}
                    </p>

                    {log.reason && (
                      <p className="text-[10px] text-[var(--color-secondary-text)] italic line-clamp-1">
                        &ldquo;{log.reason}&rdquo;
                      </p>
                    )}

                    <div className="text-[10px] text-[var(--color-secondary-text)] pt-0.5 flex items-center justify-between">
                      <span>By: {log.adminName || 'Admin'}</span>
                      <span className="font-mono text-[9px]">
                        {new Date(log.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          G. QUICK ADMINISTRATIVE ACTIONS
          ========================================================================= */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
            <span>Administrative Module Shortcuts</span>
          </span>
          <span className="text-[11px] text-[var(--color-secondary-text)]">
            Direct navigation across governance domains
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {/* 1. Event Moderation */}
          <button
            type="button"
            onClick={() => onNavigateTab('events', { status: 'pending' })}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" />
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white">
                  {pendingCount}
                </span>
              )}
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Moderation</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Review events</div>
          </button>

          {/* 2. User Governance */}
          <button
            type="button"
            onClick={() => onNavigateTab('users')}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Users className="w-4 h-4 text-[var(--color-primary-action)] group-hover:scale-110 transition-transform" />
              {userStats.suspendedUsers > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-500 text-white">
                  {userStats.suspendedUsers}
                </span>
              )}
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Users</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Roles & status</div>
          </button>

          {/* 3. Bookings & Payments */}
          <button
            type="button"
            onClick={() => onNavigateTab('bookings')}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Bookings</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Reconciliation</div>
          </button>

          {/* 4. Reviews & Feedback */}
          <button
            type="button"
            onClick={() => onNavigateTab('reviews')}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <MessageSquareQuote className="w-4 h-4 text-[var(--color-golden-accent)] group-hover:scale-110 transition-transform" />
              {reviewStats.flaggedReviews > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white">
                  {reviewStats.flaggedReviews}
                </span>
              )}
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Reviews</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Community rating</div>
          </button>

          {/* 5. Coupons & Discounts */}
          <button
            type="button"
            onClick={() => onNavigateTab('coupons')}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <Tag className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Coupons</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Promo codes</div>
          </button>

          {/* 6. Audit Trail */}
          <button
            type="button"
            onClick={() => onNavigateTab('audit-logs')}
            className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/40 hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-left transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1.5">
              <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="font-bold text-xs text-[var(--color-main-text)]">Audit Trail</div>
            <div className="text-[10px] text-[var(--color-secondary-text)]">Security logs</div>
          </button>
        </div>
      </div>
    </div>
  );
}
