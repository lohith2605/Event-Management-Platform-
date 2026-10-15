import { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Ticket,
  Eye,
  Undo2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Copy,
  Check,
  IndianRupee,
} from 'lucide-react';

export default function AdminBookingsTab({
  bookings = [],
  total = 0,
  page = 1,
  pages = 1,
  stats = {},
  statusFilter = 'all',
  paymentFilter = 'all',
  searchQuery = '',
  loading = false,
  error = null,
  onStatusChange,
  onPaymentChange,
  onSearchChange,
  onPageChange,
  onRefresh,
  onOpenBookingDetails,
  onOpenCancelRefundModal,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [copiedRef, setCopiedRef] = useState(null);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const handleCopyRef = (ref) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            <span>Confirmed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Pending</span>
          </span>
        );
    }
  };

  const getPaymentBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            Paid
          </span>
        );
      case 'free':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-500/15 text-blue-700 dark:text-blue-400">
            Free Pass
          </span>
        );
      case 'refunded':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-500/15 text-purple-700 dark:text-purple-400">
            Refunded
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400">
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial aggregate strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
            Total Bookings
          </span>
          <div className="text-2xl font-black text-[var(--color-main-text)]">
            {stats.totalBookingsCount ?? total}
          </div>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {stats.confirmedCount ?? 0} Confirmed
          </span>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
            Cancelled Orders
          </span>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            {stats.cancelledCount ?? 0}
          </div>
          <span className="text-[10px] text-[var(--color-secondary-text)]">
            Restored to inventory
          </span>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
            Gross Booking Volume
          </span>
          <div className="text-2xl font-black text-[var(--color-main-text)]">
            ₹{(stats.totalRevenue ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-[var(--color-secondary-text)]">
            Confirmed reservations
          </span>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)]">
            Total Refunded
          </span>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            ₹{(stats.totalRefunded ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-[var(--color-secondary-text)]">
            Cancelled transactions
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-main-text)] font-serif">
              Booking & Transaction Oversight
            </h2>
            <p className="text-xs text-[var(--color-secondary-text)]">
              Review attendee passes, order statuses, and refund requests.
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

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by booking reference, attendee, or email..."
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
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Booking Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={paymentFilter}
              onChange={(e) => onPaymentChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Payment Statuses</option>
              <option value="free">Free Passes</option>
              <option value="completed">Completed Payments</option>
              <option value="pending">Gateway Pending</option>
              <option value="refunded">Refunded Orders</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
            Loading booking records...
          </p>
        </div>
      )}

      {/* Error State */}
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

      {/* Empty State */}
      {!loading && !error && bookings.length === 0 && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-2">
          <Ticket className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-2" />
          <h3 className="text-sm font-bold text-[var(--color-main-text)]">No Bookings Found</h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
            {searchQuery
              ? `No booking records matching "${searchQuery}".`
              : 'No orders found matching the chosen filters.'}
          </p>
        </div>
      )}

      {/* Bookings Table */}
      {!loading && !error && bookings.length > 0 && (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-secondary-bg)]/60 border-b border-[var(--color-borders)] text-[var(--color-secondary-text)] uppercase font-extrabold tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Attendee</th>
                  <th className="py-3.5 px-4">Event</th>
                  <th className="py-3.5 px-4">Passes / Tier</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Payment</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)] text-[var(--color-main-text)]">
                {bookings.map((bk) => (
                  <tr key={bk._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    {/* Booking Reference */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs">
                          {bk.bookingReference}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyRef(bk.bookingReference)}
                          className="p-1 rounded-md text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                          title="Copy Booking Reference"
                        >
                          {copiedRef === bk.bookingReference ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block">
                        {new Date(bk.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </td>

                    {/* Attendee */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold block truncate max-w-[150px]">
                        {bk.attendeeName}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block truncate max-w-[150px]">
                        {bk.attendeeEmail}
                      </span>
                    </td>

                    {/* Event */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold block truncate max-w-[180px]">
                        {bk.eventId?.title || 'Unknown Event'}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block">
                        {bk.eventId?.date || 'N/A'} &bull; {bk.eventId?.city || 'N/A'}
                      </span>
                    </td>

                    {/* Passes & Tier */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold">
                        {bk.quantity} pass{bk.quantity > 1 ? 'es' : ''}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block truncate max-w-[130px]">
                        {bk.ticketType}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4">
                      <span className="font-black text-xs block">
                        {bk.totalAmount === 0 ? 'Free' : `₹${bk.totalAmount}`}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)]">
                        {bk.currency || 'INR'}
                      </span>
                    </td>

                    {/* Booking Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(bk.status)}
                    </td>

                    {/* Payment Status */}
                    <td className="py-3.5 px-4">
                      {getPaymentBadge(bk.paymentStatus)}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenBookingDetails(bk._id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {bk.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => onOpenCancelRefundModal(bk)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors cursor-pointer"
                            title="Cancel Booking & Process Refund"
                          >
                            Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border-t border-[var(--color-borders)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-secondary-text)]">
                Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total bookings)
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
