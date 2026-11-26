import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'TrustCore — Shared AI Security & Readiness Monorepo',
  description:
    'Modular AI security and readiness suite powered by a Dual-Engine architecture (Deterministic Rules + LLM Explainer Layer).',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090a0f] text-zinc-100 antialiased selection:bg-blue-500/30 selection:text-white">
        {/* Product analytics loads no script: src/lib/analytics.ts posts events straight to PostHog. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
