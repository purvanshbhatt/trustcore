'use client';

import React, { useState } from 'react';
import { Sliders, X, Sparkles, TrendingUp, Layout, Check, ChevronDown } from 'lucide-react';
import { useABExperiment, LayoutDensity, CtaVariant, RemediationFormat } from '@/lib/abTesting';

export function ABExperimentBar() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    density,
    ctaVariant,
    remediationFormat,
    setDensity,
    setCtaVariant,
    setRemediationFormat,
    conversionMetrics,
  } = useABExperiment();

  return (
    <>
      {/* Floating Pill Trigger Button */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 rounded-full border border-blue-500/40 bg-[#0f111a]/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-zinc-200 shadow-xl hover:border-blue-400 hover:text-white transition"
        >
          <Sliders className="h-3.5 w-3.5 text-blue-400" />
          <span className="font-mono text-[11px]">A/B Experiments</span>
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </div>

      {/* Slide-over Experiment Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-[#0e1017] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Growth & UI Experiment Lab</h3>
                  <p className="text-[11px] text-zinc-400">
                    Live multivariate toggles & conversion telemetry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Experiment 1: Layout Density */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Experiment 1: Layout Density
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">3 Variants</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'standard', label: 'Standard' },
                    { id: 'compact', label: 'SOC Ops (High)' },
                    { id: 'executive', label: 'Executive' },
                  ] as { id: LayoutDensity; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setDensity(opt.id)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                      density === opt.id
                        ? 'border-blue-500 bg-blue-600/20 text-white font-semibold'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Experiment 2: Primary Hero CTA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300">
                  Experiment 2: Hero CTA Variant
                </label>
                <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                  Variant B +28.4% CTR
                </span>
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: 'variant_a_speed',
                      title: 'Variant A: Speed Hook',
                      desc: '"Run 60-Second AI Security Scan"',
                      clicks: conversionMetrics.variant_a_speed.clicks,
                      metric: conversionMetrics.variant_a_speed.conversionRate,
                    },
                    {
                      id: 'variant_b_mcp',
                      title: 'Variant B: Blast Radius Hook (Winner)',
                      desc: '"Audit Agent Permissions & Scopes"',
                      clicks: conversionMetrics.variant_b_mcp.clicks,
                      metric: conversionMetrics.variant_b_mcp.conversionRate,
                    },
                    {
                      id: 'variant_c_soc2',
                      title: 'Variant C: Enterprise Compliance',
                      desc: '"Solve SOC 2 Questionnaires with Exact Citations"',
                      clicks: conversionMetrics.variant_c_soc2.clicks,
                      metric: conversionMetrics.variant_c_soc2.conversionRate,
                    },
                  ] as { id: CtaVariant; title: string; desc: string; clicks: number; metric: string }[]
                ).map((cta) => (
                  <div
                    key={cta.id}
                    onClick={() => setCtaVariant(cta.id)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                      ctaVariant === cta.id
                        ? 'border-purple-500 bg-purple-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-semibold">{cta.title}</span>
                      <p className="text-[11px] text-zinc-400">{cta.desc}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-zinc-300 block">
                        {cta.metric}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {cta.clicks} clicks
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Experiment 3: Remediation Presentation */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300">
                Experiment 3: Remediation Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: 'split_cards', label: 'One-Click Prompt Cards' },
                    { id: 'diff_stream', label: 'Unified Diff Stream' },
                  ] as { id: RemediationFormat; label: string }[]
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setRemediationFormat(fmt.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      remediationFormat === fmt.id
                        ? 'border-emerald-500 bg-emerald-600/20 text-white font-semibold'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Settings stored in local session</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
