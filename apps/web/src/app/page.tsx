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
} from 'lucide-react';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function OverviewHubPage() {
  const tools = [
    {
      id: 'launchgate',
      title: 'LaunchGate',
      category: 'Pre-Launch Security Gate',
      tagline: 'Cursor, Lovable & Replit App Auditor',
      description:
        'Detect hardcoded secrets, open Supabase/Firebase RLS policies, and hallucinated npm/pip packages before going live.',
      href: '/launchgate',
      icon: Rocket,
      badge: 'Engine 1 AST/Regex',
      color: 'from-blue-600 to-cyan-600',
      sampleRisk: 'Score 35/100 (Blocked)',
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
      findingsCount: 3,
    },
    {
      id: 'evidence',
      title: 'Evidence-to-Answer',
      category: 'Security Questionnaires',
      tagline: 'Zero-Hallucination SOC 2 Workbench',
      description:
        'Map questionnaires against policy and SOC 2 documents. Automatically citations-source verified answers and explicitly flag unsupported gaps.',
      href: '/evidence',
      icon: FileSpreadsheet,
      badge: 'Zero-Hallucination Gap Flag',
      color: 'from-emerald-600 to-teal-600',
      sampleRisk: 'Score 70/100 (Warning)',
      findingsCount: 2,
    },
    {
      id: 'evalkit',
      title: 'EvalKit',
      category: 'Evals & Prompt Injections',
      tagline: 'Workflow Regression & Injection Runner',
      description:
        'Run deterministic test cases and adversarial prompt injections (jailbreaks, canary leaks, tool hijacks) with client acceptance reports.',
      href: '/evalkit',
      icon: CheckSquare,
      badge: 'Canary Exfil Test',
      color: 'from-amber-600 to-orange-600',
      sampleRisk: 'Score 45/100 (Blocked)',
      findingsCount: 3,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#11131f] to-[#0a0b10] p-6 sm:p-8">
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Dual-Engine AI Security & Readiness Standard</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            TrustCore Security & Readiness Monorepo
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            One deterministic core engine, one unified frontend shell, and one Stripe billing layer powering four essential AI readiness tools.
            All findings are computed deterministically in code—LLMs are exclusively used to translate verified proof into plain-English remediation prompts.
          </p>
        </div>

        {/* Dual Engine Architecture Visualizer */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 pt-6 border-t border-zinc-800/80">
          <div className="flex items-start space-x-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Engine 1: Deterministic Rule Engine
              </span>
              <p className="mt-1 text-xs text-zinc-400">
                100% computed in code. Regex patterns, AST parsing, permission matrix computation, and exact source citations (<code className="text-zinc-300">file</code>, <code className="text-zinc-300">line</code>, <code className="text-zinc-300">rule_id</code>). Zero fabricated compliance findings.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                Engine 2: LLM Explanation Layer
              </span>
              <p className="mt-1 text-xs text-zinc-400">
                Translates verified deterministic evidence into plain-English executive summaries and one-click copy-paste remediation prompts formatted for Cursor, Lovable, Claude, and Terminal.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Readiness Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
          <span className="text-[11px] text-zinc-500 font-medium uppercase">Suite Products</span>
          <p className="mt-1 text-2xl font-bold text-zinc-100">4 Active</p>
          <span className="text-[10px] text-emerald-400">Shared Python Core</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
          <span className="text-[11px] text-zinc-500 font-medium uppercase">Pre-Launch Gate</span>
          <p className="mt-1 text-2xl font-bold text-red-400">Blocked</p>
          <span className="text-[10px] text-zinc-400">2 Critical Leaks</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
          <span className="text-[11px] text-zinc-500 font-medium uppercase">MCP Blast Radius</span>
          <p className="mt-1 text-2xl font-bold text-purple-400">-78%</p>
          <span className="text-[10px] text-zinc-400">Scoped Diff Ready</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
          <span className="text-[11px] text-zinc-500 font-medium uppercase">Questionnaire Gaps</span>
          <p className="mt-1 text-2xl font-bold text-amber-400">2 Gaps</p>
          <span className="text-[10px] text-zinc-400">Zero Hallucinations</span>
        </div>
      </div>

      {/* Product Modules Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-200">
            Modular AI Readiness Applications
          </h2>
          <span className="text-xs text-zinc-500">Select a tool to launch an audit</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((t) => {
            const Icon = t.icon;
            return (
              <div
                key={t.id}
                className="group relative flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#11121a] p-5 transition-all hover:border-zinc-700 hover:bg-[#131522]"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-blue-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition">
                          {t.title}
                        </h3>
                        <span className="text-[11px] text-zinc-500">{t.tagline}</span>
                      </div>
                    </div>
                    <span className="rounded bg-zinc-800/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 border border-zinc-700/50">
                      {t.badge}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
                    {t.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-zinc-800/60">
                  <span className="text-[11px] font-mono text-zinc-400">
                    {t.sampleRisk}
                  </span>
                  <Link
                    href={t.href}
                    className="flex items-center space-x-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
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

      {/* Demo Report Quick Jump */}
      <div className="rounded-xl border border-zinc-800 bg-[#0e0f16] p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              Interactive Report Viewer & Source Citations
            </h3>
            <p className="mt-1 text-xs text-zinc-400">
              Explore a completed end-to-end report with line-level code citations, LLM executive summaries, and export capabilities (Markdown, JSON, Print).
            </p>
          </div>
          <Link
            href="/reports/rpt_lg_demo_7721"
            className="flex shrink-0 items-center space-x-1.5 rounded-lg bg-zinc-800 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
          >
            <span>Open Sample Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
