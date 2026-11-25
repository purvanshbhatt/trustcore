'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Clock, Lock, LogIn, RefreshCw } from 'lucide-react';
import type { UiError } from '@/lib/api';
import { useBilling } from '@/lib/billing';

interface ApiErrorNoticeProps {
  error: UiError | null;
  className?: string;
  /** Re-run the failed request. Renders a Retry button when provided. */
  onRetry?: () => void;
}

const RETRY_BUTTON_CLASS =
  'flex shrink-0 items-center space-x-1.5 rounded-lg border px-3 py-1 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';

/** Seconds left before a rate-limited request may be retried; restarts for each new error. */
function useRetryCountdown(error: UiError | null): number {
  const initial = error?.status === 429 ? Math.max(0, error.retryAfterSeconds ?? 0) : 0;
  const [remaining, setRemaining] = useState(initial);

  useEffect(() => {
    setRemaining(initial);
    if (initial <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
    // A new error object restarts the countdown even when the wait is the same.
  }, [error, initial]);

  return remaining;
}

/**
 * Visible error banner for API failures, with an optional Retry button.
 * 401 links to /login, 402 opens the paywall, 429 shows the wait time; every
 * other failure shows the API's detail message. It never substitutes sample data.
 */
export function ApiErrorNotice({ error, className = '', onRetry }: ApiErrorNoticeProps) {
  const { openPaywall } = useBilling();
  const remaining = useRetryCountdown(error);

  if (error === null) {
    return null;
  }

  if (error.status === 401) {
    return (
      <div
        role="alert"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs ${className}`}
      >
        <div className="flex items-center space-x-2 text-amber-200">
          <LogIn className="h-4 w-4 shrink-0 text-amber-400" />
          <span>
            <strong className="font-semibold">Sign in required.</strong> Your session is missing or has expired.
          </span>
        </div>
        <Link
          href="/login"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-semibold text-amber-200 transition hover:bg-amber-500/20"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (error.status === 402) {
    return (
      <div
        role="alert"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 px-3.5 py-2.5 text-xs ${className}`}
      >
        <div className="flex items-start space-x-2 text-blue-100">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <span className="break-words">
            <strong className="font-semibold">Upgrade required.</strong> {error.message}
          </span>
        </div>
        <button
          type="button"
          onClick={() => openPaywall('upgrade_required')}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1 font-semibold text-white shadow transition hover:bg-blue-500"
        >
          Unlock full scans
        </button>
      </div>
    );
  }

  if (error.status === 429) {
    const waiting = remaining > 0;
    return (
      <div
        role="alert"
        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs ${className}`}
      >
        <div className="flex items-start space-x-2 text-amber-200">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <span className="break-words">
            <strong className="font-semibold">Too many requests.</strong>{' '}
            {waiting ? `Try again in ${remaining} second${remaining === 1 ? '' : 's'}.` : error.message}
          </span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={waiting}
            className={`${RETRY_BUTTON_CLASS} border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{waiting ? `Retry in ${remaining}s` : 'Retry'}</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={`flex flex-wrap items-start justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-200 ${className}`}
    >
      <div className="flex min-w-0 items-start space-x-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <span className="break-words">
          {error.status !== null && error.status > 0 && (
            <span className="mr-1.5 font-mono font-bold text-red-300">HTTP {error.status}</span>
          )}
          {error.message}
        </span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={`${RETRY_BUTTON_CLASS} border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/20`}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}
