import type { Metadata } from 'next';
import './globals.css';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
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
      </body>
    </html>
  );
}
