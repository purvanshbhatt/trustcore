'use client';

import React, { useState } from 'react';
import { Sparkles, GitCompare, FileSpreadsheet, CheckSquare } from 'lucide-react';
import { Report, SourceCitation, isPreviewReport } from '@/lib/types';
import { LockedPlaceholder } from '@/components/PreviewLock';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { SecurityGauge } from '@/components/SecurityGauge';

interface ReportBodyProps {
  report: Report;
}

/**
 * The body of a report: readiness banner, executive summary, fix prompts, the
 * product detail views and the findings table with its citation drawer. Shared
 * by the report viewer (/reports/[id]) and the public sample audit (/sample).
 * Renders a fragment so the parent controls the vertical spacing.
 */
export function ReportBody({ report }: ReportBodyProps) {
  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const preview = isPreviewReport(report);

  const handleOpenCitation = (citation: SourceCitation, ruleId: string, title: string) => {
    setActiveCitation(citation);
    setActiveRuleId(ruleId);
    setActiveFindingTitle(title);
    setIsDrawerOpen(true);
  };

  return (
    <>
      {/* Readiness Status Banner with Security Gauge */}
      <div
        className={`rounded-2xl border p-6 ${
          report.summary.readiness_status === 'BLOCKED'
            ? 'border-red-500/30 bg-red-500/5'
            : report.summary.readiness_status === 'WARNING'
            ? 'border-yellow-500/30 bg-yellow-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Overall Readiness Gate:
              </span>
              <span
                className={`font-extrabold font-mono text-sm px-2 py-0.5 rounded ${
                  report.summary.readiness_status === 'BLOCKED'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : report.summary.readiness_status === 'WARNING'
                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {report.summary.readiness_status}
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">
              Deterministic findings computed by TrustCore Engine 1 with exact file and line references. Zero fabricated compliance evidence.
            </p>

            <div className="grid grid-cols-3 gap-4 pt-3 text-center border-t border-zinc-800/80 max-w-md">
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Critical</span>
                <p className="text-xl font-bold text-red-400 font-mono">{report.summary.critical_count}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">High</span>
                <p className="text-xl font-bold text-orange-400 font-mono">{report.summary.high_count}</p>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono">Total</span>
                <p className="text-xl font-bold text-zinc-200 font-mono">{report.summary.total_findings}</p>
              </div>
            </div>
          </div>

          <div className="md:col-span-4 flex justify-center">
            <SecurityGauge score={report.summary.risk_score} label="Readiness Score" size="sm" showSimulator={false} />
          </div>
        </div>
      </div>

      {/* Executive Summary (Engine 2 LLM Layer) */}
      <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-6 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
          <Sparkles className="h-4 w-4" />
          <span>Executive Summary & Risk Narrative (Engine 2 LLM Layer)</span>
        </div>
        <div className="pt-2 text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
          {report.executive_summary}
        </div>
      </div>

      {/* Preview: fix prompts and product detail views are withheld, never replaced with sample content */}
      {preview && (
        <div className="space-y-3 print:hidden">
          <LockedPlaceholder
            title="Fix prompts"
            description="Copy-paste remediation prompts come with the full report."
          />
          <LockedPlaceholder
            title="Detailed views"
            description="Permission diff, evidence matrix and eval results come with the full report."
          />
        </div>
      )}

      {/* Copy-Paste Remediation Prompts */}
      {report.remediation_prompts && report.remediation_prompts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-100 flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span>One-Click Actionable Remediation Prompts</span>
            </h2>
            <span className="text-xs text-zinc-500">
              Formatted for immediate paste into your AI editor
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.remediation_prompts.map((p, idx) => (
              <FixPromptCard key={idx} prompt={p} />
            ))}
          </div>
        </div>
      )}

      {/* Specialized View: AgentScope Permission Diff */}
      {report.permission_diff && report.permission_diff.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-3">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-2">
            <GitCompare className="h-4 w-4 text-purple-400" />
            <span>AgentScope Least-Privilege Diff Audit</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-zinc-800 text-zinc-400 font-sans">
                <tr>
                  <th className="py-2 px-3">Field</th>
                  <th className="py-2 px-3 text-red-400">Before</th>
                  <th className="py-2 px-3 text-emerald-400">After</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3 font-sans">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {report.permission_diff.map((item, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/30">
                    <td className="py-2.5 px-3 text-zinc-300 font-semibold">{item.field}</td>
                    <td className="py-2.5 px-3 text-red-400 bg-red-500/5">{String(item.before_value)}</td>
                    <td className="py-2.5 px-3 text-emerald-400 bg-emerald-500/5">{String(item.after_value)}</td>
                    <td className="py-2.5 px-3">
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300 font-bold">
                        {item.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-zinc-400">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Specialized View: Evidence-to-Answer Matrix */}
      {report.evidence_matrix && report.evidence_matrix.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-3">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>Verified Evidence & Gap Matrix</span>
          </h3>

          <div className="divide-y divide-zinc-800/70">
            {report.evidence_matrix.map((item) => (
              <div key={item.id} className="py-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-400">{item.question_id}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
                      item.status === 'VERIFIED_EVIDENCE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="font-semibold text-zinc-200">{item.question}</p>
                <p className="text-zinc-400 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specialized View: EvalKit Results */}
      {report.eval_results && report.eval_results.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-3">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 text-amber-400" />
            <span>Adversarial Eval Test Matrix</span>
          </h3>

          <div className="divide-y divide-zinc-800/70">
            {report.eval_results.map((tc) => (
              <div key={tc.id} className="py-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono font-bold text-zinc-400">{tc.id}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono ${
                        tc.status === 'PASSED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                      }`}
                    >
                      {tc.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">{tc.category}</span>
                </div>
                <p className="font-semibold text-zinc-200">{tc.test_name}</p>
                <div className="rounded bg-zinc-900/60 p-2 font-mono text-[11px] text-zinc-300">
                  {tc.actual_output}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deterministic Findings Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-zinc-100">
            Deterministic Source-Cited Findings (
            {preview ? `top ${report.findings.length} of ${report.summary.total_findings}` : report.findings.length})
          </h2>
          <span className="text-xs text-zinc-500 font-mono">
            {preview ? 'Exact snippets unlock with the full report' : 'Click row to open exact snippet'}
          </span>
        </div>

        <FindingsTable
          findings={report.findings}
          onSelectCitation={handleOpenCitation}
        />
      </div>

      {/* Verifiable Citation Flyout Drawer */}
      <CitationDrawer
        citation={activeCitation}
        ruleId={activeRuleId}
        title={activeFindingTitle}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </>
  );
}
