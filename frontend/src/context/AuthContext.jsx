import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  getMeApi,
  loginApi,
  adminLoginApi,
  registerApi,
  logoutApi,
  googleAuthApi,
  verify2FAApi,
  resend2FAApi,
  refreshSessionApi,
} from '../api/auth';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pending2FA, setPending2FA] = useState(null);

  // Inactivity warning modal states
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [warningSecondsRemaining, setWarningSecondsRemaining] = useState(120);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);

  const userRef = useRef(user);
  userRef.current = user;

  // Load session on startup and page refresh
  const checkAuth = useCallback(async () => {
    try {
      const data = await getMeApi();
      if (data && data.user) {
        setUser(data.user);
        if (data.session) {
          setSession(data.session);
        }
      } else {
        setUser(null);
        setSession(null);
      }
    } catch (err) {
      setUser(null);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Session Inactivity & Expiry Timer
  useEffect(() => {
    if (!user || !session?.expiresAt) {
      setShowTimeoutWarning(false);
      return;
    }

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const expiresAtMs = new Date(session.expiresAt).getTime();
      const absoluteExpiresAtMs = session.absoluteExpiresAt
        ? new Date(session.absoluteExpiresAt).getTime()
        : expiresAtMs;

      // Effective deadline is the earlier of inactivity or absolute lifetime
      const effectiveExpiryMs = Math.min(expiresAtMs, absoluteExpiresAtMs);
      const remainingMs = effectiveExpiryMs - now;

      if (remainingMs <= 0) {
        // Session expired on the client side
        clearInterval(checkInterval);
        setUser(null);
        setSession(null);
        setShowTimeoutWarning(false);

        const currentRole = userRef.current?.role;
        const targetLogin = currentRole === 'admin' ? '/admin/login?sessionExpired=1' : '/login?sessionExpired=1';
        if (typeof window !== 'undefined' && window.location) {
          window.location.href = targetLogin;
        }
        return;
      }

      // Warning threshold (default 2 minutes = 120,000 ms)
      const warningThresholdMs = session.warningBeforeExpiryMs || 120000;
      if (remainingMs <= warningThresholdMs) {
        setShowTimeoutWarning(true);
        setWarningSecondsRemaining(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setShowTimeoutWarning(false);
      }
    }, 1000);

    return () => clearInterval(checkInterval);
  }, [user, session]);

  // Extend session on user action / keep alive
  const refreshSession = async () => {
    try {
      setIsRefreshingSession(true);
      const data = await refreshSessionApi();
      if (data && data.session) {
        setSession(data.session);
        setShowTimeoutWarning(false);
      }
      return data;
    } catch (err) {
      // If refresh fails due to 401 (already expired or revoked on server)
      if (err.status === 401) {
        setUser(null);
        setSession(null);
        setShowTimeoutWarning(false);
        const currentRole = userRef.current?.role;
        const targetLogin = currentRole === 'admin' ? '/admin/login?sessionExpired=1' : '/login?sessionExpired=1';
        if (typeof window !== 'undefined' && window.location) {
          window.location.href = targetLogin;
        }
      }
      throw err;
    } finally {
      setIsRefreshingSession(false);
    }
  };

  // Login handler
  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    if (data && data.require2FA) {
      setPending2FA({
        tempToken: data.tempToken,
        email: data.email,
        twoFactorMethod: data.twoFactorMethod || 'email',
        requireSetup: Boolean(data.requireSetup),
        method: 'password',
      });
      return data;
    }
    if (data && data.user) {
      setPending2FA(null);
      setUser(data.user);
      if (data.session) {
        setSession(data.session);
      }
      return data.user;
    }
    return data;
  };

  // Google OAuth Login handler
  const loginWithGoogle = async () => {
    if (!auth || !isFirebaseConfigured) {
      throw new Error(
        'Google Sign-In is not currently configured. Please ensure Firebase environment variables are defined in frontend/.env.'
      );
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const data = await googleAuthApi(idToken);
      if (data && data.require2FA) {
        setPending2FA({
          tempToken: data.tempToken,
          email: data.email,
          twoFactorMethod: data.twoFactorMethod || 'email',
          requireSetup: Boolean(data.requireSetup),
          method: 'google',
        });
        return data;
      }
      if (data && data.user) {
        setPending2FA(null);
        setUser(data.user);
        if (data.session) {
          setSession(data.session);
        }
        return data.user;
      }
      return data;
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') {
        const cancelErr = new Error('Google sign-in was cancelled.');
        cancelErr.code = err.code;
        throw cancelErr;
      }
      if (err.code === 'auth/popup-blocked') {
        const popupErr = new Error('Sign-in popup was blocked by your browser. Please allow popups for this site.');
        popupErr.code = err.code;
        throw popupErr;
      }
      if (err.code === 'auth/configuration-not-found') {
        const configErr = new Error('Google Sign-In is not enabled yet in your Firebase Console. Please go to Firebase Console ➔ Authentication ➔ Sign-in method and enable Google.');
        configErr.code = err.code;
        throw configErr;
      }
      if (err.code === 'auth/network-request-failed') {
        const netErr = new Error('Network error during Google sign-in. Please check your internet connection.');
        netErr.code = err.code;
        throw netErr;
      }
      throw err;
    }
  };

  // Dedicated Admin Login handler
  const adminLogin = async (email, password) => {
    const data = await adminLoginApi({ email, password });
    if (data && data.require2FA) {
      setPending2FA({
        tempToken: data.tempToken,
        email: data.email,
        twoFactorMethod: data.twoFactorMethod || 'authenticator',
        requireSetup: Boolean(data.requireSetup),
        role: 'admin',
        method: 'admin',
      });
      return data;
    }
    if (data && data.user) {
      setPending2FA(null);
      setUser(data.user);
      if (data.session) {
        setSession(data.session);
      }
      return data.user;
    }
    return data;
  };

  // Verify 2FA (Handles TOTP Authenticator, Recovery Code, or Email OTP)
  const verify2FA = async (codeOrOtp, overrideTempToken, isRecoveryCode = false) => {
    const tokenToUse = overrideTempToken || pending2FA?.tempToken;
    if (!tokenToUse) {
      throw new Error('No active verification session found. Please log in again.');
    }

    const data = await verify2FAApi({
      tempToken: tokenToUse,
      otp: codeOrOtp,
      code: codeOrOtp,
      recoveryCode: isRecoveryCode ? codeOrOtp : undefined,
      isRecoveryCode,
    });

    if (data && data.user) {
      setUser(data.user);
      if (data.session) {
        setSession(data.session);
      }
      setPending2FA(null);
      return data.user;
    }
    return data;
  };

  // Resend 2FA OTP (Email only)
  const resend2FA = async (overrideTempToken) => {
    const tokenToUse = overrideTempToken || pending2FA?.tempToken;
    if (!tokenToUse) {
      throw new Error('No active verification session found. Please log in again.');
    }

    return await resend2FAApi({ tempToken: tokenToUse });
  };

  // Cancel 2FA challenge and return to login
  const cancel2FA = () => {
    setPending2FA(null);
  };

  // Register handler (attendee or organizer)
  const register = async (userData) => {
    const data = await registerApi(userData);
    if (data && data.user) {
      setUser(data.user);
      if (data.session) {
        setSession(data.session);
      }
    }
    return data.user;
  };

  // Logout handler
  const logout = async () => {
    try {
      if (auth) {
        await signOut(auth).catch(() => {});
      }
      await logoutApi();
    } catch (err) {
      console.warn('Logout API warning:', err);
    } finally {
      setUser(null);
      setSession(null);
      setPending2FA(null);
      setShowTimeoutWarning(false);
    }
  };

  const normalizedRole = user?.role ? String(user.role).toLowerCase() : null;
  const safeRole =
    normalizedRole === 'admin'
      ? 'admin'
      : normalizedRole === 'organizer'
      ? 'organizer'
      : normalizedRole
      ? 'attendee'
      : null;

  const value = {
    user,
    role: safeRole,
    session,
    isAuthenticated: !!user,
    isLoading,
    pending2FA,
    showTimeoutWarning,
    warningSecondsRemaining,
    isRefreshingSession,
    refreshSession,
    checkAuth,
    login,
    loginWithGoogle,
    adminLogin,
    verify2FA,
    resend2FA,
    cancel2FA,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
