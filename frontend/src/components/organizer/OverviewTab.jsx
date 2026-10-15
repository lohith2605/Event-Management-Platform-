import { motion, useReducedMotion } from 'motion/react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  TrendingUp,
  Users,
  CreditCard,
  PlusCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Ticket,
} from 'lucide-react';

export default function OverviewTab({
  metrics,
  upcomingEvents,
  recentBookings,
  loading,
  error,
  onNavigateTab,
  onSelectEvent,
}) {
  const shouldReduceMotion = useReducedMotion();

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[var(--color-secondary-text)] font-medium">
          Loading organizer analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-sm">Failed to Load Overview Data</h4>
          <p className="text-xs mt-1 opacity-90">{error}</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Events',
      value: metrics?.totalEvents ?? 0,
      sub: `${metrics?.publishedEvents ?? 0} published • ${metrics?.pendingEvents ?? 0} in review`,
      icon: Calendar,
      accent: 'text-[var(--color-primary-action)]',
      bg: 'bg-[var(--color-primary-action)]/10',
    },
    {
      title: 'Total Registrations',
      value: metrics?.totalBookings ?? 0,
      sub: `${metrics?.confirmedBookings ?? 0} confirmed orders`,
      icon: Ticket,
      accent: 'text-[var(--color-golden-accent)]',
      bg: 'bg-[var(--color-golden-accent)]/10',
    },
    {
      title: 'Confirmed Attendees',
      value: metrics?.totalAttendees ?? 0,
      sub: 'Issued genuine entry passes',
      icon: Users,
      accent: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Confirmed Revenue',
      value: `₹${(metrics?.totalRevenue ?? 0).toLocaleString('en-IN')}`,
      sub: 'Successful payments only',
      icon: CreditCard,
      accent: 'text-[var(--color-primary-action)]',
      bg: 'bg-[var(--color-accent-soft)]',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Operations Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--color-main-text)]">
              Organizer Operations Control Center
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] mt-0.5">
              Track ticket sales, attendee check-ins, and event performance in real time.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('create-event')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-semibold text-xs hover:bg-[var(--color-primary-action-hover)] shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Create New Event</span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              className="p-5 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
                  {card.title}
                </span>
                <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.accent} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-[var(--color-main-text)]">
                  {card.value}
                </div>
                <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 font-medium">
                  {card.sub}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Two Column Section: Upcoming Events & Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upcoming Events Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-primary-action)]" />
              <span>Upcoming Events</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('my-events')}
              className="text-xs font-semibold text-[var(--color-primary-action)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-3">
            {upcomingEvents?.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-center space-y-3">
                <Calendar className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto opacity-40" />
                <p className="text-xs text-[var(--color-secondary-text)]">
                  No upcoming events scheduled yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('create-event')}
                  className="text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                >
                  Create an Event Now →
                </button>
              </div>
            ) : (
              upcomingEvents?.map((event) => (
                <div
                  key={event._id}
                  onClick={() => onSelectEvent && onSelectEvent(event)}
                  className="p-4 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] hover:border-[var(--color-primary-action)]/50 transition-all cursor-pointer flex items-center gap-4 group"
                >
                  <img
                    src={event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=300&q=80'}
                    alt={event.title}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[var(--color-borders)] group-hover:scale-105 transition-transform"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          event.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {event.status}
                      </span>
                      <span className="text-xs font-bold text-[var(--color-primary-action)]">
                        {event.priceNumber === 0 ? 'Free' : event.price}
                      </span>
                    </div>
                    <h4 className="font-bold text-sm text-[var(--color-main-text)] truncate mt-1">
                      {event.title}
                    </h4>
                    <p className="text-xs text-[var(--color-secondary-text)] flex items-center gap-2 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {event.date}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {event.city}
                      </span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Booking Activity Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-secondary-text)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-golden-accent)]" />
              <span>Recent Booking Activity</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('bookings')}
              className="text-xs font-semibold text-[var(--color-primary-action)] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>All Bookings</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] overflow-hidden shadow-xs">
            {recentBookings?.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Ticket className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto opacity-40" />
                <p className="text-xs text-[var(--color-secondary-text)]">
                  No booking transactions recorded under your events yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-secondary-bg)]/50 text-[var(--color-secondary-text)] border-b border-[var(--color-borders)]">
                    <tr>
                      <th className="py-3 px-4 font-bold">Booking Ref</th>
                      <th className="py-3 px-4 font-bold">Event & Attendee</th>
                      <th className="py-3 px-4 font-bold">Passes</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-borders)]">
                    {recentBookings?.map((booking) => (
                      <tr key={booking._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--color-main-text)]">
                          {booking.bookingReference}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-[var(--color-main-text)] truncate max-w-[200px]">
                            {booking.eventTitle}
                          </div>
                          <div className="text-[11px] text-[var(--color-secondary-text)] truncate">
                            {booking.attendeeName} ({booking.attendeeEmail})
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[var(--color-main-text)]">
                            {booking.quantity}x
                          </span>{' '}
                          <span className="text-[var(--color-secondary-text)]">
                            {booking.ticketType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              booking.status === 'confirmed'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : booking.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {booking.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
