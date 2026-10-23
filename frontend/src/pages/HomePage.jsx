import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MapPin,
  Tag,
  Sparkles,
  ShieldCheck,
  QrCode,
  ArrowRight,
  RotateCcw,
  Lock,
  RefreshCw,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import EventCard from '../components/EventCard';
import BookingModal from '../components/BookingModal';
import { EVENT_CATEGORIES, CITIES } from '../config/taxonomy';
import { BRAND } from '../config/brand';
import { fetchPublishedEventsApi, fetchCategoryCountsApi } from '../api/events';
import {
  fadeInUp,
  staggerContainer,
  cardRevealVariant,
  buttonHoverTap,
  chipHoverTap,
} from '../config/animations';

const ROTATING_PHRASES = [
  'Hackathon',
  'Concert',
  'College Fest',
  'Sports Event',
  'Workshop',
  'Cultural Festival',
  'Community Event',
  'Conference',
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state
  const selectedCategory = searchParams.get('category') || 'All';
  const selectedCity = searchParams.get('city') || 'All Cities';

  // Local filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [priceFilter, setPriceFilter] = useState('all'); // 'all', 'free', 'paid'
  const [bookingEvent, setBookingEvent] = useState(null);

  // Live data states from MongoDB Atlas
  const [events, setEvents] = useState([]);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Rotating headline index
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Unconditional phrase rotation timer (ensures text rotates smoothly on all systems)
  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  // Fetch real published events & category counts with resilient retry
  const loadData = useCallback(async (retryAttempt = 0) => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, categoriesRes] = await Promise.all([
        fetchPublishedEventsApi(),
        fetchCategoryCountsApi().catch(() => ({ categories: {} })),
      ]);

      if (eventsRes && Array.isArray(eventsRes.events)) {
        setEvents(eventsRes.events);
      } else {
        setEvents([]);
      }

      if (categoriesRes && categoriesRes.categories) {
        setCategoryCounts(categoriesRes.categories);
      }
    } catch (err) {
      console.error('Failed to load published events:', err);
      if (retryAttempt < 2) {
        // Automatically retry once or twice if backend was warming up
        setTimeout(() => {
          loadData(retryAttempt + 1);
        }, 1200 * (retryAttempt + 1));
        return;
      }
      setError(err.message || 'Unable to load events at this time. Please check your connection and try again.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(0);
  }, [loadData]);

  // Handle stale data safely when a page stays open across an event's start time or user returns
  useEffect(() => {
    const handleRevalidate = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        loadData(0);
      }
    };
    window.addEventListener('focus', handleRevalidate);
    document.addEventListener('visibilitychange', handleRevalidate);
    const interval = setInterval(handleRevalidate, 60000);

    return () => {
      window.removeEventListener('focus', handleRevalidate);
      document.removeEventListener('visibilitychange', handleRevalidate);
      clearInterval(interval);
    };
  }, [loadData]);

  // Client-side filtering on genuine fetched events for immediate responsiveness
  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // Keyword match
      const query = searchTerm.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        evt.title?.toLowerCase().includes(query) ||
        evt.tagline?.toLowerCase().includes(query) ||
        evt.venue?.toLowerCase().includes(query) ||
        evt.organizer?.toLowerCase().includes(query) ||
        evt.tags?.some((t) => t.toLowerCase().includes(query));

      // Category match
      const matchesCategory =
        selectedCategory === 'All' || evt.category === selectedCategory;

      // City match
      const matchesCity =
        selectedCity === 'All Cities' || evt.city === selectedCity;

      // Price match
      const matchesPrice =
        priceFilter === 'all' ||
        (priceFilter === 'free' && evt.priceNumber === 0) ||
        (priceFilter === 'paid' && evt.priceNumber > 0);

      return matchesSearch && matchesCategory && matchesCity && matchesPrice;
    });
  }, [events, searchTerm, selectedCategory, selectedCity, priceFilter]);

  const resetFilters = () => {
    setSearchTerm('');
    setPriceFilter('all');
    setSearchParams({});
  };

  const handleCategoryClick = (cat) => {
    const next = selectedCategory === cat ? 'All' : cat;
    const newParams = new URLSearchParams(searchParams);
    if (next !== 'All') {
      newParams.set('category', next);
    } else {
      newParams.delete('category');
    }
    setSearchParams(newParams);
  };

  const handleCityChange = (city) => {
    const newParams = new URLSearchParams(searchParams);
    if (city !== 'All Cities') {
      newParams.set('city', city);
    } else {
      newParams.delete('city');
    }
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('q', searchTerm.trim());
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (selectedCity !== 'All Cities') params.set('city', selectedCity);
    navigate(`/events?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      {/* 1. Hero Section with Animated Entry & Working Rotating Phrase */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 border-b border-[var(--color-borders)] overflow-hidden">
        {/* Subtle decorative background tints */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[var(--color-accent-soft)]/60 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-1/3 w-80 h-80 bg-[var(--color-gold-soft)]/70 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs font-semibold text-[var(--color-secondary-text)] shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
            <span>Discover College Fests, Hackathons & Live Experiences</span>
          </motion.div>

          {/* Headline with Stable Layout & Animated Rotating Phrase */}
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.08, ease: 'easeOut' }}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--color-main-text)] font-serif leading-[1.18] text-center"
          >
            Find Your Next{' '}
            <span className="inline-block relative min-w-[200px] sm:min-w-[340px] text-[var(--color-primary-action)] italic text-left align-baseline">
              <AnimatePresence mode="wait">
                <motion.span
                  key={ROTATING_PHRASES[phraseIndex]}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="inline-block"
                  aria-live="polite"
                >
                  {ROTATING_PHRASES[phraseIndex]}.
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.16, ease: 'easeOut' }}
            className="max-w-2xl mx-auto text-base sm:text-lg text-[var(--color-secondary-text)] leading-relaxed"
          >
            From premier tech hackathons in Bengaluru to collegiate cultural fests in Mumbai and heritage acoustic concerts in Jaipur. Reserve verified digital passes with instant QR check-in.
          </motion.p>

          {/* 2. Search & Discovery Widget */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.22, ease: 'easeOut' }}
            className="pt-4 max-w-4xl mx-auto"
          >
            <form
              onSubmit={handleSearchSubmit}
              className="bg-[var(--color-card-bg)] p-3 sm:p-4 rounded-2xl border border-[var(--color-borders)] shadow-md flex flex-col md:flex-row gap-3 items-center"
            >
              {/* Keyword Search */}
              <div className="flex-1 w-full flex items-center gap-2.5 px-3.5 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] focus-within:bg-[var(--color-primary-bg)] transition-all">
                <Search className="w-4 h-4 text-[var(--color-secondary-text)]" />
                <input
                  type="text"
                  placeholder="Search events, colleges, artists, or keywords..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-none"
                  aria-label="Search events"
                />
              </div>

              {/* Category Select */}
              <div className="w-full md:w-56 flex items-center gap-2 px-3.5 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] focus-within:bg-[var(--color-primary-bg)] transition-all">
                <Tag className="w-4 h-4 text-[var(--color-secondary-text)]" />
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryClick(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                  aria-label="Filter by category"
                >
                  <option value="All">All Categories</option>
                  {EVENT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} {categoryCounts[cat] ? `(${categoryCounts[cat]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Select */}
              <div className="w-full md:w-48 flex items-center gap-2 px-3.5 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] focus-within:bg-[var(--color-primary-bg)] transition-all">
                <MapPin className="w-4 h-4 text-[var(--color-secondary-text)]" />
                <select
                  value={selectedCity}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full bg-transparent text-sm text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                  aria-label="Filter by city"
                >
                  {CITIES.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Submit button */}
              <motion.button
                type="submit"
                whileHover={buttonHoverTap.hover}
                whileTap={buttonHoverTap.tap}
                className="w-full md:w-auto px-6 py-2.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <span>Find Events</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* 2. Real Category Taxonomy Bar with Genuine Published Counts */}
      <section className="py-8 bg-[var(--color-secondary-bg)] border-b border-[var(--color-borders)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between pb-4">
            <span className="text-xs uppercase font-extrabold tracking-widest text-[var(--color-secondary-text)]">
              Browse by Category
            </span>
            {selectedCategory !== 'All' && (
              <button
                type="button"
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('category');
                  setSearchParams(newParams);
                }}
                className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear Selection</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2.5">
            <motion.button
              type="button"
              whileHover={chipHoverTap.hover}
              whileTap={chipHoverTap.tap}
              onClick={() => handleCategoryClick('All')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedCategory === 'All'
                  ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                  : 'bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] hover:border-[var(--color-primary-action)]/60'
              }`}
            >
              All Categories
            </motion.button>
            {EVENT_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat;
              const count = categoryCounts[cat];
              return (
                <motion.button
                  key={cat}
                  type="button"
                  whileHover={chipHoverTap.hover}
                  whileTap={chipHoverTap.tap}
                  onClick={() => handleCategoryClick(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    active
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                      : 'bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] hover:border-[var(--color-primary-action)]/60'
                  }`}
                >
                  <span>{cat}</span>
                  {count !== undefined && count > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        active
                          ? 'bg-black/20 text-white'
                          : 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Upcoming Experiences with Real Data & Filters (Featured section moved to Attendee Dashboard) */}
      <section className="py-14 bg-[var(--color-primary-bg)] border-b border-[var(--color-borders)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-main-text)] font-serif">
                Upcoming Experiences
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] mt-1">
                Authentic campus fests, concerts, hackathons, and gatherings across India
              </p>
            </div>

            {/* Price Filter Selector */}
            <div className="flex items-center gap-2.5">
              <div className="inline-flex rounded-xl border border-[var(--color-borders)] bg-[var(--color-secondary-bg)] p-1 text-xs font-bold shadow-xs">
                <button
                  type="button"
                  onClick={() => setPriceFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceFilter === 'all'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  All Prices
                </button>
                <button
                  type="button"
                  onClick={() => setPriceFilter('free')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceFilter === 'free'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Free Passes
                </button>
                <button
                  type="button"
                  onClick={() => setPriceFilter('paid')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceFilter === 'paid'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Paid Passes
                </button>
              </div>

              {(searchTerm || selectedCategory !== 'All' || selectedCity !== 'All Cities' || priceFilter !== 'all') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 pt-4">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 space-y-4 animate-pulse"
                >
                  <div className="aspect-[16/10] bg-[var(--color-secondary-bg)] rounded-xl" />
                  <div className="h-4 bg-[var(--color-secondary-bg)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--color-secondary-bg)] rounded w-1/2" />
                  <div className="h-8 bg-[var(--color-secondary-bg)] rounded" />
                </div>
              ))}
            </div>
          )}

          {/* Error State with Retry Button */}
          {!loading && error && (
            <div className="my-8 p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Unable to load live events
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] max-w-md mx-auto">
                {error}
              </p>
              <button
                type="button"
                onClick={() => loadData(2)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl shadow-xs cursor-pointer hover:bg-[var(--color-primary-action-hover)] disabled:opacity-50 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Reconnecting...' : 'Retry Connection'}</span>
              </button>
            </div>
          )}

          {/* Empty State when 0 published events exist in DB */}
          {!loading && !error && events.length === 0 && (
            <div className="my-10 p-8 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-center space-y-3">
              <Calendar className="w-10 h-10 text-[var(--color-golden-accent)] mx-auto opacity-75" />
              <h3 className="font-bold text-lg text-[var(--color-main-text)]">
                No Published Events Available
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] max-w-md mx-auto">
                There are currently no approved public events listed. Organizers can sign up to submit their events for review.
              </p>
              <Link
                to="/organizers"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline pt-2"
              >
                <span>Learn how to publish as an Organizer</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Filter Empty State */}
          {!loading && !error && filteredEvents.length === 0 && events.length > 0 && (
            <div className="p-8 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-center space-y-3">
              <Search className="w-8 h-8 text-[var(--color-secondary-text)] mx-auto opacity-70" />
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                No events match your current filter selection
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)]">
                Try selecting a different category, city, or clearing the search keyword.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] text-xs font-bold rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            </div>
          )}

          {/* Real Filtered Events Grid with Staggered Entrance */}
          {!loading && !error && filteredEvents.length > 0 && (
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
            >
              {filteredEvents.map((event) => (
                <motion.div
                  key={event._id || event.id}
                  variants={cardRevealVariant}
                >
                  <EventCard
                    event={event}
                    onBook={(evt) => setBookingEvent(evt)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* 4. Clear View All Events Action */}
          <div className="text-center pt-4">
            <motion.div
              whileHover={buttonHoverTap.hover}
              whileTap={buttonHoverTap.tap}
              className="inline-block"
            >
              <Link
                to="/events"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-sm rounded-xl shadow-xs transition-all"
              >
                <span>{events.length > 0 ? `Explore All ${events.length} Events` : 'Explore All Events'}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* 4. Concise Trust Statement Section */}
      <section className="py-16 bg-[var(--color-secondary-bg)] border-t border-[var(--color-borders)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center space-y-3 pb-10">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-golden-accent)]">
              Direct & Reliable Passes
            </span>
            <h2 className="text-3xl font-extrabold text-[var(--color-main-text)] font-serif">
              Why Attendees Trust {BRAND.name}
            </h2>
            <p className="text-sm text-[var(--color-secondary-text)]">
              Built to provide authenticated access to college fests, concerts, and tech conclaves.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Admin-Reviewed Organizers
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Collegiate councils and event committees undergo verification before tickets go live.
              </p>
            </div>

            <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-gold-soft)] text-[var(--color-golden-accent)] flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Dynamic QR Entry
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Secure digital passes delivered to your phone for seamless check-in at gate entry.
              </p>
            </div>

            <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 space-y-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[var(--color-main-text)]">
                Direct Booking Guarantee
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                Passes linked directly to your verified profile, preventing scalping and ticket markup.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Booking Notice Modal */}
      {bookingEvent && (
        <BookingModal
          event={bookingEvent}
          onClose={() => setBookingEvent(null)}
        />
      )}
    </div>
  );
}
