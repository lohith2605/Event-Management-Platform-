import { motion } from 'motion/react';
import { Calendar, MapPin, Ticket, Users, Globe, Video } from 'lucide-react';

const DEFAULT_EVENT_IMAGE =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

export default function EventCard({ event, onBook }) {
  const isFree = event.priceNumber === 0;

  return (
    <motion.article
      layout
      whileHover={{ y: -6, transition: { duration: 0.22, ease: 'easeOut' } }}
      whileTap={{ scale: 0.98 }}
      className="group bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl overflow-hidden flex flex-col hover:border-[var(--color-primary-action)]/70 hover:shadow-xl transition-colors duration-300 h-full"
    >
      {/* Event Image & Badges */}
      <div className="relative aspect-[16/10] overflow-hidden bg-[var(--color-secondary-bg)]">
        <img
          src={event.image && event.image.startsWith('http') && !event.image.includes('unsplash.com/photos/') ? event.image : DEFAULT_EVENT_IMAGE}
          alt={event.title}
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_EVENT_IMAGE;
          }}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Top Left: Category & Format Badge */}
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
          <span className="bg-[var(--color-badge-bg)]/95 backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--color-main-text)] shadow-xs border border-[var(--color-borders)]/60">
            {event.category}
          </span>
          {event.format && (
            <span className="bg-[var(--color-dark-panel)]/85 backdrop-blur-xs text-[var(--color-primary-text)] px-2 py-0.5 rounded-lg text-[10px] font-medium flex items-center gap-1 shadow-xs">
              {event.format === 'Online' ? (
                <Video className="w-3 h-3 text-[var(--color-golden-accent)]" />
              ) : event.format === 'Hybrid' ? (
                <Globe className="w-3 h-3 text-[var(--color-golden-accent)]" />
              ) : null}
              <span>{event.format}</span>
            </span>
          )}
        </div>

        {/* Top Right: Independent Price Badge */}
        <div className="absolute top-3 right-3 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] px-3 py-1 rounded-lg text-xs font-extrabold shadow-sm">
          {isFree ? 'Free Pass' : event.price}
        </div>

        {/* Spots Left Banner */}
        {event.spotsLeft < 50 && (
          <div className="absolute bottom-3 left-3 bg-[var(--color-dark-panel)]/85 text-[var(--color-primary-text)] backdrop-blur-xs px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 shadow-sm">
            <Users className="w-3 h-3 text-[var(--color-golden-accent)]" />
            <span>Only {event.spotsLeft} passes left</span>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          {/* Date & Time */}
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)]">
            <Calendar className="w-3.5 h-3.5" />
            <span>{event.date} • {event.time}</span>
          </div>

          {/* Title */}
          <h3 className="font-extrabold text-lg text-[var(--color-main-text)] line-clamp-2 leading-snug group-hover:text-[var(--color-primary-action)] transition-colors">
            {event.title}
          </h3>

          {/* Tagline */}
          <p className="text-xs text-[var(--color-secondary-text)] line-clamp-2 leading-relaxed">
            {event.tagline}
          </p>
        </div>

        {/* Venue & Action Footer */}
        <div className="pt-3 border-t border-[var(--color-borders)]/70 space-y-3">
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-secondary-text)]">
            <MapPin className="w-3.5 h-3.5 text-[var(--color-golden-accent)] shrink-0" />
            <span className="truncate">{event.venue}</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                Pass Starting
              </span>
              <span className="font-extrabold text-base text-[var(--color-main-text)]">
                {isFree ? 'Free' : event.price}
              </span>
            </div>

            <button
              type="button"
              onClick={() => onBook(event)}
              className="px-4 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] hover:bg-[var(--color-primary-action)] hover:border-[var(--color-primary-action)] hover:text-[var(--color-primary-text)] text-[var(--color-main-text)] font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:translate-y-0.5 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Book Pass</span>
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
