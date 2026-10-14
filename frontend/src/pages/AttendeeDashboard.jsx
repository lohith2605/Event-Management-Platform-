import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { User, Calendar, LogOut, Ticket, Sparkles, ArrowRight } from 'lucide-react';
import { BRAND } from '../config/brand';
import EventCard from '../components/EventCard';
import BookingModal from '../components/BookingModal';
import { fetchPublishedEventsApi } from '../api/events';
import { staggerContainer, cardRevealVariant, buttonHoverTap } from '../config/animations';

export default function AttendeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [featuredEvents, setFeaturedEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingEvent, setBookingEvent] = useState(null);

  const loadFeatured = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPublishedEventsApi({ featured: true });
      if (res && Array.isArray(res.events)) {
        setFeaturedEvents(res.events);
      }
    } catch (err) {
      console.error('Failed to load featured events in dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeatured();
  }, [loadFeatured]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/30 flex items-center justify-center text-[var(--color-primary-action)]">
              <User className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold font-serif">
                  Welcome, {user?.name || 'Attendee'}!
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Verified Attendee
                </span>
              </div>
              <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                {user?.email} • Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '2026'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-red-500 hover:bg-red-500/10 border border-[var(--color-borders)] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </motion.div>

        {/* Milestone Shell Notification */}
        <div className="p-4 rounded-xl bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 flex items-start gap-3 text-xs leading-relaxed">
          <Sparkles className="w-5 h-5 text-[var(--color-primary-action)] shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Authentication Foundation Complete</span>
            <p className="text-[var(--color-secondary-text)] mt-0.5">
              Your real attendee session is securely authenticated against MongoDB Atlas. Interactive ticket booking, QR pass management, and saved bookmarks will be activated in the next milestone.
            </p>
          </div>
        </div>

        {/* Quick Action Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div whileHover={{ y: -3, transition: { duration: 0.2 } }}>
            <Link
              to="/events"
              className="block p-6 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl hover:border-[var(--color-primary-action)] transition-all shadow-xs group"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] flex items-center justify-center mb-3">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base group-hover:text-[var(--color-primary-action)] transition-colors">
                Explore Live Events
              </h3>
              <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                Browse upcoming college fests, hackathons, and cultural fests across India.
              </p>
            </Link>
          </motion.div>

          <div className="p-6 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl opacity-80">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)] flex items-center justify-center mb-3">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">My Passes</h3>
              <span className="text-[10px] uppercase font-bold text-[var(--color-secondary-text)] bg-[var(--color-secondary-bg)] px-2 py-0.5 rounded-md">
                Next Milestone
              </span>
            </div>
            <p className="text-xs text-[var(--color-secondary-text)] mt-1">
              Tamper-proof dynamic QR passes will appear here once ticket purchasing is launched.
            </p>
          </div>
        </div>

        {/* Featured & Curated Events for Attendee Dashboard */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-golden-accent)] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Curated For You</span>
              </div>
              <h2 className="text-xl font-extrabold font-serif text-[var(--color-main-text)] mt-0.5">
                Featured Campus & City Highlights
              </h2>
            </div>
            <Link
              to="/events"
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary-action)] hover:underline"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 space-y-3 animate-pulse"
                >
                  <div className="aspect-[16/10] bg-[var(--color-secondary-bg)] rounded-xl" />
                  <div className="h-4 bg-[var(--color-secondary-bg)] rounded w-3/4" />
                  <div className="h-3 bg-[var(--color-secondary-bg)] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : featuredEvents.length > 0 ? (
            <motion.div
              variants={staggerContainer(0.08)}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {featuredEvents.map((evt) => (
                <motion.div key={evt._id || evt.id} variants={cardRevealVariant}>
                  <EventCard
                    event={evt}
                    onBook={(e) => setBookingEvent(e)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="p-6 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center text-xs text-[var(--color-secondary-text)]">
              No featured events right now. Check back soon for curated fest passes!
            </div>
          )}
        </div>
      </div>

      {bookingEvent && (
        <BookingModal
          event={bookingEvent}
          onClose={() => setBookingEvent(null)}
        />
      )}
    </div>
  );
}
