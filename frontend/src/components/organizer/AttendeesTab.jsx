import {
  Users,
  Search,
  Filter,
  Calendar,
  Ticket,
  Mail,
  Phone,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export default function AttendeesTab({
  attendees,
  events,
  loading,
  error,
  selectedEventId,
  setSelectedEventId,
  searchQuery,
  setSearchQuery,
}) {
  return (
    <div className="space-y-6">
      {/* Search and Event Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search attendees by name, email, or booking ref..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors placeholder:text-[var(--color-secondary-text)]/60"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-4 py-2.5 rounded-xl text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors cursor-pointer"
          >
            <option value="all">All My Events</option>
            {events.map((evt) => (
              <option key={evt._id} value={evt._id}>
                {evt.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[var(--color-secondary-text)] font-medium">
            Fetching genuine attendee rosters...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Failed to load attendees</h4>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && attendees.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-[var(--color-main-text)]">
            No attendees found
          </h3>
          <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
            {searchQuery || selectedEventId !== 'all'
              ? 'No registered attendees match your current search query or event filter.'
              : 'No attendees have registered for your events yet. Live registrations will automatically populate here.'}
          </p>
        </div>
      )}

      {/* Attendees Table */}
      {!loading && !error && attendees.length > 0 && (
        <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-secondary-bg)]/60 text-[var(--color-secondary-text)] border-b border-[var(--color-borders)]">
                <tr>
                  <th className="py-3 px-4 font-bold">Attendee</th>
                  <th className="py-3 px-4 font-bold">Contact Details</th>
                  <th className="py-3 px-4 font-bold">Event Name</th>
                  <th className="py-3 px-4 font-bold">Ticket Tier</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 px-4 font-bold">Registered Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)]">
                {attendees.map((att) => (
                  <tr key={att._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-[var(--color-main-text)]">
                      <div>{att.name}</div>
                      <div className="text-[10px] font-mono text-[var(--color-secondary-text)] font-normal">
                        Ref: {att.bookingReference}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-secondary-text)]">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 shrink-0 text-[var(--color-primary-action)]" />
                        <span>{att.email}</span>
                      </div>
                      {att.phone && att.phone !== '—' && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Phone className="w-3 h-3 shrink-0 text-[var(--color-golden-accent)]" />
                          <span>{att.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-[var(--color-main-text)] max-w-[200px] truncate">
                      {att.eventTitle}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[var(--color-primary-action)]">
                        {att.quantity}x
                      </span>{' '}
                      <span className="text-[var(--color-secondary-text)]">
                        {att.ticketType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          att.bookingStatus === 'confirmed'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : att.bookingStatus === 'pending'
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {att.bookingStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--color-secondary-text)]">
                      {att.registeredAt
                        ? new Date(att.registeredAt).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
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
