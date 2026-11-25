'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Menu, ShieldCheck, X } from 'lucide-react';
import { ContactLink } from '@/components/ContactLink';
import { useAuth } from '@/lib/auth';
import { LEGAL_ENTITY } from '@/lib/site';

interface MarketingShellProps {
  children: React.ReactNode;
}

interface NavLink {
  readonly label: string;
  readonly href: string;
}

const HEADER_LINKS: readonly NavLink[] = [
  { label: 'Products', href: '/#products' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'Security', href: '/security' },
];

const FOOTER_LINKS: readonly NavLink[] = [
  { label: 'Security', href: '/security' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

/**
 * Header and footer for the public marketing and legal pages (/, /sample,
 * /security, /privacy, /terms). These pages never render the app sidebar.
 */
export function MarketingShell({ children }: MarketingShellProps) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] font-sans text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-[#090a0f]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="group flex items-center space-x-2.5" onClick={() => setMenuOpen(false)}>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <span className="text-sm font-bold tracking-tight text-white transition group-hover:text-blue-400">
              TrustCore
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center space-x-7 md:flex">
            {HEADER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs font-medium text-zinc-400 transition hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center space-x-2">
            {!user && (
              <Link
                href="/login"
                className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:text-white sm:inline-block"
              >
                Sign in
              </Link>
            )}
            <Link
              href="/dashboard"
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow shadow-blue-500/20 transition hover:bg-blue-500"
            >
              <span>Open dashboard</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav aria-label="Mobile" className="space-y-1 border-t border-zinc-800 bg-[#0c0d15] px-4 py-3 md:hidden">
            {HEADER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            {!user && (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 hover:text-white"
              >
                Sign in
              </Link>
            )}
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800/80 bg-[#0c0d15]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-bold text-white">TrustCore</span>
            </div>
            <p className="text-xs text-zinc-500">
              Security and readiness checks for AI-built apps and agents. Operated by {LEGAL_ENTITY}.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="font-medium text-zinc-400 transition hover:text-white">
                {link.label}
              </Link>
            ))}
            <ContactLink
              label="Contact"
              className="font-medium text-zinc-400 transition hover:text-white"
              placeholderClassName="text-zinc-500"
            />
          </nav>
        </div>
      </footer>
    </div>
  );
}
