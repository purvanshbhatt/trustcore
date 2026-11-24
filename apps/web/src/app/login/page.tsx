'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Mail, Github, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type MagicLinkStatus = 'idle' | 'sending' | 'sent';

export default function LoginPage() {
  const { user, loading, configured, signInWithMagicLink, signInWithGitHub, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<MagicLinkStatus>('idle');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setError(null);
    setStatus('sending');
    const result = await signInWithMagicLink(trimmed);
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('idle');
      setError(result.error);
    }
  };

  const handleGitHub = async () => {
    setError(null);
    setIsRedirecting(true);
    const result = await signInWithGitHub();
    if (!result.ok) {
      setIsRedirecting(false);
      setError(result.error);
    }
    // On success the browser navigates to GitHub, then back to /auth/callback.
  };

  const handleSignOut = async () => {
    setError(null);
    const result = await signOut();
    if (!result.ok) {
      setError(result.error);
    }
  };

  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <div className="rounded-2xl border border-zinc-800 bg-[#10111a] p-6 sm:p-8 space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-white">Sign in to TrustCore</h1>
          <p className="text-xs text-zinc-400">
            Reports are private to your account. Sign in with a one-time email link or GitHub.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start space-x-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span className="break-words">{error}</span>
          </div>
        )}

        {!configured ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-amber-200 space-y-2">
            <p className="font-semibold">Authentication is not configured for this build.</p>
            <p className="text-zinc-400 leading-relaxed">
              Set <code className="font-mono text-zinc-300">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="font-mono text-zinc-300">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>, then rebuild.
              Until then the app runs without sign-in against an API with auth disabled.
            </p>
            <Link href="/" className="inline-block text-blue-400 hover:underline">
              Return to Overview Hub
            </Link>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : user ? (
          <div className="space-y-4 text-center">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald-400" />
              <p className="mt-2 text-zinc-300">Signed in as</p>
              <p className="font-mono text-zinc-100 break-all">{user.email ?? user.id}</p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Link
                href="/"
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 transition"
              >
                Go to Overview Hub
              </Link>
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {status === 'sent' ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-xs text-zinc-300 space-y-1.5">
                <div className="flex items-center space-x-2 font-semibold text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Check your inbox</span>
                </div>
                <p className="leading-relaxed">
                  A sign-in link was sent to <span className="font-mono text-zinc-100 break-all">{email.trim()}</span>.
                  Open it in this same browser to finish signing in.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-blue-400 hover:underline"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleMagicLink} className="space-y-3">
                <label htmlFor="login-email" className="text-xs text-zinc-400">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'sending' || isRedirecting}
                  className="flex w-full items-center justify-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50 transition active:scale-[0.98]"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>{status === 'sending' ? 'Sending link…' : 'Email me a magic link'}</span>
                </button>
              </form>
            )}

            <div className="flex items-center space-x-3 text-[10px] font-mono uppercase tracking-wider text-zinc-600">
              <span className="h-px flex-1 bg-zinc-800" />
              <span>or</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <button
              type="button"
              onClick={handleGitHub}
              disabled={isRedirecting || status === 'sending'}
              className="flex w-full items-center justify-center space-x-2 rounded-lg border border-zinc-700 bg-zinc-800/80 px-4 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 disabled:opacity-50 transition"
            >
              <Github className="h-4 w-4" />
              <span>{isRedirecting ? 'Redirecting to GitHub…' : 'Continue with GitHub'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
