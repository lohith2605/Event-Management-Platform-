import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { forgotPasswordApi } from '../api/auth';
import { BRAND } from '../config/brand';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setStatusMessage('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await forgotPasswordApi(trimmedEmail);
      setStatusMessage(
        response.message || 'If an account exists with that email address, a password reset link has been dispatched.'
      );
      setIsSuccess(true);
      setEmail('');
    } catch (err) {
      setErrorMessage(
        err.message || 'Unable to process your request at this time. Please try again later.'
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
            aria-label={`${BRAND.name} Homepage`}
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
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-soft)] text-[var(--color-primary-action)] flex items-center justify-center mb-3">
            <KeyRound className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-extrabold font-serif text-[var(--color-main-text)]">
            Forgot Your Password?
          </h1>
          <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
            Enter your registered email address and we will dispatch a secure link to reset your password.
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="font-semibold leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Success Alert */}
        {isSuccess ? (
          <div className="space-y-4 animate-fade-in">
            <div className="p-4 bg-[var(--color-accent-soft)] border border-[var(--color-primary-action)]/30 rounded-xl space-y-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-[var(--color-primary-action)]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Instructions Sent</span>
              </div>
              <p className="text-[var(--color-secondary-text)] leading-relaxed">
                {statusMessage}
              </p>
              <p className="text-[11px] text-[var(--color-secondary-text)] opacity-80 pt-1 border-t border-[var(--color-borders)]/40">
                Please check your inbox (and spam or promotions folder). The reset link will remain valid for 30 minutes.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSuccess(false)}
                className="w-full py-2.5 px-4 bg-[var(--color-secondary-bg)] hover:bg-[var(--color-borders)] border border-[var(--color-borders)] text-[var(--color-main-text)] text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Send Another Link
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer text-center"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label
                htmlFor="reset-email"
                className="block text-[11px] font-bold uppercase tracking-wider text-[var(--color-main-text)]"
              >
                Registered Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[var(--color-secondary-text)]">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-[var(--color-input-bg)] border border-[var(--color-borders)] focus:border-[var(--color-primary-action)] rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-60 text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-secondary-text)] hover:text-[var(--color-primary-action)] transition-colors"
              >
                <span>Remembered your password?</span>
                <strong className="underline underline-offset-2">Sign in</strong>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
