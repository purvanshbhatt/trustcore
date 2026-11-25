import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { AppShell } from '@/components/AppShell';
import { PLAUSIBLE_DOMAIN, PLAUSIBLE_SCRIPT_URL } from '@/lib/analytics';
import { SITE_URL } from '@/lib/site';

/** Queues events fired before the Plausible script has loaded, so they are not lost. */
const PLAUSIBLE_QUEUE_STUB =
  'window.plausible = window.plausible || function(){ (window.plausible.q = window.plausible.q || []).push(arguments) }';

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
        <AppShell>{children}</AppShell>
        {/* Cookieless analytics: loaded only when NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL is set */}
        {PLAUSIBLE_SCRIPT_URL !== '' && (
          <>
            <Script id="plausible-queue" strategy="afterInteractive">
              {PLAUSIBLE_QUEUE_STUB}
            </Script>
            <Script
              src={PLAUSIBLE_SCRIPT_URL}
              strategy="afterInteractive"
              data-domain={PLAUSIBLE_DOMAIN !== '' ? PLAUSIBLE_DOMAIN : undefined}
            />
          </>
        )}
      </body>
    </html>
  );
}
