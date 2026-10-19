import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  User,
  Calendar,
  Ticket,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Bell,
  Star,
  CheckCircle2,
  MapPin,
  RefreshCw,
  Search,
  AlertCircle,
  Shield,
  KeyRound,
  X,
  CreditCard,
  Clock,
  Loader2,
  Flame,
  MessageSquare,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useChat } from '../context/ChatContext';
import EventCard from '../components/EventCard';
import BookingModal from '../components/BookingModal';
import TicketPassModal from '../components/TicketPassModal';
import BookingDetailsModal from '../components/BookingDetailsModal';
import ReviewModal from '../components/ReviewModal';
import FeaturedCarousel from '../components/FeaturedCarousel';
import Footer from '../components/Footer';
import TwoFactorSettings from '../components/TwoFactorSettings';
import ActiveSessionsCard from '../components/ActiveSessionsCard';
import ConversationList from '../components/chat/ConversationList';
import ConversationHeader from '../components/chat/ConversationHeader';
import MessageTimeline from '../components/chat/MessageTimeline';
import MessageComposer from '../components/chat/MessageComposer';
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
import { toggle2FAApi } from '../api/auth';
import { loadRazorpayScript } from '../utils/razorpay';
import { fetchPublishedEventsApi } from '../api/events';
import { EVENT_CATEGORIES, CITIES, FORMAT_OPTIONS } from '../config/taxonomy';

