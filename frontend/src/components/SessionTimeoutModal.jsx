import React from 'react';
import { ShieldAlert, Clock, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SessionTimeoutModal() {
  const {
    showTimeoutWarning,
    warningSecondsRemaining,
    refreshSession,
    logout,
    isRefreshingSession,
  } = useAuth();

  if (!showTimeoutWarning) return null;

  const minutes = Math.floor(warningSecondsRemaining / 60);
  const seconds = warningSecondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
    >
      <div className="relative w-full max-w-md p-6 bg-[var(--color-primary-bg,#121826)] border border-amber-500/30 rounded-2xl shadow-2xl shadow-amber-500/10 text-[var(--color-main-text,#f1f5f9)] overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          {/* Animated Warning Icon */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/20 animate-pulse">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2
            id="session-timeout-title"
            className="text-xl font-bold tracking-tight text-[var(--color-main-text,#f1f5f9)] mb-2"
          >
            Session Inactivity Warning
          </h2>

          <p className="text-sm text-[var(--color-secondary-text,#94a3b8)] mb-6">
            You have been inactive for a while. For your security, your session will automatically terminate in:
          </p>

          {/* Countdown Clock Badge */}
          <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6 text-amber-300 font-mono text-2xl font-bold tracking-wider">
            <Clock className="w-5 h-5 text-amber-400 animate-spin" style={{ animationDuration: '4s' }} />
            <span>{formattedTime}</span>
          </div>

          <p className="text-xs text-[var(--color-secondary-text,#94a3b8)] mb-6">
            Click <strong>Stay Signed In</strong> to continue working without interruption.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              id="stay-signed-in-btn"
              type="button"
              disabled={isRefreshingSession}
              onClick={refreshSession}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-amber-500/25 transition-all transform active:scale-95 disabled:opacity-50"
            >
              {isRefreshingSession ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              <span>Stay Signed In</span>
            </button>

            <button
              id="session-logout-btn"
              type="button"
              onClick={logout}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--color-secondary-text,#94a3b8)] hover:text-white font-semibold rounded-xl transition-all active:scale-95"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
