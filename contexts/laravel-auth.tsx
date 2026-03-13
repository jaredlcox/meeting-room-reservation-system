"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getApiBaseUrl, apiUrl } from "@/lib/api-url";

export interface AuthUser {
  email: string;
  name?: string;
}

interface LaravelAuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (returnTo?: string) => void;
  signOut: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const LaravelAuthContext = createContext<LaravelAuthContextValue | null>(null);

const TOKEN_KEY = "laravel_booking_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function LaravelAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const baseUrl = getApiBaseUrl();

  const fetchSession = useCallback(async (token: string) => {
    const res = await fetch(apiUrl("/api/auth/session"), {
      headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
    });
    if (!res.ok) {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      return;
    }
    const data = (await res.json()) as { user?: { email?: string; name?: string } };
    if (data.user?.email) {
      setUser({
        email: data.user.email,
        name: data.user.name,
      });
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!baseUrl) {
      setLoading(false);
      return;
    }
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    const tokenFromUrl = params?.get("token");
    if (tokenFromUrl) {
      localStorage.setItem(TOKEN_KEY, tokenFromUrl);
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search || "?");
      fetchSession(tokenFromUrl).finally(() => setLoading(false));
      return;
    }
    const stored = getStoredToken();
    if (!stored) {
      setLoading(false);
      return;
    }
    fetchSession(stored).finally(() => setLoading(false));
  }, [baseUrl, fetchSession]);

  const signIn = useCallback(
    (returnTo?: string) => {
      if (!baseUrl) return;
      const path = returnTo ?? (typeof window !== "undefined" ? window.location.pathname : "/");
      window.location.href = `${baseUrl}/login?returnTo=${encodeURIComponent(path)}`;
    },
    [baseUrl]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const token = getStoredToken();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, []);

  const value: LaravelAuthContextValue = {
    user,
    loading,
    signIn,
    signOut,
    getAuthHeaders,
  };

  return (
    <LaravelAuthContext.Provider value={value}>
      {children}
    </LaravelAuthContext.Provider>
  );
}

export function useLaravelAuth(): LaravelAuthContextValue | null {
  return useContext(LaravelAuthContext);
}
