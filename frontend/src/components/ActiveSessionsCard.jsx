import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Laptop,
  Smartphone,
  Globe,
  Trash2,
  LogOut,
  RefreshCw,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { getSessionsApi, revokeSessionApi, revokeOtherSessionsApi } from '../api/auth';

export default function ActiveSessionsCard() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [revokingOthers, setRevokingOthers] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSessionsApi();
      if (res && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err) {
      setError(err.message || 'Unable to load active sessions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId) => {
    try {
      setRevokingId(sessionId);
      setError(null);
      setMessage(null);
      await revokeSessionApi(sessionId);
      setMessage('Session successfully terminated.');
      await fetchSessions();
    } catch (err) {
      setError(err.message || 'Failed to revoke session.');
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    try {
      setRevokingOthers(true);
      setError(null);
      setMessage(null);
      const res = await revokeOtherSessionsApi();
      setMessage(res.message || 'All other sessions have been logged out.');
      await fetchSessions();
    } catch (err) {
      setError(err.message || 'Failed to revoke other sessions.');
    } finally {
      setRevokingOthers(false);
    }
  };

  const parseDevice = (userAgent) => {
    if (!userAgent) return { label: 'Web Browser', icon: Globe };
    const ua = userAgent.toLowerCase();
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      return { label: 'Mobile Device', icon: Smartphone };
    }
    if (ua.includes('macintosh') || ua.includes('windows') || ua.includes('linux')) {
      return { label: 'Desktop Computer', icon: Laptop };
    }
    return { label: 'Web Browser', icon: Globe };
  };

  const formatRelative = (dateStr) => {
    if (!dateStr) return 'Just now';
    const date = new Date(dateStr);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-[var(--color-primary-bg,#121826)] border border-[var(--color-border,#1e293b)] rounded-2xl p-6 shadow-xl relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--color-border,#1e293b)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-[var(--color-main-text,#f1f5f9)]">
              Active Security Sessions
            </h3>
          </div>
          <p className="text-xs text-[var(--color-secondary-text,#94a3b8)]">
            Manage your logged-in devices. Each session expires after 30 minutes of inactivity.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchSessions}
            disabled={loading}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--color-secondary-text,#94a3b8)] hover:text-white transition-colors"
            title="Refresh sessions"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {sessions.length > 1 && (
            <button
              type="button"
              disabled={revokingOthers}
              onClick={handleRevokeOthers}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all disabled:opacity-50"
            >
              {revokingOthers ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <LogOut className="w-3.5 h-3.5" />
              )}
              <span>Log Out Other Devices</span>
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && sessions.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-[var(--color-secondary-text,#94a3b8)]">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
          <p className="text-xs">Loading active sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-[var(--color-secondary-text,#94a3b8)] py-4 text-center">
          No active sessions detected.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const { label, icon: DeviceIcon } = parseDevice(s.userAgent);
            return (
              <div
                key={s.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  s.isCurrent
                    ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                    : 'bg-white/5 border-[var(--color-border,#1e293b)] hover:border-white/20'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl ${
                      s.isCurrent
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-white/10 text-[var(--color-secondary-text,#94a3b8)]'
                    }`}
                  >
                    <DeviceIcon className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--color-main-text,#f1f5f9)]">
                        {label}
                      </span>
                      {s.isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          Current Device
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-[var(--color-secondary-text,#94a3b8)]">
                      {s.ipAddress && (
                        <span className="flex items-center gap-1 font-mono">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          {s.ipAddress}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        Last active: {formatRelative(s.lastActivityAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    type="button"
                    disabled={revokingId === s.id}
                    onClick={() => handleRevokeSession(s.id)}
                    className="self-end sm:self-center flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all disabled:opacity-50"
                  >
                    {revokingId === s.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
