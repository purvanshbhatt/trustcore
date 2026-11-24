'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/auth';

/** How long to wait for the PKCE code exchange before reporting a failed sign-in. */
const SESSION_WAIT_MS = 6000;

function readErrorFromUrl(): string | null {
  // Supabase reports failures in the query string (PKCE) or the hash (implicit).
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return (
    query.get('error_description') ||
    hash.get('error_description') ||
    query.get('error') ||
    hash.get('error')
  );
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const { user, loading, configured } = useAuth();
  const [urlError, setUrlError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setUrlError(readErrorFromUrl());
  }, []);

  // The Supabase client exchanges the `?code=` param on init; once a session exists, go home.
  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (loading || user) {
      return;
    }
    const timer = window.setTimeout(() => setTimedOut(true), SESSION_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  let failure: string | null = null;
  if (urlError) {
    failure = urlError;
  } else if (!configured) {
    failure = 'Authentication is not configured for this build.';
  } else if (timedOut && !user) {
    failure =
      'The sign-in link is invalid or has expired. Open the link in the same browser you requested it from, or request a new one.';
  }

  if (failure && !user) {
    return (
      <div className="mx-auto max-w-md pt-6 sm:pt-12">
        <div className="rounded-2xl border border-zinc-800 bg-[#10111a] p-6 space-y-4 text-center">
          <AlertTriangle className="mx-auto h-7 w-7 text-red-400" />
          <h1 className="text-base font-bold text-zinc-100">Sign-in failed</h1>
          <p role="alert" className="text-xs text-red-200 break-words leading-relaxed">
            {failure}
          </p>
          <Link
            href="/login"
            className="inline-block rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="text-center space-y-3">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
        <p className="text-xs text-zinc-400 font-mono">Completing sign-in...</p>
      </div>
    </div>
  );
}
