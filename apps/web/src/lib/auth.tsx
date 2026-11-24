'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isAuthConfigured } from './supabase';

export type AuthResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

interface AuthContextValue {
  readonly user: User | null;
  readonly loading: boolean;
  readonly configured: boolean;
  readonly signInWithMagicLink: (email: string) => Promise<AuthResult>;
  readonly signInWithGitHub: () => Promise<AuthResult>;
  readonly signOut: () => Promise<AuthResult>;
}

const NOT_CONFIGURED: AuthResult = {
  ok: false,
  error:
    'Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
};

const AuthContext = createContext<AuthContextValue | null>(null);

function callbackUrl(): string {
  return `${window.location.origin}/auth/callback`;
}

function toFailure(err: unknown): AuthResult {
  return { ok: false, error: err instanceof Error ? err.message : 'Unexpected authentication error.' };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isAuthConfigured();

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (supabase === null) {
      setLoading(false);
      return;
    }

    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) {
          setUser(data.session?.user ?? null);
        }
      })
      .catch(() => {
        if (active) {
          setUser(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signInWithMagicLink = useCallback(async (email: string): Promise<AuthResult> => {
    const supabase = getSupabaseClient();
    if (supabase === null) {
      return NOT_CONFIGURED;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (err) {
      return toFailure(err);
    }
  }, []);

  const signInWithGitHub = useCallback(async (): Promise<AuthResult> => {
    const supabase = getSupabaseClient();
    if (supabase === null) {
      return NOT_CONFIGURED;
    }
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: callbackUrl() },
      });
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (err) {
      return toFailure(err);
    }
  }, []);

  const signOut = useCallback(async (): Promise<AuthResult> => {
    const supabase = getSupabaseClient();
    if (supabase === null) {
      return NOT_CONFIGURED;
    }
    try {
      const { error } = await supabase.auth.signOut();
      return error ? { ok: false, error: error.message } : { ok: true };
    } catch (err) {
      return toFailure(err);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, configured, signInWithMagicLink, signInWithGitHub, signOut }),
    [user, loading, configured, signInWithMagicLink, signInWithGitHub, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return ctx;
}