export default function AttendeeDashboard() {
  const { user } = useAuth();
  const { latestNotification, unreadCount } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    conversations,
    loadingConversations,
    activeConversation,
    openConversation,
    messages,
    loadingMessages,
    loadingMoreMessages,
    hasMoreMessages,
    loadOlderMessages,
    sendMessage,
    sendTyping,
    typingUsers,
    chatError,
    isConnected,
    startOrOpenConversation,
  } = useChat();

  // Map route URL path to active dashboard tab
  const getActiveTab = (pathname) => {
    if (pathname.startsWith('/attendee/bookings')) return 'bookings';
    if (pathname.startsWith('/attendee/tickets')) return 'tickets';
    if (pathname.startsWith('/attendee/messages')) return 'messages';
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
      messages: '/attendee/messages',
      notifications: '/attendee/notifications',
      reviews: '/attendee/reviews',
      profile: '/attendee/profile',
    };
    const target = tabPathMap[tabId] || '/attendee';
    if (location.pathname !== target) {
      navigate(target);
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
  const discoverSearch = searchParams.get('q') || searchParams.get('search') || '';
  const [discoverCategory, setDiscoverCategory] = useState('All');
  const [discoverCity, setDiscoverCity] = useState(searchParams.get('city') || 'All Cities');
  const [discoverFormat, setDiscoverFormat] = useState('All Formats');
  const [discoverPrice, setDiscoverPrice] = useState('all');
  const [discoverDate, setDiscoverDate] = useState('all');
  const [discoverSort, setDiscoverSort] = useState('soonest');
  const [discoverPage, setDiscoverPage] = useState(1);
  const [discoverTotalPages, setDiscoverTotalPages] = useState(1);
  const [discoverTotalCount, setDiscoverTotalCount] = useState(0);

  // All published events for curated collections & dynamic city discovery
  const [allPublishedForCollections, setAllPublishedForCollections] = useState([]);

  // Synchronize inline search input with URL search param
  const [searchInput, setSearchInput] = useState(discoverSearch);

  useEffect(() => {
    setSearchInput(discoverSearch);
  }, [discoverSearch]);

  // Synchronize discoverCity with URL search param (e.g. from navbar city selector)
  useEffect(() => {
    const urlCity = searchParams.get('city') || 'All Cities';
    setDiscoverCity(urlCity);
  }, [searchParams]);

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
    twoFactorEnabled: false,
    twoFactorMethod: 'email',
    totpEnrolled: false,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  // 2FA Security State
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorMsg, setTwoFactorMsg] = useState(null);
  const [show2FAConfirm, setShow2FAConfirm] = useState(false);
  const [twoFactorPassword, setTwoFactorPassword] = useState('');

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
  // 1. Overview & Stats & Active Tickets
  const loadOverviewStats = useCallback(async () => {
    setLoadingOverview(true);
    try {
      const [res, tRes] = await Promise.all([
        fetchAttendeeStatsApi(),
        fetchMyTicketsApi('all').catch(() => null),
      ]);
      if (res && res.success) {
        setStats(res.stats);
        setUpcomingBookings(res.upcomingBookings || []);
      }
      if (tRes && Array.isArray(tRes.tickets)) {
        setTickets(tRes.tickets);
      }
    } catch (err) {
      console.error('Failed to load attendee overview stats:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  // 2. Discover Events (Primary catalog querying backend)
  const loadDiscoverEvents = useCallback(
    async (targetPage = 1) => {
      setDiscoverLoading(true);
      try {
        const res = await fetchPublishedEventsApi({
          search: discoverSearch.trim() || undefined,
          category: discoverCategory !== 'All' ? discoverCategory : undefined,
          city: discoverCity !== 'All Cities' ? discoverCity : undefined,
          format: discoverFormat !== 'All Formats' ? discoverFormat : undefined,
          pricing: discoverPrice !== 'all' ? discoverPrice : undefined,
          date: discoverDate !== 'all' ? discoverDate : undefined,
          sort: discoverSort !== 'soonest' ? discoverSort : undefined,
          page: targetPage,
          limit: 12,
        });
        if (res && Array.isArray(res.events)) {
          setDiscoverEvents(res.events);
          setDiscoverPage(res.page || targetPage);
          setDiscoverTotalPages(res.pages || 1);
          setDiscoverTotalCount(res.total !== undefined ? res.total : res.events.length);
        }
      } catch (err) {
        console.error('Failed to load discover events:', err);
      } finally {
        setDiscoverLoading(false);
      }
    },
    [discoverSearch, discoverCategory, discoverCity, discoverFormat, discoverPrice, discoverDate, discoverSort]
  );

  // 3. Load events for curated collections
  const loadAllPublishedForCollections = useCallback(async () => {
    try {
      const res = await fetchPublishedEventsApi({ limit: 30, sort: 'soonest' });
      if (res && Array.isArray(res.events)) {
        setAllPublishedForCollections(res.events);
      }
    } catch (err) {
      console.warn('Could not load events for collections:', err.message);
    }
  }, []);

  // 4. Bookings
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

  // 5. Tickets
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

  // 6. Notifications
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

  // 7. Reviews
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

  // 8. Profile
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
          twoFactorEnabled: Boolean(res.user.twoFactorEnabled),
          twoFactorMethod: res.user.twoFactorMethod || 'email',
          totpEnrolled: Boolean(res.user.totpEnrolled),
        });
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Dynamic Cities list (merges taxonomy with any active event cities)
  const availableCities = useMemo(() => {
    const citySet = new Set(CITIES);
    allPublishedForCollections.forEach((e) => {
      if (e.city && e.city.trim()) citySet.add(e.city.trim());
    });
    return Array.from(citySet);
  }, [allPublishedForCollections]);

  // Curated Collections Calculation with STRICT Deduplication against Featured Event & each other
  const featuredEventId = useMemo(() => {
    const feat = allPublishedForCollections.find((e) => e.isFeatured);
    return feat ? feat._id : allPublishedForCollections[0]?._id;
  }, [allPublishedForCollections]);

  // 1. Weekend Events
  const weekendEvents = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const daysToFriday = (5 - currentDay + 7) % 7;
    const weekendStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (currentDay === 6 ? -1 : currentDay === 0 ? -2 : daysToFriday), 0, 0, 0);
    const daysToSunday = (7 - currentDay) % 7;
    const weekendEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysToSunday, 23, 59, 59, 999);

    return allPublishedForCollections.filter((evt) => {
      if (evt._id === featuredEventId) return false;
      const d = evt.isoDate ? new Date(evt.isoDate) : null;
      return d && d >= weekendStart && d <= weekendEnd;
    });
  }, [allPublishedForCollections, featuredEventId]);

  // 2. Near You Events
  const nearYouCity = discoverCity !== 'All Cities' ? discoverCity : (profile?.city || user?.city || null);
  const nearYouEvents = useMemo(() => {
    if (!nearYouCity || nearYouCity === 'All Cities') return [];
    const usedIds = new Set([featuredEventId, ...weekendEvents.map((e) => e._id)]);
    return allPublishedForCollections.filter((evt) => {
      if (usedIds.has(evt._id)) return false;
      return evt.city && evt.city.toLowerCase() === nearYouCity.toLowerCase();
    });
  }, [allPublishedForCollections, featuredEventId, weekendEvents, nearYouCity]);

  // 3. Popular & High-Demand Events
  const popularEvents = useMemo(() => {
    const usedIds = new Set([
      featuredEventId,
      ...weekendEvents.map((e) => e._id),
      ...nearYouEvents.map((e) => e._id),
    ]);
    return allPublishedForCollections.filter((evt) => {
      if (usedIds.has(evt._id)) return false;
      return (
        (evt.spotsLeft !== undefined && evt.spotsLeft < 60 && evt.spotsLeft > 0) ||
        (evt.totalCapacity && evt.spotsLeft !== undefined && (evt.totalCapacity - evt.spotsLeft) / evt.totalCapacity > 0.4)
      );
    });
  }, [allPublishedForCollections, featuredEventId, weekendEvents, nearYouEvents]);

  // 4. Newly Added Events
  const newlyAddedEvents = useMemo(() => {
    const usedIds = new Set([
      featuredEventId,
      ...weekendEvents.map((e) => e._id),
      ...nearYouEvents.map((e) => e._id),
      ...popularEvents.map((e) => e._id),
    ]);
    return allPublishedForCollections
      .filter((evt) => !usedIds.has(evt._id))
      .slice(0, 4);
  }, [allPublishedForCollections, featuredEventId, weekendEvents, nearYouEvents, popularEvents]);

  // Active filter checks
  const hasActiveFilters = Boolean(
    discoverSearch ||
    discoverCategory !== 'All' ||
    discoverCity !== 'All Cities' ||
    discoverDate !== 'all' ||
    discoverFormat !== 'All Formats' ||
    discoverPrice !== 'all' ||
    discoverSort !== 'soonest'
  );

  // City change handler
  const handleCityChange = (newCity) => {
    setDiscoverCity(newCity);
    setDiscoverPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (newCity && newCity !== 'All Cities') {
      nextParams.set('city', newCity);
    } else {
      nextParams.delete('city');
    }
    setSearchParams(nextParams);
  };

  // Search & Filter handlers
  const handleInlineSearchSubmit = (e) => {
    e.preventDefault();
    const nextParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      nextParams.set('q', searchInput.trim());
    } else {
      nextParams.delete('q');
      nextParams.delete('search');
    }
    setSearchParams(nextParams);
    setDiscoverPage(1);
  };

  const handleClearInlineSearch = () => {
    setSearchInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    nextParams.delete('search');
    setSearchParams(nextParams);
    setDiscoverPage(1);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('q');
    nextParams.delete('search');
    nextParams.delete('city');
    setSearchParams(nextParams);
    setDiscoverCategory('All');
    setDiscoverCity('All Cities');
    setDiscoverDate('all');
    setDiscoverFormat('All Formats');
    setDiscoverPrice('all');
    setDiscoverSort('soonest');
    setDiscoverPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= discoverTotalPages && newPage !== discoverPage) {
      loadDiscoverEvents(newPage);
      const el = document.getElementById('utsav-event-catalog');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Tab change trigger: load initial tab data when navigating between tabs
  useEffect(() => {
    if (activeTab === 'discovery') {
      loadOverviewStats();
      loadAllPublishedForCollections();
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
    loadOverviewStats,
    loadAllPublishedForCollections,
    loadBookings,
    loadTickets,
    loadNotifications,
    loadReviews,
    loadProfile,
  ]);

  // Discover Events query: triggers when search query or discovery filters change
  useEffect(() => {
    if (activeTab === 'discovery') {
      loadDiscoverEvents(1);
    }
  }, [
    activeTab,
    discoverSearch,
    discoverCategory,
    discoverCity,
    discoverFormat,
    discoverPrice,
    discoverDate,
    discoverSort,
    loadDiscoverEvents,
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

  // Live socket notification listener: updates notifications list instantly
  useEffect(() => {
    if (latestNotification) {
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === latestNotification._id);
        if (exists) {
          return prev.map((n) => (n._id === latestNotification._id ? latestNotification : n));
        }
        return [latestNotification, ...prev];
      });
    }
  }, [latestNotification]);

  // Keep stats in sync with real-time unreadCount
  useEffect(() => {
    if (typeof unreadCount === 'number') {
      setStats((prev) => ({ ...prev, unreadNotifications: unreadCount }));
    }
  }, [unreadCount]);

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

  // 2FA toggle submission
  const handleToggle2FA = async (e) => {
    e.preventDefault();
    setTwoFactorLoading(true);
    setTwoFactorMsg(null);
    try {
      const targetState = !profile.twoFactorEnabled;
      const res = await toggle2FAApi({
        enabled: targetState,
        currentPassword: twoFactorPassword,
      });
      if (res && res.success) {
        setProfile((prev) => ({ ...prev, twoFactorEnabled: res.twoFactorEnabled }));
        setTwoFactorMsg({
          type: 'success',
          text: `Two-factor authentication has been ${res.twoFactorEnabled ? 'enabled' : 'disabled'}.`,
        });
        setShow2FAConfirm(false);
        setTwoFactorPassword('');
      } else {
        setTwoFactorMsg({
          type: 'error',
          text: res?.message || 'Failed to update 2FA settings.',
        });
      }
    } catch (err) {
      setTwoFactorMsg({
        type: 'error',
        text: err.message || 'An error occurred updating 2FA settings.',
      });
    } finally {
      setTwoFactorLoading(false);
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

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] py-6 sm:py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ================= CANONICAL DISCOVERY HOMEPAGE (/attendee & /attendee/events) ================= */}
        {activeTab === 'discovery' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >


            {/* ================= SECTION 3: EXPLORE BY CATEGORY ================= */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                  <span className="font-extrabold text-xs uppercase tracking-wider text-[var(--color-secondary-text)]">
                    Explore by Category
                  </span>
                </div>
                {discoverCategory !== 'All' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDiscoverCategory('All');
                      setDiscoverPage(1);
                    }}
                    className="text-[11px] font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                  >
                    Reset to All Categories
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                <button
                  type="button"
                  onClick={() => {
                    setDiscoverCategory('All');
                    setDiscoverPage(1);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 snap-start ${
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
                      onClick={() => {
                        setDiscoverCategory(catName);
                        setDiscoverPage(1);
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 snap-start ${
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

            {/* ================= SECTION 4: ONE COMPACT FEATURED-EVENT BANNER (Hidden during search) ================= */}
            {!discoverSearch && (
              <FeaturedCarousel
                onSelectEvent={(evt) => setActiveBookingEvent(evt)}
                onExploreMore={() => {
                  const el = document.getElementById('utsav-event-catalog');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                onViewEvent={(evt) => setActiveBookingEvent(evt)}
              />
            )}

            {/* ================= SECTION 5: CURATED EVENT COLLECTIONS (Hidden during search) ================= */}
            {/* Populated strictly from genuine event data; empty collections are omitted; zero repetitive duplicates */}
            {!discoverSearch && (weekendEvents.length > 0 || nearYouEvents.length > 0 || popularEvents.length > 0 || newlyAddedEvents.length > 0) && (
              <div className="space-y-8 pt-1">
                {/* 1. Happening This Weekend */}
                {weekendEvents.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                            Happening This Weekend
                          </h3>
                          <p className="text-[11px] text-[var(--color-secondary-text)]">
                            Upcoming campus gatherings and stage shows scheduled for this Saturday and Sunday
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverDate('this-weekend');
                          setDiscoverPage(1);
                          const el = document.getElementById('utsav-event-catalog');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>View Weekend Events</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {weekendEvents.slice(0, 4).map((evt) => (
                        <EventCard
                          key={`weekend-${evt._id || evt.id}`}
                          event={evt}
                          onBook={(e) => setActiveBookingEvent(e)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 2. Near You / In Selected City */}
                {nearYouEvents.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                            Events in {nearYouCity}
                          </h3>
                          <p className="text-[11px] text-[var(--color-secondary-text)]">
                            Verified experiences and campus gatherings taking place in your selected region
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverCity(nearYouCity);
                          setDiscoverPage(1);
                          const el = document.getElementById('utsav-event-catalog');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>View All in {nearYouCity}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {nearYouEvents.slice(0, 4).map((evt) => (
                        <EventCard
                          key={`near-${evt._id || evt.id}`}
                          event={evt}
                          onBook={(e) => setActiveBookingEvent(e)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 3. Popular & High-Demand Stages */}
                {popularEvents.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                          <Flame className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                            Selling Fast • Popular Showcases
                          </h3>
                          <p className="text-[11px] text-[var(--color-secondary-text)]">
                            High-demand stages and workshops with limited confirmed capacity remaining
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverSort('popular');
                          setDiscoverPage(1);
                          const el = document.getElementById('utsav-event-catalog');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>Sort by Demand</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {popularEvents.slice(0, 4).map((evt) => (
                        <EventCard
                          key={`pop-${evt._id || evt.id}`}
                          event={evt}
                          onBook={(e) => setActiveBookingEvent(e)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* 4. Newly Added Experiences */}
                {newlyAddedEvents.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] flex items-center justify-center shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                            Newly Added Experiences
                          </h3>
                          <p className="text-[11px] text-[var(--color-secondary-text)]">
                            Recently published campus festivals, hackathons, and gatherings open for registration
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverSort('newest');
                          setDiscoverPage(1);
                          const el = document.getElementById('utsav-event-catalog');
                          if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <span>View Newest</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                      {newlyAddedEvents.slice(0, 4).map((evt) => (
                        <EventCard
                          key={`new-${evt._id || evt.id}`}
                          event={evt}
                          onBook={(e) => setActiveBookingEvent(e)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ================= SECTION 6: ALL PUBLISHED EVENTS (PRIMARY DISCOVERY AREA) ================= */}
            <div id="utsav-event-catalog" className="space-y-4 pt-2">
              {/* Header with Title and Result Counts */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-xl sm:text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
                      {discoverSearch
                        ? `Search Results for "${discoverSearch}"`
                        : discoverCategory !== 'All'
                        ? `${discoverCategory} Experiences`
                        : discoverCity !== 'All Cities'
                        ? `Events in ${discoverCity}`
                        : 'All Published Events'}
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)] border border-[var(--color-primary-action)]/20">
                      {discoverTotalCount || discoverEvents.length} Event{discoverTotalCount !== 1 ? 's' : ''} {discoverSearch ? 'Found' : 'Available'}
                    </span>
                    {discoverSearch && (
                      <button
                        type="button"
                        onClick={handleClearInlineSearch}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[var(--color-secondary-bg)] hover:bg-red-500/10 text-[var(--color-secondary-text)] hover:text-red-500 border border-[var(--color-borders)] hover:border-red-500/30 transition-all cursor-pointer shadow-2xs"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Search</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-secondary-text)] mt-0.5">
                    {discoverSearch
                      ? `Showing verified gatherings matching "${discoverSearch}" across India`
                      : 'Compare passes, schedules, formats, and live seat availability with direct checkout'}
                  </p>
                </div>

                {/* Filter Controls Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Date Filter */}
                  <select
                    value={discoverDate}
                    onChange={(e) => {
                      setDiscoverDate(e.target.value);
                      setDiscoverPage(1);
                    }}
                    aria-label="Filter by Date"
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">📅 All Dates</option>
                    <option value="today">Today</option>
                    <option value="this-weekend">This Weekend</option>
                    <option value="this-week">This Week</option>
                    <option value="this-month">This Month</option>
                    <option value="upcoming">Upcoming Only</option>
                  </select>

                  {/* Format Selector */}
                  <select
                    value={discoverFormat}
                    onChange={(e) => {
                      setDiscoverFormat(e.target.value);
                      setDiscoverPage(1);
                    }}
                    aria-label="Filter by Format"
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden cursor-pointer"
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
                    onChange={(e) => {
                      setDiscoverPrice(e.target.value);
                      setDiscoverPage(1);
                    }}
                    aria-label="Filter by Price"
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden cursor-pointer"
                  >
                    <option value="all">All Pricing</option>
                    <option value="free">Free Passes</option>
                    <option value="paid">Paid Passes</option>
                  </select>

                  {/* Sort Selector */}
                  <select
                    value={discoverSort}
                    onChange={(e) => {
                      setDiscoverSort(e.target.value);
                      setDiscoverPage(1);
                    }}
                    aria-label="Sort Events"
                    className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden cursor-pointer"
                  >
                    <option value="soonest">📅 Soonest First</option>
                    <option value="latest">📅 Furthest First</option>
                    <option value="price-low">💳 Price: Low to High</option>
                    <option value="price-high">💳 Price: High to Low</option>
                    <option value="popular">🔥 Most Popular</option>
                    <option value="newest">✨ Newly Added</option>
                  </select>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={() => loadDiscoverEvents(discoverPage)}
                    className="p-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                    title="Refresh Events"
                    aria-label="Refresh Events"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${discoverLoading ? 'animate-spin' : ''}`} />
                  </button>

                  {/* Reset All Filters Button */}
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-xs font-bold text-red-500 hover:underline px-2 py-1 cursor-pointer"
                    >
                      Reset All
                    </button>
                  )}
                </div>
              </div>

              {/* Active Filter Indicators */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
                  <span className="text-[var(--color-secondary-text)] font-semibold text-[11px]">Active Filters:</span>
                  {discoverSearch && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Query: &ldquo;{discoverSearch}&rdquo;</span>
                      <button
                        type="button"
                        onClick={handleClearInlineSearch}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove search query filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverCity !== 'All Cities' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>City: {discoverCity}</span>
                      <button
                        type="button"
                        onClick={() => handleCityChange('All Cities')}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove city filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverCategory !== 'All' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Category: {discoverCategory}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverCategory('All');
                          setDiscoverPage(1);
                        }}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove category filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverDate !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Date: {discoverDate}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverDate('all');
                          setDiscoverPage(1);
                        }}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove date filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverFormat !== 'All Formats' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Format: {discoverFormat}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverFormat('All Formats');
                          setDiscoverPage(1);
                        }}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove format filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverPrice !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Pricing: {discoverPrice === 'free' ? 'Free Only' : 'Paid Only'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverPrice('all');
                          setDiscoverPage(1);
                        }}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Remove pricing filter"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {discoverSort !== 'soonest' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-[11px] font-medium">
                      <span>Sort: {discoverSort}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDiscoverSort('soonest');
                          setDiscoverPage(1);
                        }}
                        className="text-[var(--color-secondary-text)] hover:text-red-500 cursor-pointer p-0.5"
                        aria-label="Reset sorting to default"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Events Grid (4-column on desktop, 3-column on tablet, 2-column on small, 1-column on mobile) */}
              {discoverLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                    {discoverEvents.map((evt) => (
                      <EventCard
                        key={evt._id || evt.id}
                        event={evt}
                        onBook={(e) => setActiveBookingEvent(e)}
                      />
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  {discoverTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-4 border-t border-[var(--color-borders)]/60 text-xs">
                      <div className="text-[var(--color-secondary-text)] font-medium">
                        Page <span className="font-bold text-[var(--color-main-text)]">{discoverPage}</span> of{' '}
                        <span className="font-bold text-[var(--color-main-text)]">{discoverTotalPages}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={discoverPage <= 1 || discoverLoading}
                          onClick={() => handlePageChange(discoverPage - 1)}
                          className="px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          Previous
                        </button>
                        <div className="hidden sm:flex items-center gap-1">
                          {Array.from({ length: discoverTotalPages }, (_, i) => i + 1)
                            .filter(
                              (p) =>
                                p === 1 ||
                                p === discoverTotalPages ||
                                Math.abs(p - discoverPage) <= 1
                            )
                            .map((p, idx, arr) => {
                              const showEllipsisBefore = idx > 0 && p - arr[idx - 1] > 1;
                              return (
                                <div key={p} className="flex items-center gap-1">
                                  {showEllipsisBefore && (
                                    <span className="px-1 text-[var(--color-secondary-text)]">...</span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handlePageChange(p)}
                                    className={`w-8 h-8 rounded-xl font-bold transition-colors cursor-pointer ${
                                      p === discoverPage
                                        ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                                        : 'bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] border border-[var(--color-borders)]'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                        <button
                          type="button"
                          disabled={discoverPage >= discoverTotalPages || discoverLoading}
                          onClick={() => handlePageChange(discoverPage + 1)}
                          className="px-3.5 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl text-center space-y-4 shadow-xs">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] flex items-center justify-center mx-auto">
                    <Search className="w-7 h-7 opacity-60" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg text-[var(--color-main-text)] font-serif">
                      {discoverSearch ? `No events found matching "${discoverSearch}"` : 'No Matching Events Found'}
                    </h4>
                    <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] max-w-md mx-auto">
                      {discoverSearch
                        ? 'Check your spelling or try searching for broader keywords like "tech", "concert", "fest", or another city.'
                        : 'Try adjusting your filters, selecting another category, or clearing active filters.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                    {discoverSearch && (
                      <button
                        type="button"
                        onClick={handleClearInlineSearch}
                        className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs transition-all cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Clear Search</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="px-4 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] border border-[var(--color-borders)] font-bold text-xs transition-colors cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ================= SECTION 7: YOUR UPCOMING EVENTS & PASSES ================= */}
            {/* Positioned near the bottom of dashboard; compact preview for authenticated attendees */}
            <section className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[var(--color-borders)]/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Ticket className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)]">
                        Your Upcoming Passes & Reservations
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        {upcomingBookings.length} Active
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-secondary-text)]">
                      Instant check-in ready with verified dynamic QR code admission passes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => navigateToTab('tickets')}
                    className="text-xs font-bold text-[var(--color-primary-action)] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>All Tickets</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[var(--color-borders)]">•</span>
                  <button
                    type="button"
                    onClick={() => navigateToTab('bookings')}
                    className="text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>All Orders ({stats.totalBookings})</span>
                  </button>
                </div>
              </div>

              {upcomingBookings.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {upcomingBookings.map((b) => {
                    const evt = b.eventId || {};
                    return (
                      <div
                        key={b._id}
                        className="bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-[var(--color-primary-action)]/50 transition-colors shadow-2xs"
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
                            {evt.title || 'Event Booking'}
                          </h4>
                          <p className="text-xs text-[var(--color-secondary-text)] flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-action)] shrink-0" />
                            <span className="truncate">{evt.date || 'Upcoming'} • {evt.time || ''}</span>
                          </p>
                          {evt.venue && (
                            <p className="text-[11px] text-[var(--color-secondary-text)] flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[var(--color-golden-accent)] shrink-0" />
                              <span className="truncate">{evt.venue}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-borders)]/70">
                          <button
                            type="button"
                            onClick={() => setActiveBookingReceipt(b)}
                            className="text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                          >
                            Receipt
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const matched = tickets.find((t) => t.bookingId === b._id || t.eventId?._id === evt._id);
                              if (matched) {
                                setActiveTicketPass(matched);
                              } else {
                                navigateToTab('tickets');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-bold text-xs shadow-xs hover:bg-[var(--color-primary-action-hover)] transition-colors cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>View Pass (QR)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-[var(--color-secondary-bg)]/60 rounded-xl border border-dashed border-[var(--color-borders)] space-y-2">
                  <Ticket className="w-6 h-6 text-[var(--color-secondary-text)] mx-auto opacity-70" />
                  <p className="text-xs text-[var(--color-secondary-text)]">
                    You don't have any upcoming event passes right now. Discover and book an experience above!
                  </p>
                </div>
              )}
            </section>

            {/* ================= SECTION 8: PLATFORM FOOTER ================= */}
            <div className="pt-6 border-t border-[var(--color-borders)]/70">
              <Footer />
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
                        {isConfirmed && b.paymentStatus !== 'failed' && b.paymentStatus !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => {
                              startOrOpenConversation({
                                eventId: evt._id || b.eventId,
                                type: 'attendee_organizer',
                                autoOpenDrawer: true,
                              });
                            }}
                            className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-xs font-bold text-[var(--color-primary-action)] transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Direct chat with event organizer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Contact Organizer</span>
                          </button>
                        )}
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
                    onClick={() => {
                      if (!n.isRead) handleMarkAsRead(n._id);
                      if (n.link) navigate(n.link);
                    }}
                    className={`p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      n.link ? 'cursor-pointer hover:border-[var(--color-primary-action)]/60 hover:shadow-sm' : ''
                    } ${
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
                        <div className="flex items-center gap-3 pt-1">
                          <span className="text-[10px] text-[var(--color-secondary-text)]/70 block">
                            {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                          </span>
                          {n.link && (
                            <span className="text-[10px] font-bold text-[var(--color-primary-action)] hover:underline">
                              View details &rarr;
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAsRead(n._id);
                        }}
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

                      // Determine if event has ended based on endDate/isoDate and timezone
                      const now = new Date();
                      let hasEnded = false;
                      if (evt.endDate) {
                        hasEnded = new Date(evt.endDate).getTime() <= now.getTime();
                      } else if (evt.isoDate) {
                        hasEnded = new Date(evt.isoDate).getTime() + 4 * 3600 * 1000 <= now.getTime();
                      } else if (evt.status === 'completed') {
                        hasEnded = true;
                      }

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
                            {existingReview ? (
                              <div className="flex items-center gap-1 mt-1 text-amber-400">
                                {[...Array(existingReview.rating)].map((_, i) => (
                                  <Star key={i} className="w-3 h-3 fill-amber-400" />
                                ))}
                                <span className="text-[10px] font-bold text-[var(--color-secondary-text)] ml-1">
                                  Reviewed
                                </span>
                              </div>
                            ) : !hasEnded ? (
                              <span className="inline-block mt-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                Reviews open after event concludes
                              </span>
                            ) : null}
                          </div>

                          {hasEnded ? (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReviewEvent({
                                  event: evt,
                                  existingReview,
                                })
                              }
                              className="px-3 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-colors"
                            >
                              {existingReview ? 'Edit Review' : 'Write Review'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Reviews are unlocked after the event end date and time."
                              className="px-3 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-secondary-text)] opacity-60 font-bold text-xs shrink-0 cursor-not-allowed"
                            >
                              Upcoming
                            </button>
                          )}
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
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-amber-400">
                            {[...Array(r.rating)].map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-amber-400" />
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveReviewEvent({
                                event: r.eventId,
                                existingReview: r,
                              })
                            }
                            className="text-xs font-bold text-[var(--color-primary-action)] hover:underline ml-2 cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                      {r.comment && (
                        <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                          "{r.comment}"
                        </p>
                      )}
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

              {/* Security & 2FA Column */}
              <div className="space-y-6">
                {/* Two-Factor Authentication Card */}
                <TwoFactorSettings
                  user={profile}
                  onUserUpdated={(updates) =>
                    setProfile((prev) => ({ ...prev, ...updates }))
                  }
                />

                {/* Active Security Sessions Card */}
                <ActiveSessionsCard />

                {/* Password & Security Card */}
                <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--color-borders)] pb-3">
                    <KeyRound className="w-4 h-4 text-[var(--color-golden-accent)]" />
                    <h4 className="font-bold text-sm">Change Password</h4>
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
            </div>
          </motion.div>
        )}

        {/* ================= TAB 7: EVENT MESSAGES ================= */}
        {activeTab === 'messages' && (
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
                  Event Messages & Inquiries
                </h2>
                <p className="text-xs text-[var(--color-secondary-text)]">
                  Direct real-time conversations with organizers of your booked events
                </p>
              </div>
            </div>

            {/* Split-Pane Chat Interface */}
            <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl shadow-xs overflow-hidden h-[750px] max-h-[80vh] flex flex-col">
              <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Left: Conversation list */}
                <div
                  className={`w-full md:w-80 lg:w-96 border-r border-[var(--color-borders)] flex flex-col shrink-0 ${
                    activeConversation ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  <ConversationList
                    conversations={conversations}
                    activeConversationId={activeConversation?._id}
                    onSelectConversation={(conv) => openConversation(conv, { autoOpenDrawer: false })}
                    loading={loadingConversations}
                  />
                </div>

                {/* Right: Active Chat */}
                <div
                  className={`flex-1 flex flex-col bg-[var(--color-primary-bg)]/20 ${
                    !activeConversation ? 'hidden md:flex' : 'flex'
                  }`}
                >
                  {activeConversation ? (
                    <>
                      <ConversationHeader
                        conversation={activeConversation}
                        showBackButton={true}
                        onBack={() => openConversation(null, { autoOpenDrawer: false })}
                        isConnected={isConnected}
                      />
                      <MessageTimeline
                        messages={messages}
                        loading={loadingMessages}
                        loadingMore={loadingMoreMessages}
                        hasMore={hasMoreMessages}
                        onLoadMore={loadOlderMessages}
                        typingUsers={typingUsers}
                        error={chatError}
                        onRetry={() => openConversation(activeConversation._id)}
                        otherParticipantId={activeConversation.organizerId?._id || activeConversation.organizerId}
                      />
                      <MessageComposer
                        onSendMessage={sendMessage}
                        onTyping={sendTyping}
                        disabled={loadingMessages}
                      />
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--color-secondary-text)] space-y-2">
                      <div className="w-16 h-16 rounded-3xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] flex items-center justify-center text-[var(--color-primary-action)] shadow-xs mb-1">
                        <MessageSquare className="w-8 h-8" />
                      </div>
                      <h3 className="font-extrabold text-base text-[var(--color-main-text)] font-serif">
                        Select an Event Conversation
                      </h3>
                      <p className="text-xs max-w-sm">
                        Choose a conversation on the left, or click &quot;Contact Organizer&quot; on any of your confirmed bookings to send a direct message.
                      </p>
                    </div>
                  )}
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
