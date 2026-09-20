"use client";

/**
 * AuthProvider — session state via /api/auth/me on mount,
 * login/register/logout/logout-all actions. Russian errors come from the API.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { resetWorkspacesCache } from "@/hooks/use-workspaces";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    name: string,
    email: string,
    password: string,
    invite?: string,
  ) => Promise<User>;
  logout: () => Promise<void>;
  /** Increment tokenVersion and clear this cookie — every device 401s. */
  logoutAll: () => Promise<void>;
  markOnboardingDone: () => void;
  /** After PATCH /api/me — replace the in-memory session user. */
  applyUser: (next: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((u) => {
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string, invite?: string) => {
      const u = await api.register(name, email, password, invite);
      setUser(u);
      return u;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      resetWorkspacesCache();
    }
  }, []);

  const logoutAll = useCallback(async () => {
    await api.logoutAll();
    setUser(null);
    resetWorkspacesCache();
  }, []);

  const markOnboardingDone = useCallback(() => {
    setUser((u) => (u ? { ...u, onboardingDone: true } : u));
  }, []);

  const applyUser = useCallback((next: User) => {
    setUser(next);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        logoutAll,
        markOnboardingDone,
        applyUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
