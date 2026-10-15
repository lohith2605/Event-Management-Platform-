import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Menu,
  X,
  Sparkles,
  Calendar,
  LogIn,
  UserPlus,
  User,
  LogOut,
  LayoutDashboard,
  Bell,
  Search,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import ThemeSwitcher from './ThemeSwitcher';
import AttendeeMenuDrawer from './AttendeeMenuDrawer';
import { useAuth } from '../context/AuthContext';
import { fetchNotificationsApi } from '../api/attendee';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [attendeeDrawerOpen, setAttendeeDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isLandingPage = location.pathname === '/';
  const { user, role, isAuthenticated, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search input state synchronized with ?q=... query param
  const urlQuery = searchParams.get('q') || '';
  const [searchValue, setSearchValue] = useState(urlQuery);

  // Sync input value whenever URL query changes externally
  useEffect(() => {
    setSearchValue(urlQuery);
  }, [urlQuery]);

  // Load unread notification count for attendee menu badge
  useEffect(() => {
    let isMounted = true;
    if (isAuthenticated && role === 'attendee') {
      fetchNotificationsApi()
        .then((res) => {
          if (isMounted && res && typeof res.unreadCount === 'number') {
            setUnreadCount(res.unreadCount);
          }
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, role, location.pathname]);

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
    setAttendeeDrawerOpen(false);
    setMobileSearchOpen(false);
  };

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'organizer') return '/organizer/dashboard';
    return '/attendee';
  };

  const getBrandLogoDestination = () => {
    if (isAuthenticated) {
      if (role === 'attendee') return '/attendee';
      if (role === 'organizer') return '/organizer/dashboard';
      if (role === 'admin') return '/admin';
    }
    return '/';
  };

  const getExploreEventsDestination = () => {
    if (isAuthenticated && role === 'attendee') {
      return '/attendee';
    }
    return '/events';
  };

  const isExploreEventsActive =
    isAuthenticated && role === 'attendee'
      ? location.pathname === '/attendee' || location.pathname === '/attendee/events'
      : location.pathname === '/events';

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/login', { replace: true });
  };

  // Live filter when typing on attendee discovery or public events catalog
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchValue(val);

    const isDiscoveryPage =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events';

    if (isDiscoveryPage) {
      const nextParams = new URLSearchParams(searchParams);
      if (val.trim()) {
        nextParams.set('q', val);
      } else {
        nextParams.delete('q');
      }
      setSearchParams(nextParams, { replace: true });
    }
  };

  // Submit search query (press Enter or submit)
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchValue.trim();
    const isDiscoveryPage =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events';

    if (isDiscoveryPage) {
      const nextParams = new URLSearchParams(searchParams);
      if (query) {
        nextParams.set('q', query);
      } else {
        nextParams.delete('q');
      }
      setSearchParams(nextParams, { replace: true });
    } else {
      // From any other page (e.g. notifications, bookings, profile)
      const destination = isAuthenticated && role === 'attendee' ? '/attendee' : '/events';
      if (query) {
        navigate(`${destination}?q=${encodeURIComponent(query)}`);
      } else {
        navigate(destination);
      }
    }
  };

  // Clear search input and URL param
  const handleClearSearch = () => {
    setSearchValue('');
    if (searchParams.has('q')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('q');
      setSearchParams(nextParams, { replace: true });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-primary-bg)]/95 backdrop-blur-md border-b border-[var(--color-borders)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 sm:gap-4 lg:gap-6">
          {/* Brand Logo */}
          <Link
            to={getBrandLogoDestination()}
            onClick={closeMenu}
            className="flex items-center gap-3 group text-[var(--color-main-text)] focus-visible:outline-none shrink-0"
            aria-label={`${BRAND.name} — ${BRAND.tagline}`}
          >
            {/* Celebratory Banner Mark in place of plain letter U */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary-action)] via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 group-hover:shadow-purple-500/30 transition-all shrink-0">
              <svg
                className="w-5 h-5 text-white drop-shadow-xs"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {/* Celebratory Festival Banner Pennant */}
                <path
                  d="M4 3h16a1 1 0 0 1 1 1v16l-5-2.8L12 19l-4-1.8L4 20V4a1 1 0 0 1 1-1z"
                  fill="currentColor"
                  fillOpacity="0.22"
                />
                {/* Celebratory Central Star */}
                <path
                  d="M12 6.5l1.1 2.3 2.5.4-1.8 1.8.4 2.5L12 12.3l-2.2 1.2.4-2.5-1.8-1.8 2.5-.4L12 6.5z"
                  fill="#fbbf24"
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                />
              </svg>
            </div>

            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-2xl tracking-tight font-serif text-[var(--color-main-text)] leading-tight">
                {BRAND.name}
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium tracking-wide text-[var(--color-secondary-text)] leading-tight">
                {BRAND.tagline}
              </span>
            </div>
          </Link>

          {/* Search Bar - Appropriate Length Suits in Navbar (Hidden on Landing Page) */}
          {!isLandingPage && (
            <form
              onSubmit={handleSearchSubmit}
              className="hidden sm:flex items-center flex-1 max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg mx-2 md:mx-4 relative"
              role="search"
            >
              <div className="relative w-full flex items-center">
                <Search className="w-4 h-4 absolute left-3.5 text-[var(--color-secondary-text)] pointer-events-none" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={handleSearchChange}
                  placeholder="Search hackathons, music concerts, tech fests, venues..."
                  aria-label="Search events"
                  className="w-full pl-10 pr-9 py-2 text-xs sm:text-sm rounded-full bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/30 border border-[var(--color-borders)] text-[var(--color-main-text)] placeholder:text-[var(--color-secondary-text)]/70 focus:outline-hidden focus:border-[var(--color-primary-action)] focus:ring-2 focus:ring-[var(--color-primary-action)]/20 transition-all font-medium shadow-2xs"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="absolute right-2.5 p-1 rounded-full text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-borders)]/50 transition-colors cursor-pointer"
                    title="Clear search"
                    aria-label="Clear search input"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-6 shrink-0" aria-label="Main Navigation">
            {/* Show 'Explore Events' for visitors/guests; hidden for authenticated attendees inside dashboard */}
            {!(isAuthenticated && role === 'attendee') && (
              <Link
                to={getExploreEventsDestination()}
                className={`text-sm font-semibold transition-colors flex items-center gap-1.5 py-1 ${
                  isExploreEventsActive
                    ? 'text-[var(--color-primary-action)] border-b-2 border-[var(--color-primary-action)]'
                    : 'text-[var(--color-main-text)] hover:text-[var(--color-primary-action)]'
                }`}
              >
                <Calendar className="w-4 h-4 opacity-75" />
                <span>Explore Events</span>
              </Link>
            )}

            {/* Show 'For Organizers' when not logged in so hosts can sign up and publish */}
            {!isAuthenticated && (
              <Link
                to="/organizers"
                className={`text-sm font-semibold transition-colors flex items-center gap-1.5 py-1 ${
                  isActive('/organizers')
                    ? 'text-[var(--color-primary-action)] border-b-2 border-[var(--color-primary-action)]'
                    : 'text-[var(--color-main-text)] hover:text-[var(--color-primary-action)]'
                }`}
              >
                <Sparkles className="w-4 h-4 text-[var(--color-golden-accent)]" />
                <span>For Organizers</span>
              </Link>
            )}
          </nav>

          {/* Desktop Auth Actions & Theme Switcher */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme switcher control */}
            <ThemeSwitcher />

            {/* Authenticated Attendee vs Other Roles vs Guest */}
            {isAuthenticated ? (
              role === 'attendee' ? (
                <div className="flex items-center gap-2 pl-1">
                  {/* Dedicated Notification Bell Icon */}
                  <Link
                    to="/attendee/notifications"
                    className={`relative p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                      location.pathname.startsWith('/attendee/notifications')
                        ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] border border-[var(--color-primary-action)] shadow-xs'
                        : 'bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/50 border border-[var(--color-borders)] text-[var(--color-main-text)] hover:text-[var(--color-primary-action)]'
                    }`}
                    title={unreadCount > 0 ? `${unreadCount} Unread Notifications` : 'View Notifications'}
                    aria-label="View Notifications"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-xs animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* Compact Profile Access */}
                  <Link
                    to="/attendee/profile"
                    className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/50 border border-[var(--color-borders)] rounded-xl text-xs font-bold text-[var(--color-main-text)] transition-colors"
                    title="Profile & Settings"
                  >
                    <div className="w-5 h-5 rounded-full bg-[var(--color-primary-action)]/20 text-[var(--color-primary-action)] flex items-center justify-center text-[10px] font-bold">
                      {user?.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <span className="max-w-[120px] truncate">{user?.name || 'Profile'}</span>
                  </Link>

                  {/* On-demand Hamburger Menu Button */}
                  <button
                    type="button"
                    onClick={() => setAttendeeDrawerOpen(true)}
                    className="relative inline-flex items-center gap-2 px-3.5 py-2 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    aria-label="Open Attendee Menu"
                    title="Attendee Navigation Menu"
                  >
                    <Menu className="w-4 h-4" />
                    <span>Menu</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 pl-1">
                  <Link
                    to={getDashboardPath()}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/40 border border-[var(--color-borders)] rounded-xl text-xs font-bold text-[var(--color-main-text)] transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                    <span className="max-w-[140px] truncate">{user?.name || 'Dashboard'}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-2 text-[var(--color-secondary-text)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                    title="Sign Out"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )
            ) : (
              <>
                <Link
                  to="/login"
                  className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-all ${
                    isActive('/login')
                      ? 'text-[var(--color-primary-action)] bg-[var(--color-accent-soft)]'
                      : 'text-[var(--color-main-text)] hover:text-[var(--color-primary-action)] hover:bg-[var(--color-secondary-bg)]'
                  }`}
                >
                  Sign In
                </Link>

                <Link
                  to="/signup"
                  className="text-sm font-bold bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] px-5 py-2.5 rounded-xl transition-all shadow-xs active:translate-y-0.5"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu & Theme Button */}
          <div className="flex items-center gap-1.5 md:hidden">
            {/* Mobile Search Toggle Button (Hidden on Landing Page) */}
            {!isLandingPage && (
              <button
                type="button"
                onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                className={`relative p-2 rounded-xl transition-colors cursor-pointer sm:hidden ${
                  mobileSearchOpen || searchValue
                    ? 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]'
                    : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
                aria-label="Toggle search bar"
                title="Search events"
              >
                <Search className="w-5 h-5" />
                {searchValue && !mobileSearchOpen && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-primary-action)]" />
                )}
              </button>
            )}

            <ThemeSwitcher />
            {isAuthenticated && role === 'attendee' ? (
              <>
                {/* Mobile Notification Bell Icon */}
                <Link
                  to="/attendee/notifications"
                  className={`relative p-2 rounded-xl transition-colors cursor-pointer flex items-center justify-center ${
                    location.pathname.startsWith('/attendee/notifications')
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)]'
                      : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                  }`}
                  aria-label="View notifications"
                  title="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-0.5 bg-red-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>

                <button
                  type="button"
                  onClick={() => setAttendeeDrawerOpen(true)}
                  className="relative text-[var(--color-main-text)] p-2 rounded-xl hover:bg-[var(--color-secondary-bg)] transition-colors focus:outline-none cursor-pointer"
                  aria-label="Open navigation menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-[var(--color-main-text)] p-2 rounded-xl hover:bg-[var(--color-secondary-bg)] transition-colors focus:outline-none"
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Input Drawer (When toggled on small screens, hidden on landing page) */}
      {!isLandingPage && mobileSearchOpen && (
        <div className="sm:hidden px-4 pb-3.5 pt-1 border-t border-[var(--color-borders)] bg-[var(--color-primary-bg)] animate-fade-in">
          <form onSubmit={handleSearchSubmit} className="relative w-full flex items-center" role="search">
            <Search className="w-4 h-4 absolute left-3.5 text-[var(--color-secondary-text)] pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search hackathons, music concerts, tech fests, venues..."
              aria-label="Search events"
              className="w-full pl-10 pr-9 py-2 text-xs rounded-full bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] placeholder:text-[var(--color-secondary-text)]/70 focus:outline-hidden focus:border-[var(--color-primary-action)] focus:ring-2 focus:ring-[var(--color-primary-action)]/20"
            />
            {searchValue && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 p-1 rounded-full text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>
        </div>
      )}

      {/* Attendee Responsive Hamburger Drawer */}
      {isAuthenticated && role === 'attendee' && (
        <AttendeeMenuDrawer
          isOpen={attendeeDrawerOpen}
          onClose={() => setAttendeeDrawerOpen(false)}
          user={user}
          unreadCount={unreadCount}
          onLogout={handleLogout}
        />
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-primary-bg)] border-b border-[var(--color-borders)] px-4 pt-3 pb-6 space-y-3 shadow-lg animate-fade-in text-[var(--color-main-text)]">
          {/* Show 'Explore Events' when NOT an authenticated attendee */}
          {!(isAuthenticated && role === 'attendee') && (
            <Link
              to={getExploreEventsDestination()}
              onClick={closeMenu}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-base font-semibold ${
                isExploreEventsActive
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-primary-action)]'
                  : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
              }`}
            >
              <Calendar className="w-5 h-5 text-[var(--color-primary-action)]" />
              <span>Explore Events</span>
            </Link>
          )}

          {/* Show 'For Organizers' when not logged in */}
          {!isAuthenticated && (
            <Link
              to="/organizers"
              onClick={closeMenu}
              className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-base font-semibold ${
                isActive('/organizers')
                  ? 'bg-[var(--color-accent-soft)] text-[var(--color-primary-action)]'
                  : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
              }`}
            >
              <Sparkles className="w-5 h-5 text-[var(--color-golden-accent)]" />
              <span>For Organizers</span>
            </Link>
          )}

          {/* Mobile Theme Selector */}
          <div className="pt-2 border-t border-[var(--color-borders)]">
            <ThemeSwitcher isMobile />
          </div>

          <div className="pt-2 border-t border-[var(--color-borders)] space-y-2.5">
            {isAuthenticated ? (
              <div className="space-y-2">
                <div className="px-3.5 py-2.5 bg-[var(--color-secondary-bg)] rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-[var(--color-main-text)]">{user?.name}</p>
                    <p className="text-[10px] text-[var(--color-secondary-text)]">{user?.email}</p>
                  </div>
                </div>

                <Link
                  to={getDashboardPath()}
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold bg-[var(--color-primary-action)] text-[var(--color-primary-text)] rounded-xl"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Go to Dashboard</span>
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold text-red-500 bg-red-500/10 rounded-xl"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 w-full py-3 text-sm font-semibold text-[var(--color-main-text)] bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl hover:bg-[var(--color-borders)]/40 transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>

                <Link
                  to="/signup"
                  onClick={closeMenu}
                  className="flex items-center justify-center gap-2 w-full py-3 text-sm font-bold bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] rounded-xl transition-colors shadow-xs"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
