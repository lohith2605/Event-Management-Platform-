import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  User,
  Calendar,
  LogOut,
  Ticket,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bell,
  Star,
  Settings,
  Compass,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Search,
  AlertCircle,
  Shield,
  KeyRound,
  Users,
  X,
  CreditCard,
  Clock,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import EventCard from '../components/EventCard';
import BookingModal from '../components/BookingModal';
import TicketPassModal from '../components/TicketPassModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import ReviewModal from '../components/ReviewModal';
import FeaturedCarousel from '../components/FeaturedCarousel';
import {
  fetchAttendeeStatsApi,
  fetchMyBookingsApi,
  fetchMyTicketsApi,
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  fetchMyReviewsApi,
  fetchProfileApi,
  updateProfileApi,
  updatePasswordApi,
  createPaymentOrderApi,
  verifyPaymentApi,
  recordPaymentFailureApi,
} from '../api/attendee';
import { loadRazorpayScript } from '../utils/razorpay';
import { fetchPublishedEventsApi } from '../api/events';
import { EVENT_CATEGORIES, CITIES, FORMAT_OPTIONS } from '../config/taxonomy';

export default function AttendeeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Map route URL path to active dashboard tab
  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/attendee/bookings')) return 'bookings';
    if (pathname.startsWith('/attendee/tickets')) return 'tickets';
    if (pathname.startsWith('/attendee/notifications')) return 'notifications';
    if (pathname.startsWith('/attendee/reviews')) return 'reviews';
    if (pathname.startsWith('/attendee/profile')) return 'profile';
    return 'discovery'; // Canonical discovery homepage for /attendee and /attendee/events
  };

  const activeTab = getActiveTab(location.pathname);

  const navigateToTab = (tabId) => {
    const tabPathMap = {
      discovery: '/attendee',
      bookings: '/attendee/bookings',
      tickets: '/attendee/tickets',
      notifications: '/attendee/notifications',
      reviews: '/attendee/reviews',
      profile: '/attendee/profile',
    };
    const target = tabPathMap[tabId] || '/attendee';
    if (location.pathname !== target) {
      navigate(target);
    }
  };

  // Helper for scrolling horizontal carousels smoothly
  const scrollHorizontal = (elementId, offset) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // ---------------- STATE ----------------
  // Stats & Overview
  const [stats, setStats] = useState({
    totalBookings: 0,
    confirmedBookings: 0,
    activeTickets: 0,
    unreadNotifications: 0,
  });
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Discover Events
  const [discoverEvents, setDiscoverEvents] = useState([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const discoverSearch = searchParams.get('q') || '';
  const [discoverCategory, setDiscoverCategory] = useState('All');
  const [discoverCity, setDiscoverCity] = useState('All Cities');
  const [discoverFormat, setDiscoverFormat] = useState('All Formats');
  const [discoverPrice, setDiscoverPrice] = useState('all');

  // Bookings
  const [bookings, setBookings] = useState([]);
  const [bookingFilter, setBookingFilter] = useState('all');
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Tickets
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Notifications
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Reviews
  const [myReviews, setMyReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Profile Form
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    bio: '',
    city: '',
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // Password Form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  // Modals
  const [activeBookingEvent, setActiveBookingEvent] = useState(null);
  const [activeTicketPass, setActiveTicketPass] = useState(null);
  const [activeBookingReceipt, setActiveBookingReceipt] = useState(null);
  const [activeReviewEvent, setActiveReviewEvent] = useState(null);

  // ---------------- LOADERS ----------------
  // 1. Overview & Stats
  const loadOverviewStats = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const res = await fetchAttendeeStatsApi();
      if (res && res.success) {
        setStats(res.stats);
        setUpcomingBookings(res.upcomingBookings || []);
      }
    } catch (err) {
      console.error('Failed to load attendee overview stats:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // 2. Discover Events
  const loadDiscoverEvents = useCallback(async () => {
    setDiscoverLoading(true);
    try {
      const res = await fetchPublishedEventsApi({
        search: discoverSearch.trim() || undefined,
        category: discoverCategory !== 'All' ? discoverCategory : undefined,
        city: discoverCity !== 'All Cities' ? discoverCity : undefined,
        format: discoverFormat !== 'All Formats' ? discoverFormat : undefined,
        pricing: discoverPrice !== 'all' ? discoverPrice : undefined,
        limit: 20,
      });
      if (res && Array.isArray(res.events)) {
        setDiscoverEvents(res.events);
      }
    } catch (err) {
      console.error('Failed to load discover events:', err);
    } finally {
      setDiscoverLoading(false);
    }
  }, [discoverSearch, discoverCategory, discoverCity, discoverFormat, discoverPrice]);

  // 3. Bookings
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const res = await fetchMyBookingsApi(bookingFilter);
      if (res && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingFilter]);

  // 4. Tickets
  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await fetchMyTicketsApi('all');
      if (res && Array.isArray(res.tickets)) {
        setTickets(res.tickets);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  // 5. Notifications
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    try {
      const res = await fetchNotificationsApi();
      if (res && Array.isArray(res.notifications)) {
        setNotifications(res.notifications);
        setStats((prev) => ({ ...prev, unreadNotifications: res.unreadCount || 0 }));
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // 6. Reviews
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const res = await fetchMyReviewsApi();
      if (res && Array.isArray(res.reviews)) {
        setMyReviews(res.reviews);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  // 7. Profile
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const res = await fetchProfileApi();
      if (res && res.user) {
        setProfile({
          name: res.user.name || '',
          email: res.user.email || '',
          phone: res.user.phone || '',
          bio: res.user.bio || '',
          city: res.user.city || '',
        });
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Curated Featured Highlights from real published events
  const featuredList = useMemo(() => {
    const explicitlyFeatured = discoverEvents.filter((e) => e.featured);
    if (explicitlyFeatured.length > 0) return explicitlyFeatured;
    return discoverEvents.slice(0, 4);
  }, [discoverEvents]);

  // Trending & Fast-filling Events from real published events
  const trendingList = useMemo(() => {
    const popular = discoverEvents.filter(
      (e) => e.seatsBooked > 0 || (e.spotsLeft !== undefined && e.spotsLeft < 80)
    );
    if (popular.length > 0) return popular;
    return discoverEvents.slice(1, 5);
  }, [discoverEvents]);

  // Load initial data
  useEffect(() => {
    loadOverviewStats();
  }, [loadOverviewStats]);

  // Tab change trigger
  useEffect(() => {
    if (activeTab === 'discovery') {
      loadDiscoverEvents();
      loadOverviewStats();
    }
    if (activeTab === 'bookings') loadBookings();
    if (activeTab === 'tickets') loadTickets();
    if (activeTab === 'notifications') loadNotifications();
    if (activeTab === 'reviews') {
      loadReviews();
      loadBookings();
    }
    if (activeTab === 'profile') loadProfile();
  }, [
    activeTab,
    loadDiscoverEvents,
    loadOverviewStats,
    loadBookings,
    loadTickets,
    loadNotifications,
    loadReviews,
    loadProfile,
  ]);

  // Notification actions
  const handleMarkAsRead = async (id) => {
    try {
      await markNotificationReadApi(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setStats((prev) => ({
        ...prev,
        unreadNotifications: Math.max(0, prev.unreadNotifications - 1),
      }));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsReadApi();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setStats((prev) => ({ ...prev, unreadNotifications: 0 }));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Profile update submission
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      const res = await updateProfileApi({
        name: profile.name,
        phone: profile.phone,
        bio: profile.bio,
        city: profile.city,
      });
      if (res && res.success) {
        setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      } else {
        setProfileMsg({ type: 'error', text: res?.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'An error occurred while updating profile.' });
    }
  };

  // Password update submission
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirmation do not match.' });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await updatePasswordApi(passwordData);
      if (res && res.success) {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setPasswordMsg({ type: 'error', text: res?.message || 'Failed to update password.' });
      }
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  // Callback after booking created
  const handleBookingSuccess = () => {
    loadOverviewStats();
    loadBookings();
    loadTickets();
  };

  const handleBookingUpdated = () => {
    loadOverviewStats();
    loadBookings();
    loadTickets();
  };

  // Payment State & Handler for Pending Bookings
  const [paymentProcessingId, setPaymentProcessingId] = useState(null);
  const [paymentActionError, setPaymentActionError] = useState(null);

  const handleCompletePayment = async (booking) => {
    setPaymentActionError(null);
    if (!booking || booking.status !== 'pending') return;

    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() <= Date.now()) {
      setPaymentActionError('The 10-minute reservation hold has expired. The spots have been released.');
      await loadBookings();
      return;
    }

    setPaymentProcessingId(booking._id);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay Checkout could not be loaded. Please check your internet connection.');
      }

      // Secure backend order creation (or reuse of pending order within 10m hold)
      const orderRes = await createPaymentOrderApi(booking._id);
      if (!orderRes || !orderRes.success) {
        throw new Error(orderRes?.message || 'Failed to initialize payment order.');
      }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_To9oRfix0A0TJX';
      const order = orderRes.order;

      const options = {
        key: razorpayKey,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'UTSAV Events',
        description: `${booking.quantity}x ${booking.eventId?.title || 'Admission'}`,
        order_id: order.id,
        prefill: {
          name: user?.name || booking.attendeeName || '',
          email: user?.email || booking.attendeeEmail || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#6366f1',
        },
        handler: async (paymentResponse) => {
          // Never mark booking as paid on frontend alone!
          // Server-side verification of payment signature
          try {
            setPaymentProcessingId(booking._id);
            const verifyRes = await verifyPaymentApi({
              bookingId: booking._id,
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
            });

            if (verifyRes && verifyRes.success) {
              await Promise.all([loadBookings(), loadTickets(), loadOverviewStats()]);
              if (verifyRes.tickets && verifyRes.tickets.length > 0) {
                setActiveTicketPass(verifyRes.tickets[0]);
              }
            } else {
              setPaymentActionError(verifyRes?.message || 'Server-side payment verification failed.');
              await loadBookings();
            }
          } catch (vErr) {
            setPaymentActionError(vErr.message || 'Payment verification failed.');
            await loadBookings();
          } finally {
            setPaymentProcessingId(null);
          }
        },
        modal: {
          ondismiss: async () => {
            setPaymentProcessingId(null);
            try {
              await recordPaymentFailureApi({
                bookingId: booking._id,
                razorpay_order_id: order.id,
                error: { description: 'Checkout window dismissed by attendee' },
              });
            } catch (e) {
              // Non-blocking
            }
            await loadBookings();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', async (failedData) => {
        setPaymentProcessingId(null);
        try {
          await recordPaymentFailureApi({
            bookingId: booking._id,
            razorpay_order_id: order.id,
            error: failedData?.error || { description: 'Payment transaction failed' },
          });
        } catch (e) {
          // Non-blocking
        }
        setPaymentActionError(failedData?.error?.description || 'Payment failed. Please retry.');
        await loadBookings();
      });
      rzp.open();
    } catch (err) {
      setPaymentActionError(err.message || 'Payment initiation failed.');
      setPaymentProcessingId(null);
      await loadBookings();
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ================= CANONICAL DISCOVERY HOMEPAGE (/attendee & /attendee/events) ================= */}
        {activeTab === 'discovery' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* 1. Featured Promotional Banner Carousel */}
            <FeaturedCarousel
              onSelectEvent={(evt) => setActiveBookingEvent(evt)}
              onExploreMore={() => {
                const el = document.getElementById('utsav-event-catalog');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            />

            {/* 2. Category Navigation Chips */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-primary-action)]" />
                  <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                    Explore by Category
                  </h3>
                </div>
                {discoverCategory !== 'All' && (
                  <button
                    type="button"
                    onClick={() => setDiscoverCategory('All')}
                    className="text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                  >
                    Reset to All Categories
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setDiscoverCategory('All')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    discoverCategory === 'All'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs scale-102'
                      : 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)]'
                  }`}
                >
                  All Categories
                </button>
                {EVENT_CATEGORIES.map((catName) => {
                  const isSelected = discoverCategory === catName;
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => setDiscoverCategory(catName)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs scale-102'
                          : 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)]'
                      }`}
                    >
                      {catName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Horizontally Browsable Section: Attendee's Confirmed Passes (if any) */}
            {upcomingBookings.length > 0 && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                        Your Upcoming Events & Passes
                      </h3>
                      <p className="text-[11px] text-[var(--color-secondary-text)]">
                        Confirmed reservations ready with verified digital QR admission
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateToTab('bookings')}
                    className="text-xs font-bold text-[var(--color-primary-action)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>View All ({stats.totalBookings})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin snap-x">
                  {upcomingBookings.map((b) => {
                    const evt = b.eventId || {};
                    return (
                      <div
                        key={b._id}
                        className="min-w-[280px] max-w-[320px] shrink-0 snap-start bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-2xl p-4 flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-[var(--color-primary-action)]">
                              {b.bookingReference}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                              Confirmed
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-[var(--color-main-text)] line-clamp-1">
                            {evt.title}
                          </h4>
                          <p className="text-xs text-[var(--color-secondary-text)] flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                            <span>{evt.date} • {evt.time}</span>
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-borders)]">
                          <button
                            type="button"
                            onClick={() => setActiveBookingReceipt(b)}
                            className="text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                          >
                            Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToTab('tickets')}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs shadow-xs cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>View Pass (QR)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. Horizontally Browsable Section: Curated & Featured Highlights */}
            {featuredList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[var(--color-golden-accent)]" />
                    <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                      Curated & Featured Highlights
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollHorizontal('featured-scroll', -320)}
                      className="p-1.5 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] cursor-pointer"
                      aria-label="Scroll featured events left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollHorizontal('featured-scroll', 320)}
                      className="p-1.5 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] cursor-pointer"
                      aria-label="Scroll featured events right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  id="featured-scroll"
                  className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin snap-x scroll-smooth"
                >
                  {featuredList.map((evt) => (
                    <div
                      key={evt._id || evt.id}
                      className="min-w-[290px] sm:min-w-[330px] max-w-[340px] shrink-0 snap-start"
                    >
                      <EventCard event={evt} onBook={(e) => setActiveBookingEvent(e)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Horizontally Browsable Section: Trending & Fast-Filling */}
            {trendingList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-500" />
                    <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                      Trending & Fast-Filling
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollHorizontal('trending-scroll', -320)}
                      className="p-1.5 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] cursor-pointer"
                      aria-label="Scroll trending events left"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollHorizontal('trending-scroll', 320)}
                      className="p-1.5 rounded-lg bg-[var(--color-card-bg)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] cursor-pointer"
                      aria-label="Scroll trending events right"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div
                  id="trending-scroll"
                  className="flex gap-5 overflow-x-auto pb-4 scrollbar-thin snap-x scroll-smooth"
                >
                  {trendingList.map((evt) => (
                    <div
                      key={evt._id || evt.id}
                      className="min-w-[290px] sm:min-w-[330px] max-w-[340px] shrink-0 snap-start"
                    >
                      <EventCard event={evt} onBook={(e) => setActiveBookingEvent(e)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. Full Event Listings with Filters (City, Format, Price, Refresh) */}
            <div id="utsav-event-catalog" className="space-y-5 pt-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold font-serif text-[var(--color-main-text)]">
                      {discoverSearch ? `Search Results for "${discoverSearch}"` : 'All Published Events'}
                    </h3>
                    {discoverSearch && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]">
                        <span>&ldquo;{discoverSearch}&rdquo;</span>
                        <button
                          type="button"
                          onClick={() => {
                            const nextParams = new URLSearchParams(searchParams);
                            nextParams.delete('q');
                            setSearchParams(nextParams);
                          }}
                          className="hover:text-red-500 transition-colors cursor-pointer p-0.5"
                          title="Clear search filter"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-secondary-text)]">
                    {discoverSearch
                      ? `Showing live events matching "${discoverSearch}" across India`
                      : 'Explore live gatherings across India with real-time pass availability'}
                  </p>
                </div>

                {/* Filter Controls Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* City Selector */}
                  <select
                    value={discoverCity}
                    onChange={(e) => setDiscoverCity(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                  >
                    {CITIES.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>

                  {/* Format Selector */}
                  <select
                    value={discoverFormat}
                    onChange={(e) => setDiscoverFormat(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                  >
                    {FORMAT_OPTIONS.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>

                  {/* Price Selector */}
                  <select
                    value={discoverPrice}
                    onChange={(e) => setDiscoverPrice(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                  >
                    <option value="all">All Pricing</option>
                    <option value="free">Free Events</option>
                    <option value="paid">Paid Events</option>
                  </select>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={loadDiscoverEvents}
                    className="p-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                    title="Refresh Events"
                  >
                    <RefreshCw className={`w-4 h-4 ${discoverLoading ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Active Filter Reset */}
                  {(discoverSearch || discoverCategory !== 'All' || discoverCity !== 'All Cities' || discoverFormat !== 'All Formats' || discoverPrice !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextParams = new URLSearchParams(searchParams);
                        nextParams.delete('q');
                        setSearchParams(nextParams);
                        setDiscoverCategory('All');
                        setDiscoverCity('All Cities');
                        setDiscoverFormat('All Formats');
                        setDiscoverPrice('all');
                      }}
                      className="text-xs font-bold text-red-500 hover:underline px-2 py-1 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Events Grid */}
              {discoverLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
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
              ) : discoverEvents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {discoverEvents.map((evt) => (
                    <EventCard
                      key={evt._id || evt.id}
                      event={evt}
                      onBook={(e) => setActiveBookingEvent(e)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto" />
                  <h4 className="font-bold text-base">No Matching Events Found</h4>
                  <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
                    Try adjusting your search criteria or resetting filters to discover more events.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const nextParams = new URLSearchParams(searchParams);
                      nextParams.delete('q');
                      setSearchParams(nextParams);
                      setDiscoverCategory('All');
                      setDiscoverCity('All Cities');
                      setDiscoverFormat('All Formats');
                      setDiscoverPrice('all');
                    }}
                    className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ================= TAB 3: MY BOOKINGS ================= */}
        {activeTab === 'bookings' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Breadcrumb Header */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/attendee')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover Events</span>
                </button>
                <h2 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                  My Bookings & Receipts
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  View and manage your confirmed ticket orders and official receipts
                </p>
              </div>
            </div>
            {/* Filter Bar */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 shadow-xs">
              <div className="flex items-center gap-2">
                {['all', 'confirmed', 'pending', 'cancelled'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBookingFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors cursor-pointer ${
                      bookingFilter === st
                        ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                        : 'bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={loadBookings}
                className="p-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-xs text-[var(--color-secondary-text)] transition-colors cursor-pointer"
                title="Refresh Bookings"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${bookingsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Payment error message banner */}
            {paymentActionError && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{paymentActionError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentActionError(null)}
                  className="text-xs font-bold hover:underline cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Bookings List */}
            {bookingsLoading ? (
              <div className="p-8 text-center text-xs text-[var(--color-secondary-text)] animate-pulse">
                Fetching bookings...
              </div>
            ) : bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((b) => {
                  const evt = b.eventId || {};
                  const isCancelled = b.status === 'cancelled';
                  const isConfirmed = b.status === 'confirmed';
                  const isPending = b.status === 'pending';
                  const isHoldActive =
                    isPending &&
                    b.holdExpiresAt &&
                    new Date(b.holdExpiresAt).getTime() > Date.now();

                  return (
                    <div
                      key={b._id}
                      className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        {evt.image && (
                          <img
                            src={evt.image}
                            alt={evt.title}
                            className="w-16 h-16 rounded-xl object-cover border border-[var(--color-borders)] shrink-0"
                          />
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-[var(--color-primary-action)]">
                              {b.bookingReference}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                isCancelled
                                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                                  : isConfirmed
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-amber-500/15 text-amber-600'
                              }`}
                            >
                              {b.status}
                            </span>
                            {isHoldActive && (
                              <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                <span>10-min reservation hold</span>
                              </span>
                            )}
                            {b.paymentStatus === 'failed' && (
                              <span className="text-[10px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                                Payment Failed
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-[var(--color-main-text)]">{evt.title}</h4>
                          <div className="text-xs text-[var(--color-secondary-text)] flex items-center gap-3 flex-wrap">
                            <span>{evt.date} • {evt.time}</span>
                            <span>•</span>
                            <span>{b.quantity} Ticket{b.quantity > 1 ? 's' : ''} ({b.ticketType})</span>
                            <span>•</span>
                            <span className="font-bold text-[var(--color-main-text)]">
                              {b.totalAmount > 0 ? `₹${b.totalAmount}` : 'Free'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                        {isPending && b.paymentStatus !== 'completed' && (
                          <button
                            type="button"
                            disabled={paymentProcessingId === b._id}
                            onClick={() => handleCompletePayment(b)}
                            className="px-3.5 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {paymentProcessingId === b._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CreditCard className="w-3.5 h-3.5" />
                            )}
                            <span>Pay Now (₹{b.totalAmount})</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveBookingReceipt(b)}
                          className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-xs font-bold text-[var(--color-main-text)] transition-colors cursor-pointer"
                        >
                          View Receipt
                        </button>
                        {isConfirmed && (
                          <button
                            type="button"
                            onClick={() => navigateToTab('tickets')}
                            className="px-3 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>My Pass</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl text-center space-y-3">
                <Ticket className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto" />
                <h4 className="font-bold text-base">No Bookings Found</h4>
                <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
                  You do not have any {bookingFilter !== 'all' ? bookingFilter : ''} bookings at the moment.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToTab('discovery')}
                  className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs cursor-pointer"
                >
                  Discover Events
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ================= TAB 4: MY TICKETS ================= */}
        {activeTab === 'tickets' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/attendee')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover Events</span>
                </button>
                <h2 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                  My Verified Digital Passes
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  Official digital QR tickets ready for registration desk check-in
                </p>
              </div>
              <button
                type="button"
                onClick={loadTickets}
                className="p-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-xs text-[var(--color-secondary-text)] transition-colors cursor-pointer"
                title="Refresh Tickets"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${ticketsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {ticketsLoading ? (
              <div className="p-8 text-center text-xs text-[var(--color-secondary-text)] animate-pulse">
                Loading digital admission passes...
              </div>
            ) : tickets.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tickets.map((tkt) => {
                  const evt = tkt.eventId || {};
                  const isValid = tkt.status === 'valid';
                  return (
                    <div
                      key={tkt._id}
                      className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 relative overflow-hidden"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-[var(--color-primary-action)]">
                            {tkt.ticketCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isValid
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-red-500/15 text-red-600'
                            }`}
                          >
                            {tkt.status}
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-golden-accent)]">
                            {evt.category || 'Pass'}
                          </span>
                          <h4 className="font-bold text-sm text-[var(--color-main-text)] leading-snug line-clamp-2 mt-0.5">
                            {evt.title}
                          </h4>
                        </div>

                        <div className="bg-[var(--color-secondary-bg)] rounded-xl p-3 space-y-1.5 text-xs text-[var(--color-secondary-text)]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />
                            <span>{evt.date} • {evt.time}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[var(--color-golden-accent)] shrink-0" />
                            <span className="truncate">{evt.venue}, {evt.city}</span>
                          </div>
                          <div className="pt-1 border-t border-[var(--color-borders)] flex justify-between text-[11px]">
                            <span>Attendee: <strong>{tkt.attendeeName}</strong></span>
                            <span>Seat: <strong>{tkt.seatNumber || 'GA'}</strong></span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveTicketPass(tkt)}
                        className="w-full py-2.5 px-3 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>View Pass & QR Code</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl text-center space-y-3">
                <Sparkles className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto" />
                <h4 className="font-bold text-base">No Passes Available</h4>
                <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
                  Digital QR passes are generated automatically as soon as you confirm an event booking.
                </p>
                <button
                  type="button"
                  onClick={() => navigateToTab('discovery')}
                  className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs cursor-pointer"
                >
                  Book an Event
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ================= TAB 5: NOTIFICATIONS ================= */}
        {activeTab === 'notifications' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/attendee')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover Events</span>
                </button>
                <h2 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                  Admission & Stage Alerts
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  Real booking confirmations, cancellations, and stage announcements
                </p>
              </div>

              {notifications.some((n) => !n.isRead) && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  className="px-3.5 py-1.5 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-xs font-bold text-[var(--color-primary-action)] transition-colors cursor-pointer"
                >
                  Mark All Read
                </button>
              )}
            </div>

            {notificationsLoading ? (
              <div className="p-8 text-center text-xs text-[var(--color-secondary-text)] animate-pulse">
                Fetching notifications...
              </div>
            ) : notifications.length > 0 ? (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n._id}
                    className={`p-4 rounded-2xl border transition-colors flex items-start justify-between gap-3 ${
                      n.isRead
                        ? 'bg-[var(--color-card-bg)] border-[var(--color-borders)] opacity-80'
                        : 'bg-[var(--color-card-bg)] border-[var(--color-primary-action)]/40 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          n.isRead
                            ? 'bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)]'
                            : 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]'
                        }`}
                      >
                        <Bell className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs sm:text-sm text-[var(--color-main-text)]">
                            {n.title}
                          </h4>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-[var(--color-primary-action)] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                          {n.message}
                        </p>
                        <span className="text-[10px] text-[var(--color-secondary-text)]/70 block pt-1">
                          {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                    </div>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkAsRead(n._id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer shrink-0"
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl text-center space-y-2">
                <Bell className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto" />
                <h4 className="font-bold text-base">All Caught Up!</h4>
                <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
                  You have no pending notifications right now.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ================= TAB 6: REVIEWS ================= */}
        {activeTab === 'reviews' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/attendee')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover Events</span>
                </button>
                <h2 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                  Event Reviews & Feedback
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  Share ratings and feedback for events you have booked on UTSAV
                </p>
              </div>
            </div>

            {/* Booked Events Eligible for Review */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
                Booked Events Eligible for Review
              </span>

              {bookings.filter((b) => b.status === 'confirmed').length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {bookings
                    .filter((b) => b.status === 'confirmed')
                    .map((b) => {
                      const evt = b.eventId || {};
                      const existingReview = myReviews.find(
                        (r) => r.eventId?._id === evt._id || r.eventId === evt._id
                      );

                      return (
                        <div
                          key={b._id}
                          className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs"
                        >
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-[var(--color-main-text)] truncate">
                              {evt.title}
                            </h4>
                            <span className="text-[11px] text-[var(--color-secondary-text)] block mt-0.5">
                              {evt.date} • {evt.city}
                            </span>
                            {existingReview && (
                              <div className="flex items-center gap-1 mt-1 text-amber-400">
                                {[...Array(existingReview.rating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-amber-400" />
                                ))}
                                <span className="text-[10px] font-bold text-[var(--color-secondary-text)] ml-1">
                                  Reviewed
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveReviewEvent({
                                event: evt,
                                existingReview,
                              })
                            }
                            className="px-3 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs shrink-0 cursor-pointer shadow-xs"
                          >
                            {existingReview ? 'Edit Review' : 'Write Review'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--color-secondary-bg)] border border-dashed border-[var(--color-borders)] text-center text-xs text-[var(--color-secondary-text)]">
                  You need a confirmed booking for an event before you can submit a review.
                </div>
              )}
            </div>

            {/* My Published Reviews */}
            <div className="space-y-3 pt-4 border-t border-[var(--color-borders)]">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
                Your Published Reviews ({myReviews.length})
              </span>

              {reviewsLoading ? (
                <div className="p-4 text-center text-xs text-[var(--color-secondary-text)] animate-pulse">
                  Loading your reviews...
                </div>
              ) : myReviews.length > 0 ? (
                <div className="space-y-3">
                  {myReviews.map((r) => (
                    <div
                      key={r._id}
                      className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-4 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs sm:text-sm text-[var(--color-main-text)]">
                          {r.eventId?.title || 'Event'}
                        </span>
                        <div className="flex items-center gap-1 text-amber-400">
                          {[...Array(r.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                        "{r.comment}"
                      </p>
                      <span className="text-[10px] text-[var(--color-secondary-text)]/70 block">
                        Submitted on {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--color-secondary-bg)]/50 text-center text-xs text-[var(--color-secondary-text)]">
                  No reviews submitted yet.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ================= TAB 7: PROFILE & SETTINGS ================= */}
        {activeTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between pb-1">
              <div>
                <button
                  type="button"
                  onClick={() => navigate('/attendee')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer mb-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Discover Events</span>
                </button>
                <h2 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                  Profile & Account Settings
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  Manage your attendee identity and security preferences
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Details Card */}
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--color-borders)] pb-3">
                  <User className="w-4 h-4 text-[var(--color-primary-action)]" />
                  <h4 className="font-bold text-sm">Personal Information</h4>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Email Address</label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-secondary-text)] cursor-not-allowed opacity-80"
                      title="Email is verified with your account credentials."
                    />
                    <span className="text-[10px] text-[var(--color-secondary-text)] block mt-0.5">
                      Account email cannot be modified directly.
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">City / Campus</label>
                    <input
                      type="text"
                      value={profile.city}
                      onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                      placeholder="e.g. Bangalore, Karnataka"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Bio / Interests</label>
                    <textarea
                      rows={2}
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      placeholder="Interested in hackathons, AI, and campus dance battles..."
                      maxLength={300}
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden resize-none"
                    />
                  </div>

                  {profileMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        profileMsg.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-600 border border-red-500/20'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{profileMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    Save Profile Changes
                  </button>
                </form>
              </div>

              {/* Password & Security Card */}
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-[var(--color-borders)] pb-3">
                  <KeyRound className="w-4 h-4 text-[var(--color-golden-accent)]" />
                  <h4 className="font-bold text-sm">Security & Password</h4>
                </div>

                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      required
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      required
                      minLength={6}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, confirmPassword: e.target.value })
                      }
                      required
                      placeholder="Repeat new password"
                      className="w-full px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>

                  {passwordMsg && (
                    <div
                      className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                        passwordMsg.type === 'success'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-red-500/10 text-red-600 border border-red-500/20'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{passwordMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="w-full py-2.5 px-4 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {passwordLoading ? 'Updating Password...' : 'Change Password'}
                  </button>
                </form>

                {/* Account Role Notice */}
                <div className="pt-2 border-t border-[var(--color-borders)] text-[11px] text-[var(--color-secondary-text)] flex items-start gap-2">
                  <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Logged in as <strong>Attendee</strong>. Keep your account details up to date for smooth event entry.
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ================= MODALS ================= */}
      {/* 1. Interactive Booking Modal */}
      {activeBookingEvent && (
        <BookingModal
          event={activeBookingEvent}
          onClose={() => setActiveBookingEvent(null)}
          onBookingSuccess={handleBookingSuccess}
        />
      )}

      {/* 2. Ticket Pass Modal with Dynamic QR */}
      {activeTicketPass && (
        <TicketPassModal
          ticket={activeTicketPass}
          onClose={() => setActiveTicketPass(null)}
        />
      )}

      {/* 3. Booking Details & Receipt Modal */}
      {activeBookingReceipt && (
        <BookingDetailsModal
          booking={activeBookingReceipt}
          onClose={() => setActiveBookingReceipt(null)}
          onBookingUpdated={handleBookingUpdated}
        />
      )}

      {/* 4. Review Modal */}
      {activeReviewEvent && (
        <ReviewModal
          event={activeReviewEvent.event}
          existingReview={activeReviewEvent.existingReview}
          onClose={() => setActiveReviewEvent(null)}
          onReviewSubmitted={() => {
            loadReviews();
            setActiveReviewEvent(null);
          }}
        />
      )}
    </div>
  );
}
