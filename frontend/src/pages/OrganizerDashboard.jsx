import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  LayoutDashboard,
  Calendar,
  PlusCircle,
  Users,
  Ticket,
  BarChart3,
  UserCheck,
  LogOut,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon,
  Palette,
  ShieldCheck,
  RefreshCw,
  Tag,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  fetchOrganizerOverviewApi,
  fetchOrganizerEventsListApi,
  createOrganizerEventApi,
  updateOrganizerEventApi,
  cancelOrganizerEventApi,
  fetchOrganizerBookingsApi,
  fetchOrganizerAttendeesApi,
  fetchOrganizerAnalyticsApi,
} from '../api/organizer';

import OverviewTab from '../components/organizer/OverviewTab';
import MyEventsTab from '../components/organizer/MyEventsTab';
import CreateEventTab from '../components/organizer/CreateEventTab';
import AttendeesTab from '../components/organizer/AttendeesTab';
import BookingsTab from '../components/organizer/BookingsTab';
import AnalyticsTab from '../components/organizer/AnalyticsTab';
import CouponsTab from '../components/organizer/CouponsTab';
import ProfileSettingsTab from '../components/organizer/ProfileSettingsTab';
import EditEventModal from '../components/organizer/EditEventModal';
import CancelEventModal from '../components/organizer/CancelEventModal';
import ViewEventModal from '../components/organizer/ViewEventModal';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'my-events', label: 'My Events', icon: Calendar },
  { id: 'create-event', label: 'Create Event', icon: PlusCircle },
  { id: 'coupons', label: 'Coupons & Discounts', icon: Tag },
  { id: 'attendees', label: 'Attendees', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'profile', label: 'Profile & Settings', icon: UserCheck },
];

