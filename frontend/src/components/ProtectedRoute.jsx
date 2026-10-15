import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ allowedRoles, children }) {
  const { user, role, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-[var(--color-main-text)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary-action)] mb-4" />
        <p className="text-sm font-semibold text-[var(--color-secondary-text)]">
          Verifying security session...
        </p>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    // If requesting admin-only portal, redirect to admin login
    const isAdminOnly = allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === 'admin';
    const targetLogin = isAdminOnly ? '/admin/login' : '/login';

    return <Navigate to={targetLogin} state={{ from: location }} replace />;
  }

  // Role authorization check (case-insensitive with fallback to attendee)
  const normalizedRole = (role || 'attendee').toLowerCase();
  const hasAccess =
    !allowedRoles ||
    allowedRoles.length === 0 ||
    allowedRoles.map((r) => r.toLowerCase()).includes(normalizedRole);

  if (!hasAccess) {
    const targetDashboard =
      normalizedRole === 'admin'
        ? '/admin'
        : normalizedRole === 'organizer'
        ? '/organizer/dashboard'
        : '/attendee';

    // Guard against self-redirect loops
    if (location.pathname === targetDashboard || location.pathname.startsWith(targetDashboard)) {
      return children;
    }

    return <Navigate to={targetDashboard} replace />;
  }

  return children;
}
