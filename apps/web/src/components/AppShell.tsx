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
  Sun,
  Moon,
  Menu,
  X,
  ExternalLink,
  Activity,
  Layers,
} from 'lucide-react';
import { PaywallModal } from '@/components/PaywallModal';
import { checkApiHealth, getBillingStatus } from '@/lib/api';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const [billingTier, setBillingTier] = useState('pro_monthly');
  const [credits, setCredits] = useState(15);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const isOnline = await checkApiHealth();
      setApiOnline(isOnline);
      const bStatus = await getBillingStatus();
      setBillingTier(bStatus.tier);
      setCredits(bStatus.credits_remaining);
    }
    init();
  }, []);

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
      description: 'Permissions matrix & least-privilege diffs',
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

  return (
    <div className="flex min-h-screen bg-[#090a0f] text-zinc-100 font-sans">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex w-64 flex-col justify-between border-r border-zinc-800/80 bg-[#0c0d14] p-4 shrink-0">
        <div className="space-y-6">
          {/* Brand */}
          <Link href="/" className="flex items-center space-x-2.5 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-bold text-sm tracking-tight text-white">TrustCore</span>
                <span className="rounded bg-blue-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-blue-400">
                  DUAL-ENGINE
                </span>
              </div>
              <p className="text-[10px] text-zinc-500">AI Security & Readiness</p>
            </div>
          </Link>

          {/* Navigation */}
          <div className="space-y-1">
            <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Suite Modules
            </span>
            <nav className="mt-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                      isActive
                        ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/60'
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <Icon
                        className={`h-4 w-4 transition ${
                          isActive ? 'text-blue-400' : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400 group-hover:text-zinc-300">
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
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-2 text-[11px]">
            <div className="flex items-center space-x-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  apiOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className="text-zinc-400">
                {apiOnline ? 'FastAPI Core Online' : 'Mock Billing / Local Mode'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-zinc-500">v1.0</span>
          </div>

          {/* Credits & Upgrade */}
          <div className="rounded-lg border border-zinc-800 bg-[#101119] p-3 text-xs">
            <div className="flex items-center justify-between text-zinc-400">
              <span>Scan Credits</span>
              <span className="font-semibold text-zinc-200">{credits} Remaining</span>
            </div>
            <button
              onClick={() => setIsPaywallOpen(true)}
              className="mt-2.5 flex w-full items-center justify-center space-x-1.5 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500"
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
        <header className="flex h-14 items-center justify-between border-b border-zinc-800/80 bg-[#0c0d14]/80 backdrop-blur-md px-4 sm:px-6 sticky top-0 z-30">
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
            <span className="flex items-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-2" />
              Engine 1: Deterministic Rules Active
            </span>
            <span>•</span>
            <span className="flex items-center">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-400 mr-2" />
              Engine 2: LLM Explainer Active
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsPaywallOpen(true)}
              className="flex items-center space-x-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
            >
              <CreditCard className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Stripe Billing</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-zinc-800 bg-[#0c0d14] p-4 lg:hidden space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium ${
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4 text-blue-400" />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] text-zinc-400">
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
          {children}
        </main>
      </div>

      {/* Global Stripe Checkout Modal */}
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        currentTier={billingTier}
        creditsRemaining={credits}
      />
    </div>
  );
}
