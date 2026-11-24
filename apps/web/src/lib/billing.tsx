'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getBillingStatus, toUiError, type UiError } from './api';
import { useAuth } from './auth';
import type { BillingStatusResponse } from './types';

/** Delays for re-checking the plan after returning from Stripe Checkout (the webhook can lag the redirect). */
const CHECKOUT_RETURN_RECHECK_MS: readonly number[] = [3000, 8000];

interface BillingContextValue {
  /** Live plan from GET /api/v1/billing/status; null while loading or when the request failed. */
  readonly status: BillingStatusResponse | null;
  readonly statusError: UiError | null;
  readonly loading: boolean;
  readonly refresh: () => Promise<void>;
  /** True when the page was opened from a completed Stripe Checkout (`?billing=success`). */
  readonly returnedFromCheckout: boolean;
  readonly isPaywallOpen: boolean;
  readonly openPaywall: () => void;
  readonly closePaywall: () => void;
}

const BillingContext = createContext<BillingContextValue | null>(null);

const OUTSIDE_PROVIDER: BillingContextValue = {
  status: null,
  statusError: null,
  loading: false,
  refresh: async () => undefined,
  returnedFromCheckout: false,
  isPaywallOpen: false,
  openPaywall: () => undefined,
  closePaywall: () => undefined,
};

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;

  const [status, setStatus] = useState<BillingStatusResponse | null>(null);
  const [statusError, setStatusError] = useState<UiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [returnedFromCheckout, setReturnedFromCheckout] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await getBillingStatus();
      setStatus(next);
      setStatusError(null);
    } catch (err) {
      // Never keep or invent a balance when the plan cannot be confirmed.
      setStatus(null);
      setStatusError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Load once the session is known, and again whenever the signed-in user changes.
  useEffect(() => {
    if (authLoading) {
      return;
    }
    void refresh();
  }, [authLoading, userId, refresh]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('billing') !== 'success') {
      return;
    }
    setReturnedFromCheckout(true);
    const timers = CHECKOUT_RETURN_RECHECK_MS.map((delay) => window.setTimeout(() => void refresh(), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [refresh]);

  const openPaywall = useCallback(() => setIsPaywallOpen(true), []);
  const closePaywall = useCallback(() => setIsPaywallOpen(false), []);

  const value = useMemo<BillingContextValue>(
    () => ({
      status,
      statusError,
      loading,
      refresh,
      returnedFromCheckout,
      isPaywallOpen,
      openPaywall,
      closePaywall,
    }),
    [status, statusError, loading, refresh, returnedFromCheckout, isPaywallOpen, openPaywall, closePaywall]
  );

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

/** Plan, credits and paywall controls. Outside the provider it is inert rather than throwing. */
export function useBilling(): BillingContextValue {
  return useContext(BillingContext) ?? OUTSIDE_PROVIDER;
}
