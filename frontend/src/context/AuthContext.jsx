import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMeApi, loginApi, adminLoginApi, registerApi, logoutApi } from '../api/auth';

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
      await logoutApi();
    } catch (err) {
      console.warn('Logout API warning:', err);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    role: user?.role || null,
    isAuthenticated: !!user,
    isLoading,
    checkAuth,
    login,
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
