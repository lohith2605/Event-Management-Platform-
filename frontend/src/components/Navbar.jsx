import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Sparkles,
  Calendar,
  LogIn,
  UserPlus,
  ShieldCheck,
  User,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import ThemeSwitcher from './ThemeSwitcher';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, isAuthenticated, logout } = useAuth();

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const closeMenu = () => setMobileMenuOpen(false);

  const getDashboardPath = () => {
    if (role === 'admin') return '/admin';
    if (role === 'organizer') return '/organizer/dashboard';
    return '/dashboard';
  };

  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-primary-bg)]/95 backdrop-blur-md border-b border-[var(--color-borders)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand Logo */}
          <Link
            to="/"
            onClick={closeMenu}
            className="flex items-center gap-2.5 group text-[var(--color-main-text)] focus-visible:outline-none"
            aria-label={`${BRAND.name} Homepage`}
          >
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] flex items-center justify-center font-bold text-xl tracking-tight shadow-xs group-hover:bg-[var(--color-primary-action-hover)] transition-colors">
              {BRAND.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight font-serif text-[var(--color-main-text)] leading-none">
                {BRAND.name}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-[var(--color-secondary-text)] font-semibold mt-0.5">
                Events & Passes
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-7" aria-label="Main Navigation">
            <Link
              to="/events"
              className={`text-sm font-semibold transition-colors flex items-center gap-1.5 py-1 ${
                isActive('/events')
                  ? 'text-[var(--color-primary-action)] border-b-2 border-[var(--color-primary-action)]'
                  : 'text-[var(--color-main-text)] hover:text-[var(--color-primary-action)]'
              }`}
            >
              <Calendar className="w-4 h-4 opacity-75" />
              <span>Explore Events</span>
            </Link>

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
            {/* Understated Admin Portal Link */}
            <Link
              to="/admin/login"
              className="text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] transition-colors opacity-70 hover:opacity-100 flex items-center gap-1 font-medium px-2 py-1 mr-1"
              title="Admin Portal"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Admin</span>
            </Link>

            {/* Theme switcher control */}
            <ThemeSwitcher />

            {/* Authenticated User state vs Guest */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2 pl-1">
                <Link
                  to={getDashboardPath()}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)]/40 border border-[var(--color-borders)] rounded-xl text-xs font-bold text-[var(--color-main-text)] transition-colors"
                >
                  <LayoutDashboard className="w-3.5 h-3.5 text-[var(--color-primary-action)]" />
                  <span className="max-w-[120px] truncate">{user?.name || 'Dashboard'}</span>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]">
                    {role}
                  </span>
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
          <div className="flex items-center gap-2 md:hidden">
            <ThemeSwitcher />
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
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[var(--color-primary-bg)] border-b border-[var(--color-borders)] px-4 pt-3 pb-6 space-y-3 shadow-lg animate-fade-in text-[var(--color-main-text)]">
          <Link
            to="/events"
            onClick={closeMenu}
            className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-base font-semibold ${
              isActive('/events')
                ? 'bg-[var(--color-accent-soft)] text-[var(--color-primary-action)]'
                : 'text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
            }`}
          >
            <Calendar className="w-5 h-5 text-[var(--color-primary-action)]" />
            <span>Explore Events</span>
          </Link>

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

          {/* Understated Admin Portal Link in Mobile Drawer */}
          <Link
            to="/admin/login"
            onClick={closeMenu}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-[var(--color-secondary-text)]" />
            <span>Admin Governance Portal</span>
          </Link>

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
                  <span className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]">
                    {role}
                  </span>
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
