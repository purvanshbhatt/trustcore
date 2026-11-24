'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  Rocket,
  Cpu,
  FileSpreadsheet,
  CheckSquare,
  FileText,
  CreditCard,
  Menu,
  X,
  ExternalLink,
  Activity,
  Layers,
  Zap,
  Sliders,
  Sparkles,
  LogIn,
  LogOut,
} from 'lucide-react';
import { PaywallModal } from '@/components/PaywallModal';
import { checkApiHealth, isMockEnabled } from '@/lib/api';
import { AuthProvider, useAuth } from '@/lib/auth';
import { BillingProvider, useBilling } from '@/lib/billing';
import { ABExperimentProvider, useABExperiment } from '@/lib/abTesting';
import { ABExperimentBar } from '@/components/ABExperimentBar';

interface AppShellProps {
  children: React.ReactNode;
}

function InnerAppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { density, ctaVariant } = useABExperiment();
  const { user, loading: authLoading, configured: authConfigured, signOut } = useAuth();
  // Real plan, credits and free-preview state from GET /api/v1/billing/status.
  const {
    status: billing,
    statusError: billingError,
    loading: billingLoading,
    refresh: refreshBilling,
    returnedFromCheckout,
    isPaywallOpen,
    openPaywall,
    closePaywall,
  } = useBilling();

  useEffect(() => {
    async function init() {
      const isOnline = await checkApiHealth();
      setApiOnline(isOnline);
    }
    init();
  }, []);

  const credits = billing?.credits_remaining ?? 0;
  const planLabel = billing ? billing.tier.replace('_', ' ') : null;
  const apiStatusLabel = apiOnline
    ? 'FastAPI Core Live'
    : isMockEnabled()
    ? 'Deterministic Mock Active'
    : apiOnline === null
    ? 'Checking API…'
    : 'API unreachable';

  const navItems = [
    {
      name: 'Overview Hub',
      href: '/',
      icon: Layers,
      description: 'Unified 4-tool status & stats',
    },
    {
      name: 'LaunchGate',
      href: '/launchgate',
      icon: Rocket,
      badge: 'Pre-Launch',
      description: 'Secrets, Supabase RLS, package audits',
    },
    {
      name: 'AgentScope',
      href: '/agentscope',
      icon: Cpu,
      badge: 'MCP Audit',
      description: 'Permissions matrix & blast radius diffs',
    },
    {
      name: 'Evidence-to-Answer',
      href: '/evidence',
      icon: FileSpreadsheet,
      badge: 'SOC 2',
      description: 'Questionnaires & zero-hallucination gaps',
    },
    {
      name: 'EvalKit',
      href: '/evalkit',
      icon: CheckSquare,
      badge: 'Evals',
      description: 'Prompt injection & regression runner',
    },
    {
      name: 'Sample Report',
      href: '/reports/rpt_lg_demo_7721',
      icon: FileText,
      description: 'Source-cited report viewer',
    },
  ];

  const densityClass =
    density === 'compact'
      ? 'density-compact'
      : density === 'executive'
      ? 'density-executive'
      : 'density-standard';

  return (
    <div className={`flex min-h-screen bg-[#090a0f] text-zinc-100 font-sans ${densityClass}`}>
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-zinc-800/80 bg-[#0c0d15] p-4 shrink-0 select-none">
        <div className="space-y-6">
          {/* Brand */}
          <Link href="/" className="flex items-center space-x-2.5 px-2 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-white group-hover:text-blue-400 transition">
                  TrustCore
                </span>
                <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-mono font-bold text-blue-400 border border-blue-500/20">
                  DUAL-ENGINE
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-medium">AI Security & Readiness</p>
            </div>
          </Link>

          {/* Navigation Items */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-500">
                Security Modules
              </span>
              <span className="text-[9px] font-mono text-zinc-600">4 Active</span>
            </div>
            <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center justify-between rounded-xl px-2.5 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-800/90 text-white shadow-sm border border-zinc-700/70 font-semibold'
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon
                        className={`h-4 w-4 transition ${
                          isActive
                            ? 'text-blue-400'
                            : 'text-zinc-500 group-hover:text-zinc-300'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold border ${
                          isActive
                            ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                            : 'bg-zinc-900 text-zinc-500 border-zinc-800 group-hover:text-zinc-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          {/* API Health Pill */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#090a0f] px-3 py-2 text-[11px]">
            <div className="flex items-center space-x-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-zinc-400 font-medium">{apiStatusLabel}</span>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">v1.2</span>
          </div>

          {/* Plan, credits & upgrade (live billing status; nothing is shown when it cannot be loaded) */}
          <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-3 text-xs space-y-2">
            {billing ? (
              <>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px]">Plan</span>
                  <span className="font-semibold text-zinc-200 font-mono uppercase">
                    {planLabel}
                    {billing.is_mock ? ' (mock)' : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-[11px]">Audit Credits</span>
                  <span className="font-semibold text-zinc-200 font-mono">
                    {billing.subscription_active ? 'Unlimited' : `${credits} Remaining`}
                  </span>
                </div>
                {!billing.can_run_full_scan && (
                  <p
                    className={`text-[11px] font-medium ${
                      billing.free_preview_available ? 'text-emerald-300' : 'text-amber-300'
                    }`}
                  >
                    {billing.free_preview_available
                      ? '1 free preview scan available'
                      : 'Free preview used — upgrade to scan'}
                  </p>
                )}
              </>
            ) : billingLoading ? (
              <p className="text-[11px] text-zinc-500">Loading plan…</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] text-amber-300">
                  Plan status unavailable
                  {billingError?.status ? ` (HTTP ${billingError.status})` : ''}.
                </p>
                <button
                  onClick={() => void refreshBilling()}
                  className="text-[11px] font-semibold text-zinc-300 underline underline-offset-2 hover:text-white"
                >
                  Retry
                </button>
              </div>
            )}
            <button
              onClick={openPaywall}
              className="mt-1 flex w-full items-center justify-center space-x-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500 active:scale-[0.98]"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Billing & Upgrades</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Top Navbar */}
        <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-[#0c0d15]/80 backdrop-blur-md px-4 sm:px-6 sticky top-0 z-30">
          <div className="flex items-center space-x-3 lg:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
              <span className="font-bold text-sm text-white">TrustCore</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-3 text-xs text-zinc-400">
            <span className="flex items-center font-mono text-[11px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-2 animate-pulse" />
              Engine 1: Deterministic Rules
            </span>
            <span className="text-zinc-600">•</span>
            <span className="flex items-center font-mono text-[11px]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 mr-2" />
              Engine 2: LLM Explainer
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <Link
              href="/"
              className="hidden md:flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
            >
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Free Tools</span>
            </Link>

            <button
              onClick={openPaywall}
              className="flex items-center space-x-1.5 rounded-lg border border-blue-500/30 bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-600/20 transition"
            >
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Stripe Billing</span>
            </button>

            {/* Account: Supabase Auth session (hidden when auth is not configured) */}
            {authConfigured && !authLoading && (
              user ? (
                <div className="flex items-center space-x-2">
                  <span
                    className="hidden md:inline max-w-[180px] truncate font-mono text-[11px] text-zinc-400"
                    title={user.email ?? undefined}
                  >
                    {user.email ?? 'Signed in'}
                  </span>
                  <button
                    onClick={() => void signOut()}
                    className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
                >
                  <LogIn className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Sign in</span>
                </Link>
              )
            )}
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-zinc-800 bg-[#0c0d15] p-4 lg:hidden space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-medium ${
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-blue-400" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400 font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Child Pages Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {/* Returned from Stripe Checkout: the plan is re-read from the API, never assumed */}
          {returnedFromCheckout && (
            <div
              role="status"
              className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-200"
            >
              {billing?.can_run_full_scan
                ? 'Payment confirmed. Full scans are unlocked.'
                : 'Checkout complete. Your plan updates as soon as Stripe confirms the payment — this can take a few seconds.'}
            </div>
          )}
          {children}
        </main>
      </div>

      {/* Global Stripe Checkout Modal */}
      <PaywallModal isOpen={isPaywallOpen} onClose={closePaywall} />

      {/* Floating A/B Testing Lab Drawer */}
      <ABExperimentBar />
    </div>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <AuthProvider>
      <BillingProvider>
        <ABExperimentProvider>
          <InnerAppShell>{children}</InnerAppShell>
        </ABExperimentProvider>
      </BillingProvider>
    </AuthProvider>
  );
}
