'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  FileText,
  Download,
  Printer,
  Share2,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Sparkles,
  GitCompare,
  FileSpreadsheet,
  CheckSquare,
  Copy,
  Check,
  FileCode,
} from 'lucide-react';
import { Report, SourceCitation } from '@/lib/types';
import { getReport } from '@/lib/api';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { SecurityGauge } from '@/components/SecurityGauge';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function ReportViewerPage() {
  const params = useParams();
  const reportId = (params?.id as string) || 'rpt_lg_demo_7721';

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const rep = await getReport(reportId);
        setReport(rep);
      } catch {
        setReport(MOCK_REPORTS.launchgate);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId]);

  const handleOpenCitation = (citation: SourceCitation, ruleId: string, title: string) => {
    setActiveCitation(citation);
    setActiveRuleId(ruleId);
    setActiveFindingTitle(title);
    setIsDrawerOpen(true);
  };

  const handleExportJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!report) return;
    const md = [
      `# TrustCore Security & Readiness Report`,
      `**Report ID:** \`${report.id}\`  `,
      `**Title:** ${report.title}  `,
      `**Product:** ${report.product.toUpperCase()}  `,
      `**Date:** ${report.created_at}  `,
      `**Readiness Score:** ${report.summary.risk_score}/100 (${report.summary.readiness_status})  `,
      '',
      `## Executive Summary`,
      report.executive_summary,
      '',
      `## Summary Metrics`,
      `- Total Findings: ${report.summary.total_findings}`,
      `- Critical: ${report.summary.critical_count}`,
      `- High: ${report.summary.high_count}`,
      `- Medium: ${report.summary.medium_count}`,
      `- Low: ${report.summary.low_count}`,
      '',
      `## Deterministic Findings`,
    ];

    report.findings.forEach((f, i) => {
      md.push(`### ${i + 1}. [${f.severity}] ${f.title} (${f.rule_id})`);
      md.push(`- **Category:** ${f.category}`);
      md.push(`- **Description:** ${f.description}`);
      md.push(`- **File:** \`${f.citation.file_path}\` (Line ${f.citation.line_start || 'N/A'})`);
      md.push(`- **Snippet:** \`${f.citation.snippet}\``);
      md.push(`- **Impact:** ${f.impact}`);
      md.push('');
    });

    if (report.remediation_prompts && report.remediation_prompts.length > 0) {
      md.push(`## Actionable Remediation Prompts`);
      report.remediation_prompts.forEach((p) => {
        md.push(`### ${p.title} (Target: ${p.target_tool})`);
        md.push('```text');
        md.push(p.prompt_text);
        md.push('```');
        md.push('');
      });
    }

    const blob = new Blob([md.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Loading verifiable report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-8 text-center space-y-3">
        <h3 className="text-base font-semibold text-zinc-200">Report Not Found</h3>
        <Link href="/" className="inline-block text-xs text-blue-400 hover:underline">
          Return to Overview Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16 print:p-0">
      {/* Top Action Bar (Hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4 print:hidden">
        <Link
          href={`/${report.product}`}
          className="inline-flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-mono">Back to {report.product.toUpperCase()}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleShareLink}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportMarkdown}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Markdown</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 shadow transition"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {/* Report Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-zinc-400">{report.id}</span>
          <span className="text-zinc-600">•</span>
          <span className="uppercase text-blue-400 font-mono font-bold tracking-wider">{report.product}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-mono">
            {new Date(report.created_at).toLocaleString()}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {report.title}
        </h1>
      </div>

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
            Deterministic Source-Cited Findings ({report.findings.length})
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Click row to open exact snippet</span>
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
    </div>
  );
}
