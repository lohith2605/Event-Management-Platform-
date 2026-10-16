import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Receipt,
  MessageSquareQuote,
  ScrollText,
  Bell,
  Sparkles,
  Tag,
  ChevronLeft,
  X,
} from 'lucide-react';
import ThemeSwitcher from '../ThemeSwitcher';

export const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'events', label: 'Event Moderation', icon: ShieldCheck, badgeKey: 'pendingEvents' },
  { id: 'users', label: 'User Governance', icon: Users, badgeKey: 'suspendedUsers' },
  { id: 'bookings', label: 'Bookings & Payments', icon: Receipt },
  { id: 'coupons', label: 'Coupons & Discounts', icon: Tag },
  { id: 'reviews', label: 'Reviews & Feedback', icon: MessageSquareQuote, badgeKey: 'flaggedReviews' },
  { id: 'audit-logs', label: 'Audit Trail', icon: ScrollText },
  { id: 'notifications', label: 'Alerts & Notices', icon: Bell, badgeKey: 'unreadNotifs' },
];

export default function AdminSidebar({
  activeTab,
  onTabChange,
  badges = {},
  sidebarOpen = true,
  onToggleSidebar,
  mobileDrawerOpen,
  setMobileDrawerOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
}) {
  const isMobileOpen = mobileDrawerOpen ?? mobileMenuOpen ?? false;
  const setIsMobileOpen = setMobileDrawerOpen ?? setMobileMenuOpen ?? (() => {});

  return (
    <>
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-300 ease-in-out ${
          sidebarOpen
            ? 'w-64 mr-6 lg:mr-8 opacity-100 translate-x-0'
            : 'w-0 mr-0 opacity-0 -translate-x-4 pointer-events-none overflow-hidden'
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="w-64 sticky top-28 space-y-6">
          <nav className="p-3 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-1">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--color-secondary-text)]">
                Governance Modules
              </span>
              {onToggleSidebar && (
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
            </div>

            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const badgeCount = item.badgeKey ? badges[item.badgeKey] || 0 : 0;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[var(--color-primary-action)] text-white shadow-xs'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--color-secondary-text)]'}`} />
                    <span>{item.label}</span>
                  </div>

                  {badgeCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.id === 'events'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile Drawer Navigation */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Admin Navigation Drawer">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMobileOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] bg-[var(--color-card-bg)] h-full p-5 shadow-2xl flex flex-col justify-between overflow-y-auto border-r border-[var(--color-borders)] animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--color-borders)]">
                <span className="font-serif font-black text-lg text-[var(--color-main-text)]">
                  Admin Navigation
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  className="p-1.5 rounded-xl text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)] cursor-pointer transition-colors"
                  aria-label="Close navigation drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Theme switcher on mobile */}
              <div className="pt-1 pb-2">
                <ThemeSwitcher isMobile />
              </div>

              <nav className="space-y-1">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  const badgeCount = item.badgeKey ? badges[item.badgeKey] || 0 : 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onTabChange(item.id);
                        setIsMobileOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-[var(--color-primary-action)] text-white shadow-xs'
                          : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[var(--color-secondary-text)]'}`} />
                        <span>{item.label}</span>
                      </div>

                      {badgeCount > 0 && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : item.id === 'events'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                              : 'bg-[var(--color-primary-action)]/15 text-[var(--color-primary-action)]'
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[var(--color-borders)] text-[11px] text-[var(--color-secondary-text)]">
              UTSAV Event Governance Portal &copy; 2026
            </div>
          </div>
        </div>
      )}
    </>
  );
}
