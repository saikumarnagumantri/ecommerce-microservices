import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { clearToken, getToken, setToken } from '../api/tokenStore';
import { setUnauthorizedHandler } from '../api/client';
import { UserProfile } from '../api/types';

interface AuthContextValue {
  user: UserProfile | null;
  /** True only while the very first token check on app launch is in flight. */
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearToken();
    setUser(null);
  }, []);

  // A session persists across restarts: on launch, if a token was saved,
  // fetch the profile it belongs to rather than trusting it blindly.
  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        try {
          setUser(await authApi.getProfile());
        } catch {
          await clearToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  // Any 401 from anywhere in the app (an expired token mid-session) drops
  // the user back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user: profile } = await authApi.login(email, password);
    await setToken(accessToken);
    setUser(profile);
  }, []);

  const register = useCallback(async (input: authApi.RegisterInput) => {
    await authApi.register(input);
    await login(input.email, input.password);
  }, [login]);

  const refreshProfile = useCallback(async () => {
    setUser(await authApi.getProfile());
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refreshProfile }),
    [user, isLoading, login, register, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
