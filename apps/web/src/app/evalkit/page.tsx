'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Bug,
  Terminal,
  FileText,
  XCircle,
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { ScanInputFile, Report, SourceCitation, EvalCaseResult } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function EvalKitPage() {
  const [files, setFiles] = useState<ScanInputFile[]>([]);
  const [projectName, setProjectName] = useState('Customer Support Bot');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.evalkit);
  const [isLoading, setIsLoading] = useState(false);
  const [filterFailedOnly, setFilterFailedOnly] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sample = await getSampleData('evalkit');
      setProjectName(sample.project_name || 'Customer Support Bot Guardrails');
      setFiles(sample.files || []);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunScan = async () => {
    setIsLoading(true);
    try {
      const res = await runScan({
        product: 'evalkit',
        project_name: projectName,
        files: files.length > 0 ? files : (MOCK_REPORTS.evalkit.metadata?.sample_files || []),
      });
      setReport(res);
    } catch (err) {
      console.error('Eval run failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCitation = (citation: SourceCitation, ruleId: string, title: string) => {
    setActiveCitation(citation);
    setActiveRuleId(ruleId);
    setActiveFindingTitle(title);
    setIsDrawerOpen(true);
  };

  const evalCases = report?.eval_results || [];
  const filteredCases = filterFailedOnly
    ? evalCases.filter((tc) => tc.status === 'FAILED')
    : evalCases;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
            <CheckSquare className="h-4 w-4" />
            <span>Product 4 of 4 • Workflow Regression & Adversarial Runner</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            EvalKit — Prompt Injection & Client Acceptance Runner
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Execute deterministic assertions and adversarial prompt-injection payloads (canary token leaks, jailbreaks, tool hijacks) with client acceptance sign-off.
          </p>
        </div>

        {report && (
          <Link
            href={`/reports/${report.id}`}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 self-start md:self-auto"
          >
            <span>Client Acceptance Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Ingestion & Eval Setup */}
      <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">
              Agent Workflow & Prompt Harness Ingestion
            </h3>
            <p className="text-xs text-zinc-400">
              Upload system prompt, tool schemas, and evaluation test cases for automated adversarial stress-testing.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Workflow Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-amber-500 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Executing Evals...' : 'Run Eval Suite'}</span>
            </button>
          </div>
        </div>

        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          onLoadSample={handleLoadSample}
          sampleLabel="Load SupportBot Prompt & Canary Harness"
          acceptLabel="Supported: prompt.txt, agent.py, eval_suite.yaml, test_cases.json"
        />
      </div>

      {/* Results and Eval Scorecard */}
      {report && (
        <div className="space-y-6">
          {/* Acceptance Scorecard */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Eval Pass Rate
              </span>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {report.metadata?.pass_rate || 40}%
              </p>
              <span className="text-[10px] text-zinc-500">
                {report.metadata?.passed_tests || 2} of {report.metadata?.total_tests || 5} Passed
              </span>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
                Vulnerabilities Found
              </span>
              <p className="mt-1 text-2xl font-bold text-red-400">
                {report.metadata?.failed_tests || 3} Failed
              </p>
              <span className="text-[10px] text-zinc-400">Canary Leak & Tool Hijack</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Client Acceptance
              </span>
              <p className="mt-1 text-2xl font-bold text-red-400">REJECTED</p>
              <span className="text-[10px] text-zinc-500">Gate Blocked (Canary Exfil)</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Test Suite Model
              </span>
              <p className="mt-1 text-2xl font-bold text-zinc-100">Deterministic</p>
              <span className="text-[10px] text-emerald-400">Canary Token Verification</span>
            </div>
          </div>

          {/* Adversarial Test Matrix Table */}
          <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Adversarial Test Suite Results ({evalCases.length} Tests)
                </h3>
                <p className="text-xs text-zinc-400">
                  Detailed pass/fail breakdown showing attack payloads, defensive triggers, and actual responses.
                </p>
              </div>

              <button
                onClick={() => setFilterFailedOnly(!filterFailedOnly)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                  filterFailedOnly
                    ? 'border-red-500/50 bg-red-500/10 text-red-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {filterFailedOnly ? 'Showing Failed Only (3)' : 'Filter Failed Tests Only'}
              </button>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {filteredCases.map((tc) => (
                <div key={tc.id} className="py-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-zinc-400">
                        {tc.id}
                      </span>
                      {tc.status === 'PASSED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          PASSED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                          <XCircle className="h-3 w-3" />
                          FAILED (INJECTION DETECTED)
                        </span>
                      )}
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                        {tc.adversarial_type || tc.category}
                      </span>
                    </div>

                    <span className="text-xs text-zinc-500 font-mono">
                      Defense Triggered: {tc.defense_triggered ? 'YES' : 'NO'}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-zinc-200">
                    {tc.test_name}
                  </h4>

                  {/* Adversarial Payload vs Actual Output */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                    <div className="rounded-lg border border-zinc-800 bg-[#090a0f] p-3">
                      <span className="text-[10px] uppercase font-bold text-zinc-500">
                        Attack Payload:
                      </span>
                      <p className="mt-1 text-zinc-300 leading-relaxed whitespace-pre-wrap">
                        {tc.input_payload}
                      </p>
                    </div>

                    <div
                      className={`rounded-lg border p-3 ${
                        tc.status === 'PASSED'
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-red-500/20 bg-red-500/5'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold text-zinc-500">
                        Actual Output / Reason:
                      </span>
                      <p
                        className={`mt-1 leading-relaxed ${
                          tc.status === 'PASSED' ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {tc.actual_output}
                      </p>
                      <p className="mt-2 text-[11px] text-zinc-400 font-sans italic">
                        {tc.details}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fix Prompts for Prompt Guardrails */}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>System Prompt Guardrail Hardening (Engine 2)</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.remediation_prompts.map((p, idx) => (
                  <FixPromptCard key={idx} prompt={p} />
                ))}
              </div>
            </div>
          )}

          {/* Findings Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              Vulnerabilities & Security Deficiencies ({report.findings.length})
            </h3>
            <FindingsTable
              findings={report.findings}
              onSelectCitation={handleOpenCitation}
            />
          </div>
        </div>
      )}

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
