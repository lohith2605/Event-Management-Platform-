import {
  Ticket,
  Search,
  Filter,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const BOOKING_STATUSES = [
  { id: 'all', label: 'All Orders' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function BookingsTab({
  bookings,
  events,
  loading,
  error,
  selectedEventId,
  setSelectedEventId,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
}) {
  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by reference, attendee name, or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors placeholder:text-[var(--color-secondary-text)]/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors cursor-pointer"
          >
            <option value="all">All Events</option>
            {events.map((evt) => (
              <option key={evt._id} value={evt._id}>
                {evt.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {BOOKING_STATUSES.map((st) => (
          <button
            key={st.id}
            type="button"
            onClick={() => setStatusFilter(st.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              statusFilter === st.id
                ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                : 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)]'
            }`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[var(--color-secondary-text)] font-medium">
            Loading bookings and order records...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Failed to load bookings</h4>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && bookings.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
            <Ticket className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-[var(--color-main-text)]">
            No bookings recorded
          </h3>
          <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
            {searchQuery || statusFilter !== 'all' || selectedEventId !== 'all'
              ? 'No bookings match your current filter settings.'
              : 'Zero bookings have been made for your events so far.'}
          </p>
        </div>
      )}

      {/* Bookings Table */}
      {!loading && !error && bookings.length > 0 && (
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-secondary-bg)]/60 text-[var(--color-secondary-text)] border-b border-[var(--color-borders)]">
                <tr>
                  <th className="py-3 px-4 font-bold">Booking Reference</th>
                  <th className="py-3 px-4 font-bold">Event & Date</th>
                  <th className="py-3 px-4 font-bold">Attendee</th>
                  <th className="py-3 px-4 font-bold">Tier & Quantity</th>
                  <th className="py-3 px-4 font-bold">Total Amount</th>
                  <th className="py-3 px-4 font-bold">Payment</th>
                  <th className="py-3 px-4 font-bold">Booking Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)]">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-main-text)]">
                      {b.bookingReference}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-[var(--color-main-text)] max-w-[200px] truncate">
                        {b.eventId?.title || 'Unknown Event'}
                      </div>
                      <div className="text-[11px] text-[var(--color-secondary-text)]">
                        {b.eventId?.date}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--color-main-text)]">
                        {b.attendeeName}
                      </div>
                      <div className="text-[11px] text-[var(--color-secondary-text)]">
                        {b.attendeeEmail}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[var(--color-primary-action)]">
                        {b.quantity}x
                      </span>{' '}
                      <span className="text-[var(--color-secondary-text)]">
                        {b.ticketType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[var(--color-main-text)]">
                      {b.totalAmount === 0 ? 'Free' : `₹${b.totalAmount.toLocaleString('en-IN')}`}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.paymentStatus === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : b.paymentStatus === 'free'
                            ? 'bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] border border-[var(--color-primary-action)]/20'
                            : b.paymentStatus === 'pending'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20'
                        }`}
                      >
                        {b.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          b.status === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : b.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
