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
  ShieldCheck,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { CITIES } from '../config/taxonomy';
import ThemeSwitcher from './ThemeSwitcher';
import AttendeeMenuDrawer from './AttendeeMenuDrawer';
import NotificationDropdown from './NotificationDropdown';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [attendeeDrawerOpen, setAttendeeDrawerOpen] = useState(false);
  const { unreadCount } = useSocket();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, isAuthenticated, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search input state synchronized with ?q=... or ?search=... query param
  const urlQuery = searchParams.get('q') || searchParams.get('search') || '';
  const [searchValue, setSearchValue] = useState(urlQuery);

  // Sync input value whenever URL query changes externally
  useEffect(() => {
    setSearchValue(urlQuery);
  }, [urlQuery]);

  // Debounced search synchronization on live discovery pages (attendee and public events)
  useEffect(() => {
    const isDiscoveryPage =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events';

    if (!isDiscoveryPage) return;

    const currentParam = (searchParams.get('q') || searchParams.get('search') || '').trim();
    if (searchValue.trim() === currentParam) return;

    const timer = setTimeout(() => {
      const nextParams = new URLSearchParams(searchParams);
      if (searchValue.trim()) {
        nextParams.set('q', searchValue.trim());
      } else {
        nextParams.delete('q');
        nextParams.delete('search');
      }
      setSearchParams(nextParams, { replace: true });
    }, 280);

    return () => clearTimeout(timer);
  }, [searchValue, location.pathname, searchParams, setSearchParams]);



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

  const getProfilePath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'organizer') return '/organizer/profile';
    return '/attendee/profile';
  };

  const getProfileInitial = () => {
    if (role === 'admin') return 'A';
    const name = user?.name?.trim();
    if (name && name.length > 0) {
      return name[0].toUpperCase();
    }
    if (role === 'organizer') return 'O';
    return 'U';
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

  // Immediate input change for smooth 60fps typing
  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
  };

  // Submit search query (press Enter or click submit)
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
        nextParams.delete('search');
      }
      setSearchParams(nextParams, { replace: true });

      const catalogEl = document.getElementById('utsav-event-catalog');
      if (catalogEl) {
        catalogEl.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      // From any other page (landing page, bookings, tickets, profile, etc.)
      const destination = isAuthenticated && role === 'attendee' ? '/attendee' : '/events';
      if (query) {
        navigate(`${destination}?q=${encodeURIComponent(query)}`);
      } else {
        navigate(destination);
      }
    }
    setMobileSearchOpen(false);
  };

  // Clear search input and URL param
  const handleClearSearch = () => {
    setSearchValue('');
    const isDiscoveryPage =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events';

    if (isDiscoveryPage) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('q');
      nextParams.delete('search');
      setSearchParams(nextParams, { replace: true });
    }
  };

  // City selection synchronized with URL query parameter
  const selectedCity = searchParams.get('city') || 'All Cities';

  const handleCitySelect = (e) => {
    const newCity = e.target.value;
    const isDiscoveryPage =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events' ||
      location.pathname === '/';

    if (isDiscoveryPage) {
      const nextParams = new URLSearchParams(searchParams);
      if (newCity && newCity !== 'All Cities') {
        nextParams.set('city', newCity);
      } else {
        nextParams.delete('city');
      }
      setSearchParams(nextParams, { replace: true });
    } else {
      const destination = isAuthenticated && role === 'attendee' ? '/attendee' : '/events';
      if (newCity && newCity !== 'All Cities') {
        navigate(`${destination}?city=${encodeURIComponent(newCity)}`);
      } else {
        navigate(destination);
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-primary-bg)]/95 backdrop-blur-md border-b border-[var(--color-borders)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 sm:gap-4 lg:gap-6">
          {/* Brand Logo & City Selector */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
            <Link
              to={getBrandLogoDestination()}
              onClick={closeMenu}
              className="flex items-center gap-2.5 sm:gap-3 group text-[var(--color-main-text)] focus-visible:outline-none shrink-0"
              aria-label={`${BRAND.name} — ${BRAND.tagline}`}
            >
              {/* Celebratory Banner Mark in place of plain letter U */}
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-[var(--color-primary-action)] via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 group-hover:shadow-purple-500/30 transition-all shrink-0">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white drop-shadow-xs"
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
                <span className="font-extrabold text-xl sm:text-2xl tracking-tight font-serif text-[var(--color-main-text)] leading-tight">
                  {BRAND.name}
                </span>
                <span className="hidden sm:inline text-[10px] sm:text-[11px] font-medium tracking-wide text-[var(--color-secondary-text)] leading-tight">
                  {BRAND.tagline}
                </span>
              </div>
            </Link>

            {/* City Selector Pin Icon directly right of UTSAV */}
            <div className="relative flex items-center shrink-0">
              <div
                className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/40 border border-[var(--color-borders)] flex items-center justify-center transition-all cursor-pointer shadow-2xs ${
                  selectedCity !== 'All Cities'
                    ? 'ring-2 ring-[var(--color-primary-action)]/30 text-[var(--color-primary-action)]'
                    : 'text-[var(--color-golden-accent)]'
                }`}
                title={selectedCity !== 'All Cities' ? `Filtered by ${selectedCity} (Click to change)` : 'Filter events by city'}
              >
                <MapPin className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" />
                {selectedCity !== 'All Cities' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[var(--color-primary-action)] animate-pulse" />
                )}
              </div>
              <select
                value={selectedCity}
                onChange={handleCitySelect}
                aria-label="Filter events by host city"
                title={selectedCity !== 'All Cities' ? `City: ${selectedCity}` : 'Filter by city'}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="All Cities">All Cities</option>
                {CITIES.filter((c) => c !== 'All Cities').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search Bar - Universal Discovery Search in Navbar */}
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
                  {/* Dedicated Real-Time In-App Notification Bell & Popover */}
                  <NotificationDropdown />

                  {/* Circular Profile Avatar Button */}
                  <Link
                    to={getProfilePath()}
                    className="w-10 h-10 rounded-full bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-sm flex items-center justify-center shadow-xs hover:ring-2 hover:ring-[var(--color-primary-action)]/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    title={`${user?.name || 'Attendee'} Profile`}
                    aria-label="Open Profile"
                  >
                    {getProfileInitial()}
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
                  {/* Real-time notifications for Organizers & Admins too */}
                  <NotificationDropdown />

                  {/* Circular Profile Avatar Button */}
                  <Link
                    to={getProfilePath()}
                    className="w-10 h-10 rounded-full bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-sm flex items-center justify-center shadow-xs hover:ring-2 hover:ring-[var(--color-primary-action)]/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                    title={role === 'admin' ? `Admin Profile (${user?.name || 'Administrator'})` : `${user?.name || 'Organizer'} Profile`}
                    aria-label="Open Profile"
                  >
                    {getProfileInitial()}
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
                {/* Landing page only: Admin Portal Login button */}
                {location.pathname === '/' && (
                  <Link
                    to="/admin/login"
                    className="text-sm font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 border border-[var(--color-borders)] bg-[var(--color-secondary-bg)]/50 hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] hover:border-[var(--color-primary-action)]/50 shadow-2xs"
                    title="Administrator Login"
                    aria-label="Admin Login"
                  >
                    <ShieldCheck className="w-4 h-4 text-[var(--color-primary-action)]" />
                    <span>Admin Login</span>
                  </Link>
                )}

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
            {/* Mobile Search Toggle Button */}
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

            <ThemeSwitcher />
            {isAuthenticated && role === 'attendee' ? (
              <>
                {/* Mobile Real-Time Notification Bell & Dropdown */}
                <NotificationDropdown align="right" />

                <Link
                  to={getProfilePath()}
                  className="w-8 h-8 rounded-full bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-xs flex items-center justify-center shadow-xs active:scale-95 transition-all"
                  title={`${user?.name || 'Attendee'} Profile`}
                  aria-label="Open Profile"
                >
                  {getProfileInitial()}
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
              <div className="flex items-center gap-1.5">
                {isAuthenticated && (
                  <Link
                    to={getProfilePath()}
                    className="w-8 h-8 rounded-full bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-xs flex items-center justify-center shadow-xs active:scale-95 transition-all"
                    title={role === 'admin' ? `Admin Profile (${user?.name || 'Administrator'})` : `${user?.name || 'Organizer'} Profile`}
                    aria-label="Open Profile"
                  >
                    {getProfileInitial()}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-[var(--color-main-text)] p-2 rounded-xl hover:bg-[var(--color-secondary-bg)] transition-colors focus:outline-none"
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileMenuOpen}
                >
                  {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Input Drawer */}
      {mobileSearchOpen && (
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
          {/* Mobile City Selector */}
          <div className="relative flex items-center w-full">
            <MapPin className="w-4 h-4 absolute left-3 text-[var(--color-golden-accent)] pointer-events-none" />
            <select
              value={selectedCity}
              onChange={(e) => {
                handleCitySelect(e);
                closeMenu();
              }}
              aria-label="Filter events by host city"
              className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs font-bold text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)] focus:ring-1 focus:ring-[var(--color-primary-action)] transition-colors cursor-pointer appearance-none shadow-2xs"
            >
              <option value="All Cities">All Cities</option>
              {CITIES.filter((c) => c !== 'All Cities').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 text-[var(--color-secondary-text)] pointer-events-none" />
          </div>

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
                <Link
                  to={getProfilePath()}
                  onClick={closeMenu}
                  className="px-3.5 py-2.5 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/40 rounded-xl flex items-center gap-3 transition-colors cursor-pointer"
                  title="Open Profile"
                >
                  <div className="w-10 h-10 rounded-full bg-[var(--color-primary-action)] text-[var(--color-primary-text)] font-extrabold text-sm flex items-center justify-center shrink-0 shadow-xs">
                    {getProfileInitial()}
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-[var(--color-main-text)] truncate">{user?.name}</p>
                    <p className="text-[10px] text-[var(--color-secondary-text)] truncate">{user?.email}</p>
                  </div>
                </Link>

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
                {/* Landing page only: Admin Portal Login button */}
                {location.pathname === '/' && (
                  <Link
                    to="/admin/login"
                    onClick={closeMenu}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-[var(--color-secondary-text)] bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl hover:text-[var(--color-primary-action)] hover:border-[var(--color-primary-action)]/40 transition-colors"
                  >
                    <ShieldCheck className="w-4 h-4 text-[var(--color-primary-action)]" />
                    <span>Admin Login</span>
                  </Link>
                )}

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
