import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { fetchPublishedEventsApi } from '../api/events';

// High-contrast fallback image if event image fails to load
const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

export default function FeaturedCarousel({
  onSelectEvent,
  onExploreMore,
  onViewEvent,
  autoRotateInterval = 2000,
}) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [failedImages, setFailedImages] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(
    typeof document !== 'undefined' ? document.hidden : false
  );

  // Query genuine featured events, or fallback to upcoming published events
  const loadFeaturedEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Query published featured events first
      const res = await fetchPublishedEventsApi({ featured: true, limit: 10 });
      let featuredList = res && Array.isArray(res.events) ? res.events : [];

      // If fewer than 5 featured events, supplement with other published upcoming events
      if (featuredList.length < 5) {
        const fallbackRes = await fetchPublishedEventsApi({ limit: 8, sort: 'soonest' });
        if (fallbackRes && Array.isArray(fallbackRes.events)) {
          const existingIds = new Set(featuredList.map((e) => e._id));
          const additional = fallbackRes.events.filter((e) => !existingIds.has(e._id));
          featuredList = [...featuredList, ...additional];
        }
      }

      setEvents(featuredList);
    } catch (err) {
      console.error('Failed to load featured banner event:', err);
      setError(err.message || 'Unable to load featured event.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeaturedEvents();
  }, [loadFeaturedEvents]);

  // Listen for browser tab visibility and focus to revalidate stale data and manage rotation
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = typeof document !== 'undefined' ? document.hidden : false;
      setIsTabHidden(hidden);
      if (!hidden) {
        loadFeaturedEvents();
      }
    };
    const handleFocus = () => {
      loadFeaturedEvents();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadFeaturedEvents();
      }
    }, 60000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [loadFeaturedEvents]);

  const handleImageError = (eventId) => {
    setFailedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  const goToPrev = useCallback(() => {
    if (events.length > 1) {
      setCurrentIndex((prev) => (prev === 0 ? events.length - 1 : prev - 1));
    }
  }, [events.length]);

  const goToNext = useCallback(() => {
    if (events.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }
  }, [events.length]);

  // Automatic rotation between eligible events every 5 seconds (pauses on hover or when tab is hidden)
  const isPaused = isHovered || isTabHidden;

  useEffect(() => {
    if (events.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      goToNext();
    }, autoRotateInterval);

    return () => clearInterval(timer);
  }, [events.length, isPaused, goToNext, currentIndex, autoRotateInterval]);

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden animate-pulse">
        <div className="h-[220px] sm:h-[250px] md:h-[285px] rounded-xl bg-[var(--color-secondary-bg)] flex flex-col items-center justify-center space-y-2 text-[var(--color-secondary-text)]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs font-semibold">Loading featured spotlight...</p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error && events.length === 0) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-red-500 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={loadFeaturedEvents}
          className="px-3 py-1.5 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] text-xs font-bold rounded-xl hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Graceful Fallback if No Events Available
  if (events.length === 0) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-dashed border-[var(--color-borders)] rounded-2xl p-5 text-center space-y-2 shadow-2xs">
        <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)]/10 text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
          <Sparkles className="w-4 h-4" />
        </div>
        <h3 className="font-extrabold text-sm font-serif text-[var(--color-main-text)]">
          Curated Highlights Coming Soon
        </h3>
        <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
          Campus hosts and curators are actively preparing upcoming hackathons, fests, and workshops.
        </p>
        {onExploreMore && (
          <button
            type="button"
            onClick={onExploreMore}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer mt-1"
          >
            <span>Explore All Events</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Display one actual featured event at a time
  const currentEvent = events[currentIndex % events.length];

  const handleView = () => {
    if (onViewEvent) {
      onViewEvent(currentEvent);
    } else if (onSelectEvent) {
      onSelectEvent(currentEvent);
    }
  };

  const handleBook = () => {
    if (onSelectEvent) {
      onSelectEvent(currentEvent);
    }
  };

  return (
    <section
      aria-label="Featured Event Banner"
      aria-roledescription="carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      className="relative w-full overflow-hidden rounded-2xl border border-[var(--color-borders)] shadow-md bg-black group select-none"
    >
      <div className="relative w-full min-h-[220px] sm:min-h-[250px] md:min-h-[285px] flex items-center overflow-hidden">
        {/* Preloaded Background Images with Smooth Crossfade */}
        {events.map((evt, idx) => {
          const isActive = idx === currentIndex % events.length;
          const src = failedImages[evt._id]
            ? DEFAULT_FALLBACK_IMAGE
            : evt.image || DEFAULT_FALLBACK_IMAGE;

          return (
            <div
              key={evt._id || idx}
              aria-hidden={!isActive}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                isActive ? 'opacity-100 z-0' : 'opacity-0 pointer-events-none z-[-1]'
              }`}
            >
              <img
                src={src}
                alt={evt.title}
                onError={() => handleImageError(evt._id)}
                className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-700 pointer-events-none"
              />
            </div>
          );
        })}

        {/* Enhanced Contrast Gradient Overlays (ensures readable text in both light and dark themes) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/35 pointer-events-none z-[1]" />
        <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent pointer-events-none z-[1]" />

        {/* Top Badges & Controls */}
        <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-5 right-3.5 sm:right-5 flex items-center justify-between gap-2 z-10">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs">
              <Sparkles className="w-3.5 h-3.5" />
              Featured Spotlight
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/20">
              {currentEvent.category}
            </span>
          </div>

          {/* Prev/Next Controls with Slide Count */}
          {events.length > 1 && (
            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-xs">
              <button
                type="button"
                onClick={goToPrev}
                aria-label="Previous featured event"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-white/90 px-1.5 font-mono font-bold">
                {(currentIndex % events.length) + 1}/{events.length}
              </span>
              <button
                type="button"
                onClick={goToNext}
                aria-label="Next featured event"
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full text-white/80 hover:text-white hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Banner Content & Actions with Gentle Fade-In Transition on Slide Change */}
        <div
          key={currentEvent._id || currentIndex}
          className="relative z-10 w-full p-4 sm:p-6 md:p-8 pt-14 sm:pt-16 space-y-3 max-w-3xl animate-fade-in"
        >
          <div className="space-y-1">
            <h2 className="text-lg sm:text-2xl md:text-3xl font-extrabold font-serif text-white leading-tight drop-shadow-md line-clamp-1 sm:line-clamp-2">
              {currentEvent.title}
            </h2>
            {currentEvent.tagline && (
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-2 drop-shadow-xs max-w-2xl hidden sm:block">
                {currentEvent.tagline}
              </p>
            )}
          </div>

          {/* Event Meta Details: Date, Venue, Price */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-white/95">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Calendar className="w-4 h-4 text-[var(--color-golden-accent)] shrink-0" />
              <span>{currentEvent.date}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{currentEvent.venue}, {currentEvent.city}</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
              {currentEvent.priceNumber === 0 ? 'Free Pass' : currentEvent.price}
            </span>
          </div>

          {/* Primary View Event and Secondary Book Tickets Actions */}
          <div className="pt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleView}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-white hover:bg-gray-100 text-gray-900 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>View Event</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleBook}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Ticket className="w-4 h-4" />
              <span>Book Tickets</span>
            </button>
          </div>
        </div>

        {/* Slide Indicator Dots at Bottom-Right */}
        {events.length > 1 && (
          <div className="absolute bottom-3 right-4 sm:bottom-4 sm:right-6 hidden sm:flex items-center gap-1.5 z-10">
            {events.map((evt, idx) => (
              <button
                key={evt._id || idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Jump to featured event ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  idx === currentIndex % events.length
                    ? 'w-5 h-1.5 bg-[var(--color-primary-action)] shadow-xs'
                    : 'w-1.5 h-1.5 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
