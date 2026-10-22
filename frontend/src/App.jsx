import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import OrganizerPage from './pages/OrganizerPage';
import AuthPage from './pages/AuthPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AttendeeDashboard from './pages/AttendeeDashboard';
import OrganizerDashboard from './pages/OrganizerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MessagesPage from './pages/MessagesPage';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import NotificationToastContainer from './components/NotificationToastContainer';
import SessionTimeoutModal from './components/SessionTimeoutModal';
import ChatDrawer from './components/chat/ChatDrawer';
import { Loader2 } from 'lucide-react';

// Public Layout includes the full marketing and discovery footer
function PublicLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

// Dashboard Layout provides a clean, distraction-free app experience without the marketing footer
function DashboardLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      <Navbar />
      <main className="flex-1">{children}</main>
    </div>
  );
}

// Smart Root Route: redirects logged-in users directly to their role-specific dashboard
function RootRoute() {
  const { user, role, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-primary-bg)] text-[var(--color-main-text)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary-action)] mb-3" />
        <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'organizer') return <Navigate to="/organizer/dashboard" replace />;
    return <Navigate to="/attendee" replace />;
  }

  return (
    <PublicLayout>
      <HomePage />
    </PublicLayout>
  );
}

// Guest-Only Route: prevents authenticated users from viewing login/signup screens
function PublicOnlyRoute({ children }) {
  const { user, role, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-primary-bg)] text-[var(--color-main-text)]">
        <Loader2 className="w-10 h-10 animate-spin text-[var(--color-primary-action)] mb-3" />
        <p className="text-xs font-semibold text-[var(--color-secondary-text)]">
          Verifying security session...
        </p>
      </div>
    );
  }

  if (isAuthenticated && user) {
    if (role === 'admin') return <Navigate to="/admin" replace />;
    if (role === 'organizer') return <Navigate to="/organizer/dashboard" replace />;
    return <Navigate to="/attendee" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SocketProvider>
          <ChatProvider>
            <BrowserRouter>
              {/* Global Real-Time In-App Notification Toast Popup */}
              <NotificationToastContainer />
              {/* Global Session Inactivity Warning Modal */}
              <SessionTimeoutModal />
              {/* Global Event Real-Time Chat Drawer */}
              <ChatDrawer />
              <Routes>
              {/* Root Route: Smart landing / attendee dashboard redirection */}
              <Route path="/" element={<RootRoute />} />
              <Route
                path="/events"
                element={
                  <PublicLayout>
                    <EventsPage />
                  </PublicLayout>
                }
              />
              <Route
                path="/organizers"
                element={
                  <PublicLayout>
                    <OrganizerPage />
                  </PublicLayout>
                }
              />
              <Route path="/organizer" element={<Navigate to="/organizers" replace />} />

              {/* Public Authentication Routes (auto-redirect to dashboard if logged in) */}
              <Route
                path="/login"
                element={
                  <PublicOnlyRoute>
                    <AuthPage initialMode="login" />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicOnlyRoute>
                    <AuthPage initialMode="signup" />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnlyRoute>
                    <AuthPage initialMode="signup" />
                  </PublicOnlyRoute>
                }
              />
              <Route
                path="/admin/login"
                element={
                  <PublicOnlyRoute>
                    <AdminLoginPage />
                  </PublicOnlyRoute>
                }
              />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

              {/* Protected Attendee Routes (Clean DashboardLayout without Footer) */}
              <Route
                path="/attendee"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/events"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/bookings"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/tickets"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/notifications"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/reviews"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/profile"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/attendee/messages"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <AttendeeDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              {/* Dedicated Full-Page Messaging Route */}
              <Route
                path="/messages"
                element={
                  <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                    <DashboardLayout>
                      <MessagesPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/attendee/*" element={<Navigate to="/attendee" replace />} />

              {/* Backward Compatibility & Legacy Dashboard Deep-Link Redirects */}
              <Route path="/dashboard" element={<Navigate to="/attendee" replace />} />
              <Route path="/dashboard/events" element={<Navigate to="/attendee/events" replace />} />
              <Route path="/dashboard/bookings" element={<Navigate to="/attendee/bookings" replace />} />
              <Route path="/dashboard/tickets" element={<Navigate to="/attendee/tickets" replace />} />
              <Route path="/dashboard/notifications" element={<Navigate to="/attendee/notifications" replace />} />
              <Route path="/dashboard/messages" element={<Navigate to="/attendee/messages" replace />} />
              <Route path="/dashboard/reviews" element={<Navigate to="/attendee/reviews" replace />} />
              <Route path="/dashboard/profile" element={<Navigate to="/attendee/profile" replace />} />

              {/* Protected Organizer Route (Clean DashboardLayout without Footer) */}
              <Route
                path="/organizer/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                    <DashboardLayout>
                      <OrganizerDashboard />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/organizer/events" element={<Navigate to="/organizer/dashboard?tab=my-events" replace />} />
              <Route path="/organizer/create-event" element={<Navigate to="/organizer/dashboard?tab=create-event" replace />} />
              <Route path="/organizer/coupons" element={<Navigate to="/organizer/dashboard?tab=coupons" replace />} />
              <Route path="/organizer/messages" element={<Navigate to="/organizer/dashboard?tab=messages" replace />} />
              <Route path="/organizer/bookings" element={<Navigate to="/organizer/dashboard?tab=bookings" replace />} />
              <Route path="/organizer/attendees" element={<Navigate to="/organizer/dashboard?tab=attendees" replace />} />
              <Route path="/organizer/analytics" element={<Navigate to="/organizer/dashboard?tab=analytics" replace />} />
              <Route path="/organizer/profile" element={<Navigate to="/organizer/dashboard?tab=profile" replace />} />

              {/* Protected Admin Route */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/admin/events" element={<Navigate to="/admin?tab=events" replace />} />
              <Route path="/admin/users" element={<Navigate to="/admin?tab=users" replace />} />
              <Route path="/admin/bookings" element={<Navigate to="/admin?tab=bookings" replace />} />
              <Route path="/admin/coupons" element={<Navigate to="/admin?tab=coupons" replace />} />
              <Route path="/admin/chat" element={<Navigate to="/admin?tab=chat" replace />} />
              <Route path="/admin/messages" element={<Navigate to="/admin?tab=chat" replace />} />
              <Route path="/admin/reviews" element={<Navigate to="/admin?tab=reviews" replace />} />
              <Route path="/admin/audit-logs" element={<Navigate to="/admin?tab=audit-logs" replace />} />
              <Route path="/admin/notifications" element={<Navigate to="/admin?tab=notifications" replace />} />
              <Route path="/admin/*" element={<Navigate to="/admin" replace />} />

              {/* Fallback to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ChatProvider>
      </SocketProvider>
    </AuthProvider>
  </ThemeProvider>
);
}
