import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Ban,
  Check,
  CheckSquare,
  ClipboardCopy,
  Cpu,
  EyeOff,
  FileSearch,
  FileSpreadsheet,
  KeyRound,
  Rocket,
  ShieldCheck,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { PricingCards } from '@/components/PricingCards';
import { MOCK_REPORTS } from '@/lib/mockData';
import type { Severity } from '@/lib/types';

const HEADLINE =
  'Ship AI-Built Apps & Agents Without Leaking Keys, Breaking Rules, or Failing Security Reviews.';

const DESCRIPTION =
  'Deterministic security and readiness checks for AI-built apps and agents: leaked secrets, open Supabase/Firebase RLS, hallucinated packages, MCP permissions, security questionnaires and prompt-injection evals. Every finding cites its source.';

export const metadata: Metadata = {
  title: 'TrustCore — Security checks for AI-built apps and agents',
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    title: HEADLINE,
    description: DESCRIPTION,
    url: '/',
    siteName: 'TrustCore',
    type: 'website',
  },
};

interface ProductCard {
  readonly name: string;
  readonly kicker: string;
  readonly description: string;
  readonly checks: readonly string[];
  readonly href: string;
  readonly cta: string;
  readonly icon: LucideIcon;
  readonly iconClass: string;
  readonly linkClass: string;
}

const PRODUCTS: readonly ProductCard[] = [
  {
    name: 'LaunchGate',
    kicker: 'Pre-launch gate',
    description: 'Run it on the app you are about to ship, before anyone else finds what the AI left behind.',
    checks: ['Leaked secrets and API keys', 'Open Supabase / Firebase RLS', 'Hallucinated packages'],
    href: '/launchgate',
    cta: 'Open LaunchGate',
    icon: Rocket,
    iconClass: 'border-blue-500/25 bg-blue-500/10 text-blue-400',
    linkClass: 'text-blue-400 hover:text-blue-300',
  },
  {
    name: 'AgentScope',
    kicker: 'MCP / agent permission audit',
    description: 'Upload an MCP or agent config and see what the agent is actually allowed to touch.',
    checks: ['Wildcard scopes and broad mounts', 'Plaintext keys in config', 'Least-privilege diff'],
    href: '/agentscope',
    cta: 'Open AgentScope',
    icon: Cpu,
    iconClass: 'border-purple-500/25 bg-purple-500/10 text-purple-400',
    linkClass: 'text-purple-400 hover:text-purple-300',
  },
  {
    name: 'Evidence-to-Answer',
    kicker: 'Security questionnaires',
    description: 'Answer a security questionnaire from your own policy documents instead of from memory.',
    checks: ['Answers with exact citations', 'Unsupported questions flagged as gaps', 'Evidence and gap matrix'],
    href: '/evidence',
    cta: 'Open Evidence-to-Answer',
    icon: FileSpreadsheet,
    iconClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400',
    linkClass: 'text-emerald-400 hover:text-emerald-300',
  },
  {
    name: 'EvalKit',
    kicker: 'Prompt-injection and regression evals',
    description: 'Test a system prompt against adversarial inputs and catch regressions between versions.',
    checks: ['Prompt-injection and jailbreak cases', 'Canary-leak and tool-hijack checks', 'Regression evals'],
    href: '/evalkit',
    cta: 'Open EvalKit',
    icon: CheckSquare,
    iconClass: 'border-amber-500/25 bg-amber-500/10 text-amber-400',
    linkClass: 'text-amber-400 hover:text-amber-300',
  },
];

interface EnginePoint {
  readonly name: string;
  readonly body: string;
}

/** The Dual-Engine value proposition stated in the hero; keep it in sync with /security. */
const DUAL_ENGINE: readonly EnginePoint[] = [
  {
    name: 'Deterministic Rule Engine',
    body: 'Produces every finding and the readiness score. Each finding cites its file, line and rule.',
  },
  {
    name: 'AI Remediation Prompts',
    body: 'Turn those findings into copy-paste fixes for your AI editor.',
  },
  {
    name: 'Zero-Retention Mode',
    body: 'Switch it on and the scan runs in memory and stores nothing.',
  },
];

interface Step {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
}

