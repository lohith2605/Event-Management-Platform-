import {
  X,
  Calendar,
  Clock,
  MapPin,
  Users,
  Ticket,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Tag,
} from 'lucide-react';

export default function ViewEventModal({ event, isOpen, onClose, onEdit }) {
  if (!isOpen || !event) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Banner with close */}
        <div className="relative h-48 w-full bg-[var(--color-secondary-bg)]">
          <img
            src={event.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80'}
            alt={event.title}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 text-white hover:bg-black/70 backdrop-blur-xs transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute bottom-3 left-3 flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                event.status === 'published'
                  ? 'bg-emerald-600 text-white'
                  : event.status === 'pending'
                  ? 'bg-amber-600 text-white'
                  : event.status === 'rejected'
                  ? 'bg-rose-600 text-white'
                  : 'bg-zinc-700 text-white'
              }`}
            >
              {event.status}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-xs">
              {event.format || 'In-Person'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-golden-accent)]">
              {event.category}
            </span>
            <h2 className="text-xl font-extrabold text-[var(--color-main-text)] mt-1">
              {event.title}
            </h2>
            {event.tagline && (
              <p className="text-xs text-[var(--color-secondary-text)] mt-0.5">
                {event.tagline}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-[var(--color-secondary-bg)]/40 border border-[var(--color-borders)]">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--color-secondary-text)] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[var(--color-primary-action)]" />
                <span>Date & Time</span>
              </span>
              <p className="font-bold text-[var(--color-main-text)]">
                {event.date} • {event.time}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[var(--color-secondary-text)] flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[var(--color-golden-accent)]" />
                <span>Venue & City</span>
              </span>
              <p className="font-bold text-[var(--color-main-text)]">
                {event.venue}, {event.city}
              </p>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div className="space-y-1">
              <span className="font-bold text-[var(--color-main-text)]">Description:</span>
              <p className="text-[var(--color-secondary-text)] leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </div>
          )}

          {/* Ticket Tiers */}
          {Array.isArray(event.ticketTiers) && event.ticketTiers.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-[var(--color-borders)]">
              <span className="font-bold text-[var(--color-main-text)] flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                <span>Configured Ticket Tiers ({event.ticketTiers.length})</span>
              </span>
              <div className="space-y-1.5">
                {event.ticketTiers.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/30 border border-[var(--color-borders)] flex items-center justify-between"
                  >
                    <div>
                      <span className="font-bold text-[var(--color-main-text)]">
                        {t.name}
                      </span>
                      {t.description && (
                        <p className="text-[10px] text-[var(--color-secondary-text)] mt-0.5">
                          {t.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-[var(--color-primary-action)]">
                        {t.price === 0 ? 'Free' : `₹${t.price}`}
                      </span>
                      <p className="text-[10px] text-[var(--color-secondary-text)]">
                        {t.spotsLeft ?? t.capacity} / {t.capacity} left
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejection / Cancellation alerts */}
          {event.status === 'rejected' && event.rejectionReason && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Rejection Reason:</span>
              </div>
              <p className="pl-5 text-[11px] opacity-90">{event.rejectionReason}</p>
            </div>
          )}

          {event.status === 'cancelled' && event.cancellationReason && (
            <div className="p-3.5 rounded-xl bg-zinc-500/10 border border-zinc-500/20 text-zinc-700 dark:text-zinc-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Cancellation Reason:</span>
              </div>
              <p className="pl-5 text-[11px] opacity-90">{event.cancellationReason}</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-[var(--color-borders)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] transition-colors cursor-pointer"
            >
              Close
            </button>
            {event.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onEdit) onEdit(event);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] text-[var(--color-primary-text)] hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
              >
                Edit Event
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
