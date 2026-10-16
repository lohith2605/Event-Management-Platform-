import { useState, useEffect, useCallback, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAdminStatsApi,
  fetchAdminEventsApi,
  fetchAdminEventByIdApi,
  reviewAdminEventApi,
  fetchAdminUsersApi,
  fetchAdminUserByIdApi,
  updateAdminUserStatusApi,
  fetchAdminBookingsApi,
  fetchAdminBookingByIdApi,
  cancelAndRefundAdminBookingApi,
  fetchAdminReviewsApi,
  moderateAdminReviewApi,
  fetchAdminAuditLogsApi,
  fetchAdminNotificationsApi,
  markAdminNotificationReadApi,
  markAllAdminNotificationsReadApi,
} from '../api/admin';

import AdminHeader from '../components/admin/AdminHeader';
import AdminSidebar from '../components/admin/AdminSidebar';
import AdminOverviewTab from '../components/admin/AdminOverviewTab';
import AdminEventsTab from '../components/admin/AdminEventsTab';
import AdminEventDetailModal from '../components/admin/AdminEventDetailModal';
import AdminUsersTab from '../components/admin/AdminUsersTab';
import AdminUserDetailModal from '../components/admin/AdminUserDetailModal';
import AdminUserStatusModal from '../components/admin/AdminUserStatusModal';
import AdminBookingsTab from '../components/admin/AdminBookingsTab';
import AdminBookingDetailModal from '../components/admin/AdminBookingDetailModal';
import AdminReviewsTab from '../components/admin/AdminReviewsTab';
import AdminAuditLogsTab from '../components/admin/AdminAuditLogsTab';
import AdminNotificationsModal from '../components/admin/AdminNotificationsModal';
import AdminCouponsTab from '../components/admin/AdminCouponsTab';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldReduceMotion = useReducedMotion();
  const [, startTransition] = useTransition();

  // Active tab synchronized with URL (?tab=...)
  const tabParam = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabParam);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Success Feedback Toast
  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  // 1. Overview & Aggregate Stats State
  const [stats, setStats] = useState(null);
  const [recentPendingEvents, setRecentPendingEvents] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentAuditLogs, setRecentAuditLogs] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);

  // 2. Events & Moderation State
  const [events, setEvents] = useState([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPages, setEventsPages] = useState(1);
  const [eventsStatusCounts, setEventsStatusCounts] = useState({});
  const [eventsStatusFilter, setEventsStatusFilter] = useState(searchParams.get('status') || 'all');
  const [eventsCategoryFilter, setEventsCategoryFilter] = useState('all');
  const [eventsFormatFilter, setEventsFormatFilter] = useState('all');
  const [eventsSearchQuery, setEventsSearchQuery] = useState('');
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);

  // Event Details Modal State
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventBookingStats, setEventBookingStats] = useState({});
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [isProcessingEventAction, setIsProcessingEventAction] = useState(false);

  // 3. User Governance State
  const [users, setUsers] = useState([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPages, setUsersPages] = useState(1);
  const [usersRoleCounts, setUsersRoleCounts] = useState({});
  const [usersRoleFilter, setUsersRoleFilter] = useState('all');
  const [usersStatusFilter, setUsersStatusFilter] = useState('all');
  const [usersSearchQuery, setUsersSearchQuery] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState(null);

  // User Modals State
  const [selectedUser, setSelectedUser] = useState(null);
  const [userActivitySummary, setUserActivitySummary] = useState({});
  const [userDetailModalOpen, setUserDetailModalOpen] = useState(false);
  const [userStatusModalOpen, setUserStatusModalOpen] = useState(false);
  const [statusTargetUser, setStatusTargetUser] = useState(null);
  const [statusTargetAction, setStatusTargetAction] = useState('suspend');
  const [isProcessingUserStatus, setIsProcessingUserStatus] = useState(false);

  // 4. Bookings & Payments State
  const [bookings, setBookings] = useState([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingsPages, setBookingsPages] = useState(1);
  const [bookingsStats, setBookingsStats] = useState({});
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState('all');
  const [bookingsPaymentFilter, setBookingsPaymentFilter] = useState('all');
  const [bookingsSearchQuery, setBookingsSearchQuery] = useState('');
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);

  // Booking Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingTickets, setBookingTickets] = useState([]);
  const [bookingDetailModalOpen, setBookingDetailModalOpen] = useState(false);
  const [isProcessingBookingRefund, setIsProcessingBookingRefund] = useState(false);

  // 5. Reviews State
  const [reviews, setReviews] = useState([]);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsPages, setReviewsPages] = useState(1);
  const [reviewsStatusCounts, setReviewsStatusCounts] = useState({});
  const [reviewsStatusFilter, setReviewsStatusFilter] = useState('all');
  const [reviewsRatingFilter, setReviewsRatingFilter] = useState('all');
  const [reviewsSearchQuery, setReviewsSearchQuery] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState(null);
  const [isProcessingReviewAction, setIsProcessingReviewAction] = useState(false);

  // 6. Audit Logs State
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPages, setAuditPages] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('all');
  const [auditTargetTypeFilter, setAuditTargetTypeFilter] = useState('all');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);

  // 7. Notifications State
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);

  // Synchronize Tab with searchParams
  const handleTabChange = useCallback((tabId, extraParams = {}) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    startTransition(() => {
      setSearchParams({ tab: tabId, ...extraParams }, { replace: true });
    });
  }, [setSearchParams]);

  // Load Platform Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const data = await fetchAdminStatsApi();
      if (data && data.success) {
        setStats(data.stats);
        setRecentPendingEvents(data.recentPendingEvents || []);
        setRecentBookings(data.recentBookings || []);
        setRecentAuditLogs(data.recentAuditLogs || []);
      }
    } catch (err) {
      console.error('Error fetching admin platform stats:', err);
      setStatsError(err.message || 'Unable to load real administrative platform metrics.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load Events List
  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const data = await fetchAdminEventsApi({
        status: eventsStatusFilter,
        category: eventsCategoryFilter,
        format: eventsFormatFilter,
        search: eventsSearchQuery,
        page: eventsPage,
        limit: 10,
      });
      if (data && data.success) {
        setEvents(data.events || []);
        setEventsTotal(data.total || 0);
        setEventsPages(data.pages || 1);
        setEventsStatusCounts(data.statusCounts || {});
      }
    } catch (err) {
      console.error('Error fetching admin events list:', err);
      setEventsError(err.message || 'Failed to query event submissions.');
    } finally {
      setEventsLoading(false);
    }
  }, [eventsStatusFilter, eventsCategoryFilter, eventsFormatFilter, eventsSearchQuery, eventsPage]);

  // Load Event Full Details
  const openEventDetails = useCallback(async (eventId) => {
    try {
      const data = await fetchAdminEventByIdApi(eventId);
      if (data && data.success) {
        setSelectedEvent(data.event);
        setEventBookingStats(data.bookingStats || {});
        setEventModalOpen(true);
      }
    } catch (err) {
      console.error('Failed to open event details:', err);
      alert(err.message || 'Failed to load event details.');
    }
  }, []);

  // Quick Approve Event
  const handleQuickApprove = async (eventId, eventTitle) => {
    if (!window.confirm(`Are you sure you want to approve "${eventTitle}" and publish it for public discovery?`)) {
      return;
    }
    try {
      setIsProcessingEventAction(true);
      const res = await reviewAdminEventApi(eventId, { action: 'approve' });
      if (res && res.success) {
        showToast(`Event "${eventTitle}" has been approved and published!`);
        if (eventModalOpen) setEventModalOpen(false);
        loadEvents();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to approve event.');
    } finally {
      setIsProcessingEventAction(false);
    }
  };

  // Reject Event
  const handleRejectEvent = async (eventId, reason) => {
    try {
      setIsProcessingEventAction(true);
      const res = await reviewAdminEventApi(eventId, {
        action: 'reject',
        rejectionReason: reason,
      });
      if (res && res.success) {
        showToast('Event has been rejected with the stated reason.');
        setEventModalOpen(false);
        loadEvents();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to reject event.');
    } finally {
      setIsProcessingEventAction(false);
    }
  };

  // Return Event for Corrections
  const handleReturnEvent = async (eventId, feedback) => {
    try {
      setIsProcessingEventAction(true);
      const res = await reviewAdminEventApi(eventId, {
        action: 'return',
        rejectionReason: feedback,
      });
      if (res && res.success) {
        showToast('Event returned to organizer as draft with revision instructions.');
        setEventModalOpen(false);
        loadEvents();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to return event.');
    } finally {
      setIsProcessingEventAction(false);
    }
  };

  // Load Users List
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await fetchAdminUsersApi({
        role: usersRoleFilter,
        status: usersStatusFilter,
        search: usersSearchQuery,
        page: usersPage,
        limit: 10,
      });
      if (data && data.success) {
        setUsers(data.users || []);
        setUsersTotal(data.total || 0);
        setUsersPages(data.pages || 1);
        setUsersRoleCounts(data.roleCounts || {});
      }
    } catch (err) {
      console.error('Error fetching admin users list:', err);
      setUsersError(err.message || 'Failed to query registered user accounts.');
    } finally {
      setUsersLoading(false);
    }
  }, [usersRoleFilter, usersStatusFilter, usersSearchQuery, usersPage]);

  // Open User Details
  const openUserDetails = useCallback(async (userId) => {
    try {
      const data = await fetchAdminUserByIdApi(userId);
      if (data && data.success) {
        setSelectedUser(data.user);
        setUserActivitySummary(data.activitySummary || {});
        setUserDetailModalOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to load user details.');
    }
  }, []);

  // Update User Account Status (Suspend / Reactivate)
  const handleConfirmUserStatus = async (userId, { action, reason }) => {
    try {
      setIsProcessingUserStatus(true);
      const res = await updateAdminUserStatusApi(userId, { action, reason });
      if (res && res.success) {
        showToast(
          action === 'suspend'
            ? 'User account has been successfully suspended.'
            : 'User account has been successfully reactivated.'
        );
        setUserStatusModalOpen(false);
        loadUsers();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to update account status.');
    } finally {
      setIsProcessingUserStatus(false);
    }
  };

  // Load Bookings List
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const data = await fetchAdminBookingsApi({
        status: bookingsStatusFilter,
        paymentStatus: bookingsPaymentFilter,
        search: bookingsSearchQuery,
        page: bookingsPage,
        limit: 10,
      });
      if (data && data.success) {
        setBookings(data.bookings || []);
        setBookingsTotal(data.total || 0);
        setBookingsPages(data.pages || 1);
        setBookingsStats(data.stats || {});
      }
    } catch (err) {
      console.error('Error fetching bookings:', err);
      setBookingsError(err.message || 'Failed to load platform bookings.');
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingsStatusFilter, bookingsPaymentFilter, bookingsSearchQuery, bookingsPage]);

  // Open Booking Details
  const openBookingDetails = useCallback(async (bookingId) => {
    try {
      const data = await fetchAdminBookingByIdApi(bookingId);
      if (data && data.success) {
        setSelectedBooking(data.booking);
        setBookingTickets(data.tickets || []);
        setBookingDetailModalOpen(true);
      }
    } catch (err) {
      alert(err.message || 'Failed to load booking details.');
    }
  }, []);

  // Cancel and Refund Booking
  const handleCancelRefundBooking = async (bookingId, reason) => {
    try {
      setIsProcessingBookingRefund(true);
      const res = await cancelAndRefundAdminBookingApi(bookingId, reason);
      if (res && res.success) {
        showToast('Booking cancelled, passes deactivated, and refund recorded.');
        setBookingDetailModalOpen(false);
        loadBookings();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel and refund booking.');
    } finally {
      setIsProcessingBookingRefund(false);
    }
  };

  // Load Reviews List
  const loadReviews = useCallback(async () => {
    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const data = await fetchAdminReviewsApi({
        status: reviewsStatusFilter,
        rating: reviewsRatingFilter,
        search: reviewsSearchQuery,
        page: reviewsPage,
        limit: 10,
      });
      if (data && data.success) {
        setReviews(data.reviews || []);
        setReviewsTotal(data.total || 0);
        setReviewsPages(data.pages || 1);
        setReviewsStatusCounts(data.statusCounts || {});
      }
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setReviewsError(err.message || 'Failed to load reviews.');
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewsStatusFilter, reviewsRatingFilter, reviewsSearchQuery, reviewsPage]);

  // Moderate Review
  const handleModerateReview = async (reviewId, action, reason = '') => {
    try {
      setIsProcessingReviewAction(true);
      const res = await moderateAdminReviewApi(reviewId, { action, reason });
      if (res && res.success) {
        showToast(`Review status updated to '${action}'.`);
        loadReviews();
        loadStats();
      }
    } catch (err) {
      alert(err.message || 'Failed to moderate review.');
    } finally {
      setIsProcessingReviewAction(false);
    }
  };

  // Load Audit Logs
  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const data = await fetchAdminAuditLogsApi({
        action: auditActionFilter,
        targetType: auditTargetTypeFilter,
        search: auditSearchQuery,
        page: auditPage,
        limit: 15,
      });
      if (data && data.success) {
        setAuditLogs(data.logs || []);
        setAuditTotal(data.total || 0);
        setAuditPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setAuditError(err.message || 'Failed to load audit logs.');
    } finally {
      setAuditLoading(false);
    }
  }, [auditActionFilter, auditTargetTypeFilter, auditSearchQuery, auditPage]);

  // Load Admin Notifications
  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchAdminNotificationsApi();
      if (data && data.success) {
        setNotifications(data.notifications || []);
        setUnreadNotifsCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.warn('Failed to fetch admin notifications:', err.message);
    }
  }, []);

  // Mark single notification read
  const handleMarkNotificationRead = async (id) => {
    try {
      await markAdminNotificationReadApi(id);
      loadNotifications();
    } catch (err) {
      console.warn('Error marking notification read:', err.message);
    }
  };

  // Mark all notifications read
  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllAdminNotificationsReadApi();
      loadNotifications();
    } catch (err) {
      console.warn('Error marking all notifications read:', err.message);
    }
  };

  // Notification click routing
  const handleNotificationClick = (notif) => {
    if (!notif.isRead) {
      handleMarkNotificationRead(notif._id);
    }
    setNotificationsModalOpen(false);
    if (notif.metadata?.eventId) {
      handleTabChange('events', { status: 'pending' });
      openEventDetails(notif.metadata.eventId);
    }
  };

  // Initial Load
  useEffect(() => {
    const timer = setTimeout(() => {
      loadStats();
      loadNotifications();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadStats, loadNotifications]);

  // Load active tab data on demand
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'overview') {
        loadStats();
      } else if (activeTab === 'events') {
        loadEvents();
      } else if (activeTab === 'users') {
        loadUsers();
      } else if (activeTab === 'bookings') {
        loadBookings();
      } else if (activeTab === 'reviews') {
        loadReviews();
      } else if (activeTab === 'audit-logs') {
        loadAuditLogs();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [activeTab, loadStats, loadEvents, loadUsers, loadBookings, loadReviews, loadAuditLogs]);

  // Check if deep link opened an event
  useEffect(() => {
    const eventIdParam = searchParams.get('eventId');
    if (eventIdParam && !eventModalOpen) {
      const timer = setTimeout(() => {
        openEventDetails(eventIdParam);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, openEventDetails, eventModalOpen]);

  // Logout Handler
  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  // Badges map for sidebar
  const sidebarBadges = {
    pendingEvents: stats?.events?.pendingEvents ?? stats?.pendingEvents ?? 0,
    suspendedUsers: stats?.users?.suspendedUsers ?? 0,
    flaggedReviews: stats?.reviews?.flaggedReviews ?? 0,
    unreadNotifs: unreadNotifsCount,
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors flex flex-col">
      {/* Toast notification banner */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-xs shadow-xl flex items-center gap-2 border border-emerald-400"
          >
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Top Navigation Header */}
      <AdminHeader
        user={user}
        onLogout={handleLogout}
        unreadCount={unreadNotifsCount}
        onOpenNotifications={() => setNotificationsModalOpen(true)}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
      />

      {/* Main Workspace */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Responsive Sidebar */}
          <AdminSidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            badges={sidebarBadges}
            mobileMenuOpen={mobileMenuOpen}
            setMobileMenuOpen={setMobileMenuOpen}
          />

          {/* Tab Content Display */}
          <main className="flex-1 min-w-0 w-full">
            {activeTab === 'overview' && (
              <AdminOverviewTab
                stats={stats}
                recentPendingEvents={recentPendingEvents}
                recentBookings={recentBookings}
                recentAuditLogs={recentAuditLogs}
                loading={statsLoading}
                error={statsError}
                onRefresh={loadStats}
                onSelectEvent={openEventDetails}
                onNavigateTab={(tab, params) => handleTabChange(tab, params)}
              />
            )}

            {activeTab === 'events' && (
              <AdminEventsTab
                events={events}
                total={eventsTotal}
                page={eventsPage}
                pages={eventsPages}
                statusCounts={eventsStatusCounts}
                statusFilter={eventsStatusFilter}
                searchQuery={eventsSearchQuery}
                categoryFilter={eventsCategoryFilter}
                formatFilter={eventsFormatFilter}
                loading={eventsLoading}
                error={eventsError}
                onStatusChange={(status) => {
                  setEventsStatusFilter(status);
                  setEventsPage(1);
                }}
                onSearchChange={(search) => {
                  setEventsSearchQuery(search);
                  setEventsPage(1);
                }}
                onCategoryChange={(cat) => {
                  setEventsCategoryFilter(cat);
                  setEventsPage(1);
                }}
                onFormatChange={(fmt) => {
                  setEventsFormatFilter(fmt);
                  setEventsPage(1);
                }}
                onPageChange={setEventsPage}
                onRefresh={loadEvents}
                onOpenEventDetails={openEventDetails}
                onQuickApprove={handleQuickApprove}
                onOpenRejectModal={(evt) => openEventDetails(evt._id)}
              />
            )}

            {activeTab === 'users' && (
              <AdminUsersTab
                users={users}
                total={usersTotal}
                page={usersPage}
                pages={usersPages}
                roleCounts={usersRoleCounts}
                roleFilter={usersRoleFilter}
                statusFilter={usersStatusFilter}
                searchQuery={usersSearchQuery}
                loading={usersLoading}
                error={usersError}
                currentAdminId={user?.id || user?._id}
                onRoleChange={(role) => {
                  setUsersRoleFilter(role);
                  setUsersPage(1);
                }}
                onStatusChange={(status) => {
                  setUsersStatusFilter(status);
                  setUsersPage(1);
                }}
                onSearchChange={(search) => {
                  setUsersSearchQuery(search);
                  setUsersPage(1);
                }}
                onPageChange={setUsersPage}
                onRefresh={loadUsers}
                onOpenUserDetails={openUserDetails}
                onOpenStatusModal={(targetUser, action) => {
                  setStatusTargetUser(targetUser);
                  setStatusTargetAction(action);
                  setUserStatusModalOpen(true);
                }}
              />
            )}

            {activeTab === 'bookings' && (
              <AdminBookingsTab
                bookings={bookings}
                total={bookingsTotal}
                page={bookingsPage}
                pages={bookingsPages}
                stats={bookingsStats}
                statusFilter={bookingsStatusFilter}
                paymentFilter={bookingsPaymentFilter}
                searchQuery={bookingsSearchQuery}
                loading={bookingsLoading}
                error={bookingsError}
                onStatusChange={(status) => {
                  setBookingsStatusFilter(status);
                  setBookingsPage(1);
                }}
                onPaymentChange={(pmt) => {
                  setBookingsPaymentFilter(pmt);
                  setBookingsPage(1);
                }}
                onSearchChange={(search) => {
                  setBookingsSearchQuery(search);
                  setBookingsPage(1);
                }}
                onPageChange={setBookingsPage}
                onRefresh={loadBookings}
                onOpenBookingDetails={openBookingDetails}
                onOpenCancelRefundModal={(bk) => openBookingDetails(bk._id)}
              />
            )}

            {activeTab === 'coupons' && (
              <AdminCouponsTab onShowToast={showToast} />
            )}

            {activeTab === 'reviews' && (
              <AdminReviewsTab
                reviews={reviews}
                total={reviewsTotal}
                page={reviewsPage}
                pages={reviewsPages}
                statusCounts={reviewsStatusCounts}
                statusFilter={reviewsStatusFilter}
                ratingFilter={reviewsRatingFilter}
                searchQuery={reviewsSearchQuery}
                loading={reviewsLoading}
                error={reviewsError}
                onStatusChange={(status) => {
                  setReviewsStatusFilter(status);
                  setReviewsPage(1);
                }}
                onRatingChange={(rating) => {
                  setReviewsRatingFilter(rating);
                  setReviewsPage(1);
                }}
                onSearchChange={(search) => {
                  setReviewsSearchQuery(search);
                  setReviewsPage(1);
                }}
                onPageChange={setReviewsPage}
                onRefresh={loadReviews}
                onModerateReview={handleModerateReview}
                isProcessing={isProcessingReviewAction}
              />
            )}

            {activeTab === 'audit-logs' && (
              <AdminAuditLogsTab
                logs={auditLogs}
                total={auditTotal}
                page={auditPage}
                pages={auditPages}
                actionFilter={auditActionFilter}
                targetTypeFilter={auditTargetTypeFilter}
                searchQuery={auditSearchQuery}
                loading={auditLoading}
                error={auditError}
                onActionChange={(action) => {
                  setAuditActionFilter(action);
                  setAuditPage(1);
                }}
                onTargetTypeChange={(target) => {
                  setAuditTargetTypeFilter(target);
                  setAuditPage(1);
                }}
                onSearchChange={(search) => {
                  setAuditSearchQuery(search);
                  setAuditPage(1);
                }}
                onPageChange={setAuditPage}
                onRefresh={loadAuditLogs}
              />
            )}

            {activeTab === 'notifications' && (
              <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-borders)]">
                  <div>
                    <h2 className="text-base font-bold font-serif">Platform Notices & Alerts</h2>
                    <p className="text-xs text-[var(--color-secondary-text)]">
                      Administrative notifications for pending event moderation and platform alerts.
                    </p>
                  </div>
                  {unreadNotifsCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      className="text-xs font-bold text-[var(--color-primary-action)] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif._id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        !notif.isRead
                          ? 'bg-[var(--color-primary-action)]/5 border-[var(--color-primary-action)]/30'
                          : 'bg-[var(--color-secondary-bg)]/30 border-[var(--color-borders)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <strong className="text-xs">{notif.title}</strong>
                        <span className="text-[10px] text-[var(--color-secondary-text)]">
                          {new Date(notif.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-secondary-text)] mt-1">{notif.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Modals */}
      <AdminEventDetailModal
        event={selectedEvent}
        bookingStats={eventBookingStats}
        isOpen={eventModalOpen}
        onClose={() => setEventModalOpen(false)}
        onApprove={handleQuickApprove}
        onReject={handleRejectEvent}
        onReturn={handleReturnEvent}
        isProcessing={isProcessingEventAction}
      />

      <AdminUserDetailModal
        user={selectedUser}
        activitySummary={userActivitySummary}
        isOpen={userDetailModalOpen}
        onClose={() => setUserDetailModalOpen(false)}
      />

      <AdminUserStatusModal
        user={statusTargetUser}
        action={statusTargetAction}
        isOpen={userStatusModalOpen}
        onClose={() => setUserStatusModalOpen(false)}
        onConfirm={handleConfirmUserStatus}
        isProcessing={isProcessingUserStatus}
      />

      <AdminBookingDetailModal
        booking={selectedBooking}
        tickets={bookingTickets}
        isOpen={bookingDetailModalOpen}
        onClose={() => setBookingDetailModalOpen(false)}
        onCancelRefund={handleCancelRefundBooking}
        isProcessing={isProcessingBookingRefund}
      />

      <AdminNotificationsModal
        notifications={notifications}
        unreadCount={unreadNotifsCount}
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
}
