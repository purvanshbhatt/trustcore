'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { ApiError, createCheckout, toUiError, type UiError } from '@/lib/api';
import { ApiErrorNotice } from '@/components/ApiErrorNotice';
import { ContactLink } from '@/components/ContactLink';

type CheckoutTier = 'per_scan' | 'pro_monthly';

interface CheckoutPlan {
  readonly tier: CheckoutTier;
  readonly kicker: string;
  readonly name: string;
  readonly price: string;
  readonly unit: string;
  readonly blurb: string;
  readonly features: readonly string[];
  readonly cta: string;
}

/**
 * The plans sold through Stripe Checkout. The landing page and the paywall both
 * render this list, so names and prices cannot drift apart.
 */
const CHECKOUT_PLANS: readonly CheckoutPlan[] = [
  {
    tier: 'per_scan',
    kicker: 'One-time',
    name: 'Launch Audit',
    price: '$29',
    unit: 'one-time, per audit',
    blurb: 'One full audit with any of the four tools, for the app or agent you are about to ship.',
    features: [
      'Every finding, not only the top 2',
      'Exact file and line citations',
      'Copy-paste fix prompts',
      'Markdown, JSON and print / PDF export',
    ],
    cta: 'Buy a Launch Audit — $29',
  },
  {
    tier: 'pro_monthly',
    kicker: 'Subscription',
    name: 'Pro Builder',
    price: '$49',
    unit: '/mo',
    blurb: 'A full report on every scan while you build, without buying audits one at a time.',
    features: [
      'Full reports across all four tools',
      'Everything in Launch Audit, on every scan',
      'Billed monthly through Stripe',
    ],
    cta: 'Start Pro Builder — $49/mo',
  },
];

const SPRINT_PLAN = {
  kicker: 'Service',
  name: 'Done-For-You AI Readiness Sprint',
  pricePrefix: 'from',
  price: '$1,500',
  blurb: 'For teams that want the readiness work done for them.',
  features: [
    'Scope and deliverables agreed in a separate statement of work',
    'Priced per engagement',
  ],
  cta: 'Contact us about a sprint',
} as const;

interface PricingCardsProps {
  /** Tighter spacing for the paywall modal. */
  compact?: boolean;
  /** Runs before the redirect to /login when checkout needs a signed-in account (e.g. to close a modal). */
  onSignInRequired?: () => void;
}

/**
 * The three pricing cards: Launch Audit and Pro Builder start a Stripe Checkout
 * session; the sprint is a contact option.
 */
export function PricingCards({ compact = false, onSignInRequired }: PricingCardsProps) {
  const router = useRouter();
  const [loadingTier, setLoadingTier] = useState<CheckoutTier | null>(null);
  const [checkoutError, setCheckoutError] = useState<UiError | null>(null);

  const handleCheckout = async (tier: CheckoutTier) => {
    setLoadingTier(tier);
    setCheckoutError(null);
    try {
      // Real Stripe Checkout session; success/cancel URLs stay on this app's origin.
      const response = await createCheckout(tier);
      if (!response.checkout_url) {
        throw new Error('Checkout did not return a redirect URL.');
      }
      window.location.href = response.checkout_url;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Purchases attach to an account: send signed-out visitors to sign in first.
        onSignInRequired?.();
        router.push('/login');
        return;
      }
      console.error('Checkout failed:', err);
      setCheckoutError(toUiError(err));
    } finally {
      setLoadingTier(null);
    }
  };

  const cardPadding = compact ? 'p-5' : 'p-6';
  const priceSize = compact ? 'text-3xl' : 'text-4xl';

  return (
    <div className="space-y-4">
      {/* Checkout failure (no simulated success): shown inline */}
      <ApiErrorNotice error={checkoutError} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CHECKOUT_PLANS.map((plan) => {
          const featured = plan.tier === 'per_scan';
          return (
            <div
              key={plan.tier}
              className={`flex flex-col justify-between rounded-2xl border ${cardPadding} ${
                featured ? 'border-blue-500/50 bg-[#121424]' : 'border-zinc-800 bg-[#10111a]'
              }`}
            >
              <div>
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                    featured ? 'text-blue-400' : 'text-zinc-500'
                  }`}
                >
                  {plan.kicker}
                </span>
                <h3 className="mt-1.5 text-base font-bold text-white">{plan.name}</h3>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  <span className={`font-mono font-extrabold text-zinc-50 ${priceSize}`}>{plan.price}</span>
                  <span className="font-mono text-xs text-zinc-400">{plan.unit}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-zinc-400">{plan.blurb}</p>
                <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mr-2 mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                type="button"
                onClick={() => void handleCheckout(plan.tier)}
                disabled={loadingTier !== null}
                className={`mt-6 w-full rounded-xl py-2.5 text-xs font-semibold transition disabled:opacity-50 ${
                  featured
                    ? 'bg-blue-600 text-white shadow hover:bg-blue-500'
                    : 'border border-zinc-700 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {loadingTier === plan.tier ? 'Redirecting to Stripe…' : plan.cta}
              </button>
            </div>
          );
        })}

        {/* Sprint: sold by conversation, not by checkout */}
        <div className={`flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#10111a] ${cardPadding}`}>
          <div>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
              {SPRINT_PLAN.kicker}
            </span>
            <h3 className="mt-1.5 text-base font-bold text-white">{SPRINT_PLAN.name}</h3>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs text-zinc-400">{SPRINT_PLAN.pricePrefix}</span>
              <span className={`font-mono font-extrabold text-zinc-50 ${priceSize}`}>{SPRINT_PLAN.price}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-zinc-400">{SPRINT_PLAN.blurb}</p>
            <ul className="mt-4 space-y-2 text-xs text-zinc-300">
              {SPRINT_PLAN.features.map((feature) => (
                <li key={feature} className="flex items-start">
                  <Check className="mr-2 mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <ContactLink
            label={SPRINT_PLAN.cta}
            subject={SPRINT_PLAN.name}
            className="mt-6 block w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-center text-xs font-semibold text-zinc-100 transition hover:bg-zinc-700 hover:text-white"
            placeholderClassName="mt-6 block w-full rounded-xl border border-dashed border-zinc-700 px-3 py-2.5 text-center text-xs text-zinc-400"
          />
        </div>
      </div>
    </div>
  );
}
