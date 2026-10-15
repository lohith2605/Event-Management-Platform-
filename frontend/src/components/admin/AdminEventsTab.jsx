import { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Calendar,
  MapPin,
  Tag,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Undo2,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'all', label: 'All Events' },
  { id: 'pending', label: 'Pending Approval' },
  { id: 'published', label: 'Published / Live' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'draft', label: 'Drafts' },
  { id: 'cancelled', label: 'Cancelled' },
];

export default function AdminEventsTab({
  events = [],
  total = 0,
  page = 1,
  pages = 1,
  statusCounts = {},
  statusFilter = 'all',
  searchQuery = '',
  categoryFilter = 'all',
  formatFilter = 'all',
  loading = false,
  error = null,
  onStatusChange,
  onSearchChange,
  onCategoryChange,
  onFormatChange,
  onPageChange,
  onRefresh,
  onOpenEventDetails,
  onQuickApprove,
  onOpenRejectModal,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" />
            <span>Published</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 animate-pulse">
            <Clock className="w-3 h-3" />
            <span>Pending Review</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <XCircle className="w-3 h-3" />
            <span>Rejected</span>
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/15 text-gray-700 dark:text-gray-300 border border-gray-500/30">
            <Tag className="w-3 h-3" />
            <span>Draft</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-600 dark:text-zinc-400 border border-zinc-500/30">
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-500/10 text-gray-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-main-text)] font-serif">
              Event Moderation & Oversight
            </h2>
            <p className="text-xs text-[var(--color-secondary-text)]">
              Review and moderate event submissions to maintain UTSAV&apos;s quality standards.
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Status Filter Tabs with Counts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--color-borders)] scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab.id] ?? 0;
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-primary-action)] text-white shadow-xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : tab.id === 'pending' && count > 0
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                      : 'bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by title, organizer, city, or venue..."
              className="w-full pl-9 pr-20 py-2 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  onSearchChange('');
                }}
                className="absolute right-12 top-1/2 -translate-y-1/2 text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[var(--color-primary-action)] text-white cursor-pointer"
            >
              Go
            </button>
          </form>

          <div className="sm:col-span-3">
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Categories</option>
              <option value="Music & Concerts">Music & Concerts</option>
              <option value="Arts & Culture">Arts & Culture</option>
              <option value="Food & Culinary">Food & Culinary</option>
              <option value="Workshops & Learning">Workshops & Learning</option>
              <option value="Festivals & Parades">Festivals & Parades</option>
              <option value="Tech & Design">Tech & Design</option>
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={formatFilter}
              onChange={(e) => onFormatChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Formats</option>
              <option value="In-Person">In-Person</option>
              <option value="Online">Online / Stream</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
            Loading events...
          </p>
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="p-5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-600 dark:text-red-400 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="px-3 py-1.5 rounded-lg font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && events.length === 0 && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-2">
          <Calendar className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-2" />
          <h3 className="text-sm font-bold text-[var(--color-main-text)]">No Events Found</h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
            {searchQuery
              ? `No events matching "${searchQuery}" under the selected filters.`
              : `No events in '${statusFilter}' status.`}
          </p>
          {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || formatFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
                onStatusChange('all');
                onCategoryChange('all');
                onFormatChange('all');
              }}
              className="mt-3 px-3.5 py-1.5 rounded-xl text-xs font-bold text-[var(--color-primary-action)] border border-[var(--color-primary-action)] hover:bg-[var(--color-primary-action)]/10 transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {/* Events Table */}
      {!loading && !error && events.length > 0 && (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-secondary-bg)]/60 border-b border-[var(--color-borders)] text-[var(--color-secondary-text)] uppercase font-extrabold tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Event Details</th>
                  <th className="py-3.5 px-4">Organizer</th>
                  <th className="py-3.5 px-4">Schedule & Venue</th>
                  <th className="py-3.5 px-4">Capacity / Price</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)] text-[var(--color-main-text)]">
                {events.map((evt) => (
                  <tr key={evt._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                    {/* Event Details */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={evt.image || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=400&q=80'}
                          alt={evt.title}
                          className="w-12 h-12 rounded-xl object-cover border border-[var(--color-borders)] shrink-0 bg-[var(--color-secondary-bg)]"
                        />
                        <div className="min-w-0 max-w-[220px]">
                          <span className="font-bold text-xs truncate block text-[var(--color-main-text)] hover:underline cursor-pointer" onClick={() => onOpenEventDetails(evt._id)}>
                            {evt.title}
                          </span>
                          <span className="text-[10px] text-[var(--color-secondary-text)] block truncate">
                            {evt.category} &bull; {evt.format}
                          </span>
                          {evt.isFeatured && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-sm text-[9px] font-black bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)]">
                              Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Organizer Info */}
                    <td className="py-3.5 px-4">
                      <span className="font-bold block truncate max-w-[150px]">
                        {evt.organizer}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)] block truncate max-w-[150px]">
                        {evt.organizerId?.email || 'N/A'}
                      </span>
                    </td>

                    {/* Schedule & Venue */}
                    <td className="py-3.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold">
                          <Calendar className="w-3 h-3 text-[var(--color-secondary-text)] shrink-0" />
                          <span>{evt.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[var(--color-secondary-text)] truncate max-w-[180px]">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span>{evt.venue}, {evt.city}</span>
                        </div>
                      </div>
                    </td>

                    {/* Capacity / Price */}
                    <td className="py-3.5 px-4">
                      <span className="font-black text-xs block text-[var(--color-main-text)]">
                        {evt.priceNumber === 0 ? 'Free' : `₹${evt.priceNumber}`}
                      </span>
                      <span className="text-[10px] text-[var(--color-secondary-text)]">
                        {evt.spotsLeft} / {evt.totalCapacity} spots
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(evt.status)}
                      {evt.rejectionReason && (
                        <span className="block text-[10px] text-red-500 mt-1 max-w-[140px] truncate" title={evt.rejectionReason}>
                          Reason: {evt.rejectionReason}
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenEventDetails(evt._id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                          title="Open Full Event Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {evt.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => onQuickApprove(evt._id, evt.title)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
                              title="Approve & Publish Immediately"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenRejectModal(evt)}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-600/15 hover:bg-red-600/25 text-red-600 dark:text-red-400 border border-red-500/30 transition-colors cursor-pointer"
                              title="Reject with Reason"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border-t border-[var(--color-borders)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-secondary-text)]">
                Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total events)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-[var(--color-borders)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-secondary-bg)] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-bold text-xs px-2">
                  {page} / {pages}
                </span>
                <button
                  type="button"
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= pages}
                  className="p-1.5 rounded-lg border border-[var(--color-borders)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-secondary-bg)] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
