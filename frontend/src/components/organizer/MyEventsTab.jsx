import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  Eye,
  Edit3,
  XCircle,
  AlertCircle,
  PlusCircle,
  CheckCircle2,
  Users,
  Ticket,
} from 'lucide-react';

const STATUS_FILTERS = [
  { id: 'all', label: 'All Events' },
  { id: 'published', label: 'Published' },
  { id: 'pending', label: 'Pending Review' },
  { id: 'draft', label: 'Drafts' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
];

export default function MyEventsTab({
  events,
  loading,
  error,
  activeFilter,
  setActiveFilter,
  searchQuery,
  setSearchQuery,
  onViewEvent,
  onEditEvent,
  onCancelEvent,
  onNavigateTab,
}) {
  const shouldReduceMotion = useReducedMotion();

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Published</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            <span>Under Review</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertCircle className="w-3 h-3" />
            <span>Action Required</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
            <XCircle className="w-3 h-3" />
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] border border-[var(--color-borders)]">
            <span>Draft</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your events by title, venue, or city..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-[var(--color-card-bg)] text-[var(--color-main-text)] border border-[var(--color-borders)] focus:outline-none focus:border-[var(--color-primary-action)] transition-colors placeholder:text-[var(--color-secondary-text)]/60"
          />
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={() => onNavigateTab('create-event')}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-semibold text-xs hover:bg-[var(--color-primary-action-hover)] transition-colors shadow-xs cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Event</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeFilter === f.id
                ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                : 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[var(--color-secondary-text)] font-medium">
            Loading your authored events...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-3 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold">Failed to load events</h4>
            <p className="opacity-90 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div className="py-16 text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
            <Calendar className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-base text-[var(--color-main-text)]">
              No matching events found
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] mt-1 leading-relaxed">
              {activeFilter !== 'all' || searchQuery
                ? 'No events match your current filter criteria. Try resetting filters or search terms.'
                : 'You have not authored any events yet. Create your first event now and start accepting registrations.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('create-event')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Your First Event</span>
          </button>
        </div>
      )}

      {/* Events Grid */}
      {!loading && !error && events.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {events.map((event, idx) => {
            const capacity = event.totalCapacity || 100;
            const spotsLeft = event.spotsLeft !== undefined ? event.spotsLeft : capacity;
            const booked = Math.max(0, capacity - spotsLeft);
            const bookedPercent = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

            return (
              <motion.div
                key={event._id}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                className="rounded-2xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Event Banner */}
                  <div className="relative h-44 w-full overflow-hidden bg-[var(--color-secondary-bg)]">
                    <img
                      src={event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=600&q=80'}
                      alt={event.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      {getStatusBadge(event.status)}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-card-bg)]/90 backdrop-blur-sm text-[var(--color-main-text)] border border-[var(--color-borders)] shadow-xs">
                        {event.format || 'In-Person'}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-[var(--color-card-bg)]/95 backdrop-blur-sm text-[var(--color-primary-action)] border border-[var(--color-borders)] shadow-xs">
                        {event.priceNumber === 0 ? 'Free Entry' : event.price}
                      </span>
                    </div>
                  </div>

                  {/* Event Details */}
                  <div className="p-5 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-golden-accent)]">
                        {event.category}
                      </span>
                      <h3 className="text-base font-extrabold text-[var(--color-main-text)] line-clamp-1 mt-0.5">
                        {event.title}
                      </h3>
                      {event.tagline && (
                        <p className="text-xs text-[var(--color-secondary-text)] line-clamp-1 mt-0.5">
                          {event.tagline}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-secondary-text)] pt-1 border-t border-[var(--color-borders)]">
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />
                        <span className="truncate">{event.date}</span>
                      </span>
                      <span className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[var(--color-golden-accent)] shrink-0" />
                        <span className="truncate">{event.city} • {event.venue}</span>
                      </span>
                    </div>

                    {/* Rejection Alert Callout if Rejected */}
                    {event.status === 'rejected' && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Admin Feedback / Rejection Note:</span>
                        </div>
                        <p className="text-[11px] opacity-90 pl-5">
                          {event.rejectionReason || 'Did not meet platform publishing requirements.'}
                        </p>
                        <p className="text-[10px] font-semibold opacity-75 pl-5 pt-0.5">
                          💡 You can click Edit to make required corrections and resubmit for approval.
                        </p>
                      </div>
                    )}

                    {/* Cancellation Alert Callout if Cancelled */}
                    {event.status === 'cancelled' && (
                      <div className="p-3 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-xs text-zinc-700 dark:text-zinc-300 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold">
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>Event Cancelled</span>
                        </div>
                        {event.cancellationReason && (
                          <p className="text-[11px] opacity-90 pl-5">
                            Reason: {event.cancellationReason}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Capacity & Bookings Bar */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[var(--color-secondary-text)] font-medium flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>Registrations: {booked} / {capacity}</span>
                        </span>
                        <span className="font-bold text-[var(--color-main-text)]">
                          {spotsLeft} spots remaining
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[var(--color-secondary-bg)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--color-primary-action)] transition-all duration-500"
                          style={{ width: `${bookedPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="px-5 py-3.5 bg-[var(--color-secondary-bg)]/40 border-t border-[var(--color-borders)] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onViewEvent(event)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-card-bg)] border border-transparent hover:border-[var(--color-borders)] transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {event.status !== 'cancelled' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditEvent(event)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-primary-action)] hover:bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 transition-all cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{event.status === 'rejected' ? 'Fix & Resubmit' : 'Edit'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onCancelEvent(event)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-500 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title="Cancel Event"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Cancel</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
