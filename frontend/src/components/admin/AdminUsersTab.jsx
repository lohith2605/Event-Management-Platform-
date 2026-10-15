import { useState } from 'react';
import {
  Users,
  Search,
  Filter,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  AlertCircle,
} from 'lucide-react';

const ROLE_TABS = [
  { id: 'all', label: 'All Roles' },
  { id: 'attendee', label: 'Attendees' },
  { id: 'organizer', label: 'Organizers' },
  { id: 'admin', label: 'Admins' },
];

export default function AdminUsersTab({
  users = [],
  total = 0,
  page = 1,
  pages = 1,
  roleCounts = {},
  roleFilter = 'all',
  statusFilter = 'all',
  searchQuery = '',
  loading = false,
  error = null,
  currentAdminId,
  onRoleChange,
  onStatusChange,
  onSearchChange,
  onPageChange,
  onRefresh,
  onOpenUserDetails,
  onOpenStatusModal,
}) {
  const [localSearch, setLocalSearch] = useState(searchQuery);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    onSearchChange(localSearch);
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            Admin
          </span>
        );
      case 'organizer':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            Organizer
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[var(--color-golden-accent)]/20 text-[var(--color-golden-accent)] border border-[var(--color-golden-accent)]/30">
            Attendee
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Filter Controls */}
      <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--color-main-text)] font-serif">
              User Management & Account Governance
            </h2>
            <p className="text-xs text-[var(--color-secondary-text)]">
              Manage attendee and organizer accounts across the platform.
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

        {/* Role Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--color-borders)] scrollbar-none">
          {ROLE_TABS.map((tab) => {
            const count = roleCounts[tab.id] ?? 0;
            const isActive = roleFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onRoleChange(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-primary-action)] text-white shadow-xs'
                    : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] hover:bg-[var(--color-secondary-bg)]'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filter */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-[var(--color-secondary-text)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search user by name or email address..."
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
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full py-2 px-3 rounded-xl text-xs bg-[var(--color-input-bg)] border border-[var(--color-borders)] text-[var(--color-main-text)] focus:outline-hidden focus:border-[var(--color-primary-action)]"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="suspended">Suspended Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-3">
          <div className="w-8 h-8 border-3 border-[var(--color-primary-action)] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
            Loading user accounts...
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
      {!loading && !error && users.length === 0 && (
        <div className="p-12 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl text-center space-y-2">
          <Users className="w-10 h-10 text-[var(--color-secondary-text)] mx-auto opacity-50 mb-2" />
          <h3 className="text-sm font-bold text-[var(--color-main-text)]">No Accounts Found</h3>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-sm mx-auto">
            {searchQuery
              ? `No user accounts matching "${searchQuery}".`
              : 'No users registered under the selected criteria.'}
          </p>
        </div>
      )}

      {/* Users Table */}
      {!loading && !error && users.length > 0 && (
        <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[var(--color-secondary-bg)]/60 border-b border-[var(--color-borders)] text-[var(--color-secondary-text)] uppercase font-extrabold tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4">Contact</th>
                  <th className="py-3.5 px-4">Registered Date</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-borders)] text-[var(--color-main-text)]">
                {users.map((u) => {
                  const isSelf = currentAdminId && String(currentAdminId) === String(u._id);
                  return (
                    <tr key={u._id} className="hover:bg-[var(--color-secondary-bg)]/30 transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] flex items-center justify-center font-bold text-sm shrink-0 text-[var(--color-main-text)]">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0 max-w-[200px]">
                            <span
                              className="font-bold text-xs truncate block hover:underline cursor-pointer"
                              onClick={() => onOpenUserDetails(u._id)}
                            >
                              {u.name}
                            </span>
                            <span className="text-[10px] text-[var(--color-secondary-text)] truncate block">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        {getRoleBadge(u.role)}
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        {u.isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
                            <XCircle className="w-3 h-3" />
                            <span>Suspended</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle className="w-3 h-3" />
                            <span>Active</span>
                          </span>
                        )}
                        {u.suspensionReason && (
                          <span className="block text-[10px] text-red-500 mt-1 max-w-[140px] truncate" title={u.suspensionReason}>
                            {u.suspensionReason}
                          </span>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] block">{u.phone || 'No phone'}</span>
                        <span className="text-[10px] text-[var(--color-secondary-text)] block">{u.city || 'No city'}</span>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4">
                        <span className="text-[11px] font-medium">
                          {new Date(u.createdAt).toLocaleDateString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenUserDetails(u._id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                            title="View Full User Profile & Activity"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Suspend / Reactivate action */}
                          {u.isSuspended ? (
                            <button
                              type="button"
                              onClick={() => onOpenStatusModal(u, 'reactivate')}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors cursor-pointer"
                              title="Reactivate Account"
                            >
                              Reactivate
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => onOpenStatusModal(u, 'suspend')}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                isSelf
                                  ? 'opacity-40 cursor-not-allowed bg-gray-500/10 text-gray-400'
                                  : 'bg-red-500/15 text-red-600 dark:text-red-400 hover:bg-red-500/25 border border-red-500/30'
                              }`}
                              title={isSelf ? 'Cannot suspend self' : 'Suspend Account'}
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pages > 1 && (
            <div className="p-4 bg-[var(--color-secondary-bg)]/40 border-t border-[var(--color-borders)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[var(--color-secondary-text)]">
                Showing page <strong>{page}</strong> of <strong>{pages}</strong> ({total} total users)
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
