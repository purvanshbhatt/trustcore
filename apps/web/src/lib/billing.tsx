'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { track, type PaywallSource } from './analytics';
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
  /** Open the paywall; `source` (where it was opened from) is recorded with the analytics event. */
  readonly openPaywall: (source: PaywallSource) => void;
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

interface BillingProviderProps {
  readonly children: React.ReactNode;
  /** Load the plan from the API. False on marketing pages, which never show it. */
  readonly autoLoad?: boolean;
}

export function BillingProvider({ children, autoLoad = true }: BillingProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const checkoutReturnTracked = useRef(false);

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
    if (authLoading || !autoLoad) {
      return;
    }
    void refresh();
  }, [authLoading, userId, refresh, autoLoad]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('billing') !== 'success') {
      return;
    }
    setReturnedFromCheckout(true);
    // Once per page load, even if this effect re-runs.
    if (!checkoutReturnTracked.current) {
      checkoutReturnTracked.current = true;
      track('checkout_completed');
    }
    const timers = CHECKOUT_RETURN_RECHECK_MS.map((delay) => window.setTimeout(() => void refresh(), delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [refresh]);

  const openPaywall = useCallback((source: PaywallSource) => {
    setIsPaywallOpen(true);
    track('paywall_opened', { source });
  }, []);
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
