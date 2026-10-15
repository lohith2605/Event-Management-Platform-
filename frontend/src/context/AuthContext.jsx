import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMeApi, loginApi, adminLoginApi, registerApi, logoutApi, googleAuthApi } from '../api/auth';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load session on startup and page refresh
  const checkAuth = useCallback(async () => {
    try {
      const data = await getMeApi();
      if (data && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login handler
  const login = async (email, password) => {
    const data = await loginApi({ email, password });
    if (data && data.user) {
      setUser(data.user);
    }
    return data.user;
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
      if (data && data.user) {
        setUser(data.user);
      }
      return data.user;
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
    if (data && data.user) {
      setUser(data.user);
    }
    return data.user;
  };

  // Register handler (attendee or organizer)
  const register = async (userData) => {
    const data = await registerApi(userData);
    if (data && data.user) {
      setUser(data.user);
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
    isAuthenticated: !!user,
    isLoading,
    checkAuth,
    login,
    loginWithGoogle,
    adminLogin,
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
