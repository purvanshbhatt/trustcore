'use client';

import React, { useState } from 'react';
import { X, Check, Zap, Shield, Sparkles, CreditCard, Lock } from 'lucide-react';
import { createCheckout } from '@/lib/api';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
  creditsRemaining?: number;
}

export function PaywallModal({
  isOpen,
  onClose,
  currentTier = 'per_scan',
  creditsRemaining = 10,
}: PaywallModalProps) {
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCheckout = async (tier: 'per_scan' | 'pro_monthly' | 'enterprise_monthly') => {
    setLoadingTier(tier);
    try {
      const response = await createCheckout(tier);
      if (response && response.checkout_url) {
        window.location.href = response.checkout_url;
      }
    } catch (err) {
      console.error('Checkout failed:', err);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl border border-zinc-800 bg-[#0e0f17] p-6 sm:p-8 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-lg mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
            Upgrade TrustCore Security & Readiness
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-zinc-400">
            Current Tier: <span className="font-semibold text-zinc-200 uppercase">{currentTier}</span> ({creditsRemaining} credits available).
            Stripe payment integration with live/mock toggle.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Per Job Scan */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Single Audit
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-zinc-100">$9.99</span>
                <span className="ml-1 text-xs text-zinc-500">/ scan</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Ideal for solo founders testing a pre-launch build before demo day.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  1 Full Engine 1 + Engine 2 Scan
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Source-Cited Report Export
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Fix Prompts for Cursor/Lovable
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('per_scan')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {loadingTier === 'per_scan' ? 'Initiating...' : 'Buy 1 Scan Job'}
            </button>
          </div>

          {/* Card 2: Pro Tier */}
          <div className="relative flex flex-col justify-between rounded-xl border border-blue-500/50 bg-[#121422] p-5 shadow-lg shadow-blue-500/5 transition hover:border-blue-400">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-blue-400/40 bg-blue-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              Most Popular
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Pro Team
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-zinc-100">$49</span>
                <span className="ml-1 text-xs text-zinc-500">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Unlimited scans for active development teams and security leads.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400" />
                  Unlimited Scans across all 4 tools
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400" />
                  Before/After MCP Permission Diffs
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400" />
                  SOC 2 Evidence-to-Answer Mapper
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400" />
                  Prompt Injection & Canary Harness
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('pro_monthly')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loadingTier === 'pro_monthly' ? 'Redirecting to Stripe...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Card 3: Enterprise Tier */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Enterprise
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-bold text-zinc-100">$199</span>
                <span className="ml-1 text-xs text-zinc-500">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Custom rule packs, CI/CD webhooks, and SOC 2 auditor acceptance export.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Custom AST & Regex Rule Packs
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Client Acceptance Report Sign-off
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400" />
                  Dedicated GCS/PostgreSQL Vault
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('enterprise_monthly')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-lg border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50"
            >
              {loadingTier === 'enterprise_monthly' ? 'Initiating...' : 'Get Enterprise'}
            </button>
          </div>
        </div>

        {/* Footer Guarantee */}
        <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-zinc-500">
          <Lock className="h-3.5 w-3.5" />
          <span>Secured with Stripe Checkout • Instant activation • Cancel anytime</span>
        </div>
      </div>
    </div>
  );
}