const STEPS: readonly Step[] = [
  {
    title: 'Upload, or point at a public GitHub repo',
    body: 'Drop a ZIP export or individual files, paste a snippet, or enter a public GitHub repository URL. Files are parsed in memory.',
    icon: UploadCloud,
  },
  {
    title: 'Deterministic rules produce cited findings',
    body: 'Findings, severities and the readiness score come from deterministic rules. Each finding cites the file, the line and the rule behind it.',
    icon: FileSearch,
  },
  {
    title: 'Copy-paste fix prompts',
    body: 'The full report includes fix prompts written for Cursor, Lovable, Claude Code and the terminal. Paste one in, apply the fix, scan again.',
    icon: ClipboardCopy,
  },
];

interface TrustPoint {
  readonly title: string;
  readonly body: string;
  readonly icon: LucideIcon;
}

/** Each statement is taken from /security; keep the two in sync. */
const TRUST_POINTS: readonly TrustPoint[] = [
  {
    title: 'Parsed in memory',
    body: 'Uploads and GitHub archives are never written to disk or stored.',
    icon: EyeOff,
  },
  {
    title: 'Zero-Retention Mode',
    body: 'The scan runs in memory and the report is returned but never stored.',
    icon: ShieldCheck,
  },
  {
    title: 'Secrets masked',
    body: 'Detected credentials are masked before a report is returned, stored or sent to the AI layer.',
    icon: KeyRound,
  },
  {
    title: 'No model training',
    body: 'Your code, uploads and reports are not used to train models.',
    icon: Ban,
  },
];

const SEVERITY_CHIP: Record<Severity, string> = {
  CRITICAL: 'border-red-500/40 bg-red-500/10 text-red-300',
  HIGH: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
  MEDIUM: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
  LOW: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  INFO: 'border-zinc-700 bg-zinc-800 text-zinc-300',
};

// The hero excerpt is built from the bundled sample report, so it always matches /sample's built-in data.
const EXCERPT_REPORT = MOCK_REPORTS.launchgate;
const EXCERPT_FINDINGS = EXCERPT_REPORT.findings.slice(0, 3);
const EXCERPT_PROMPT = EXCERPT_REPORT.remediation_prompts[0];
const EXCERPT_PROMPT_LINES = EXCERPT_PROMPT
  ? EXCERPT_PROMPT.prompt_text
      .split('\n')
      .filter((line) => line.trim() !== '')
      .slice(0, 4)
  : [];

