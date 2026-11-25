import React from 'react';
import { LEGAL_LAST_UPDATED } from '@/lib/site';

interface LegalPageProps {
  eyebrow: string;
  title: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}

/** Shared layout for /security, /privacy and /terms. */
export function LegalPage({ eyebrow, title, intro, children }: LegalPageProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="border-b border-zinc-800 pb-8">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-400">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{title}</h1>
        <div className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">{intro}</div>
        <p className="mt-5 font-mono text-xs text-zinc-500">Last updated: {LEGAL_LAST_UPDATED}</p>
      </header>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

interface LegalSectionProps {
  title: string;
  id?: string;
  children: React.ReactNode;
}

export function LegalSection({ title, id, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  );
}

interface Subprocessor {
  readonly name: string;
  readonly purpose: string;
}

const SUBPROCESSORS: readonly Subprocessor[] = [
  { name: 'Supabase', purpose: 'Sign-in and database.' },
  { name: 'Stripe', purpose: 'Payments. Card details never reach TrustCore.' },
  { name: 'Google Cloud Run', purpose: 'API hosting.' },
  { name: 'Vercel', purpose: 'Web hosting.' },
  {
    name: 'Plausible',
    purpose: 'Cookieless analytics: page views and four product events, no personal data.',
  },
  { name: 'Google Gemini API', purpose: 'Optional explanations, from redacted findings only.' },
];

/** The subprocessor list shown on /security and /privacy. */
export function SubprocessorList() {
  return (
    <dl className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-[#10111a]">
      {SUBPROCESSORS.map((item) => (
        <div key={item.name} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-3 sm:gap-4">
          <dt className="font-mono text-xs font-semibold text-zinc-100">{item.name}</dt>
          <dd className="text-xs leading-relaxed text-zinc-400 sm:col-span-2">{item.purpose}</dd>
        </div>
      ))}
    </dl>
  );
}
