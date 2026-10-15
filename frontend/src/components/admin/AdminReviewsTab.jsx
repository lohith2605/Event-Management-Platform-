import { useState } from 'react';
import {
  MessageSquareQuote,
  Star,
  Search,
  Filter,
  CheckCircle,
  Flag,
  EyeOff,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

const STATUS_TABS = [
  { id: 'all', label: 'All Reviews' },
  { id: 'published', label: 'Published' },
  { id: 'flagged', label: 'Flagged for Review' },
  { id: 'hidden', label: 'Hidden / Moderated' },
];

export default function AdminReviewsTab({
  reviews = [],
  total = 0,
  page = 1,
  pages = 1,
  statusCounts = {},
  statusFilter = 'all',
  ratingFilter = 'all',
  searchQuery = '',
  loading = false,
  error = null,
  onStatusChange,
  onRatingChange,
  onSearchChange,
  onPageChange,
  onRefresh,
  onModerateReview,
  isProcessing = false,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'flagged':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
            Flagged
          </span>
        );
      case 'hidden':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            Hidden
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            Published
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-main-text)] font-serif">
              Review Moderation & Community Quality
            </h2>
            <p className="text-xs text-[var(--color-secondary-text)]">
              Inspect attendee reviews and moderate inappropriate or unhelpful content.
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

        {/* Status Tabs with Counts */}
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
                      : tab.id === 'flagged' && count > 0
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

        {/* Search & Rating Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search by review text or attendee name..."
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

          <div className="sm:col-span-4">
            <select
              value={ratingFilter}
              onChange={(e) => onRatingChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4 Stars</option>
              <option value="3">3 Stars</option>
              <option value="2">2 Stars</option>
              <option value="1">1 Star</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
            Loading reviews...
          </p>
        </div>
      )}

      {/* Error */}
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

      {/* Empty */}
      {!loading && !error && reviews.length === 0 && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-2">
          <MessageSquareQuote className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-2" />
          <h3 className="text-sm font-bold text-[var(--color-main-text)]">No Reviews Found</h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
            {searchQuery
              ? `No reviews matching "${searchQuery}".`
              : 'No reviews found in this moderation category.'}
          </p>
        </div>
      )}

      {/* Reviews List */}
      {!loading && !error && reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <div
              key={rev._id}
              className="p-5 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs space-y-3 text-xs"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-0.5 text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`w-3.5 h-3.5 ${
                          i < rev.rating ? 'fill-current' : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-[var(--color-main-text)]">
                    {rev.attendeeName}
                  </span>
                  <span className="text-[var(--color-secondary-text)]">
                    for <strong>{rev.eventId?.title || 'Event'}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[var(--color-secondary-text)] font-mono">
                    {new Date(rev.createdAt).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  {getStatusBadge(rev.status)}
                </div>
              </div>

              <p className="text-[var(--color-main-text)] leading-relaxed italic bg-[var(--color-secondary-bg)]/30 p-3 rounded-xl border border-[var(--color-borders)]/40">
                &ldquo;{rev.comment}&rdquo;
              </p>

              {rev.moderationReason && (
                <p className="text-[10px] text-red-500 font-medium">
                  Moderator Note: {rev.moderationReason}
                </p>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--color-borders)]/50">
                {rev.status !== 'published' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onModerateReview(rev._id, 'publish')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Publish</span>
                  </button>
                )}

                {rev.status !== 'flagged' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onModerateReview(rev._id, 'flag')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/25 border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Flag</span>
                  </button>
                )}

                {rev.status !== 'hidden' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => onModerateReview(rev._id, 'hide')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 border border-red-500/30 transition-colors cursor-pointer"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide from Public</span>
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-4 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-secondary-text)]">
                Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total reviews)
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