export default function OrganizerDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, toggleDarkMode, isDark } = useTheme();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const shouldReduceMotion = useReducedMotion();

  // Active tab state (synced with ?tab= query parameter)
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(
    NAV_ITEMS.some((i) => i.id === initialTab) ? initialTab : 'overview'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Overview data
  const [overviewData, setOverviewData] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState(null);

  // Events data
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState(null);
  const [eventsStatusFilter, setEventsStatusFilter] = useState('all');
  const [eventsSearchQuery, setEventsSearchQuery] = useState('');

  // Attendees data
  const [attendees, setAttendees] = useState([]);
  const [attendeesLoading, setAttendeesLoading] = useState(false);
  const [attendeesError, setAttendeesError] = useState(null);
  const [attendeesEventId, setAttendeesEventId] = useState('all');
  const [attendeesSearchQuery, setAttendeesSearchQuery] = useState('');

  // Bookings data
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState(null);
  const [bookingsEventId, setBookingsEventId] = useState('all');
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState('all');
  const [bookingsSearchQuery, setBookingsSearchQuery] = useState('');

  // Analytics data
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(null);

  // Modal states
  const [viewingEvent, setViewingEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [cancellingEvent, setCancellingEvent] = useState(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Switch tab and sync with URL
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    setSearchParams({ tab: tabId }, { replace: true });
  };

  // 1. Load Overview Data
  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const res = await fetchOrganizerOverviewApi();
      if (res && res.data) {
        setOverviewData(res.data);
      }
    } catch (err) {
      console.error('Failed to load organizer overview:', err);
      setOverviewError(err.message || 'Unable to load real overview statistics.');
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  // 2. Load Events Data
  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const res = await fetchOrganizerEventsListApi({
        status: eventsStatusFilter,
        search: eventsSearchQuery,
      });
      if (res && Array.isArray(res.events)) {
        setEvents(res.events);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      setEventsError(err.message || 'Unable to retrieve your events.');
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [eventsStatusFilter, eventsSearchQuery]);

  // 3. Load Attendees Data
  const loadAttendees = useCallback(async () => {
    setAttendeesLoading(true);
    setAttendeesError(null);
    try {
      const res = await fetchOrganizerAttendeesApi({
        eventId: attendeesEventId,
        search: attendeesSearchQuery,
      });
      if (res && Array.isArray(res.attendees)) {
        setAttendees(res.attendees);
      } else {
        setAttendees([]);
      }
    } catch (err) {
      console.error('Failed to load attendees:', err);
      setAttendeesError(err.message || 'Unable to retrieve attendee roster.');
      setAttendees([]);
    } finally {
      setAttendeesLoading(false);
    }
  }, [attendeesEventId, attendeesSearchQuery]);

  // 4. Load Bookings Data
  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    setBookingsError(null);
    try {
      const res = await fetchOrganizerBookingsApi({
        eventId: bookingsEventId,
        status: bookingsStatusFilter,
        search: bookingsSearchQuery,
      });
      if (res && Array.isArray(res.bookings)) {
        setBookings(res.bookings);
      } else {
        setBookings([]);
      }
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setBookingsError(err.message || 'Unable to retrieve bookings list.');
      setBookings([]);
    } finally {
      setBookingsLoading(false);
    }
  }, [bookingsEventId, bookingsStatusFilter, bookingsSearchQuery]);

  // 5. Load Analytics Data
  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const res = await fetchOrganizerAnalyticsApi();
      if (res && res.analytics) {
        setAnalytics(res.analytics);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setAnalyticsError(err.message || 'Unable to aggregate analytics.');
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Fetch on mount and tab changes
  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (activeTab === 'my-events') loadEvents();
  }, [activeTab, loadEvents]);

  useEffect(() => {
    if (activeTab === 'attendees') loadAttendees();
  }, [activeTab, loadAttendees]);

  useEffect(() => {
    if (activeTab === 'bookings') loadBookings();
  }, [activeTab, loadBookings]);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, loadAnalytics]);

  // Handle Event Creation
  const handleCreateEvent = async (payload) => {
    setIsSubmittingEvent(true);
    try {
      const res = await createOrganizerEventApi(payload);
      // Reload relevant data
      loadOverview();
      loadEvents();
      return res;
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  // Handle Event Edit
  const handleSaveEdit = async (eventId, payload) => {
    setIsSavingEdit(true);
    try {
      await updateOrganizerEventApi(eventId, payload);
      loadEvents();
      loadOverview();
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle Event Cancellation
  const handleConfirmCancel = async (eventId, reason) => {
    setIsCancelling(true);
    try {
      await cancelOrganizerEventApi(eventId, reason);
      loadEvents();
      loadOverview();
    } finally {
      setIsCancelling(false);
    }
  };

  // Sign out
  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const getThemeDisplayName = (t) => {
    switch (t) {
      case 'terracotta':
        return 'Warm Terracotta';
      case 'champagne':
        return 'Champagne Gold';
      case 'modern-light':
        return 'Modern Light';
      case 'modern-dark':
        return 'Modern Dark';
      default:
        return t;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      {/* Top Mobile Bar */}
      <div className="lg:hidden sticky top-0 z-30 bg-[var(--color-primary-bg)]/95 backdrop-blur-md border-b border-[var(--color-borders)] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-xl text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <span className="font-serif font-extrabold text-base text-[var(--color-main-text)]">
            Organizer Hub
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
            title={`Switch Theme (Current: ${getThemeDisplayName(theme)})`}
          >
            <Palette className="w-4 h-4 text-[var(--color-golden-accent)]" />
          </button>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--color-golden-accent)]/15 text-[var(--color-golden-accent)] border border-[var(--color-golden-accent)]/30">
            Host
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto flex">
        {/* Persistent Desktop Sidebar / Collapsible Mobile Drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-[var(--color-primary-bg)] lg:bg-[var(--color-card-bg)] border-r border-[var(--color-borders)] flex flex-col justify-between p-5 transition-transform duration-200 lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <div className="space-y-6">
            {/* Mobile Drawer Close Button */}
            <div className="lg:hidden flex justify-end pb-1">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                aria-label="Close Navigation Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menu Links */}
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                        : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--color-primary-text)]' : ''}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer: Theme Picker, Profile Preview & Sign Out */}
          <div className="pt-4 border-t border-[var(--color-borders)] space-y-3">
            {/* Theme Selector Control */}
            <div className="p-3 rounded-xl bg-[var(--color-secondary-bg)]/50 border border-[var(--color-borders)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)]">
                  {getThemeDisplayName(theme)}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="text-[10px] font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
              >
                Switch
              </button>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="min-w-0">
                <p className="font-bold text-xs text-[var(--color-main-text)] truncate">
                  {user?.name || 'Organizer'}
                </p>
                <p className="text-[10px] text-[var(--color-secondary-text)] truncate">
                  {user?.email}
                </p>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-xl text-[var(--color-secondary-text)] hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Mobile backdrop overlay */}
        {mobileMenuOpen && (
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-2xs"
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 py-8 px-4 sm:px-6 lg:px-8">
          {/* Section Title Header */}
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-[var(--color-borders)]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black font-serif text-[var(--color-main-text)]">
                  {NAV_ITEMS.find((i) => i.id === activeTab)?.label || 'Organizer Dashboard'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-[var(--color-golden-accent)]/15 text-[var(--color-golden-accent)] border border-[var(--color-golden-accent)]/30">
                  Certified Host
                </span>
              </div>
              <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                Manage your events, attendee passes, registrations, and genuine ticket analytics.
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'overview') loadOverview();
                  if (activeTab === 'my-events') loadEvents();
                  if (activeTab === 'attendees') loadAttendees();
                  if (activeTab === 'bookings') loadBookings();
                  if (activeTab === 'analytics') loadAnalytics();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] transition-colors cursor-pointer"
                title="Refresh Data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && (
                <OverviewTab
                  metrics={overviewData?.metrics}
                  upcomingEvents={overviewData?.upcomingEvents}
                  recentBookings={overviewData?.recentBookings}
                  loading={overviewLoading}
                  error={overviewError}
                  onNavigateTab={handleTabChange}
                  onSelectEvent={(evt) => setViewingEvent(evt)}
                />
              )}

              {activeTab === 'my-events' && (
                <MyEventsTab
                  events={events}
                  loading={eventsLoading}
                  error={eventsError}
                  activeFilter={eventsStatusFilter}
                  setActiveFilter={setEventsStatusFilter}
                  searchQuery={eventsSearchQuery}
                  setSearchQuery={setEventsSearchQuery}
                  onViewEvent={(evt) => setViewingEvent(evt)}
                  onEditEvent={(evt) => setEditingEvent(evt)}
                  onCancelEvent={(evt) => setCancellingEvent(evt)}
                  onNavigateTab={handleTabChange}
                />
              )}

              {activeTab === 'create-event' && (
                <CreateEventTab
                  onSubmit={handleCreateEvent}
                  isSubmitting={isSubmittingEvent}
                  onSuccess={() => handleTabChange('my-events')}
                />
              )}

              {activeTab === 'attendees' && (
                <AttendeesTab
                  attendees={attendees}
                  events={events.length > 0 ? events : overviewData?.upcomingEvents || []}
                  loading={attendeesLoading}
                  error={attendeesError}
                  selectedEventId={attendeesEventId}
                  setSelectedEventId={setAttendeesEventId}
                  searchQuery={attendeesSearchQuery}
                  setSearchQuery={setAttendeesSearchQuery}
                />
              )}

              {activeTab === 'bookings' && (
                <BookingsTab
                  bookings={bookings}
                  events={events.length > 0 ? events : overviewData?.upcomingEvents || []}
                  loading={bookingsLoading}
                  error={bookingsError}
                  selectedEventId={bookingsEventId}
                  setSelectedEventId={setBookingsEventId}
                  statusFilter={bookingsStatusFilter}
                  setStatusFilter={setBookingsStatusFilter}
                  searchQuery={bookingsSearchQuery}
                  setSearchQuery={setBookingsSearchQuery}
                />
              )}

              {activeTab === 'coupons' && (
                <CouponsTab
                  events={events.length > 0 ? events : overviewData?.upcomingEvents || []}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsTab
                  analytics={analytics}
                  loading={analyticsLoading}
                  error={analyticsError}
                  onRefresh={loadAnalytics}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileSettingsTab
                  user={user}
                  onProfileUpdated={(updated) => {
                    // Update user in view
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <ViewEventModal
        event={viewingEvent}
        isOpen={!!viewingEvent}
        onClose={() => setViewingEvent(null)}
        onEdit={(evt) => {
          setViewingEvent(null);
          setEditingEvent(evt);
        }}
      />

      <EditEventModal
        event={editingEvent}
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={handleSaveEdit}
        isSaving={isSavingEdit}
      />

      <CancelEventModal
        event={cancellingEvent}
        isOpen={!!cancellingEvent}
        onClose={() => setCancellingEvent(null)}
        onConfirm={handleConfirmCancel}
        isCancelling={isCancelling}
      />
    </div>
  );
}
