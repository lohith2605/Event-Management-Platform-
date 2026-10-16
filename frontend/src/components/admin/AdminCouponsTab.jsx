import { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchAdminCouponsApi,
  fetchAdminCouponStatsApi,
  updateAdminCouponStatusApi,
} from '../../api/coupons';

export default function AdminCouponsTab({ onShowToast }) {
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status moderation modal
  const [moderateCoupon, setModerateCoupon] = useState(null);
  const [moderateReason, setModerateReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetchAdminCouponStatsApi();
      if (res && res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load admin coupon stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchAdminCouponsApi({
        page,
        limit: 15,
        status: statusFilter,
        search: searchQuery,
      });

      if (res && res.success) {
        setCoupons(res.coupons || []);
        setTotal(res.total || 0);
        setPages(res.pages || 1);
      } else {
        setError(res?.message || 'Failed to load coupons.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch platform coupons.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, searchQuery]);

  useEffect(() => {
    loadStats();
    loadCoupons();
  }, [loadStats, loadCoupons]);

  const handleOpenModerate = (coupon) => {
    setModerateCoupon(coupon);
    setModerateReason(
      coupon.isActive
        ? 'Violation of platform promotional policy'
        : 'Reinstated following policy compliance review'
    );
  };

  const handleConfirmModerate = async (e) => {
    e.preventDefault();
    if (!moderateCoupon) return;

    setActionLoading(true);
    try {
      const nextState = !moderateCoupon.isActive;
      await updateAdminCouponStatusApi(moderateCoupon._id, {
        isActive: nextState,
        reason: moderateReason.trim(),
      });

      if (onShowToast) {
        onShowToast(
          `Coupon "${moderateCoupon.code}" has been ${nextState ? 'enabled' : 'disabled'} and logged in Audit Trail.`
        );
      }

      setModerateCoupon(null);
      loadStats();
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to moderate coupon status.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[var(--color-main-text)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-borders)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-serif flex items-center gap-2">
            <Tag className="w-6 h-6 text-[var(--color-primary-action)]" />
            <span>Platform Coupon Governance</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] mt-0.5">
            Oversee all promotional discounts created across organizers, audit redemptions, and enforce platform policy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            loadStats();
            loadCoupons();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] rounded-xl text-xs font-semibold cursor-pointer shrink-0 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Aggregate Platform Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Total Platform Coupons</span>
            <Tag className="w-4 h-4 text-[var(--color-primary-action)]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : stats?.totalCoupons || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Active: {stats?.activeCoupons || 0} • Disabled: {stats?.disabledCoupons || 0}
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Active Discount Codes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {statsLoading ? '...' : stats?.activeCoupons || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Live and valid across organizers
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Platform Redemptions</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : stats?.totalRedemptions || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Completed coupon checkouts
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Total Savings Granted</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : `₹${stats?.totalDiscountGranted || 0}`}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Platform wide discounts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by coupon code..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs pl-9 pr-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] placeholder:text-[var(--color-secondary-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-[var(--color-secondary-text)]">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none"
          >
            <option value="all">All Coupons</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled by Admin / Organizer</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Cross-Organizer Coupons Table */}
      {loading ? (
        <div className="py-16 text-center text-[var(--color-secondary-text)] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs">Fetching coupons across organizers...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : coupons.length === 0 ? (
        <div className="py-16 text-center bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-8 space-y-3">
          <Tag className="w-12 h-12 mx-auto text-[var(--color-secondary-text)] opacity-40" />
          <h3 className="font-serif font-bold text-lg text-[var(--color-main-text)]">
            No Coupons Found
          </h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-md mx-auto">
            No coupon records matched your criteria.
          </p>
        </div>
      ) : (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-secondary-bg)]/80 text-[var(--color-secondary-text)] font-semibold border-b border-[var(--color-borders)]">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Organizer</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Moderation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)]">
                {coupons.map((coupon) => {
                  const now = new Date();
                  const isExpired = new Date(coupon.endDate) < now;

                  return (
                    <tr
                      key={coupon._id}
                      className="hover:bg-[var(--color-secondary-bg)]/40 transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-sm text-[var(--color-primary-action)] uppercase tracking-wider bg-[var(--color-secondary-bg)] px-2.5 py-1 rounded-lg border border-[var(--color-borders)]">
                          {coupon.code}
                        </span>
                        {coupon.description && (
                          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 truncate max-w-[180px]">
                            {coupon.description}
                          </p>
                        )}
                      </td>

                      {/* Organizer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-[var(--color-main-text)]">
                          {coupon.organizerId?.name || 'Organizer'}
                        </div>
                        <div className="text-[11px] text-[var(--color-secondary-text)] truncate max-w-[160px]">
                          {coupon.organizerId?.email || 'N/A'}
                        </div>
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-4 font-semibold text-[var(--color-main-text)]">
                        <div>
                          {coupon.discountType === 'percentage'
                            ? `${coupon.discountValue}% OFF`
                            : `₹${coupon.discountValue} OFF`}
                        </div>
                        <div className="text-[10px] text-[var(--color-secondary-text)]">
                          {coupon.maxDiscountAmount && `Cap: ₹${coupon.maxDiscountAmount} `}
                          {coupon.minBookingAmount > 0 && `Min: ₹${coupon.minBookingAmount}`}
                        </div>
                      </td>

                      {/* Scope */}
                      <td className="py-3.5 px-4 text-[var(--color-secondary-text)]">
                        {!coupon.applicableEvents || coupon.applicableEvents.length === 0 ? (
                          <span className="text-[11px] font-medium text-[var(--color-main-text)]">
                            All Organizer Events
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-[var(--color-main-text)]">
                            {coupon.applicableEvents.length} Specific Event(s)
                          </span>
                        )}
                      </td>

                      {/* Validity */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs">
                          {new Date(coupon.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-[var(--color-secondary-text)]">
                          {isExpired ? (
                            <span className="text-red-500 font-bold">Expired</span>
                          ) : (
                            <span className="text-emerald-500 font-medium">Active Window</span>
                          )}
                        </div>
                      </td>

                      {/* Redemptions */}
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[var(--color-main-text)]">
                            {coupon.redemptionCount || 0}
                          </span>
                          <span className="text-[var(--color-secondary-text)]">
                            / {coupon.maxRedemptions || '∞'}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            coupon.isActive && !isExpired
                              ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/20'
                              : 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border border-gray-500/20'
                          }`}
                        >
                          {coupon.isActive && !isExpired ? 'Active' : 'Disabled'}
                        </span>
                      </td>

                      {/* Moderation Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenModerate(coupon)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            coupon.isActive
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/20'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {coupon.isActive ? 'Disable' : 'Enable'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-3.5 border-t border-[var(--color-borders)] flex items-center justify-between text-xs text-[var(--color-secondary-text)]">
              <span>
                Showing page {page} of {pages} ({total} total coupons)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="px-2.5 py-1 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] rounded-lg disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Moderation Reason Modal */}
      {moderateCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-borders)]">
              <ShieldAlert className="w-5 h-5 text-[var(--color-primary-action)]" />
              <h3 className="font-serif font-bold text-base text-[var(--color-main-text)]">
                {moderateCoupon.isActive ? 'Disable Coupon' : 'Enable Coupon'}
              </h3>
            </div>

            <p className="text-[var(--color-secondary-text)]">
              You are about to {moderateCoupon.isActive ? 'disable' : 'enable'} coupon{' '}
              <strong className="text-[var(--color-main-text)] font-mono">
                {moderateCoupon.code}
              </strong>{' '}
              owned by {moderateCoupon.organizerId?.name || 'organizer'}. This administrative action will be recorded in the tamper-evident Audit Log.
            </p>

            <div>
              <label className="block font-bold text-[var(--color-main-text)] mb-1">
                Moderation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Specify the reason for this governance action..."
                value={moderateReason}
                onChange={(e) => setModerateReason(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModerateCoupon(null)}
                className="flex-1 py-2.5 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !moderateReason.trim()}
                onClick={handleConfirmModerate}
                className={`flex-1 py-2.5 rounded-xl font-bold text-white disabled:opacity-40 cursor-pointer ${
                  moderateCoupon.isActive ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {actionLoading
                  ? 'Recording...'
                  : moderateCoupon.isActive
                  ? 'Confirm Disable'
                  : 'Confirm Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
