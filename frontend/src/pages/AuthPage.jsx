import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Eye,
  EyeOff,
  LogIn,
  UserPlus,
  Lock,
  Mail,
  User,
  Building,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { BRAND } from '../config/brand';
import { useAuth } from '../context/AuthContext';
import { forgotPasswordApi } from '../api/auth';
import { buttonHoverTap } from '../config/animations';

function GoogleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export default function AuthPage({ initialMode = 'login' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user: currentUser, role: currentRole, isAuthenticated, isLoading: authLoading, login, register, loginWithGoogle } = useAuth();

  const shouldReduceMotion = useReducedMotion();

  // Mode derived directly from route path
  const mode =
    location.pathname.startsWith('/signup') || location.pathname.startsWith('/register')
      ? 'signup'
      : location.pathname.startsWith('/login')
        ? 'login'
        : initialMode;

  // Immediately redirect already authenticated users to their dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const from = location.state?.from?.pathname;
      if (from && from !== '/' && !from.startsWith('/login') && !from.startsWith('/signup') && !from.startsWith('/register')) {
        navigate(from === '/dashboard' ? '/attendee' : from, { replace: true });
      } else if (currentRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (currentRole === 'organizer') {
        navigate('/organizer/dashboard', { replace: true });
      } else {
        navigate('/attendee', { replace: true });
      }
    }
  }, [isAuthenticated, authLoading, currentRole, location.state, navigate]);

  // Form states
  const [role, setRole] = useState(
    searchParams.get('role') === 'organizer' ? 'organizer' : 'attendee'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Validation & Submission
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccessMessage, setForgotSuccessMessage] = useState('');
  const [forgotError, setForgotError] = useState('');

  // Handle mode switching with safe state preservation
  const handleSwitchMode = (nextMode) => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
    setServerError('');

    if (nextMode === 'signup') {
      navigate('/signup', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  };

  // Client validation
  const validateForm = () => {
    const errs = {};

    if (!email.trim()) {
      errs.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        errs.name =
          role === 'organizer'
            ? 'Organization or committee name is required.'
            : 'Full name is required.';
      }

      if (!confirmPassword) {
        errs.confirmPassword = 'Please confirm your password.';
      } else if (password !== confirmPassword) {
        errs.confirmPassword = 'Passwords do not match.';
      }

      if (!agreedTerms) {
        errs.terms = 'You must agree to the Terms of Service to create an account.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Submit real authentication request
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setServerError('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const user = await login(email, password);
        // Direct to authorized destination
        const from = location.state?.from?.pathname;
        if (from && from !== '/' && !from.startsWith('/login') && !from.startsWith('/signup') && !from.startsWith('/register')) {
          navigate(from === '/dashboard' ? '/attendee' : from, { replace: true });
        } else if (user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (user.role === 'organizer') {
          navigate('/organizer/dashboard', { replace: true });
        } else {
          navigate('/attendee', { replace: true });
        }
      } else {
        const user = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          confirmPassword,
          role,
        });

        // Direct new account to role dashboard
        if (user.role === 'organizer') {
          navigate('/organizer/dashboard', { replace: true });
        } else {
          navigate('/attendee', { replace: true });
        }
      }
    } catch (err) {
      setServerError(
        err.message ||
          (mode === 'login'
            ? 'Invalid email or password.'
            : 'Registration failed. Please check your details and try again.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Real Google OAuth handler via Firebase
  const handleGoogleAuth = async () => {
    if (isGoogleSubmitting || isSubmitting) return;
    setServerError('');
    setIsGoogleSubmitting(true);

    try {
      const user = await loginWithGoogle();

      // Direct to authorized destination
      const from = location.state?.from?.pathname;
      if (from && from !== '/' && !from.startsWith('/login') && !from.startsWith('/signup') && !from.startsWith('/register')) {
        navigate(from === '/dashboard' ? '/attendee' : from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else if (user.role === 'organizer') {
        navigate('/organizer/dashboard', { replace: true });
      } else {
        navigate('/attendee', { replace: true });
      }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User voluntarily closed the popup, do not show error banner
        return;
      }
      setServerError(
        err.message || 'Google authentication could not be completed. Please try again or use email sign-in.'
      );
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  // Forgot password submission
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccessMessage('');

    if (!forgotEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail)) {
      setForgotError('Please enter a valid email address.');
      return;
    }

    setForgotSubmitting(true);
    try {
      const res = await forgotPasswordApi(forgotEmail);
      setForgotSuccessMessage(
        res.message || 'If an account exists with that email address, a password reset link has been dispatched.'
      );
    } catch (err) {
      setForgotError(err.message || 'Unable to request password reset. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen lg:h-[100dvh] lg:overflow-hidden bg-[var(--color-primary-bg)] text-[var(--color-main-text)] relative flex flex-col lg:flex-row transition-colors">
      {/* 
        ========================================================================
        PROMOTIONAL PANEL
        - Desktop: 50% width, full height, slides between Left (login) and Right (signup)
        - Height-safe: Fits 1366x768, 1440x900, 1920x1080 without scrollbar
        - Mobile: Compact card placed below the form (order-2)
        ========================================================================
      */}
      <aside
        className={`w-full lg:w-1/2 bg-[var(--color-dark-panel)] text-[var(--color-primary-text)] border-[var(--color-borders)]/20 flex flex-col justify-between p-6 sm:p-8 lg:px-8 xl:px-12 lg:py-6 xl:py-8 z-20 
          lg:absolute lg:top-0 lg:bottom-0 lg:h-full lg:overflow-hidden
          transition-transform duration-700 ease-in-out motion-reduce:transition-none
          order-2 lg:order-none
          ${mode === 'signup' ? 'lg:translate-x-full lg:border-l' : 'lg:translate-x-0 lg:border-r'}`}
        aria-label="UTSAV Platform Highlights"
      >
        {/* Top bar with brand logo & link to explore */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 group text-inherit focus-visible:outline-none"
            aria-label={`${BRAND.name} Homepage`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-primary-action)] via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/20 group-hover:scale-105 transition-all">
              <svg
                className="w-4.5 h-4.5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M4 3h16a1 1 0 0 1 1 1v16l-5-2.8L12 19l-4-1.8L4 20V4a1 1 0 0 1 1-1z"
                  fill="currentColor"
                  fillOpacity="0.22"
                />
                <path
                  d="M12 6.5l1.1 2.3 2.5.4-1.8 1.8.4 2.5L12 12.3l-2.2 1.2.4-2.5-1.8-1.8 2.5-.4L12 6.5z"
                  fill="#fbbf24"
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                />
              </svg>
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-extrabold text-xl xl:text-2xl tracking-tight font-serif leading-tight">
                {BRAND.name}
              </span>
              <span className="text-[9px] tracking-wide text-white/75 font-medium leading-tight">
                {BRAND.tagline}
              </span>
            </div>
          </Link>

          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-inherit opacity-80 hover:opacity-100 transition-opacity bg-white/5 px-2.5 py-1 rounded-lg border border-white/10"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Explore Events</span>
          </Link>
        </div>

        {/* Center content: dynamic depending on login vs signup */}
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="space-y-4 xl:space-y-6 my-auto py-2"
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-golden-accent)]/20 border border-[var(--color-golden-accent)]/30 text-xs font-bold text-[var(--color-golden-accent)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {mode === 'login' ? 'Welcome Back' : 'Join the Live Event Community'}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl xl:text-3xl font-extrabold font-serif leading-tight">
              {mode === 'login' ? (
                <>
                  Your gateway to verified <span className="text-[var(--color-golden-accent)]">campus fests</span> & live experiences.
                </>
              ) : (
                <>
                  Experience or host <span className="text-[var(--color-golden-accent)]">unforgettable</span> events across India.
                </>
              )}
            </h2>

            <p className="text-xs xl:text-sm opacity-80 leading-relaxed max-w-sm">
              {mode === 'login'
                ? 'Access your digital QR tickets, view real-time stage line-ups, and enjoy contactless gate check-in at premier colleges and venues.'
                : 'Whether you are discovering flagship tech hackathons or an organizer orchestrating a campus fest, UTSAV handles ticketing effortlessly.'}
            </p>

            {/* Visual Event Highlight Snippets */}
            <div className="space-y-2.5 pt-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 backdrop-blur-xs">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-action)]/20 flex items-center justify-center text-[var(--color-primary-action)] shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">
                      Instant Dynamic QR Passes
                    </span>
                    <span className="text-[9px] text-[var(--color-golden-accent)] font-bold uppercase tracking-wider">
                      Instant Entry
                    </span>
                  </div>
                  <p className="text-[10px] xl:text-[11px] opacity-75 truncate mt-0.5">
                    Direct admission via contactless scanner at campus & venue gates
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 backdrop-blur-xs">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-golden-accent)]/20 flex items-center justify-center text-[var(--color-golden-accent)] shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs truncate">
                      Curated College & Indie Hosts
                    </span>
                    <span className="text-[9px] text-[#10b981] font-bold uppercase tracking-wider">
                      Admin Reviewed
                    </span>
                  </div>
                  <p className="text-[10px] xl:text-[11px] opacity-75 truncate mt-0.5">
                    Verified university committees, artists, and hackathon collectives
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Real Platform Assurances (Zero Mock Metrics) */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] xl:text-xs opacity-80">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#10b981]" />
            <span>Verified Organizers</span>
          </div>
          <span>•</span>
          <span>Dynamic QR Entry</span>
          <span>•</span>
          <span>Dedicated Dashboards</span>
        </div>
      </aside>

      {/* 
        ========================================================================
        FORM PANEL
        - Desktop: 50% width, centered vertically, fits 1366x768 without page scroll
        - Mobile: Clean full-width form shown first (order-1)
        ========================================================================
      */}
      <main
        className={`w-full lg:w-1/2 bg-[var(--color-primary-bg)] text-[var(--color-main-text)] flex flex-col justify-center items-center p-6 sm:p-8 lg:px-8 xl:px-14 lg:py-4 xl:py-6 z-10
          lg:absolute lg:top-0 lg:bottom-0 lg:h-full lg:overflow-y-auto
          transition-transform duration-700 ease-in-out motion-reduce:transition-none
          order-1 lg:order-none
          ${mode === 'signup' ? 'lg:translate-x-0' : 'lg:translate-x-full'}`}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="max-w-sm w-full mx-auto my-auto space-y-3 xl:space-y-4"
          >
          {/* Mobile Back Link */}
          <div className="flex items-center justify-between lg:hidden pb-1">
            <Link
              to="/events"
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Events</span>
            </Link>

            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-primary-action)]">
              {mode === 'login' ? 'Sign In' : 'Sign Up'}
            </span>
          </div>

          {/* Form Header */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--color-main-text)] font-serif leading-tight">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              {mode === 'login'
                ? 'Sign in to access your event passes or organizer tools.'
                : 'Join UTSAV to reserve event passes or host verified campus gatherings.'}
            </p>
          </div>

          {/* Server Error Feedback */}
          {serverError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="font-semibold leading-relaxed">{serverError}</p>
            </div>
          )}

          {/* Google Login / Signup Button */}
          <div>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleSubmitting || isSubmitting}
              className="w-full py-2.5 px-4 bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] disabled:opacity-60 disabled:cursor-not-allowed border border-[var(--color-borders)] rounded-xl text-xs xl:text-sm font-semibold text-[var(--color-main-text)] transition-all shadow-2xs flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
            >
              {isGoogleSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary-action)]" />
                  <span>Connecting to Google...</span>
                </>
              ) : (
                <>
                  <GoogleIcon className="w-4 h-4 shrink-0" />
                  <span>
                    {mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[var(--color-borders)] w-full" />
            <span className="bg-[var(--color-primary-bg)] px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)] shrink-0">
              or continue with email
            </span>
          </div>

          {/* Registration Role Selection: Attendee vs Organizer */}
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]">
                I Want To Join As:
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl">
                <button
                  type="button"
                  onClick={() => setRole('attendee')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'attendee'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                  aria-pressed={role === 'attendee'}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Attendee</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('organizer')}
                  className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    role === 'organizer'
                      ? 'bg-[var(--color-primary-action)] text-[var(--color-primary-text)] shadow-xs'
                      : 'text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)]'
                  }`}
                  aria-pressed={role === 'organizer'}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-golden-accent)]" />
                  <span>Organizer</span>
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
            {/* Full Name / Organization Name (Signup Only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label
                  htmlFor="signup-name"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
                >
                  {role === 'organizer' ? 'Organization Name' : 'Full Name'}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                    {role === 'organizer' ? (
                      <Building className="w-3.5 h-3.5" />
                    ) : (
                      <User className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
                    }}
                    placeholder={
                      role === 'organizer'
                        ? 'e.g. IIT Cultural Council'
                        : 'e.g. Aarav Patel'
                    }
                    className={`w-full pl-9 pr-3 py-2 bg-[var(--color-input-bg)] border rounded-xl text-xs xl:text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] transition-all focus:bg-[var(--color-primary-bg)] focus:outline-none ${
                      errors.name
                        ? 'border-[#ef4444] focus:border-[#ef4444]'
                        : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                    }`}
                    aria-invalid={!!errors.name}
                  />
                </div>
                {errors.name && (
                  <p className="text-[10px] text-[#ef4444] mt-0.5 font-medium">{errors.name}</p>
                )}
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1">
              <label
                htmlFor="auth-email"
                className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  placeholder="name@example.com"
                  className={`w-full pl-9 pr-3 py-2 bg-[var(--color-input-bg)] border rounded-xl text-xs xl:text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] transition-all focus:bg-[var(--color-primary-bg)] focus:outline-none ${
                    errors.email
                      ? 'border-[#ef4444] focus:border-[#ef4444]'
                      : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                  }`}
                  aria-invalid={!!errors.email}
                />
              </div>
              {errors.email && (
                <p className="text-[10px] text-[#ef4444] mt-0.5 font-medium">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
                >
                  Password
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotError('');
                      setForgotSuccessMessage('');
                    }}
                    className="text-[11px] font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter your password'}
                  className={`w-full pl-9 pr-10 py-2 bg-[var(--color-input-bg)] border rounded-xl text-xs xl:text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] transition-all focus:bg-[var(--color-primary-bg)] focus:outline-none ${
                    errors.password
                      ? 'border-[#ef4444] focus:border-[#ef4444]'
                      : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                  }`}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] text-[#ef4444] mt-0.5 font-medium">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Field (Signup Only) */}
            {mode === 'signup' && (
              <div className="space-y-1">
                <label
                  htmlFor="auth-confirm-password"
                  className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirmPassword)
                        setErrors((prev) => ({ ...prev, confirmPassword: null }));
                    }}
                    placeholder="Repeat your password"
                    className={`w-full pl-9 pr-10 py-2 bg-[var(--color-input-bg)] border rounded-xl text-xs xl:text-sm text-[var(--color-main-text)] placeholder-[var(--color-secondary-text)] transition-all focus:bg-[var(--color-primary-bg)] focus:outline-none ${
                      errors.confirmPassword
                        ? 'border-[#ef4444] focus:border-[#ef4444]'
                        : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                    }`}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-[10px] text-[#ef4444] mt-0.5 font-medium">
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
            )}

            {/* Remember Me option (Login Only) */}
            {mode === 'login' && (
              <div className="flex items-center pt-0.5">
                <input
                  id="login-remember"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[var(--color-primary-action)] rounded border-[var(--color-borders)] cursor-pointer"
                />
                <label
                  htmlFor="login-remember"
                  className="ml-2 text-xs text-[var(--color-secondary-text)] cursor-pointer select-none"
                >
                  Keep me signed in on this device
                </label>
              </div>
            )}

            {/* Terms of Service Checkbox (Signup Only) */}
            {mode === 'signup' && (
              <div className="pt-0.5">
                <div className="flex items-start">
                  <input
                    id="signup-terms"
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={(e) => {
                      setAgreedTerms(e.target.checked);
                      if (errors.terms) setErrors((prev) => ({ ...prev, terms: null }));
                    }}
                    className="w-3.5 h-3.5 mt-0.5 accent-[var(--color-primary-action)] rounded border-[var(--color-borders)] cursor-pointer"
                  />
                  <label
                    htmlFor="signup-terms"
                    className="ml-2 text-[11px] text-[var(--color-secondary-text)] leading-tight cursor-pointer select-none"
                  >
                    I agree to the Terms of Service & Privacy Policy.
                  </label>
                </div>
                {errors.terms && (
                  <p className="text-[10px] text-[#ef4444] mt-0.5 font-medium">{errors.terms}</p>
                )}
              </div>
            )}

            {/* Submit Action Button */}
            <div className="pt-1.5">
              <motion.button
                type="submit"
                whileHover={buttonHoverTap.hover}
                whileTap={buttonHoverTap.tap}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-[var(--color-primary-text)] font-bold text-xs xl:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 active:translate-y-0.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{mode === 'login' ? 'Signing In...' : 'Creating Account...'}</span>
                  </>
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>
                      Create {role === 'organizer' ? 'Organizer' : 'Attendee'} Account
                    </span>
                  </>
                )}
              </motion.button>
            </div>
          </form>

          {/* Mode Switching Prompt */}
          <div className="pt-2 border-t border-[var(--color-borders)] text-center text-xs text-[var(--color-secondary-text)]">
            {mode === 'login' ? (
              <p>
                Don't have an account yet?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('signup')}
                  className="font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer ml-1"
                >
                  Create Account
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="font-bold text-[var(--color-primary-action)] hover:underline cursor-pointer ml-1"
                >
                  Sign In Instead
                </button>
              </p>
            )}
          </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-dark-panel)]/75 backdrop-blur-xs animate-fade-in text-[var(--color-main-text)]">
          <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-3">
              <h3 className="font-extrabold text-xl font-serif">
                Reset Your Password
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowForgotModal(false);
                  setForgotSuccessMessage('');
                  setForgotError('');
                  setForgotEmail('');
                }}
                className="w-8 h-8 rounded-full bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] flex items-center justify-center text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
              Enter your registered email address. We will provide secure password reset instructions to regain access to your account.
            </p>

            {forgotError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{forgotError}</p>
              </div>
            )}

            {forgotSuccessMessage ? (
              <div className="p-4 bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 rounded-xl space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-[var(--color-primary-action)]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Request Processed</span>
                </div>
                <p className="text-[var(--color-secondary-text)] leading-relaxed">
                  {forgotSuccessMessage}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotSuccessMessage('');
                    setForgotError('');
                    setForgotEmail('');
                  }}
                  className="mt-2 w-full py-2.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[var(--color-main-text)] mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl text-sm focus:border-[var(--color-primary-action)] focus:bg-[var(--color-primary-bg)] focus:outline-none"
                  />
                </div>
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] rounded-xl text-xs font-bold text-[var(--color-secondary-text)] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="flex-1 py-2.5 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-60 text-[var(--color-primary-text)] rounded-xl text-xs font-bold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {forgotSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <span>Send Reset Link</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
