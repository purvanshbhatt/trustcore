'use client';

import React from 'react';
import Link from 'next/link';
import {
  Rocket,
  Cpu,
  FileSpreadsheet,
  CheckSquare,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCode,
  Zap,
  Lock,
  Sparkles,
  Layers,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { SecurityGauge } from '@/components/SecurityGauge';
import { IllustrativeExample } from '@/components/DemoNotice';

// Read the flag directly so the hub does not pull the API client into its bundle.
const isMockEnabled = (): boolean => process.env.NEXT_PUBLIC_USE_MOCK === 'true';
import { FreeToolsSection } from '@/components/FreeToolsSection';
import { useABExperiment } from '@/lib/abTesting';

export default function OverviewHubPage() {
  const { ctaVariant, trackCtaClick } = useABExperiment();

  const tools = [
    {
      id: 'launchgate',
      title: 'LaunchGate',
      category: 'Pre-Launch Security Gate',
      tagline: 'Cursor, Lovable & Replit App Gate',
      description:
        'Detect hardcoded secrets, open Supabase/Firebase RLS policies, and hallucinated npm/pip packages before going live.',
      href: '/launchgate',
      icon: Rocket,
      badge: 'Engine 1 AST/Regex',
      color: 'from-blue-600 to-cyan-600',
      sampleRisk: 'Score 35/100 (Blocked)',
      status: 'BLOCKED',
      findingsCount: 4,
    },
    {
      id: 'agentscope',
      title: 'AgentScope',
      category: 'MCP & Permissions Auditor',
      tagline: 'Agent Tool & Scope Blast Radius Limiter',
      description:
        'Audit MCP configs (Claude Desktop, custom agents) for wildcard permissions, plaintext keys, and generate least-privilege diffs.',
      href: '/agentscope',
      icon: Cpu,
      badge: 'Least-Privilege Diff',
      color: 'from-purple-600 to-indigo-600',
      sampleRisk: 'Score 42/100 (Blocked)',
      status: 'BLOCKED',
      findingsCount: 3,
    },
    {
      id: 'evidence',
      title: 'Evidence-to-Answer',
      category: 'Security Questionnaires',
      tagline: 'Zero-Hallucination SOC 2 Workbench',
      description:
        'Map questionnaires against policy and SOC 2 documents. Automatically source citations for verified answers and explicitly flag gaps.',
      href: '/evidence',
      icon: FileSpreadsheet,
      badge: 'Zero-Hallucination Gaps',
      color: 'from-emerald-600 to-teal-600',
      sampleRisk: 'Score 70/100 (Warning)',
      status: 'WARNING',
      findingsCount: 2,
    },
    {
      id: 'evalkit',
      title: 'EvalKit',
      category: 'Evals & Prompt Injections',
      tagline: 'Workflow Regression & Injection Runner',
      description:
        'Run deterministic test cases and adversarial prompt injections (canary leaks, jailbreaks, tool hijacks) with client acceptance reports.',
      href: '/evalkit',
      icon: CheckSquare,
      badge: 'Canary Exfil Test',
      color: 'from-amber-600 to-orange-600',
      sampleRisk: 'Score 45/100 (Blocked)',
      status: 'BLOCKED',
      findingsCount: 3,
    },
  ];

  // A/B CTA experiment mapping
  const getHeroCta = () => {
    switch (ctaVariant) {
      case 'variant_a_speed':
        return {
          label: 'Run 60-Second AI Security Scan',
          href: '/launchgate',
          sub: 'Free instant heuristic check',
        };
      case 'variant_b_mcp':
        return {
          label: 'Audit Agent MCP Permissions & Blast Radius',
          href: '/agentscope',
          sub: 'Generates least-privilege diff',
        };
      case 'variant_c_soc2':
      default:
        return {
          label: 'Map SOC 2 Evidence & Solve Questionnaires',
          href: '/evidence',
          sub: 'Zero hallucination gap flags',
        };
    }
  };

  const heroCta = getHeroCta();

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Header with Dual-Engine Gauge & Visual Hierarchy */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#121422] to-[#0a0b12] p-6 sm:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-8 space-y-4">
            <div className="inline-flex items-center space-x-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400">
              <ShieldCheck className="h-4 w-4" />
              <span>TrustCore Dual-Engine Standard</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Enterprise AI Security & Readiness Monorepo
            </h1>

            <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-2xl">
              One deterministic rule engine, one unified frontend shell, and one Stripe billing layer powering four essential AI readiness tools.
              Every finding is computed deterministically in code—LLMs exclusively translate verified proof into plain-English remediation prompts.
            </p>

            {/* Dynamic A/B CTA Button */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Link
                href={heroCta.href}
                onClick={() => trackCtaClick(ctaVariant)}
                className="flex items-center space-x-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition active:scale-[0.98]"
              >
                <span>{heroCta.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/reports/rpt_lg_demo_7721"
                className="flex items-center space-x-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-750 transition"
              >
                <FileCode className="h-4 w-4 text-zinc-400" />
                <span>View Sample Audit Report</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Posture Gauge */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40">
            {/* Fixed sample score: in live mode it is labelled so it cannot pass for the visitor's posture */}
            {isMockEnabled() ? (
              <SecurityGauge score={42} label="Monorepo Aggregate AI Readiness Posture" size="md" />
            ) : (
              <IllustrativeExample>
                <SecurityGauge score={42} label="Sample AI Readiness Posture" size="md" />
              </IllustrativeExample>
            )}
          </div>
        </div>

        {/* Dual-Engine Architecture Blueprint */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-zinc-800/80">
          <div className="flex items-start space-x-3.5 rounded-xl border border-zinc-800/80 bg-[#090a0f] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">
                Engine 1: Deterministic Rule Engine
              </span>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                100% computed in Python. Regex patterns, AST parsing, permissions matrix computation, and exact source citations (<code className="text-zinc-300 font-mono">file</code>, <code className="text-zinc-300 font-mono">line</code>, <code className="text-zinc-300 font-mono">rule_id</code>). Zero fabricated compliance findings.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5 rounded-xl border border-zinc-800/80 bg-[#090a0f] p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
                Engine 2: LLM Explanation Layer
              </span>
              <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                Translates verified deterministic evidence into plain-English executive summaries and one-click copy-paste remediation prompts formatted for Cursor, Lovable, Claude, and Terminal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Readiness Status Bar (fixed sample figures; labelled in live mode) */}
      <div className="space-y-2">
      {!isMockEnabled() && (
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-amber-300">
          Illustrative example — not your data
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
            Suite Modules
          </span>
          <p className="mt-1 text-2xl font-extrabold text-zinc-100 font-mono">4 Active</p>
          <span className="text-[10px] text-emerald-400 font-medium">Shared Python Core</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
            Pre-Launch Gate
          </span>
          <p className="mt-1 text-2xl font-extrabold text-red-400 font-mono">Blocked</p>
          <span className="text-[10px] text-zinc-400">2 Critical Leaks Detected</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
            MCP Blast Radius
          </span>
          <p className="mt-1 text-2xl font-extrabold text-purple-400 font-mono">-78%</p>
          <span className="text-[10px] text-zinc-400">Scoped Diff Ready</span>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
            Questionnaire Gaps
          </span>
          <p className="mt-1 text-2xl font-extrabold text-amber-400 font-mono">2 Gaps</p>
          <span className="text-[10px] text-zinc-400">Zero Hallucinations</span>
        </div>
      </div>
      </div>

      {/* Product Modules Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Modular AI Readiness Applications
            </h2>
            <p className="text-xs text-zinc-400">
              Select an auditor to inspect code, agent permissions, SOC 2 documents, or test harnesses.
            </p>
          </div>
          <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
            FastAPI Endpoints Live
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#11121c] p-5 transition-all hover:border-zinc-700 hover:bg-[#131524] shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400 group-hover:scale-105 transition">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                          {t.title}
                        </h3>
                        <span className="text-[11px] text-zinc-400 font-mono">{t.tagline}</span>
                      </div>
                    </div>

                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono font-semibold text-zinc-400 border border-zinc-700/60">
                      {t.badge}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-zinc-800/80">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        t.status === 'BLOCKED' ? 'bg-red-500' : 'bg-amber-500'
                      }`}
                    />
                    <span className="text-[11px] font-mono text-zinc-300">
                      {isMockEnabled() ? t.sampleRisk : `Sample result: ${t.sampleRisk}`}
                    </span>
                  </div>

                  <Link
                    href={t.href}
                    className="flex items-center space-x-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
                  >
                    <span>Launch Auditor</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Embedded Free Tools & Lead Magnets Shelf */}
      <FreeToolsSection />

      {/* Demo Report Quick Jump */}
      <div className="rounded-xl border border-zinc-800 bg-[#0e0f17] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <FileCode className="h-4 w-4 text-blue-400" />
              <h3 className="text-sm font-bold text-zinc-200">
                Interactive Source-Cited Report Viewer & JSON/Print Export
              </h3>
            </div>
            <p className="text-xs text-zinc-400 max-w-2xl">
              Inspect an end-to-end report generated by the Dual-Engine pipeline. Features exact line-level source code snippets, Engine 2 executive summaries, and multi-format exports.
            </p>
          </div>

          <Link
            href="/reports/rpt_lg_demo_7721"
            className="flex shrink-0 items-center space-x-1.5 rounded-lg bg-zinc-800 border border-zinc-700/80 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition"
          >
            <span>Open Sample Report</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
