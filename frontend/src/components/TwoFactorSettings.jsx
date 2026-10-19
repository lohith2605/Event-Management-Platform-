import { useState } from 'react';
import {
  Shield,
  Smartphone,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  QrCode,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  setupAuthenticatorApi,
  verifyAuthenticatorSetupApi,
  disableAuthenticatorApi,
  regenerateRecoveryCodesApi,
  toggle2FAApi,
} from '../api/auth';

/**
 * TwoFactorSettings
 * Unified security management component for Attendees and Organizers.
 * Supports Google Authenticator (TOTP) enrollment, recovery codes,
 * method switching to Email OTP, and disabling.
 */
export default function TwoFactorSettings({
  user,
  onUserUpdated,
  isAdmin = false,
}) {
  const isEnabled = Boolean(user?.twoFactorEnabled);
  const method = user?.twoFactorMethod || 'email';
  const hasPassword = Boolean(user?.hasPassword ?? true);

  // Modals & Panels
  const [activeModal, setActiveModal] = useState(null); // 'setupTotp' | 'regenCodes' | 'toggleEmail' | 'disable' | null
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [confirmPassword, setConfirmPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Setup TOTP State
  const [enrollmentData, setEnrollmentData] = useState(null); // { qrCode, manualEntryKey }
  const [recoveryCodesDisplay, setRecoveryCodesDisplay] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

  const resetModalState = () => {
    setActiveModal(null);
    setLoading(false);
    setErrorMsg('');
    setConfirmPassword('');
    setTotpCode('');
    setEnrollmentData(null);
    setRecoveryCodesDisplay(null);
    setCopiedKey(false);
    setCopiedCodes(false);
  };

  // Open Authenticator Setup
  const handleOpenSetup = async () => {
    resetModalState();
    setActiveModal('setupTotp');
    setLoading(true);
    try {
      const data = await setupAuthenticatorApi();
      setEnrollmentData(data);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to initialize authenticator setup.');
    } finally {
      setLoading(false);
    }
  };

  // Verify and complete Authenticator Setup
  const handleVerifySetup = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    const clean = totpCode.trim();
    if (!clean || clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setErrorMsg('Please enter the 6-digit code shown in your authenticator app.');
      return;
    }

    if (hasPassword && !confirmPassword) {
      setErrorMsg('Please enter your current password to confirm this security change.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyAuthenticatorSetupApi({
        code: clean,
        currentPassword: confirmPassword,
      });

      if (res.recoveryCodes) {
        setRecoveryCodesDisplay(res.recoveryCodes);
      }

      setSuccessMsg('Google Authenticator 2FA has been successfully activated!');
      if (onUserUpdated) {
        onUserUpdated({
          twoFactorEnabled: true,
          twoFactorMethod: 'authenticator',
          totpEnrolled: true,
        });
      }
    } catch (err) {
      setErrorMsg(err.message || 'Verification failed. Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Switch to Email OTP
  const handleSwitchToEmail = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    if (hasPassword && !confirmPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    setLoading(true);
    try {
      const res = await toggle2FAApi({
        enabled: true,
        method: 'email',
        currentPassword: confirmPassword,
      });

      if (res && res.success) {
        setSuccessMsg('Two-Factor Authentication switched to Email OTP.');
        if (onUserUpdated) {
          onUserUpdated({
            twoFactorEnabled: true,
            twoFactorMethod: 'email',
          });
        }
        resetModalState();
      } else {
        setErrorMsg(res?.message || 'Failed to update security method.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect password or update failed.');
    } finally {
      setLoading(false);
    }
  };

  // Disable 2FA
  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    if (isAdmin) {
      setErrorMsg('Administrator security policy forbids disabling Two-Factor Authentication.');
      return;
    }

    if (hasPassword && !confirmPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    setLoading(true);
    try {
      let res;
      if (method === 'authenticator') {
        res = await disableAuthenticatorApi({ currentPassword: confirmPassword });
      } else {
        res = await toggle2FAApi({ enabled: false, currentPassword: confirmPassword });
      }

      if (res && res.success) {
        setSuccessMsg('Two-Factor Authentication has been disabled.');
        if (onUserUpdated) {
          onUserUpdated({
            twoFactorEnabled: false,
            totpEnrolled: false,
          });
        }
        resetModalState();
      } else {
        setErrorMsg(res?.message || 'Failed to disable 2FA.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect password or update failed.');
    } finally {
      setLoading(false);
    }
  };

  // Regenerate Recovery Codes
  const handleRegenerateCodes = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');

    if (hasPassword && !confirmPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    setLoading(true);
    try {
      const res = await regenerateRecoveryCodesApi({ currentPassword: confirmPassword });
      if (res && res.recoveryCodes) {
        setRecoveryCodesDisplay(res.recoveryCodes);
        setSuccessMsg('New recovery codes generated. Old recovery codes are now invalidated.');
      } else {
        setErrorMsg(res?.message || 'Failed to regenerate recovery codes.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect password or request failed.');
    } finally {
      setLoading(false);
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

  return (
    <div className="bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-3xl p-6 shadow-xs space-y-5 transition-colors">
      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-[var(--color-main-text)]">
              Two-Factor Authentication (2FA)
            </h4>
            <p className="text-[11px] text-[var(--color-secondary-text)]">
              Add an extra layer of verification to protect your account
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isEnabled && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                method === 'authenticator'
                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                  : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
              }`}
            >
              {method === 'authenticator' ? 'Authenticator App' : 'Email OTP'}
            </span>
          )}

          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              isEnabled
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}
          >
            {isEnabled ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {/* Global Success / Notice Alert */}
      {successMsg && !activeModal && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Explanation Text */}
      <p className="text-xs text-[var(--color-secondary-text)] leading-relaxed">
        {isEnabled ? (
          method === 'authenticator' ? (
            <>
              Your account is guarded with <strong>Google Authenticator TOTP</strong>. You will be prompted for a 6-digit code from your authenticator app whenever you sign in. No email delivery is needed.
            </>
          ) : (
            <>
              Your account is guarded with <strong>Email OTP</strong>. A 6-digit verification code is dispatched to your registered email address whenever you sign in.
            </>
          )
        ) : (
          <>
            Two-Factor Authentication is currently turned off. We strongly recommend enabling an authenticator app or email OTP to safeguard your event passes and account details.
          </>
        )}
      </p>

      {/* Action Buttons Toolbar */}
      {!activeModal && (
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {isEnabled ? (
            <>
              {method === 'authenticator' ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetModalState();
                      setActiveModal('regenCodes');
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                    <span>Regenerate Recovery Codes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetModalState();
                      setActiveModal('toggleEmail');
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-blue-500" />
                    <span>Switch to Email OTP</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenSetup}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Upgrade to Google Authenticator</span>
                </button>
              )}

              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    resetModalState();
                    setActiveModal('disable');
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Disable 2FA</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleOpenSetup}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Set Up Google Authenticator</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  resetModalState();
                  setActiveModal('toggleEmail');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--color-borders)] hover:bg-[var(--color-secondary-bg)] text-[var(--color-main-text)] transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-blue-500" />
                <span>Enable Email OTP</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SETUP GOOGLE AUTHENTICATOR */}
      {/* ========================================================================= */}
      {activeModal === 'setupTotp' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-2.5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-purple-600" />
              <h5 className="font-bold text-xs sm:text-sm text-[var(--color-main-text)]">
                {recoveryCodesDisplay ? 'Save Recovery Codes' : 'Set Up Google Authenticator'}
              </h5>
            </div>
            <button
              type="button"
              onClick={resetModalState}
              className="text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {recoveryCodesDisplay ? (
            /* Step 3: Display Recovery Codes */
            <div className="space-y-3.5 text-center">
              <p className="text-xs text-[var(--color-secondary-text)]">
                Save these 8 emergency recovery codes in a secure password manager. They can be used to sign in if you lose your phone.
              </p>

              <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-xl font-mono text-xs font-bold text-[var(--color-main-text)]">
                {recoveryCodesDisplay.map((code, idx) => (
                  <div key={idx} className="p-1.5 bg-[var(--color-secondary-bg)] rounded-lg text-center tracking-wider">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyRecoveryCodes}
                  className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] text-xs font-bold text-[var(--color-main-text)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedCodes ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied Codes</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All Codes</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetModalState}
                  className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  I Have Stored These Codes Safely
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--color-secondary-text)]">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--color-primary-action)]" />
              <span>Generating enrollment QR code...</span>
            </div>
          ) : enrollmentData ? (
            /* Step 1 & 2: QR Code & Verification Form */
            <form onSubmit={handleVerifySetup} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* QR Code Container */}
                <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-[var(--color-borders)] shadow-xs mx-auto">
                  {enrollmentData.qrCode ? (
                    <img
                      src={enrollmentData.qrCode}
                      alt="Google Authenticator QR Code"
                      className="w-40 h-40 object-contain"
                    />
                  ) : (
                    <QrCode className="w-32 h-32 text-gray-700" />
                  )}
                  <span className="text-[10px] text-gray-500 mt-1 font-medium">
                    Scan with Google Authenticator
                  </span>
                </div>

                {/* Instructions & Secret Key */}
                <div className="space-y-3">
                  <ol className="text-xs text-[var(--color-secondary-text)] space-y-1.5 list-decimal list-inside">
                    <li>Open <strong>Google Authenticator</strong> or compatible app.</li>
                    <li>Tap <strong>+</strong> and scan the QR code.</li>
                    <li>If you cannot scan, enter the key below manually.</li>
                  </ol>

                  <div className="p-2.5 bg-[var(--color-card-bg)] rounded-xl border border-[var(--color-borders)] space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary-text)] block">
                      Manual Secret Key
                    </span>
                    <div className="flex items-center justify-between gap-2">
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
                </div>
              </div>

              {/* Password & First Code Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {hasPassword && (
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--color-main-text)] mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                    />
                  </div>
                )}

                <div className={hasPassword ? '' : 'sm:col-span-2'}>
                  <label className="block text-[11px] font-bold text-[var(--color-main-text)] mb-1">
                    First 6-Digit App Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full px-3 py-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs font-mono font-bold tracking-widest text-[var(--color-main-text)] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetModalState}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-borders)] text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6 || (hasPassword && !confirmPassword)}
                  className="px-4 py-2 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Verifying...' : 'Verify & Activate'}</span>
                </button>
              </div>
            </form>
          ) : null}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGENERATE RECOVERY CODES */}
      {/* ========================================================================= */}
      {activeModal === 'regenCodes' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] space-y-3.5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-2.5">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-amber-500" />
              <h5 className="font-bold text-xs sm:text-sm text-[var(--color-main-text)]">
                Regenerate Emergency Recovery Codes
              </h5>
            </div>
            <button
              type="button"
              onClick={resetModalState}
              className="text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {recoveryCodesDisplay ? (
            <div className="space-y-3.5 text-center">
              <p className="text-xs text-[var(--color-secondary-text)]">
                New recovery codes have been generated. Your old recovery codes are immediately invalidated.
              </p>

              <div className="grid grid-cols-2 gap-2 p-3 bg-[var(--color-card-bg)] border border-[var(--color-borders)] rounded-xl font-mono text-xs font-bold text-[var(--color-main-text)]">
                {recoveryCodesDisplay.map((code, idx) => (
                  <div key={idx} className="p-1.5 bg-[var(--color-secondary-bg)] rounded-lg text-center tracking-wider">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyRecoveryCodes}
                  className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl border border-[var(--color-borders)] bg-[var(--color-card-bg)] hover:bg-[var(--color-secondary-bg)] text-xs font-bold text-[var(--color-main-text)] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {copiedCodes ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied Codes</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All Codes</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={resetModalState}
                  className="w-full sm:w-auto flex-1 py-2 px-3 rounded-xl bg-[var(--color-primary-action)] hover:bg-[var(--color-primary-action-hover)] text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleRegenerateCodes} className="space-y-3">
              <p className="text-xs text-[var(--color-secondary-text)]">
                Generating new codes will invalidate any existing recovery codes. Enter your password to confirm.
              </p>

              {hasPassword && (
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
                />
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetModalState}
                  className="px-3.5 py-2 rounded-xl border border-[var(--color-borders)] text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={loading || (hasPassword && !confirmPassword)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{loading ? 'Regenerating...' : 'Confirm Regeneration'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SWITCH TO EMAIL OTP */}
      {/* ========================================================================= */}
      {activeModal === 'toggleEmail' && (
        <form onSubmit={handleSwitchToEmail} className="p-4 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-2.5">
            <span className="text-xs font-bold text-[var(--color-main-text)]">
              Switch to Email Verification
            </span>
            <button
              type="button"
              onClick={resetModalState}
              className="text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-[var(--color-secondary-text)]">
            Verification codes will be sent to <strong>{user?.email}</strong> instead of your authenticator app.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {hasPassword && (
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm with current password"
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetModalState}
              className="px-3.5 py-2 rounded-xl border border-[var(--color-borders)] text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (hasPassword && !confirmPassword)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Switching...' : 'Activate Email OTP'}</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DISABLE 2FA */}
      {/* ========================================================================= */}
      {activeModal === 'disable' && (
        <form onSubmit={handleDisable2FA} className="p-4 rounded-2xl bg-[var(--color-secondary-bg)] border border-[var(--color-borders)] space-y-3 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[var(--color-borders)] pb-2.5">
            <span className="text-xs font-bold text-red-600">
              Disable Two-Factor Authentication
            </span>
            <button
              type="button"
              onClick={resetModalState}
              className="text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-[var(--color-secondary-text)]">
            Disabling 2FA reduces account security. You will only need your password to log in.
          </p>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-600 dark:text-red-400">
              {errorMsg}
            </div>
          )}

          {hasPassword && (
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm with current password"
              className="w-full px-3 py-2 rounded-xl bg-[var(--color-card-bg)] border border-[var(--color-borders)] text-xs text-[var(--color-main-text)] focus:outline-hidden"
            />
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={resetModalState}
              className="px-3.5 py-2 rounded-xl border border-[var(--color-borders)] text-xs font-bold text-[var(--color-secondary-text)] hover:text-[var(--color-main-text)] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (hasPassword && !confirmPassword)}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? 'Disabling...' : 'Confirm Disable'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
