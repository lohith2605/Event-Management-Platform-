import { useState, useEffect, useCallback } from 'react';
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  Users,
  AlertCircle,
  Loader2,
  Trash2,
  Edit2,
  Eye,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Receipt,
  X,
} from 'lucide-react';
import {
  fetchOrganizerCouponsApi,
  fetchOrganizerCouponStatsApi,
  createOrganizerCouponApi,
  updateOrganizerCouponApi,
  toggleOrganizerCouponStatusApi,
  deleteOrganizerCouponApi,
  fetchOrganizerCouponByIdApi,
} from '../../api/coupons';

export default function CouponsTab({ events = [] }) {
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [viewingCouponId, setViewingCouponId] = useState(null);
  const [viewingCouponData, setViewingCouponData] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [deleteModalCoupon, setDeleteModalCoupon] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');

  // Form state for Create / Edit
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '',
    minBookingAmount: '',
    maxDiscountAmount: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    maxRedemptions: '',
    maxRedemptionsPerUser: '1',
    applicableEvents: [],
    isActive: true,
  });

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await fetchOrganizerCouponStatsApi();
      if (res && res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to load coupon stats:', err.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchOrganizerCouponsApi({
        status: statusFilter,
        eventId: eventFilter,
        search: searchQuery,
      });

      if (res && res.success) {
        setCoupons(res.coupons || []);
      } else {
        setError(res?.message || 'Failed to load coupons.');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch coupons from server.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, eventFilter, searchQuery]);

  useEffect(() => {
    loadStats();
    loadCoupons();
  }, [loadStats, loadCoupons]);

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2500);
  };

  const openCreateModal = () => {
    setEditingCoupon(null);
    setFormData({
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      minBookingAmount: '',
      maxDiscountAmount: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
      maxRedemptions: '',
      maxRedemptionsPerUser: '1',
      applicableEvents: [],
      isActive: true,
    });
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      description: coupon.description || '',
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minBookingAmount: coupon.minBookingAmount || '',
      maxDiscountAmount: coupon.maxDiscountAmount || '',
      startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().split('T')[0] : '',
      endDate: coupon.endDate ? new Date(coupon.endDate).toISOString().split('T')[0] : '',
      maxRedemptions: coupon.maxRedemptions || '',
      maxRedemptionsPerUser: coupon.maxRedemptionsPerUser || '1',
      applicableEvents: coupon.applicableEvents ? coupon.applicableEvents.map((e) => e._id || e) : [],
      isActive: coupon.isActive,
    });
    setModalError(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setModalError(null);

    try {
      const payload = {
        code: formData.code.trim().toUpperCase(),
        description: formData.description.trim(),
        discountType: formData.discountType,
        discountValue: Number(formData.discountValue),
        minBookingAmount: formData.minBookingAmount ? Number(formData.minBookingAmount) : 0,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        startDate: formData.startDate,
        endDate: formData.endDate,
        maxRedemptions: formData.maxRedemptions ? Number(formData.maxRedemptions) : null,
        maxRedemptionsPerUser: formData.maxRedemptionsPerUser ? Number(formData.maxRedemptionsPerUser) : 1,
        applicableEvents: formData.applicableEvents,
        isActive: formData.isActive,
      };

      if (editingCoupon) {
        await updateOrganizerCouponApi(editingCoupon._id, payload);
      } else {
        await createOrganizerCouponApi(payload);
      }

      setIsCreateModalOpen(false);
      loadStats();
      loadCoupons();
    } catch (err) {
      setModalError(err.message || 'Failed to save coupon.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    try {
      await toggleOrganizerCouponStatusApi(coupon._id, !coupon.isActive);
      loadStats();
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const handleDeleteCoupon = async () => {
    if (!deleteModalCoupon) return;
    setActionLoading(true);
    try {
      await deleteOrganizerCouponApi(deleteModalCoupon._id);
      setDeleteModalCoupon(null);
      loadStats();
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Failed to delete coupon.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewRedemptions = async (couponId) => {
    setViewingCouponId(couponId);
    setViewingLoading(true);
    try {
      const res = await fetchOrganizerCouponByIdApi(couponId);
      if (res && res.success) {
        setViewingCouponData(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setViewingLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in text-[var(--color-main-text)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--color-borders)]">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold font-serif flex items-center gap-2">
            <Tag className="w-6 h-6 text-[var(--color-primary-action)]" />
            <span>Coupons & Discounts</span>
          </h2>
          <p className="text-xs sm:text-sm text-[var(--color-secondary-text)] mt-0.5">
            Create promotional codes, limit redemptions, and view genuine discount metrics for your events.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white font-bold text-xs sm:text-sm shadow-xs transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Coupon</span>
        </button>
      </div>

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Total Coupons</span>
            <Tag className="w-4 h-4 text-[var(--color-primary-action)]" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : stats?.totalCoupons || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Created across your events
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Active Codes</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {statsLoading ? '...' : stats?.activeCoupons || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Eligible for attendee checkout
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Total Redemptions</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : stats?.totalRedemptions || 0}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Successful attendee bookings
          </div>
        </div>

        <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-[var(--color-secondary-text)] text-xs font-semibold">
            <span>Discounts Granted</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-[var(--color-main-text)]">
            {statsLoading ? '...' : `₹${stats?.totalDiscountGranted || 0}`}
          </div>
          <div className="text-[11px] text-[var(--color-secondary-text)] mt-1">
            Verified savings granted
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] placeholder:text-[var(--color-secondary-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[var(--color-secondary-text)] hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Disabled</option>
              <option value="expired">Expired</option>
            </select>
          </div>

          {/* Event Filter */}
          {events.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[var(--color-secondary-text)] hidden sm:inline">Event:</span>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="max-w-[180px] truncate px-2.5 py-1.5 text-xs bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none"
              >
                <option value="all">All Events</option>
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              loadStats();
              loadCoupons();
            }}
            className="p-1.5 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
            title="Refresh coupons"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Coupons Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-[var(--color-secondary-text)] flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary-action)]" />
          <p className="text-xs">Loading coupons from database...</p>
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
            {searchQuery || statusFilter !== 'all' || eventFilter !== 'all'
              ? 'No coupons match your active filters. Try resetting the search or filter options.'
              : 'You haven’t created any promotional coupons yet. Create your first coupon to offer exclusive discounts to your attendees.'}
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-action)] text-white font-bold text-xs rounded-xl shadow-xs hover:bg-[var(--color-primary-action-hover)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create First Coupon</span>
          </button>
        </div>
      ) : (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--color-secondary-bg)]/80 text-[var(--color-secondary-text)] font-semibold border-b border-[var(--color-borders)]">
                <tr>
                  <th className="py-3 px-4">Coupon Code</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Scope</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)]">
                {coupons.map((coupon) => {
                  const now = new Date();
                  const isExpired = new Date(coupon.endDate) < now;
                  const isUpcoming = new Date(coupon.startDate) > now;
                  const isFull =
                    coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions;

                  return (
                    <tr
                      key={coupon._id}
                      className="hover:bg-[var(--color-secondary-bg)]/40 transition-colors"
                    >
                      {/* Code */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-[var(--color-primary-action)] uppercase tracking-wider bg-[var(--color-secondary-bg)] px-2.5 py-1 rounded-lg border border-[var(--color-borders)]">
                            {coupon.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(coupon.code)}
                            className="p-1 rounded text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                            title="Copy code"
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-[11px] text-[var(--color-secondary-text)] mt-1 truncate max-w-[200px]">
                            {coupon.description}
                          </p>
                        )}
                      </td>

                      {/* Discount Value */}
                      <td className="py-3.5 px-4 font-semibold text-[var(--color-main-text)]">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm">
                            {coupon.discountType === 'percentage'
                              ? `${coupon.discountValue}% OFF`
                              : `₹${coupon.discountValue} OFF`}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--color-secondary-text)] space-y-0.5 mt-0.5">
                          {coupon.maxDiscountAmount && (
                            <div>Cap: ₹{coupon.maxDiscountAmount}</div>
                          )}
                          {coupon.minBookingAmount > 0 && (
                            <div>Min Subtotal: ₹{coupon.minBookingAmount}</div>
                          )}
                        </div>
                      </td>

                      {/* Scope (Applicable Events) */}
                      <td className="py-3.5 px-4 text-[var(--color-secondary-text)]">
                        {!coupon.applicableEvents || coupon.applicableEvents.length === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--color-secondary-bg)] text-[11px] font-medium text-[var(--color-main-text)] border border-[var(--color-borders)]">
                            <Sparkles className="w-3 h-3 text-[var(--color-golden-accent)]" />
                            All Your Events
                          </span>
                        ) : coupon.applicableEvents.length === 1 ? (
                          <span className="text-xs text-[var(--color-main-text)] font-medium truncate block max-w-[150px]">
                            {coupon.applicableEvents[0]?.title || 'Single Event'}
                          </span>
                        ) : (
                          <span className="text-xs text-[var(--color-main-text)] font-medium">
                            {coupon.applicableEvents.length} Selected Events
                          </span>
                        )}
                      </td>

                      {/* Validity Period */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs text-[var(--color-main-text)]">
                          {new Date(coupon.endDate).toLocaleDateString()}
                        </div>
                        <div className="text-[10px] text-[var(--color-secondary-text)]">
                          From: {new Date(coupon.startDate).toLocaleDateString()}
                        </div>
                        {isExpired ? (
                          <span className="text-[10px] text-red-500 font-bold">Expired</span>
                        ) : isFull ? (
                          <span className="text-[10px] text-amber-500 font-bold">Exhausted</span>
                        ) : isUpcoming ? (
                          <span className="text-[10px] text-amber-500 font-bold">Upcoming</span>
                        ) : (
                          <span className="text-[10px] text-emerald-500 font-semibold">Active Window</span>
                        )}
                      </td>

                      {/* Redemptions */}
                      <td className="py-3.5 px-4 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-[var(--color-main-text)]">
                            {coupon.redemptionCount || 0}
                          </span>
                          <span className="text-[var(--color-secondary-text)] text-xs">
                            / {coupon.maxRedemptions ? coupon.maxRedemptions : '∞'}
                          </span>
                        </div>
                        <div className="text-[10px] text-[var(--color-secondary-text)]">
                          Max/user: {coupon.maxRedemptionsPerUser || 1}
                        </div>
                      </td>

                      {/* Active Status Toggle */}
                      <td className="py-3.5 px-4">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(coupon)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            coupon.isActive && !isExpired
                              ? 'bg-emerald-500'
                              : 'bg-gray-400 dark:bg-gray-600'
                          }`}
                          role="switch"
                          aria-checked={coupon.isActive}
                          title={coupon.isActive ? 'Click to disable' : 'Click to enable'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              coupon.isActive && !isExpired ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <div className="text-[10px] text-[var(--color-secondary-text)] mt-0.5">
                          {coupon.isActive && !isExpired ? 'Enabled' : 'Disabled'}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleViewRedemptions(coupon._id)}
                            className="p-1.5 rounded-lg bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                            title="View Redemptions"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditModal(coupon)}
                            className="p-1.5 rounded-lg bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                            title="Edit Coupon"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeleteModalCoupon(coupon)}
                            className="p-1.5 rounded-lg bg-[var(--color-secondary-bg)] hover:bg-red-500/10 text-[var(--color-secondary-text)] hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete Coupon"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Coupon Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="p-4 sm:p-5 border-b border-[var(--color-borders)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-[var(--color-primary-action)]" />
                <h3 className="font-serif font-bold text-base sm:text-lg">
                  {editingCoupon ? `Edit Coupon "${editingCoupon.code}"` : 'Create Promotional Coupon'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCoupon} className="p-5 overflow-y-auto space-y-4 text-xs">
              {modalError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Coupon Code */}
              <div>
                <label className="block font-bold text-[var(--color-main-text)] mb-1">
                  Coupon Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DIWALI2026, EARLYBIRD"
                  value={formData.code}
                  disabled={editingCoupon && editingCoupon.redemptionCount > 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
                    }))
                  }
                  className="w-full font-mono uppercase px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)] disabled:opacity-50"
                />
                <p className="text-[11px] text-[var(--color-secondary-text)] mt-1">
                  Uppercase letters, numbers, hyphens, and underscores only.
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-[var(--color-main-text)] mb-1">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 20% discount on Early Bird passes"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                />
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Discount Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, discountType: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Discount Value <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    max={formData.discountType === 'percentage' ? '100' : '999999'}
                    step="any"
                    placeholder={formData.discountType === 'percentage' ? 'e.g. 20' : 'e.g. 250'}
                    value={formData.discountValue}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, discountValue: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>
              </div>

              {/* Minimum Subtotal and Max Discount Cap */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Min Booking Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for no minimum"
                    value={formData.minBookingAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, minBookingAmount: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Max Discount Cap (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Optional cap for % discount"
                    disabled={formData.discountType !== 'percentage'}
                    value={formData.maxDiscountAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, maxDiscountAmount: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)] disabled:opacity-40"
                  />
                </div>
              </div>

              {/* Validity Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Expiration Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>
              </div>

              {/* Redemption Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Total Redemptions Limit
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave blank for unlimited"
                    value={formData.maxRedemptions}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, maxRedemptions: e.target.value }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--color-main-text)] mb-1">
                    Max Redemptions Per Attendee <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.maxRedemptionsPerUser}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxRedemptionsPerUser: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg text-[var(--color-main-text)] focus:outline-none focus:border-[var(--color-primary-action)]"
                  />
                </div>
              </div>

              {/* Applicable Events */}
              <div>
                <label className="block font-bold text-[var(--color-main-text)] mb-1">
                  Applicable Events
                </label>
                <div className="p-3 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-lg space-y-2 max-h-36 overflow-y-auto">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={formData.applicableEvents.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData((prev) => ({ ...prev, applicableEvents: [] }));
                        }
                      }}
                      className="rounded"
                    />
                    <span>All My Events (Platform Wide for Organizer)</span>
                  </label>
                  {events.map((ev) => {
                    const isChecked = formData.applicableEvents.includes(ev._id);
                    return (
                      <label key={ev._id} className="flex items-center gap-2 cursor-pointer pl-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData((prev) => ({
                                ...prev,
                                applicableEvents: [...prev.applicableEvents, ev._id],
                              }));
                            } else {
                              setFormData((prev) => ({
                                ...prev,
                                applicableEvents: prev.applicableEvents.filter(
                                  (id) => id !== ev._id
                                ),
                              }));
                            }
                          }}
                          className="rounded"
                        />
                        <span className="truncate">{ev.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status active toggle */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="coupon-active-toggle"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, isActive: e.target.checked }))
                  }
                  className="rounded"
                />
                <label
                  htmlFor="coupon-active-toggle"
                  className="font-semibold text-[var(--color-main-text)] cursor-pointer"
                >
                  Enable Coupon immediately upon creation
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--color-borders)]">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalCoupon && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 text-xs">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-serif font-bold text-base text-[var(--color-main-text)]">
                Delete Coupon "{deleteModalCoupon.code}"?
              </h3>
              <p className="text-[var(--color-secondary-text)] mt-1">
                {deleteModalCoupon.redemptionCount > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-semibold block">
                    This coupon has already been redeemed {deleteModalCoupon.redemptionCount} times.
                    To preserve financial integrity, please disable the coupon instead of deleting it.
                  </span>
                ) : (
                  'Are you sure you want to permanently delete this coupon? This action cannot be undone.'
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalCoupon(null)}
                className="flex-1 py-2.5 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || deleteModalCoupon.redemptionCount > 0}
                onClick={handleDeleteCoupon}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold disabled:opacity-40 cursor-pointer"
              >
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Redemptions Modal */}
      {viewingCouponId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-2xl w-full p-5 shadow-2xl relative max-h-[85vh] flex flex-col text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--color-borders)]">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-[var(--color-primary-action)]" />
                <h3 className="font-serif font-bold text-base text-[var(--color-main-text)]">
                  Redemption History: {viewingCouponData?.coupon?.code || 'Coupon'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewingCouponId(null);
                  setViewingCouponData(null);
                }}
                className="p-1 rounded text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-3 flex-1">
              {viewingLoading ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-action)]" />
                  <span>Loading redemption audit trail...</span>
                </div>
              ) : viewingCouponData?.redemptions?.length === 0 ? (
                <div className="py-12 text-center text-[var(--color-secondary-text)]">
                  No attendees have redeemed this coupon yet.
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-borders)]">
                  {viewingCouponData?.redemptions?.map((r) => (
                    <div key={r._id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-[var(--color-main-text)]">
                          {r.userId?.name || 'Attendee'} ({r.userId?.email || 'N/A'})
                        </div>
                        <div className="text-[11px] text-[var(--color-secondary-text)] mt-0.5">
                          Booking: <span className="font-mono">{r.bookingReference}</span> •{' '}
                          {new Date(r.redeemedAt || r.createdAt).toLocaleString()}
                        </div>
                        {r.eventId && (
                          <div className="text-[11px] text-[var(--color-secondary-text)]">
                            Event: {r.eventId?.title}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-emerald-600 dark:text-emerald-400">
                          -₹{r.discountAmount}
                        </div>
                        <div className="text-[11px] text-[var(--color-secondary-text)]">
                          Subtotal: ₹{r.originalSubtotal} • Paid: ₹{r.finalAmount}
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            r.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-600 border border-red-500/20'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[var(--color-borders)] flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setViewingCouponId(null);
                  setViewingCouponData(null);
                }}
                className="px-4 py-2 rounded-xl bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] text-[var(--color-main-text)] font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
