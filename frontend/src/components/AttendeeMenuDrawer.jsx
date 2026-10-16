import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  X,
  Compass,
  Ticket,
  Sparkles,
  Bell,
  Star,
  Settings,
  LogOut,
  ChevronRight,
  ShieldCheck,
  MapPin,
  ChevronDown,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { CITIES } from '../config/taxonomy';
import ThemeSwitcher from './ThemeSwitcher';

export default function AttendeeMenuDrawer({ isOpen, onClose, user, unreadCount = 0, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCity = searchParams.get('city') || 'All Cities';

  const handleCityChangeInDrawer = (newCity) => {
    onClose();
    const isDiscovery =
      location.pathname === '/attendee' ||
      location.pathname === '/attendee/events' ||
      location.pathname === '/events' ||
      location.pathname === '/';

    if (isDiscovery) {
      const next = new URLSearchParams(searchParams);
      if (newCity && newCity !== 'All Cities') {
        next.set('city', newCity);
      } else {
        next.delete('city');
      }
      setSearchParams(next, { replace: true });
    } else {
      if (newCity && newCity !== 'All Cities') {
        navigate(`/attendee?city=${encodeURIComponent(newCity)}`);
      } else {
        navigate('/attendee');
      }
    }
  };

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'discover',
      label: 'Discover Events',
      path: '/attendee',
      icon: Compass,
      description: 'Explore live hackathons, concerts & fests',
    },
    {
      id: 'bookings',
      label: 'My Bookings',
      path: '/attendee/bookings',
      icon: Ticket,
      description: 'Track orders & download receipts',
    },
    {
      id: 'tickets',
      label: 'My Tickets',
      path: '/attendee/tickets',
      icon: Sparkles,
      description: 'Digital passes & entry QR codes',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      path: '/attendee/notifications',
      icon: Bell,
      badge: unreadCount,
      description: 'Admission updates & organizer alerts',
    },
    {
      id: 'reviews',
      label: 'Event Reviews',
      path: '/attendee/reviews',
      icon: Star,
      description: 'Verified feedback on past gatherings',
    },
    {
      id: 'profile',
      label: 'Profile & Settings',
      path: '/attendee/profile',
      icon: Settings,
      description: 'Personal details & security',
    },
  ];

  const handleItemClick = (path) => {
    onClose();
    if (location.pathname !== path) {
      navigate(path);
    }
  };

  const handleSignOutClick = async () => {
    onClose();
    if (onLogout) {
      await onLogout();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Attendee Navigation Menu"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel (Fixed to full viewport height on the right) */}
      <div
        className="fixed top-0 bottom-0 right-0 max-w-sm w-full h-full h-screen bg-[var(--color-primary-bg)] border-l border-[var(--color-borders)] shadow-2xl flex flex-col justify-between z-[101] text-[var(--color-main-text)] overflow-hidden"
        style={{ backgroundColor: 'var(--color-primary-bg)' }}
      >
        {/* Drawer Header (shrink-0) */}
        <div className="shrink-0 p-5 sm:p-6 border-b border-[var(--color-borders)] bg-[var(--color-primary-bg)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/30 text-[var(--color-primary-action)] flex items-center justify-center font-bold font-serif text-xl shadow-xs">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <h3 className="font-extrabold text-base font-serif text-[var(--color-main-text)] leading-tight truncate max-w-[170px]">
                  {user?.name || 'Attendee'}
                </h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                    Verified
                  </span>
                  <span className="text-[11px] text-[var(--color-secondary-text)] truncate max-w-[110px]">
                    {user?.email}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* City / Location Selector inside Drawer */}
          <div className="relative flex items-center w-full mt-3.5">
            <MapPin className="w-4 h-4 absolute left-3 text-[var(--color-golden-accent)] pointer-events-none" />
            <select
              value={currentCity}
              onChange={(e) => handleCityChangeInDrawer(e.target.value)}
              aria-label="Filter events by host city"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] text-xs font-bold text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)] focus:ring-1 focus:ring-[var(--color-primary-action)] transition-colors cursor-pointer appearance-none shadow-2xs"
            >
              <option value="All Cities">📍 All Cities (India)</option>
              {CITIES.filter((c) => c !== 'All Cities').map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 text-[var(--color-secondary-text)] pointer-events-none" />
          </div>
        </div>

        {/* Drawer Navigation Links (flex-1 min-h-0 with scrolling) */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2 scrollbar-thin">
          <p className="px-3 py-1 text-[10px] uppercase font-bold tracking-widest text-[var(--color-secondary-text)]">
            Attendee Menu
          </p>

          {menuItems.map((item) => {
            const Icon = item.icon;
            const isItemActive =
              item.path === '/attendee'
                ? location.pathname === '/attendee' || location.pathname === '/attendee/events'
                : location.pathname.startsWith(item.path);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item.path)}
                className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all cursor-pointer group ${
                  isItemActive
                    ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-sm'
                    : 'hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isItemActive
                        ? 'bg-white/20 text-[var(--color-primary-text)]'
                        : 'bg-[var(--color-secondary-bg)] text-[var(--color-primary-action)] group-hover:bg-[var(--color-borders)]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold leading-tight truncate">
                        {item.label}
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold shrink-0 ${
                            isItemActive
                              ? 'bg-white text-[var(--color-primary-action)]'
                              : 'bg-red-500 text-white animate-pulse'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] leading-tight mt-0.5 truncate ${
                        isItemActive
                          ? 'text-white/80'
                          : 'text-[var(--color-secondary-text)]'
                      }`}
                    >
                      {item.description}
                    </p>
                  </div>
                </div>

                <ChevronRight
                  className={`w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all ${
                    isItemActive ? 'text-white' : 'text-[var(--color-secondary-text)]'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Drawer Footer Actions (shrink-0) */}
        <div className="shrink-0 p-4 border-t border-[var(--color-borders)] space-y-3 bg-[var(--color-secondary-bg)]/60">
          <div className="flex items-center justify-between px-2">
            <span className="text-xs font-semibold text-[var(--color-secondary-text)]">
              Appearance Theme
            </span>
            <ThemeSwitcher />
          </div>

          <button
            type="button"
            onClick={handleSignOutClick}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-xs transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out from {BRAND.name}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
