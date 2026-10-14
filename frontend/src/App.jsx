import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import EventsPage from './pages/EventsPage';
import OrganizerPage from './pages/OrganizerPage';
import AuthPage from './pages/AuthPage';
import AdminLoginPage from './pages/AdminLoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AttendeeDashboard from './pages/AttendeeDashboard';
import OrganizerDashboard from './pages/OrganizerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';

function AppLayout({ children }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] transition-colors">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Discovery Routes */}
            <Route
              path="/"
              element={
                <AppLayout>
                  <HomePage />
                </AppLayout>
              }
            />
            <Route
              path="/events"
              element={
                <AppLayout>
                  <EventsPage />
                </AppLayout>
              }
            />
            <Route
              path="/organizers"
              element={
                <AppLayout>
                  <OrganizerPage />
                </AppLayout>
              }
            />
            <Route path="/organizer" element={<Navigate to="/organizers" replace />} />

            {/* Public Authentication Routes */}
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="signup" />} />
            <Route path="/register" element={<AuthPage initialMode="signup" />} />
            <Route path="/admin/login" element={<AdminLoginPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

            {/* Protected Attendee Route */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['attendee', 'organizer', 'admin']}>
                  <AppLayout>
                    <AttendeeDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Organizer Route */}
            <Route
              path="/organizer/dashboard"
              element={
                <ProtectedRoute allowedRoles={['organizer', 'admin']}>
                  <AppLayout>
                    <OrganizerDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Protected Admin Route */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
