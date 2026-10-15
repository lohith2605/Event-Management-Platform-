import { useState } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Undo2,
  UserX,
  UserCheck,
  Ticket,
} from 'lucide-react';

export default function AdminAuditLogsTab({
  logs = [],
  total = 0,
  page = 1,
  pages = 1,
  actionFilter = 'all',
  targetTypeFilter = 'all',
  searchQuery = '',
  loading = false,
  error = null,
  onActionChange,
  onTargetTypeChange,
  onSearchChange,
  onPageChange,
  onRefresh,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'event_approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            Event Approved
          </span>
        );
      case 'event_rejected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            Event Rejected
          </span>
        );
      case 'event_returned':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            Event Returned
          </span>
        );
      case 'user_suspended':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            User Suspended
          </span>
        );
      case 'user_reactivated':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            User Reactivated
          </span>
        );
      case 'booking_cancelled_refunded':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30">
            Booking Refunded
          </span>
        );
      case 'review_moderated':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
            Review Moderated
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-700 dark:text-gray-300">
            {action?.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-main-text)] font-serif">
              Platform Activity & Governance Logs
            </h2>
            <p className="text-xs text-[var(--color-secondary-text)]">
              Official record of administrative decisions, event approvals, suspensions, and refunds.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by admin email, target title, details, or reason..."
              className="w-full pl-9 pr-20 py-2 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  onSearchChange('');
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--color-primary-action)] text-white cursor-pointer"
            >
              Go
            </button>
          </form>

          <div className="sm:col-span-3">
            <select
              value={actionFilter}
              onChange={(e) => onActionChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Actions</option>
              <option value="event_approved">Event Approvals</option>
              <option value="event_rejected">Event Rejections</option>
              <option value="event_returned">Event Returned</option>
              <option value="user_suspended">User Suspensions</option>
              <option value="user_reactivated">User Reactivations</option>
              <option value="booking_cancelled_refunded">Refunds Processed</option>
              <option value="review_moderated">Reviews Moderated</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={targetTypeFilter}
              onChange={(e) => onTargetTypeChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Resource Types</option>
              <option value="Event">Event</option>
              <option value="User">User</option>
              <option value="Booking">Booking</option>
              <option value="Review">Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
            Loading audit records...
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 dark:text-red-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && logs.length === 0 && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-2">
          <ScrollText className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-2" />
          <h3 className="text-sm font-bold text-[var(--color-main-text)]">No Audit Records Found</h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
            {searchQuery
              ? `No audit entries matching "${searchQuery}".`
              : 'Administrative actions will automatically generate audit entries.'}
          </p>
        </div>
      )}

      {/* Audit Logs Table */}
      {!loading && !error && logs.length > 0 && (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-secondary-bg)]/60 border-b border-[var(--color-borders)] text-[var(--color-secondary-text)] uppercase font-extrabold tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Action</th>
                  <th className="py-3.5 px-4">Administrator</th>
                  <th className="py-3.5 px-4">Target Resource</th>
                  <th className="py-3.5 px-4">Reason / Details</th>
                  <th className="py-3.5 px-4 text-right">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)] text-[var(--color-main-text)]">
                {logs.map((log) => (
                  <tr key={log._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    {/* Timestamp */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-bold block text-[11px]">
                        {new Date(log.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] font-mono">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4">
                      {getActionBadge(log.action)}
                    </td>

                    {/* Administrator */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold block truncate max-w-[140px]">
                        {log.adminName}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block truncate max-w-[140px]">
                        {log.adminEmail}
                      </span>
                    </td>

                    {/* Target */}
                    <td className="py-3.5 px-4">
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] mr-1.5">
                        {log.targetType}
                      </span>
                      <span className="font-semibold text-xs">
                        {log.targetTitle || log.targetId}
                      </span>
                    </td>

                    {/* Details / Reason */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {log.details && (
                        <p className="text-[11px] truncate text-[var(--color-main-text)]">
                          {log.details}
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-[10px] text-[var(--color-secondary-text)] italic truncate" title={log.reason}>
                          Reason: &ldquo;{log.reason}&rdquo;
                        </p>
                      )}
                    </td>

                    {/* Origin IP */}
                    <td className="py-3.5 px-4 text-right font-mono text-[10px] text-[var(--color-secondary-text)] whitespace-nowrap">
                      {log.ipAddress || 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border-t border-[var(--color-borders)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-secondary-text)]">
                Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total audit entries)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-[var(--color-borders)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-secondary-bg)] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-xs px-2">
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= pages}
                  className="p-1.5 rounded-lg border border-[var(--color-borders)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-secondary-bg)] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