function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-400">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{title}</h2>
      {children && <p className="mt-3 text-sm leading-relaxed text-zinc-400 sm:text-base">{children}</p>}
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-800/80">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-grid-mesh [mask-image:radial-gradient(ellipse_at_top,black_15%,transparent_70%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-56 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-blue-600/[0.13] blur-3xl"
        />

        <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-12 lg:gap-12 lg:py-24">
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 font-mono text-[11px] text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Deterministic checks for AI-built software
            </p>

            <h1 className="mt-5 text-[2rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl sm:leading-[1.08] lg:text-[3.2rem]">
              {HEADLINE}
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-400">
              TrustCore is a Dual-Engine scanner for what your AI tools generated and what your agents are
              allowed to do.
            </p>

            <dl className="mt-5 max-w-xl space-y-3">
              {DUAL_ENGINE.map((point) => (
                <div key={point.name} className="border-l-2 border-blue-500/40 pl-3">
                  <dt className="text-sm font-semibold text-zinc-100">{point.name}</dt>
                  <dd className="mt-0.5 text-sm leading-relaxed text-zinc-400">{point.body}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/launchgate"
                className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
              >
                <span>Run Free Preview Scan</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/70 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
              >
                Open Workspace
              </Link>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-zinc-500">
              Your first preview scan is free: overall score plus the top 2 findings. Not ready to upload?{' '}
              <Link
                href="/sample"
                className="font-semibold text-zinc-300 underline underline-offset-2 transition hover:text-white"
              >
                See a sample report
              </Link>
              .
            </p>
          </div>

          {/* Report excerpt, built from the bundled sample report and labelled as such */}
          <figure className="lg:col-span-5">
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0d15] shadow-2xl shadow-black/50">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 px-4 py-2.5">
                <span className="font-mono text-[11px] text-zinc-400">launchgate · sample audit</span>
                <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                  Demo app — not your code
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Readiness score
                  </p>
                  <p className="mt-0.5 font-mono text-2xl font-extrabold text-red-400">
                    {EXCERPT_REPORT.summary.risk_score}
                    <span className="text-sm text-zinc-500">/100</span>
                  </p>
                </div>
                <span className="rounded border border-red-500/30 bg-red-500/15 px-2 py-0.5 font-mono text-xs font-extrabold text-red-400">
                  {EXCERPT_REPORT.summary.readiness_status}
                </span>
              </div>

              <ul className="divide-y divide-zinc-800/70">
                {EXCERPT_FINDINGS.map((finding) => (
                  <li key={finding.id} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${SEVERITY_CHIP[finding.severity]}`}
                      >
                        {finding.severity}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">{finding.rule_id}</span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold leading-snug text-zinc-100">{finding.title}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-blue-300">
                      {finding.citation.file_path}
                      {finding.citation.line_start ? `:${finding.citation.line_start}` : ''}
                    </p>
                  </li>
                ))}
              </ul>

              {EXCERPT_PROMPT_LINES.length > 0 && (
                <div className="border-t border-zinc-800 px-4 py-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                    Fix prompt · paste into your AI editor
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-[#090a0f] p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {EXCERPT_PROMPT_LINES.join('\n')}
                  </pre>
                </div>
              )}
            </div>
            <figcaption className="mt-3 text-[11px] text-zinc-500">
              Excerpt from the sample report for a bundled demo app.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="scroll-mt-16 border-b border-zinc-800/80">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Products" title="Four tools, one way of working">
            Each tool takes your files, runs deterministic rules over them and returns a report you can check line
            by line.
          </SectionHeading>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            {PRODUCTS.map((product, index) => {
              const Icon = product.icon;
              return (
                <Link
                  key={product.href}
                  href={product.href}
                  className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-[#10111a] p-6 transition hover:border-zinc-700 hover:bg-[#131524]"
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${product.iconClass}`}
                        >
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <h3 className="text-base font-bold text-white">{product.name}</h3>
                          <p className="font-mono text-[11px] text-zinc-500">{product.kicker}</p>
                        </div>
                      </div>
                      <span aria-hidden className="font-mono text-xs text-zinc-700">
                        0{index + 1}
                      </span>
                    </div>

                    <p className="mt-4 text-sm leading-relaxed text-zinc-400">{product.description}</p>

                    <ul className="mt-4 space-y-2 text-xs text-zinc-300">
                      {product.checks.map((check) => (
                        <li key={check} className="flex items-start">
                          <Check className="mr-2 mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <span
                    className={`mt-6 inline-flex items-center space-x-1.5 text-xs font-semibold transition ${product.linkClass}`}
                  >
                    <span>{product.cta}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-16 border-b border-zinc-800/80 bg-[#0b0c13]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="How it works" title="From upload to fix in three steps" />

          <ol className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="border-t border-zinc-800 pt-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-blue-400">0{index + 1}</span>
                    <Icon className="h-4 w-4 text-zinc-600" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{step.body}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-16 border-b border-zinc-800/80">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading eyebrow="Pricing" title="Start free. Pay when you want the full report." />

          <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="max-w-2xl">
              <p className="text-sm font-bold text-emerald-200">Your first preview scan is free.</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                It includes the overall score and the top 2 findings. The full report, with every finding, exact
                citations, fix prompts and exports, comes with Per-Scan, Pro Monthly or Enterprise.
              </p>
            </div>
            <Link
              href="/launchgate"
              className="flex shrink-0 items-center justify-center space-x-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <span>Run Free Preview Scan</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-6">
            <PricingCards />
          </div>

          <p className="mt-5 text-xs leading-relaxed text-zinc-500">
            Payments are processed by Stripe; card details never reach TrustCore. Buying a plan requires signing
            in. Rate limits apply to all plans.
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-zinc-800/80 bg-[#0b0c13]">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <SectionHeading eyebrow="Your code" title="How TrustCore handles your code" />
            <Link
              href="/security"
              className="inline-flex items-center space-x-1.5 text-sm font-semibold text-blue-400 transition hover:text-blue-300"
            >
              <span>Read the full security page</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-800 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_POINTS.map((point) => {
              const Icon = point.icon;
              return (
                <div key={point.title} className="bg-[#10111a] p-5">
                  <Icon className="h-5 w-5 text-emerald-400" />
                  <h3 className="mt-3 text-sm font-bold text-white">{point.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{point.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section>
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#121422] to-[#0a0b12] p-8 text-center sm:p-12">
            <h2 className="mx-auto max-w-2xl text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Run your first preview scan free
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              The preview shows your overall score and the top 2 findings. Switch on Zero-Retention Mode and the
              scan runs in memory and stores nothing.
            </p>
            <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Link
                href="/launchgate"
                className="flex items-center justify-center space-x-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-500"
              >
                <span>Run Free Preview Scan</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/70 px-6 py-3 text-sm font-semibold text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
              >
                Open Workspace
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
