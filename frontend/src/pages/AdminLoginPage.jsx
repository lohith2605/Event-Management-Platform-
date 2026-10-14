import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../config/brand';
import { buttonHoverTap } from '../config/animations';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLogin } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const errs = {};
    if (!email.trim()) {
      errs.email = 'Admin email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Please enter a valid administrator email.';
    }

    if (!password) {
      errs.password = 'Password is required.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const user = await adminLogin(email, password);
      if (user && user.role === 'admin') {
        const from = location.state?.from?.pathname || '/admin';
        navigate(from, { replace: true });
      } else {
        setServerError('Access denied: You do not have administrator permissions.');
      }
    } catch (err) {
      setServerError(
        err.message || 'Invalid administrative credentials or unprivileged account.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] flex flex-col justify-center items-center p-4 sm:p-6 transition-colors">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-md w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6"
      >
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-4">
          <Link
            to="/"
            className="flex items-center gap-2 group text-[var(--color-main-text)] focus-visible:outline-none"
            aria-label={`${BRAND.name} Homepage`}
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] flex items-center justify-center font-bold font-serif text-lg shadow-xs">
              {BRAND.name.charAt(0)}
            </div>
            <span className="font-extrabold text-xl font-serif">{BRAND.name}</span>
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Main Site</span>
          </Link>
        </div>

        {/* Portal Identifier */}
        <div className="space-y-2 text-center pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-golden-accent)]/20 border border-[var(--color-golden-accent)]/30 text-xs font-bold text-[var(--color-golden-accent)]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Restricted Governance Portal</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold font-serif text-[var(--color-main-text)]">
            Administrator Sign In
          </h1>
          <p className="text-xs text-[var(--color-secondary-text)] max-w-xs mx-auto">
            Authorized UTSAV system administrators only. Public registration is not permitted for governance accounts.
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{serverError}</p>
          </div>
        )}

        {/* Admin Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div className="space-y-1">
            <label
              htmlFor="admin-email"
              className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
            >
              Admin Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <input
                id="admin-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                }}
                placeholder="admin@example.com"
                className={`w-full pl-9 pr-3 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-none ${
                  errors.email
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                }`}
                aria-invalid={!!errors.email}
              />
            </div>
            {errors.email && (
              <p className="text-[10px] text-red-500 font-medium">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label
              htmlFor="admin-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
                placeholder="Enter admin credentials"
                className={`w-full pl-9 pr-10 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-none ${
                  errors.password
                    ? 'border-red-500 focus:border-red-500'
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
              <p className="text-[10px] text-red-500 font-medium">{errors.password}</p>
            )}
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            whileHover={buttonHoverTap.hover}
            whileTap={buttonHoverTap.tap}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-60 text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Administrator Privileges...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Enter Admin Portal</span>
              </>
            )}
          </motion.button>
        </form>

        {/* Security Notice Footer */}
        <div className="pt-2 border-t border-[var(--color-borders)] text-center text-[11px] text-[var(--color-secondary-text)]">
          <p>
            Need attendee or organizer access instead?{' '}
            <Link
              to="/login"
              className="font-bold text-[var(--color-primary-action)] hover:underline"
            >
              Public Sign In
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
