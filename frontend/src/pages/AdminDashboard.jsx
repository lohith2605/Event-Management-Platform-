import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  LogOut,
  CheckCircle,
  Database,
  Users,
  Calendar,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { fetchAdminStatsApi } from '../api/events';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAdminStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminStatsApi();
      if (res && res.stats) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setError(err.message || 'Unable to load real administrative platform metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminStats();
  }, [loadAdminStats]);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Admin Header Card */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary-action)]/20 border border-[var(--color-primary-action)]/40 flex items-center justify-center text-[var(--color-primary-action)]">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold font-serif">
                  UTSAV Admin Governance Portal
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                  Root Admin
                </span>
              </div>
              <p className="text-xs text-[var(--color-secondary-text)] mt-1">
                Signed in as: <strong>{user?.name}</strong> ({user?.email})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] transition-colors"
            >
              Public Site
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </motion.div>

        {/* Milestone Shell Notification */}
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200">
          <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm">Server-Authorized Admin Token Verified</span>
            <p className="text-xs opacity-90 mt-0.5">
              Strict role-based authorization is enforced by the backend on <code>/api/admin/stats</code>. The metrics below reflect actual MongoDB Atlas document counts.
            </p>
          </div>
        </div>

        {/* Real Platform Statistics (Direct from MongoDB Atlas) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-[var(--color-secondary-text)]">
              Real Platform Aggregate Metrics
            </h2>
            <button
              type="button"
              onClick={loadAdminStats}
              className="text-xs font-bold text-[var(--color-primary-action)] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Counts</span>
            </button>
          </div>

          {loading && (
            <div className="p-8 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center text-xs text-[var(--color-secondary-text)]">
              <div className="w-6 h-6 border-2 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p>Querying MongoDB Atlas collection document counts...</p>
            </div>
          )}

          {!loading && error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                  Total Users
                </span>
                <div className="text-2xl font-black text-[var(--color-main-text)]">
                  {stats.totalUsers}
                </div>
                <p className="text-[10px] text-[var(--color-secondary-text)]">
                  Atlas Registered Accounts
                </p>
              </div>

              <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                  Attendees
                </span>
                <div className="text-2xl font-black text-[var(--color-golden-accent)]">
                  {stats.totalAttendees}
                </div>
                <p className="text-[10px] text-[var(--color-secondary-text)]">
                  Public Pass Holders
                </p>
              </div>

              <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                  Organizers
                </span>
                <div className="text-2xl font-black text-purple-500">
                  {stats.totalOrganizers}
                </div>
                <p className="text-[10px] text-[var(--color-secondary-text)]">
                  Verified Hosts
                </p>
              </div>

              <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
                  Published Events
                </span>
                <div className="text-2xl font-black text-[var(--color-primary-action)]">
                  {stats.publishedEvents}
                </div>
                <p className="text-[10px] text-[var(--color-secondary-text)]">
                  Of {stats.totalEvents} Total Events
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Infrastructure & Security Indicators */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl">
            <Database className="w-5 h-5 text-[var(--color-primary-action)] mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
              Persistence
            </span>
            <p className="font-bold text-sm text-[var(--color-main-text)] mt-0.5">
              MongoDB Atlas
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              Active Connection
            </p>
          </div>

          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl">
            <Users className="w-5 h-5 text-[var(--color-golden-accent)] mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
              Security Model
            </span>
            <p className="font-bold text-sm text-[var(--color-main-text)] mt-0.5">
              JWT + HTTP-Only Cookies
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
              Role Verified (Admin)
            </p>
          </div>

          <div className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl">
            <Calendar className="w-5 h-5 text-purple-500 mb-2" />
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-secondary-text)]">
              Governance
            </span>
            <p className="font-bold text-sm text-[var(--color-main-text)] mt-0.5">
              Event Moderation
            </p>
            <p className="text-[11px] text-[var(--color-secondary-text)] font-semibold mt-1">
              Protected in Next Phase
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
