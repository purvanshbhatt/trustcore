'use client';

import React from 'react';
import Link from 'next/link';
import { X, Lock, ShieldCheck } from 'lucide-react';
import { useBilling } from '@/lib/billing';
import { PricingCards } from '@/components/PricingCards';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  const { status, statusError } = useBilling();

  if (!isOpen) return null;

  const planSummary =
    status !== null ? (
      <>
        Current plan:{' '}
        <span className="font-semibold text-zinc-200 uppercase font-mono">{status.tier.replace('_', ' ')}</span>{' '}
        {status.subscription_active
          ? '(subscription active)'
          : `(${status.credits_remaining} scan credit${status.credits_remaining === 1 ? '' : 's'} available)`}
        .
      </>
    ) : statusError !== null ? (
      <>Your current plan could not be loaded.</>
    ) : (
      <>Loading your current plan…</>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-zinc-800 bg-[#0d0e17] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Close Button */}
        <button
          onClick={onClose}
          aria-label="Close"
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
            Unlock full TrustCore reports
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400">{planSummary}</p>
          <p className="text-xs text-zinc-500">
            Your first preview scan is free: overall score plus the top 2 findings. Paid scans unlock every
            finding, exact source citations, copy-paste fix prompts and report exports.
          </p>
        </div>

        {/* Same three tiers, names and prices as the landing page: Per-Scan, Pro Monthly, Enterprise */}
        <PricingCards compact onSignInRequired={onClose} />

        {/* How submitted code and payments are handled (see /security) */}
        <div className="pt-4 border-t border-zinc-800/80 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-zinc-500">
          <span className="flex items-center">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            Uploads are parsed in memory and never stored
          </span>
          <span className="flex items-center">
            <Lock className="mr-1.5 h-3.5 w-3.5 text-zinc-400" />
            Card details are handled by Stripe and never reach TrustCore
          </span>
          <Link href="/security" onClick={onClose} className="font-semibold text-blue-400 hover:underline">
            How TrustCore handles your code
          </Link>
        </div>
      </div>
    </div>
  );
}
