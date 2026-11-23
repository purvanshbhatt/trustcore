'use client';

import React, { useState } from 'react';
import { X, Check, Zap, Shield, Sparkles, CreditCard, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');
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

  const proPrice = billingCycle === 'annual' ? 39 : 49;
  const enterprisePrice = billingCycle === 'annual' ? 159 : 199;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-4xl rounded-2xl border border-zinc-800 bg-[#0d0e17] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
            Upgrade TrustCore AI Readiness Platform
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">
            Current Tier: <span className="font-semibold text-zinc-200 uppercase font-mono">{currentTier}</span> ({creditsRemaining} scan credits available).
          </p>

          {/* Billing Cycle Switcher */}
          <div className="pt-2 flex items-center justify-center space-x-2">
            <div className="inline-flex items-center rounded-xl border border-zinc-800 bg-[#08090f] p-1 text-xs">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`rounded-lg px-3 py-1 font-medium transition ${
                  billingCycle === 'monthly'
                    ? 'bg-zinc-800 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center space-x-1.5 rounded-lg px-3 py-1 font-medium transition ${
                  billingCycle === 'annual'
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <span>Annual Billing</span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-300 font-mono">
                  SAVE 20%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Card 1: Per Job Scan */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 transition hover:border-zinc-700">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Single Audit
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-2xl font-extrabold text-zinc-100 font-mono">$9.99</span>
                <span className="ml-1 text-xs text-zinc-500 font-mono">/ scan</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Ideal for solo builders testing pre-launch apps before release.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  1 Full Engine 1 + Engine 2 Scan
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Source-Cited Report Export
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Fix Prompts for Cursor & Claude
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('per_scan')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            >
              {loadingTier === 'per_scan' ? 'Initiating...' : 'Buy 1 Scan Job'}
            </button>
          </div>

          {/* Card 2: Pro Tier (Highlighted) */}
          <div className="relative flex flex-col justify-between rounded-xl border-2 border-blue-500/60 bg-[#121424] p-5 shadow-xl shadow-blue-500/5 transition hover:border-blue-400">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-blue-400/40 bg-blue-600 px-3 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white shadow">
              Most Popular
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400">
                Pro Team
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-3xl font-extrabold text-zinc-100 font-mono">${proPrice}</span>
                <span className="ml-1 text-xs text-zinc-400 font-mono">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Unlimited scans for active development teams and security leads.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400 shrink-0" />
                  Unlimited scans across all 4 tools
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400 shrink-0" />
                  Interactive blast radius visualizer
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400 shrink-0" />
                  SOC 2 Evidence-to-Answer mapper
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-blue-400 shrink-0" />
                  Prompt injection canary harness
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('pro_monthly')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-xl bg-blue-600 py-2.5 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50 transition"
            >
              {loadingTier === 'pro_monthly' ? 'Redirecting to Stripe...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Card 3: Enterprise Tier */}
          <div className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 transition hover:border-zinc-700">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Enterprise
              </span>
              <div className="mt-2 flex items-baseline">
                <span className="text-3xl font-extrabold text-zinc-100 font-mono">${enterprisePrice}</span>
                <span className="ml-1 text-xs text-zinc-400 font-mono">/ month</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                Custom rule packs, CI/CD webhooks, and SOC 2 auditor acceptance export.
              </p>

              <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Custom AST & Regex rule packs
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Client Acceptance Report Sign-off
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Dedicated GCS/PostgreSQL Vault
                </li>
                <li className="flex items-center">
                  <Check className="mr-2 h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  Priority SLA & Security Engineer Review
                </li>
              </ul>
            </div>

            <button
              onClick={() => handleCheckout('enterprise_monthly')}
              disabled={loadingTier !== null}
              className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
            >
              {loadingTier === 'enterprise_monthly' ? 'Initiating...' : 'Get Enterprise'}
            </button>
          </div>
        </div>

        {/* Security & Compliance Guarantees */}
        <div className="pt-2 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-6 text-[11px] text-zinc-500 font-mono">
          <span className="flex items-center">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            Zero Code Retention Standard
          </span>
          <span className="flex items-center">
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
            SOC 2 Type II Certified Pipeline
          </span>
          <span className="flex items-center">
            <Lock className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
            Stripe 256-Bit SSL Checkout
          </span>
        </div>
      </div>
    </div>
  );
}
