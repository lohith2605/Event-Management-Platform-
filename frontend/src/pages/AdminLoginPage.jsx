import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Smartphone,
  KeyRound,
  Copy,
  Check,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../config/brand';
import { buttonHoverTap } from '../config/animations';
import { setupAuthenticatorApi, verifyAuthenticatorSetupApi } from '../api/auth';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminLogin, verify2FA, cancel2FA } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 2FA Challenge States
  const [challenge2FA, setChallenge2FA] = useState(null); // { tempToken, email, requireSetup }
  const [otpCode, setOtpCode] = useState('');
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Unenrolled Admin Setup States
  const [enrollmentData, setEnrollmentData] = useState(null); // { qrCode, manualEntryKey }
  const [enrollmentLoading, setEnrollmentLoading] = useState(false);
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCodesDisplay, setRecoveryCodesDisplay] = useState(null); // array of plain recovery codes
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

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

  const fetchAdminSetup = async (tempToken) => {
    setEnrollmentLoading(true);
    setOtpError('');
    try {
      const data = await setupAuthenticatorApi({ tempToken });
      setEnrollmentData(data);
    } catch (err) {
      setOtpError(err.message || 'Failed to initialize authenticator setup. Please try again.');
    } finally {
      setEnrollmentLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setServerError('');

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const result = await adminLogin(email, password);
      if (result && result.require2FA) {
        const requireSetup = Boolean(result.requireSetup);
        setChallenge2FA({
          tempToken: result.tempToken,
          email: result.email,
          requireSetup,
        });
        setOtpCode('');
        setSetupCode('');
        setIsRecoveryMode(false);
        setRecoveryCode('');
        setOtpError('');
        setRecoveryCodesDisplay(null);

        if (requireSetup) {
          fetchAdminSetup(result.tempToken);
        }
        return;
      }

      if (result && result.role === 'admin') {
        const from =
          location.state?.from?.pathname && location.state.from.pathname !== '/'
            ? location.state.from.pathname
            : '/admin';
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

  // Verification for already-enrolled admin
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otpSubmitting || !challenge2FA) return;
    setOtpError('');

    if (isRecoveryMode) {
      const cleanRecovery = recoveryCode.trim();
      if (!cleanRecovery) {
        setOtpError('Please enter an emergency recovery code.');
        return;
      }

      setOtpSubmitting(true);
      try {
        const verifiedUser = await verify2FA(cleanRecovery, challenge2FA.tempToken, true);
        if (verifiedUser && verifiedUser.role === 'admin') {
          setChallenge2FA(null);
          const from =
            location.state?.from?.pathname && location.state.from.pathname !== '/'
              ? location.state.from.pathname
              : '/admin';
          navigate(from, { replace: true });
        } else {
          setOtpError('Access denied: Account does not possess administrator permissions.');
        }
      } catch (err) {
        setOtpError(err.message || 'Invalid or already consumed recovery code.');
      } finally {
        setOtpSubmitting(false);
      }
      return;
    }

    const clean = otpCode.trim();
    if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setOtpError('Please enter a valid 6-digit numeric authenticator code.');
      return;
    }

    setOtpSubmitting(true);
    try {
      const verifiedUser = await verify2FA(clean, challenge2FA.tempToken, false);
      if (verifiedUser && verifiedUser.role === 'admin') {
        setChallenge2FA(null);
        const from =
          location.state?.from?.pathname && location.state.from.pathname !== '/'
            ? location.state.from.pathname
            : '/admin';
        navigate(from, { replace: true });
      } else {
        setOtpError('Access denied: Account does not possess administrator permissions.');
      }
    } catch (err) {
      setOtpError(err.message || 'Verification failed. Please check the code in your authenticator app.');
    } finally {
      setOtpSubmitting(false);
    }
  };

  // Verification for unenrolled admin setting up for the first time
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (otpSubmitting || !challenge2FA) return;
    setOtpError('');

    const clean = setupCode.trim();
    if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setOtpError('Please enter the 6-digit code from your authenticator app.');
      return;
    }

    setOtpSubmitting(true);
    try {
      const data = await verifyAuthenticatorSetupApi({
        code: clean,
        tempToken: challenge2FA.tempToken,
      });

      if (data.recoveryCodes && data.recoveryCodes.length > 0) {
        setRecoveryCodesDisplay(data.recoveryCodes);
      } else {
        setChallenge2FA(null);
        const from =
          location.state?.from?.pathname && location.state.from.pathname !== '/'
            ? location.state.from.pathname
            : '/admin';
        navigate(from, { replace: true });
      }
    } catch (err) {
      setOtpError(
        err.message ||
          'Verification failed. Ensure your device clock is synchronized and try again.'
      );
    } finally {
      setOtpSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    if (!enrollmentData?.manualEntryKey) return;
    navigator.clipboard.writeText(enrollmentData.manualEntryKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCopyRecoveryCodes = () => {
    if (!recoveryCodesDisplay) return;
    navigator.clipboard.writeText(recoveryCodesDisplay.join('\n'));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  };

  const handleCompleteSetupAndEnter = () => {
    setChallenge2FA(null);
    setRecoveryCodesDisplay(null);
    const from =
      location.state?.from?.pathname && location.state.from.pathname !== '/'
        ? location.state.from.pathname
        : '/admin';
    navigate(from, { replace: true });
  };

  const handleCancel2FA = () => {
    setChallenge2FA(null);
    setOtpCode('');
    setSetupCode('');
    setIsRecoveryMode(false);
    setRecoveryCode('');
    setOtpError('');
    setEnrollmentData(null);
    setRecoveryCodesDisplay(null);
    cancel2FA();
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

        {/* Display Recovery Codes Screen upon Initial Setup Completion */}
        {recoveryCodesDisplay ? (
          <div className="space-y-4 animate-fade-in text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/30 mx-auto flex items-center justify-center shadow-xs">
              <KeyRound className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-extrabold font-serif text-[var(--color-main-text)]">
                Save Emergency Recovery Codes
              </h2>
              <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
                These 8 single-use codes are your safeguard if you lose access to your authenticator app. Store them safely.
              </p>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-left text-[11px] text-amber-700 dark:text-amber-400 font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>These codes will <strong>NEVER</strong> be displayed again. Each can only be used once.</span>
            </div>

            <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] rounded-xl font-mono text-xs font-bold text-[var(--color-main-text)]">
              {recoveryCodesDisplay.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-[var(--color-card-bg)] rounded-lg border border-[var(--color-borders)] text-center tracking-wider">
                  {code}
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleCopyRecoveryCodes}
                className="w-full py-2 px-3 rounded-xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] text-xs font-bold text-[var(--color-main-text)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copiedCodes ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Copied All Codes</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy All Recovery Codes</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCompleteSetupAndEnter}
                className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>I Have Saved These Codes — Enter Portal</span>
              </button>
            </div>
          </div>
        ) : challenge2FA ? (
          <div className="space-y-4 animate-fade-in">
            {/* Header & Badges */}
            <div className="space-y-2 text-center pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-golden-accent)]/20 border border-[var(--color-golden-accent)]/30 text-xs font-bold text-[var(--color-golden-accent)]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Restricted Governance 2FA</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold font-serif text-[var(--color-main-text)]">
                {challenge2FA.requireSetup
                  ? 'Mandatory 2FA Enrollment'
                  : isRecoveryMode
                    ? 'Emergency Recovery'
                    : 'Authenticator Verification'}
              </h1>
              <p className="text-xs text-[var(--color-secondary-text)] max-w-xs mx-auto">
                {challenge2FA.requireSetup
                  ? 'Administrator policy mandates Google Authenticator TOTP. Scan the QR code with your app to enroll.'
                  : isRecoveryMode
                    ? 'Enter one of your 12-character emergency recovery codes.'
                    : 'Open your Google Authenticator or compatible app and enter the 6-digit code.'}
              </p>
            </div>

            {/* Error Feedback */}
            {otpError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-600 dark:text-red-400 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-semibold leading-relaxed">{otpError}</p>
              </div>
            )}

            {/* CASE A: Unenrolled Admin Setup Flow */}
            {challenge2FA.requireSetup ? (
              <div className="space-y-4">
                {enrollmentLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-secondary-text)]">
                    <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-action)]" />
                    <span>Generating enrollment QR code...</span>
                  </div>
                ) : enrollmentData ? (
                  <>
                    {/* QR Code Container */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-[var(--color-borders)] shadow-xs mx-auto max-w-[210px]">
                      {enrollmentData.qrCode ? (
                        <img
                          src={enrollmentData.qrCode}
                          alt="Google Authenticator QR Code"
                          className="w-44 h-44 object-contain"
                        />
                      ) : (
                        <QrCode className="w-36 h-36 text-gray-800" />
                      )}
                    </div>

                    {/* Manual Secret Key */}
                    <div className="p-3 bg-[var(--color-secondary-bg)] rounded-xl border border-[var(--color-borders)] space-y-1.5 text-center">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--color-secondary-text)]">
                        Manual Entry Key
                      </span>
                      <div className="flex items-center justify-center gap-2">
                        <code className="font-mono text-xs font-bold text-[var(--color-main-text)] select-all tracking-wider break-all">
                          {enrollmentData.manualEntryKey}
                        </code>
                        <button
                          type="button"
                          onClick={handleCopySecret}
                          className="p-1 rounded-md text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer shrink-0"
                          title="Copy Key"
                        >
                          {copiedKey ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Setup Code Form */}
                    <form onSubmit={handleVerifySetup} className="space-y-3" noValidate>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="setup-code-input"
                          className="block text-xs font-bold uppercase tracking-wider text-[var(--color-main-text)] text-center"
                        >
                          First 6-Digit App Code
                        </label>
                        <input
                          id="setup-code-input"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={6}
                          autoFocus
                          value={setupCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setSetupCode(val);
                            if (otpError) setOtpError('');
                          }}
                          placeholder="••••••"
                          className="w-full text-center tracking-[10px] text-2xl font-mono font-extrabold py-2.5 px-4 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] focus:border-[var(--color-primary-action)] focus:outline-hidden transition-all shadow-2xs"
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={otpSubmitting || setupCode.length !== 6}
                        className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {otpSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Activating Authenticator...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Verify & Complete Enrollment</span>
                          </>
                        )}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <button
                      type="button"
                      onClick={() => fetchAdminSetup(challenge2FA.tempToken)}
                      className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] text-white text-xs font-bold cursor-pointer"
                    >
                      Retry Generating QR Code
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--color-borders)] text-center">
                  <button
                    type="button"
                    onClick={handleCancel2FA}
                    className="text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel and return to sign in</span>
                  </button>
                </div>
              </div>
            ) : (
              /* CASE B: Enrolled Admin TOTP / Recovery Verification */
              <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                {isRecoveryMode ? (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-recovery-input"
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--color-main-text)] text-center"
                    >
                      Emergency Recovery Code
                    </label>
                    <input
                      id="admin-recovery-input"
                      type="text"
                      autoFocus
                      autoComplete="off"
                      value={recoveryCode}
                      onChange={(e) => {
                        setRecoveryCode(e.target.value.toUpperCase());
                        if (otpError) setOtpError('');
                      }}
                      placeholder="ABCD-EFGH-IJKL"
                      className="w-full text-center tracking-[4px] text-lg font-mono font-extrabold py-3 px-4 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] focus:border-[var(--color-primary-action)] focus:outline-hidden transition-all shadow-2xs"
                      required
                    />
                    <div className="text-center text-[11px] text-[var(--color-secondary-text)]">
                      <span>Each recovery code can only be used once.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-otp-input"
                      className="block text-xs font-bold uppercase tracking-wider text-[var(--color-main-text)] text-center"
                    >
                      6-Digit Authenticator Code
                    </label>
                    <input
                      id="admin-otp-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      autoComplete="one-time-code"
                      value={otpCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setOtpCode(val);
                        if (otpError) setOtpError('');
                      }}
                      placeholder="••••••"
                      className="w-full text-center tracking-[10px] text-2xl font-mono font-extrabold py-3 px-4 bg-[var(--color-input-bg)] border border-[var(--color-borders)] rounded-xl text-[var(--color-main-text)] focus:border-[var(--color-primary-action)] focus:outline-hidden transition-all shadow-2xs"
                      required
                    />
                    <div className="flex justify-between items-center text-[11px] text-[var(--color-secondary-text)] px-1">
                      <span>Changes every 30s</span>
                      <span className="font-semibold">{otpCode.length}/6 digits</span>
                    </div>
                  </div>
                )}

                <motion.button
                  type="submit"
                  whileHover={buttonHoverTap.hover}
                  whileTap={buttonHoverTap.tap}
                  disabled={otpSubmitting || (isRecoveryMode ? !recoveryCode.trim() : otpCode.length !== 6)}
                  className="w-full py-2.5 px-4 bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--color-primary-text)] font-bold text-xs sm:text-sm rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                  {otpSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Token...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isRecoveryMode ? 'Verify Recovery Code' : 'Authenticate & Enter Portal'}</span>
                    </>
                  )}
                </motion.button>

                {/* Recovery Toggle and Cancel Controls */}
                <div className="pt-2 border-t border-[var(--color-borders)] flex flex-col gap-2.5 text-center">
                  <div>
                    {isRecoveryMode ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecoveryMode(false);
                          setOtpError('');
                        }}
                        className="text-xs font-semibold text-[var(--color-primary-action)] hover:underline cursor-pointer"
                      >
                        Use 6-digit authenticator code instead
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecoveryMode(true);
                          setOtpError('');
                        }}
                        className="text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors cursor-pointer"
                      >
                        Lost phone? Use an emergency recovery code
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCancel2FA}
                    className="text-xs text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer py-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Cancel and re-enter admin credentials</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <>
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

            {/* Session Expired Banner */}
            {new URLSearchParams(location.search).get('sessionExpired') === '1' && !serverError && (
              <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-xs text-amber-600 dark:text-amber-400 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-semibold leading-relaxed">
                  Your security session expired due to inactivity. Please sign in again to access the Admin Portal.
                </p>
              </div>
            )}

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
                    className={`w-full pl-9 pr-3 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-hidden ${
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
                    className={`w-full pl-9 pr-10 py-2.5 bg-[var(--color-input-bg)] border rounded-xl text-xs sm:text-sm text-[var(--color-main-text)] transition-all focus:outline-hidden ${
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
          </>
        )}

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
