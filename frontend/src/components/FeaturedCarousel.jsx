import { useState, useEffect, useRef, useCallback } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calendar,
  MapPin,
  Ticket,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { fetchPublishedEventsApi } from '../api/events';

// Fallback high-contrast background if remote event image fails to load
const DEFAULT_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';

export default function FeaturedCarousel({ onSelectEvent, onExploreMore }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [failedImages, setFailedImages] = useState({});

  const shouldReduceMotion = useReducedMotion();
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);

  // Fetch real eligible events (prefer featured=true, fallback to published upcoming events)
  const loadFeaturedEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Query published featured events
      const res = await fetchPublishedEventsApi({ featured: true, limit: 8 });
      if (res && Array.isArray(res.events) && res.events.length > 0) {
        setEvents(res.events);
      } else {
        // 2. Fallback: Query all published upcoming events if none flagged as featured
        const fallbackRes = await fetchPublishedEventsApi({ limit: 6, sort: 'soonest' });
        if (fallbackRes && Array.isArray(fallbackRes.events)) {
          setEvents(fallbackRes.events);
        } else {
          setEvents([]);
        }
      }
    } catch (err) {
      console.error('Failed to load featured carousel events:', err);
      setError(err.message || 'Unable to load featured events.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeaturedEvents();
  }, [loadFeaturedEvents]);

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (events.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % events.length);
  }, [events.length]);

  const goToPrev = useCallback(() => {
    if (events.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? events.length - 1 : prev - 1));
  }, [events.length]);

  const goToSlide = (idx) => {
    if (events.length > 0) {
      setCurrentIndex(idx % events.length);
    }
  };

  // Robust Autoplay Advancement (advances every 5 seconds when >1 events exist)
  useEffect(() => {
    // Do not autoplay if paused or not enough events
    if (events.length <= 1 || isPaused) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % events.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [events.length, isPaused, currentIndex]);

  // Mobile Touch Handlers
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartXRef.current - touchEndXRef.current;
    if (diff > 45) {
      // Swiped Left -> Next
      goToNext();
    } else if (diff < -45) {
      // Swiped Right -> Prev
      goToPrev();
    }
  };

  const handleImageError = (eventId) => {
    setFailedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  // 1. Loading Skeleton State
  if (loading) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-sm overflow-hidden animate-pulse">
        <div className="h-[260px] sm:h-[320px] md:h-[380px] rounded-2xl bg-[var(--color-secondary-bg)] flex flex-col items-center justify-center space-y-3 text-[var(--color-secondary-text)]">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs font-semibold">Loading featured highlights...</p>
        </div>
      </div>
    );
  }

  // 2. Error State
  if (error && events.length === 0) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-red-500">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-medium">{error}</p>
        </div>
        <button
          type="button"
          onClick={loadFeaturedEvents}
          className="px-4 py-2 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] text-xs font-bold rounded-xl hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Empty State (Zero eligible events found)
  if (events.length === 0) {
    return (
      <div className="w-full bg-[var(--color-card-bg)] border border-dashed border-[var(--color-borders)] rounded-3xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-[var(--color-primary-action)]/10 text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
            New Featured Showcases Coming Soon
          </h3>
          <p className="text-xs text-[var(--color-secondary-text)] mt-1 max-w-md mx-auto">
            Our curators and campus hosts are approving exciting upcoming hackathons, cultural festivals, and conferences.
          </p>
        </div>
        {onExploreMore && (
          <button
            type="button"
            onClick={onExploreMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <span>Explore All Upcoming Events</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  // 4. Single Event Display (no carousel navigation needed)
  if (events.length === 1) {
    const singleEvent = events[0];
    const imgSrc = failedImages[singleEvent._id] ? DEFAULT_FALLBACK_IMAGE : singleEvent.image || DEFAULT_FALLBACK_IMAGE;

    return (
      <div className="w-full overflow-hidden rounded-3xl border border-[var(--color-borders)] shadow-lg relative group bg-black">
        <div className="relative w-full h-[260px] sm:h-[320px] md:h-[380px] lg:h-[420px] overflow-hidden">
          <img
            src={imgSrc}
            alt={singleEvent.title}
            onError={() => handleImageError(singleEvent._id)}
            className="w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />

          {/* Badges */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-md">
              <Sparkles className="w-3.5 h-3.5" />
              Featured Event
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white backdrop-blur-md border border-white/20">
              {singleEvent.category}
            </span>
          </div>

          {/* Banner Content */}
          <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 z-10 space-y-2 sm:space-y-3 max-w-2xl">
            <h2 className="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-extrabold font-serif text-white leading-tight drop-shadow-sm">
              {singleEvent.title}
            </h2>
            {singleEvent.tagline && (
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-1 drop-shadow-xs">
                {singleEvent.tagline}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-white/90 pt-0.5">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Calendar className="w-4 h-4 text-[var(--color-golden-accent)] shrink-0" />
                <span>{singleEvent.date}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{singleEvent.venue}, {singleEvent.city}</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                {singleEvent.price || 'Free'}
              </span>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSelectEvent && onSelectEvent(singleEvent)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs sm:text-sm font-extrabold shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <Ticket className="w-4 h-4" />
                <span>Book Tickets</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Multi-Slide BookMyShow-style Carousel with Side Peeks
  const activeIdx = events.length > 0 ? currentIndex % events.length : 0;
  const desktopSlideWidth = 86;
  const desktopGap = 1.5; // in percentage
  const desktopCenterOffset = (100 - desktopSlideWidth) / 2; // 7%
  const desktopTranslateX = desktopCenterOffset - activeIdx * (desktopSlideWidth + desktopGap);

  return (
    <section
      aria-label="Featured Events Carousel"
      className="relative w-full overflow-hidden select-none py-1"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={(e) => {
        setIsPaused(true);
        handleTouchStart(e);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => {
        handleTouchEnd();
        setTimeout(() => setIsPaused(false), 2000);
      }}
    >
      {/* Sliding Carousel Track */}
      <div className="w-full overflow-hidden rounded-3xl">
        <div
          className={`flex items-center ${
            shouldReduceMotion ? 'transition-none' : 'transition-transform duration-500 ease-out'
          }`}
          style={{
            transform: `translateX(${desktopTranslateX}%)`,
          }}
        >
          {events.map((evt, idx) => {
            const isActive = idx === activeIdx;
            const imgSrc = failedImages[evt._id] ? DEFAULT_FALLBACK_IMAGE : evt.image || DEFAULT_FALLBACK_IMAGE;

            return (
              <div
                key={evt._id}
                onClick={() => {
                  if (!isActive) {
                    goToSlide(idx);
                  } else if (onSelectEvent) {
                    onSelectEvent(evt);
                  }
                }}
                className={`shrink-0 px-1 sm:px-2 transition-all duration-500 ${
                  isActive
                    ? 'opacity-100 scale-100 z-10 cursor-pointer'
                    : 'opacity-55 hover:opacity-75 scale-[0.96] cursor-pointer'
                }`}
                style={{
                  width: `${desktopSlideWidth}%`,
                  marginRight: `${desktopGap}%`,
                }}
              >
                <div className="relative w-full h-[250px] sm:h-[300px] md:h-[360px] lg:h-[400px] rounded-3xl overflow-hidden border border-[var(--color-borders)] shadow-xl bg-black">
                  {/* Banner Image with fallback support */}
                  <img
                    src={imgSrc}
                    alt={evt.title}
                    onError={() => handleImageError(evt._id)}
                    className="w-full h-full object-cover object-center pointer-events-none"
                  />

                  {/* Contrast Gradient Overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />
                  <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 sm:top-5 sm:left-5 right-3 sm:right-5 flex items-center justify-between gap-2 z-10">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-md">
                      <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      Featured
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-black/60 text-white backdrop-blur-md border border-white/20">
                      {evt.category}
                    </span>
                  </div>

                  {/* Bottom Text & Actions (Only interactive on active slide) */}
                  <div className="absolute bottom-3 left-3 right-3 sm:bottom-6 sm:left-6 sm:right-6 z-10 space-y-2 sm:space-y-2.5 max-w-2xl">
                    <h3 className="text-base sm:text-2xl md:text-3xl lg:text-4xl font-extrabold font-serif text-white leading-tight drop-shadow-sm line-clamp-2">
                      {evt.title}
                    </h3>

                    {evt.tagline && (
                      <p className="text-[11px] sm:text-xs md:text-sm text-gray-200 line-clamp-1 drop-shadow-xs">
                        {evt.tagline}
                      </p>
                    )}

                    {/* Metadata Chips */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] sm:text-xs md:text-sm text-white/90 pt-0.5">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--color-golden-accent)] shrink-0" />
                        <span>{evt.date}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
                        <span className="truncate">{evt.venue}, {evt.city}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-white/20 text-white backdrop-blur-xs">
                        {evt.price || 'Free'}
                      </span>
                    </div>

                    {/* Actions */}
                    {isActive && (
                      <div className="pt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectEvent) onSelectEvent(evt);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs sm:text-sm font-extrabold shadow-lg transition-transform active:scale-95 cursor-pointer"
                        >
                          <Ticket className="w-4 h-4" />
                          <span>Book Tickets</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectEvent) onSelectEvent(evt);
                          }}
                          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 sm:py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-bold backdrop-blur-md border border-white/20 transition-colors cursor-pointer"
                        >
                          <span>View Event</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows (BookMyShow Flanking Style) */}
      {events.length > 1 && (
        <>
          <button
            type="button"
            onClick={goToPrev}
            aria-label="Previous Featured Event"
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-action)]"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <button
            type="button"
            onClick={goToNext}
            aria-label="Next Featured Event"
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-action)]"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Indicator Dots */}
      {events.length > 1 && (
        <div className="flex items-center justify-center gap-2 pt-3">
          {events.map((evt, idx) => (
            <button
              key={evt._id}
              type="button"
              onClick={() => goToSlide(idx)}
              aria-label={`Slide ${idx + 1}: ${evt.title}`}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                idx === activeIdx
                  ? 'w-7 bg-[var(--color-primary-action)] shadow-xs'
                  : 'w-2 bg-[var(--color-borders)] hover:bg-[var(--color-secondary-text)]'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
