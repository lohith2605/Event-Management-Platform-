import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { resetPasswordApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../config/brand';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    const errs = {};
    if (!password) {
      errs.password = 'New password is required.';
    } else if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.';
    }

    if (!confirmPassword) {
      errs.confirmPassword = 'Please confirm your new password.';
    } else if (password !== confirmPassword) {
      errs.confirmPassword = 'Passwords do not match.';
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
      await resetPasswordApi(token, password, confirmPassword);
      setIsSuccess(true);
      // Refresh session
      await checkAuth();
      // Redirect after 2.5 seconds
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2500);
    } catch (err) {
      setServerError(
        err.message || 'The password reset token is invalid or has expired. Please request a new one.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-primary-bg)] text-[var(--color-main-text)] flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="max-w-md w-full bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-4">
          <Link
            to="/"
            className="flex items-center gap-2 group text-[var(--color-main-text)] focus-visible:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-[var(--color-primary-action)] text-[var(--color-primary-text)] flex items-center justify-center font-bold font-serif text-lg shadow-xs">
              {BRAND.name.charAt(0)}
            </div>
            <span className="font-extrabold text-xl font-serif">{BRAND.name}</span>
          </Link>

          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </Link>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
            Create New Password
          </h1>
          <p className="text-xs text-[var(--color-secondary-text)]">
            Please choose a strong, unique password with at least 6 characters.
          </p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{serverError}</p>
              <Link
                to="/login"
                className="inline-block mt-2 font-bold underline hover:opacity-80"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span>Password Reset Successfully!</span>
            </div>
            <p className="leading-relaxed">
              Your new password is now active. You are being redirected to sign in...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* New Password */}
            <div className="space-y-1">
              <label
                htmlFor="new-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
              >
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                  }}
                  placeholder="Min 6 characters"
                  className={`w-full pl-9 pr-10 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-none ${
                    errors.password
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                  }`}
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

            {/* Confirm Password */}
            <div className="space-y-1">
              <label
                htmlFor="confirm-password"
                className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                  <Lock className="w-3.5 h-3.5" />
                </div>
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirmPassword)
                      setErrors((prev) => ({ ...prev, confirmPassword: null }));
                  }}
                  placeholder="Repeat new password"
                  className={`w-full pl-9 pr-10 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-none ${
                    errors.confirmPassword
                      ? 'border-red-500 focus:border-red-500'
                      : 'border-[var(--color-borders)] focus:border-[var(--color-primary-action)]'
                  }`}
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
                <p className="text-[10px] text-red-500 font-medium">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-60 text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Set New Password</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
