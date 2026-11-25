'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckSquare, Cpu, FileSpreadsheet, FlaskConical, Rocket, type LucideIcon } from 'lucide-react';
import { ReportBody } from '@/components/ReportBody';
import { track } from '@/lib/analytics';
import { getBuiltInSampleReport, getSampleReport, isMockEnabled } from '@/lib/api';
import { isPreviewReport, type ProductType, type Report } from '@/lib/types';

interface SampleProduct {
  readonly id: ProductType;
  readonly name: string;
  readonly summary: string;
  readonly icon: LucideIcon;
}

const SAMPLE_PRODUCTS: readonly SampleProduct[] = [
  { id: 'launchgate', name: 'LaunchGate', summary: 'Pre-launch gate', icon: Rocket },
  { id: 'agentscope', name: 'AgentScope', summary: 'Agent permissions', icon: Cpu },
  { id: 'evidence', name: 'Evidence-to-Answer', summary: 'Questionnaires', icon: FileSpreadsheet },
  { id: 'evalkit', name: 'EvalKit', summary: 'Injection evals', icon: CheckSquare },
];

/** `engine`: produced by the API's rule engine. `built_in`: the sample report bundled with this app. */
type SampleOrigin = 'engine' | 'built_in';

interface LoadedSample {
  readonly report: Report;
  readonly origin: SampleOrigin;
}

type LoadedSamples = Partial<Record<ProductType, LoadedSample>>;

/**
 * The sample report for a product. It is sample data either way, so a failed or
 * slow request falls back to the built-in report and the page always renders.
 */
async function loadSample(product: ProductType): Promise<LoadedSample> {
  if (isMockEnabled()) {
    return { report: getBuiltInSampleReport(product), origin: 'built_in' };
  }
  try {
    const report = await getSampleReport(product);
    if (isPreviewReport(report)) {
      // The sample is always a full report; anything else counts as a failed load.
      throw new Error('The sample report was not a full report.');
    }
    return { report, origin: 'engine' };
  } catch (err) {
    console.warn('[TrustCore] Live sample report unavailable; showing the built-in sample.', err);
    return { report: getBuiltInSampleReport(product), origin: 'built_in' };
  }
}

function originNote(sample: LoadedSample | null): string {
  if (sample === null) {
    return 'Loading the sample report…';
  }
  if (sample.origin === 'engine') {
    return 'Produced by the TrustCore rule engine from the demo app’s files. Nothing here came from you.';
  }
  return isMockEnabled()
    ? 'Built-in sample report (this build runs in mock mode). Nothing here came from you.'
    : 'The live sample did not load, so this is the built-in sample report. Nothing here came from you.';
}

export function SampleAudit() {
  const [product, setProduct] = useState<ProductType>('launchgate');
  const [samples, setSamples] = useState<LoadedSamples>({});
  const current = samples[product] ?? null;
  const alreadyLoaded = current !== null;

  useEffect(() => {
    if (alreadyLoaded) {
      return;
    }
    let active = true;
    void loadSample(product).then((sample) => {
      if (!active) {
        return;
      }
      setSamples((prev) => ({ ...prev, [product]: sample }));
      track('sample_loaded', { product, source: 'sample_page' });
    });
    return () => {
      active = false;
    };
  }, [product, alreadyLoaded]);

  const selected = SAMPLE_PRODUCTS.find((item) => item.id === product) ?? SAMPLE_PRODUCTS[0];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="max-w-3xl space-y-3">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-400">
          Live sample audit · no login
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          See a full TrustCore report before you upload anything
        </h1>
        <p className="text-sm leading-relaxed text-zinc-400 sm:text-base">
          This is the report you get for your own code: a readiness score, findings that cite the file, line and
          rule, and fix prompts you can paste into your AI editor. Switch between the four tools below.
        </p>
      </header>

      {/* Always-visible label: this is sample data, whichever source it came from */}
      <div
        role="note"
        className="sticky top-14 z-20 flex items-start gap-3 rounded-xl border border-amber-500/40 bg-[#1b160b]/95 px-4 py-3 backdrop-blur"
      >
        <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div className="min-w-0">
          <p className="text-sm font-bold text-amber-200">Sample audit of a bundled demo app — not your code</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">{originNote(current)}</p>
        </div>
      </div>

      {/* Product switcher */}
      <div role="tablist" aria-label="Sample audit product" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SAMPLE_PRODUCTS.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === product;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setProduct(item.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                isActive
                  ? 'border-blue-500/60 bg-blue-500/10 text-white'
                  : 'border-zinc-800 bg-[#10111a] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-zinc-500'}`} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{item.name}</span>
                <span className="block truncate font-mono text-[10px] text-zinc-500">{item.summary}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Report */}
      {current === null ? (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">Loading the sample report…</span>
          <div className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-[#10111a]" />
          <div className="h-28 animate-pulse rounded-xl border border-zinc-800 bg-[#10111a]" />
          <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-[#10111a]" />
        </div>
      ) : (
        <div role="tabpanel" className="space-y-8">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold uppercase tracking-wider text-blue-400">{selected.name}</span>
              <span className="text-zinc-600">•</span>
              <span className="font-mono text-zinc-500">
                {current.report.summary.total_findings} finding
                {current.report.summary.total_findings === 1 ? '' : 's'} in the demo app
              </span>
            </div>
            <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">{current.report.title}</h2>
          </div>

          {/* Keyed by product so the findings filter and citation drawer reset on switch */}
          <ReportBody key={product} report={current.report} />
        </div>
      )}

      {/* Next step: scan their own code */}
      <section className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#121422] to-[#0a0b12] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Now run it on your own repo
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Upload a ZIP export or point LaunchGate at a public GitHub repository. Your first preview scan is
              free: it shows the overall score and the top 2 findings.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/launchgate"
              className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-500"
            >
              <span>Scan my repo</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            {product !== 'launchgate' && (
              <Link
                href={`/${product}`}
                className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/80 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
              >
                Open {selected.name}
              </Link>
            )}
            <Link
              href="/#pricing"
              className="flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
