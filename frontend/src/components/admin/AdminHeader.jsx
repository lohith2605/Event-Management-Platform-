import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  LogOut,
  Bell,
  Menu,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import BrandLogo from '../BrandLogo';
import ThemeSwitcher from '../ThemeSwitcher';

export default function AdminHeader({
  user,
  onLogout,
  unreadCount = 0,
  onOpenNotifications,
  sidebarOpen = true,
  onToggleSidebar,
  mobileMenuOpen,
  setMobileMenuOpen,
}) {
  const handleToggle = onToggleSidebar || (() => {
    if (setMobileMenuOpen) setMobileMenuOpen(!mobileMenuOpen);
  });

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-card-bg)]/90 backdrop-blur-md border-b border-[var(--color-borders)] transition-colors">
      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
          {/* Left: Hamburger Sidebar Toggle & Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <button
              type="button"
              onClick={handleToggle}
              className={`p-2 sm:p-2.5 rounded-xl border border-[var(--color-borders)] transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-primary-action)] active:scale-95 shadow-2xs ${
                sidebarOpen
                  ? 'bg-[var(--color-secondary-bg)] text-[var(--color-main-text)]'
                  : 'bg-[var(--color-card-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
              }`}
              aria-label={sidebarOpen ? "Collapse governance navigation sidebar" : "Expand governance navigation sidebar"}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              aria-expanded={sidebarOpen}
            >
              <Menu className="w-5 h-5 transition-transform duration-200" />
            </button>

            <Link to="/admin" className="flex items-center gap-3 group">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[var(--color-primary-action)]/15 border border-[var(--color-primary-action)]/30 flex items-center justify-center text-[var(--color-primary-action)] shadow-xs transition-transform group-hover:scale-105">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base sm:text-lg font-serif tracking-tight text-[var(--color-main-text)]">
                    UTSAV
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                    Admin Portal
                  </span>
                </div>
                <p className="text-[11px] text-[var(--color-secondary-text)] hidden sm:block">
                  Platform Governance & Moderation
                </p>
              </div>
            </Link>
          </div>

          {/* Right: Actions, Theme Switcher, Notifications, User Info, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Direct Theme Switcher (Terracotta, Champagne, Modern Light, Modern Dark) */}
            <div className="hidden sm:block">
              <ThemeSwitcher />
            </div>

            {/* In-App Notifications Button */}
            <button
              type="button"
              onClick={onOpenNotifications}
              className="relative p-2.5 rounded-xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-all cursor-pointer"
              title="Platform Alerts & Moderation Notifications"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-primary-action)] text-white text-[10px] font-black flex items-center justify-center border-2 border-[var(--color-card-bg)] shadow-xs animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Public Site Link */}
            <Link
              to="/"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </Link>

            {/* Signed-in Admin profile badge */}
            <div className="hidden sm:flex items-center pl-2 border-l border-[var(--color-borders)]">
              <div
                className="w-9 h-9 rounded-full bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)] border border-[var(--color-golden-accent)]/30 flex items-center justify-center font-extrabold text-sm shadow-xs"
                title={`${user?.name || 'Administrator'} (${user?.email || 'admin'})`}
              >
                {user?.role === 'admin' ? 'A' : (user?.name ? user.name.charAt(0).toUpperCase() : 'A')}
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
