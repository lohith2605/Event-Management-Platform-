import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Search,
  MapPin,
  Tag,
  RotateCcw,
  Globe,
  X,
  ArrowUpDown,
  AlertCircle,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import EventCard from '../components/EventCard';
import BookingModal from '../components/BookingModal';
import { EVENT_CATEGORIES, CITIES, FORMAT_OPTIONS } from '../config/taxonomy';
import { fetchPublishedEventsApi } from '../api/events';
import { staggerContainer, cardRevealVariant, buttonHoverTap } from '../config/animations';

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL Query Params as source of truth
  const categoryParam = searchParams.get('category') || 'All';
  const cityParam = searchParams.get('city') || 'All Cities';
  const formatParam = searchParams.get('format') || 'All Formats';
  const priceParam = searchParams.get('price') || 'all'; // 'all', 'free', 'paid'
  const dateParam = searchParams.get('date') || 'all'; // 'all', 'weekend', '30days'
  const sortParam = searchParams.get('sort') || 'soonest'; // 'soonest', 'price-low', 'price-high', 'title'

  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [bookingEvent, setBookingEvent] = useState(null);

  // Live data states from MongoDB Atlas
  const [events, setEvents] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Synchronize search query
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    const newParams = new URLSearchParams(searchParams);
    if (val.trim()) {
      newParams.set('q', val);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const updateParam = (key, value, defaultValue = 'All') => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== defaultValue) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setSearchParams({});
  };

  // Fetch real published events with current filters from backend
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchPublishedEventsApi({
        search: searchTerm.trim() || undefined,
        category: categoryParam !== 'All' ? categoryParam : undefined,
        city: cityParam !== 'All Cities' ? cityParam : undefined,
        format: formatParam !== 'All Formats' ? formatParam : undefined,
        pricing: priceParam !== 'all' ? priceParam : undefined,
        sort: sortParam,
        limit: 50,
      });

      if (res && Array.isArray(res.events)) {
        let list = res.events;

        // Apply client date filter if requested
        if (dateParam !== 'all') {
          const now = new Date();
          list = list.filter((evt) => {
            if (!evt.isoDate) return true;
            const diffDays = (new Date(evt.isoDate) - now) / (1000 * 60 * 60 * 24);
            if (dateParam === 'weekend') return diffDays >= 0 && diffDays <= 7;
            if (dateParam === '30days') return diffDays >= 0 && diffDays <= 30;
            return true;
          });
        }

        setEvents(list);
        setTotalCount(res.total ?? list.length);
      } else {
        setEvents([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Failed to load published events:', err);
      setError(err.message || 'Unable to load published events from the server.');
      setEvents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, categoryParam, cityParam, formatParam, priceParam, sortParam, dateParam]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const activeFilterCount =
    (categoryParam !== 'All' ? 1 : 0) +
    (cityParam !== 'All Cities' ? 1 : 0) +
    (formatParam !== 'All Formats' ? 1 : 0) +
    (priceParam !== 'all' ? 1 : 0) +
    (dateParam !== 'all' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[var(--color-borders)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-golden-accent)] uppercase tracking-wider mb-1">
              <Link to="/" className="hover:underline text-[var(--color-secondary-text)]">
                Home
              </Link>
              <span>/</span>
              <span>Event Discovery</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold font-serif text-[var(--color-main-text)]">
              All Upcoming Events
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] mt-1">
              Explore authentic campus fests, hackathons, music gigs, and workshops across India.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-secondary-text)]">Sort By:</span>
            <div className="relative">
              <select
                value={sortParam}
                onChange={(e) => updateParam('sort', e.target.value, 'soonest')}
                className="pl-3 pr-8 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl text-xs font-bold text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                aria-label="Sort events"
              >
                <option value="soonest">Date: Soonest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="title">Title: Alphabetical</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 pointer-events-none text-[var(--color-secondary-text)]" />
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] transition-all">
              <Search className="w-4 h-4 text-[var(--color-secondary-text)]" />
              <input
                type="text"
                placeholder="Search event, college, artist..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="w-full bg-transparent text-xs sm:text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => handleSearchChange({ target: { value: '' } })}
                  className="text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] transition-all">
              <Tag className="w-4 h-4 text-[var(--color-secondary-text)] shrink-0" />
              <select
                value={categoryParam}
                onChange={(e) => updateParam('category', e.target.value, 'All')}
                className="w-full bg-transparent text-xs sm:text-sm text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                aria-label="Filter by Category"
              >
                <option value="All">All Categories</option>
                {EVENT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* City Dropdown */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] transition-all">
              <MapPin className="w-4 h-4 text-[var(--color-secondary-text)] shrink-0" />
              <select
                value={cityParam}
                onChange={(e) => updateParam('city', e.target.value, 'All Cities')}
                className="w-full bg-transparent text-xs sm:text-sm text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                aria-label="Filter by City"
              >
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            {/* Format Dropdown (In-Person, Online, Hybrid) */}
            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl focus-within:border-[var(--color-primary-action)] transition-all">
              <Globe className="w-4 h-4 text-[var(--color-secondary-text)] shrink-0" />
              <select
                value={formatParam}
                onChange={(e) => updateParam('format', e.target.value, 'All Formats')}
                className="w-full bg-transparent text-xs sm:text-sm text-[var(--color-main-text)] focus:outline-none cursor-pointer"
                aria-label="Filter by Format"
              >
                {FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Secondary Row: Pricing Buttons & Date Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--color-borders)]/70 text-xs">
            {/* Price Filter Selector */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--color-secondary-text)]">Pricing:</span>
              <div className="inline-flex rounded-xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)] p-1 font-bold">
                <button
                  type="button"
                  onClick={() => updateParam('price', 'all', 'all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceParam === 'all'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  All Prices
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('price', 'free', 'all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceParam === 'free'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Free Passes
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('price', 'paid', 'all')}
                  className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                    priceParam === 'paid'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Paid Passes
                </button>
              </div>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-[var(--color-secondary-text)]">Date Range:</span>
              <div className="inline-flex rounded-xl border border-[var(--color-borders)] bg-[var(--color-primary-bg)] p-1 font-bold">
                <button
                  type="button"
                  onClick={() => updateParam('date', 'all', 'all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    dateParam === 'all'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  All Upcoming
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('date', 'weekend', 'all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    dateParam === 'weekend'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Next 7 Days
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('date', '30days', 'all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    dateParam === '30days'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                >
                  Next 30 Days
                </button>
              </div>
            </div>

            {/* Active filters count & reset */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-primary-bg)] border border-[var(--color-borders)] text-[var(--color-primary-action)] hover:bg-[var(--color-secondary-bg)] rounded-xl font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All ({activeFilterCount})</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Count Header */}
        <div className="flex items-center justify-between text-xs text-[var(--color-secondary-text)]">
          <p>
            Showing{' '}
            <strong className="text-[var(--color-main-text)] font-extrabold">
              {events.length}
            </strong>{' '}
            of{' '}
            <strong className="text-[var(--color-main-text)] font-extrabold">
              {totalCount}
            </strong>{' '}
            genuine published events
          </p>
        </div>

        {/* Loading Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
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

        {/* Error State with Retry */}
        {!loading && error && (
          <div className="my-10 p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h3 className="font-bold text-base text-[var(--color-main-text)]">
              Unable to retrieve events from server
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] max-w-md mx-auto">
              {error}
            </p>
            <button
              type="button"
              onClick={loadEvents}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl shadow-xs cursor-pointer hover:bg-[var(--color-primary-action-hover)]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Search</span>
            </button>
          </div>
        )}

        {/* Events Grid or Polished Empty State */}
        {!loading && !error && events.length > 0 && (
          <motion.div
            variants={staggerContainer(0.08)}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {events.map((event) => (
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

        {!loading && !error && events.length === 0 && (
          <div className="py-20 text-center bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-lg mx-auto p-8 space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-lg text-[var(--color-main-text)] font-serif">
              No Events Match Your Filters
            </h3>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              We couldn't find any published events matching your selected criteria. Try adjusting your format, price, or city filters to explore more experiences.
            </p>
            <motion.button
              type="button"
              whileHover={buttonHoverTap.hover}
              whileTap={buttonHoverTap.tap}
              onClick={resetAllFilters}
              className="px-6 py-2.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Reset All Filters
            </motion.button>
          </div>
        )}
      </div>

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
