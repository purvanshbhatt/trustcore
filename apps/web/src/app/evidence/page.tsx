'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Play,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  FileCheck,
  Search,
  UploadCloud,
  FileText,
  File,
  Check,
  Layers,
  Filter,
} from 'lucide-react';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { FileDropzone } from '@/components/FileDropzone';
import { ZeroRetentionToggle } from '@/components/ZeroRetentionToggle';
import { ReportFlags, isEphemeralReport } from '@/components/ReportFlags';
import { ApiErrorNotice } from '@/components/ApiErrorNotice';
import { PreviewLockedPanel, LockedPlaceholder } from '@/components/PreviewLock';
import { EmptyReportState } from '@/components/DemoNotice';
import { ScanInputFile, Report, SourceCitation, EvidenceMappingItem, isPreviewReport } from '@/lib/types';
import { runScan, getSampleData, isMockEnabled, toUiError, type UiError } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';
import { useBilling } from '@/lib/billing';

export default function EvidenceWorkbenchPage() {
  const [questionnaireFiles, setQuestionnaireFiles] = useState<ScanInputFile[]>([]);
  const [policyFiles, setPolicyFiles] = useState<ScanInputFile[]>([]);
  const [ephemeral, setEphemeral] = useState(false);
  const [scanError, setScanError] = useState<UiError | null>(null);
  const [projectName, setProjectName] = useState('Enterprise SOC 2 Questionnaire');
  // Live mode starts empty: the demo report is preloaded only when NEXT_PUBLIC_USE_MOCK=true.
  const [report, setReport] = useState<Report | null>(isMockEnabled() ? MOCK_REPORTS.evidence : null);
  const [isLoading, setIsLoading] = useState(false);
  const { refresh: refreshBilling } = useBilling();
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED_EVIDENCE' | 'UNSUPPORTED_GAP'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRunScan = async () => {
    setIsLoading(true);
    setScanError(null);
    try {
      // Staged uploads (questionnaire + policy docs) take precedence; otherwise run the SOC 2 sample.
      const stagedFiles: ScanInputFile[] = [...questionnaireFiles, ...policyFiles];
      let scanFiles: ScanInputFile[] = stagedFiles;
      if (stagedFiles.length === 0) {
        const sample = await getSampleData('evidence');
        scanFiles = sample.files || [];
      }
      const res = await runScan({
        product: 'evidence',
        project_name: projectName,
        files: scanFiles,
        ephemeral,
      });
      setReport(res);
    } catch (err) {
      console.error('Evidence analysis failed:', err);
      setScanError(toUiError(err));
    } finally {
      setIsLoading(false);
      // A scan spends a credit or the free preview: re-read the plan.
      void refreshBilling();
    }
  };

  const handleLoadSample = async () => {
    setIsLoading(true);
    setScanError(null);
    try {
      const sample = await getSampleData('evidence');
      setProjectName(sample.project_name || 'SOC 2 Type II Vendor Review');
      // The sample ships policy documents; controls come from the built-in SOC 2 set.
      setQuestionnaireFiles([]);
      setPolicyFiles(sample.files || []);
    } catch (err) {
      setScanError(toUiError(err));
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

  const matrix = report?.evidence_matrix || [];
  const filteredMatrix = matrix.filter((item) => {
    const matchesStatus =
      statusFilter === 'ALL' || item.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.question_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const verifiedCount = matrix.filter((m) => m.status === 'VERIFIED_EVIDENCE').length;
  const gapCount = matrix.filter((m) => m.status === 'UNSUPPORTED_GAP').length;
  // Computed from the scan only: an empty matrix is 0%, never a sample figure.
  const coverageRate = matrix.length > 0 ? Math.round((verifiedCount / matrix.length) * 100) : 0;
  const preview = isPreviewReport(report);

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Product 3 of 4 • Security Questionnaire Workbench</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Evidence-to-Answer — Zero-Hallucination Questionnaire Solver
          </h1>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
            Ingest SOC 2 and security policies, map customer questionnaire requirements with exact line-level proof, and explicitly flag unsupported compliance gaps without hallucinating.
          </p>
        </div>

        {report && !isEphemeralReport(report) && (
          <Link
            href={`/reports/${report.id}`}
            className="flex items-center space-x-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition self-start md:self-auto shadow"
          >
            <span>View Full Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* DUAL DROPZONE SECTION (Questionnaire CSV/XLSX + Evidence Docs) */}
      <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Dual Evidence & Questionnaire Ingestion
            </h3>
            <p className="text-xs text-zinc-400">
              Drop your customer questionnaire into Dropzone 1, and your internal policies into Dropzone 2.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ZeroRetentionToggle enabled={ephemeral} onChange={setEphemeral} disabled={isLoading} />
            <button
              onClick={handleLoadSample}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              <Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
              Load SOC 2 Sample
            </button>
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-50 transition active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Mapping Evidence...' : 'Map Questionnaire'}</span>
            </button>
          </div>
        </div>

        {/* Dual Dropzone Containers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropzone 1: Questionnaire */}
          <FileDropzone
            files={questionnaireFiles}
            onFilesChange={setQuestionnaireFiles}
            product="evidence"
            accept=".csv,.xlsx"
            title="Dropzone 1: Security Questionnaire"
            acceptLabel="CSV or XLSX vendor questionnaire (max 15 MB)"
          />

          {/* Dropzone 2: Evidence Documents */}
          <FileDropzone
            files={policyFiles}
            onFilesChange={setPolicyFiles}
            product="evidence"
            accept=".pdf,.md,.txt"
            title="Dropzone 2: Policy & SOC 2 Documents"
            acceptLabel="Information Security Policy, SOC 2 Type II report — PDF, MD, or TXT (max 15 MB)"
          />
        </div>

        {/* Failures surface here with Retry, never as sample data */}
        <ApiErrorNotice
          error={scanError}
          onRetry={scanError !== null && scanError.status !== null ? handleRunScan : undefined}
        />
      </div>

      {!report && !isLoading && (
        <EmptyReportState description="Upload a questionnaire and policy documents above, then map the questionnaire. Results from your own documents appear here; no sample results are shown." />
      )}

      {/* Results Section */}
      {report && (
        <div className="space-y-6">
          <ReportFlags report={report} />
          {preview && <PreviewLockedPanel report={report} />}

          {preview ? (
            // The evidence matrix (and every figure derived from it) is withheld in a preview.
            <LockedPlaceholder
              title="Evidence mapping table"
              description="Per-question answers, coverage figures and exact policy citations come with the full report."
            />
          ) : (
            <>
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Verified Coverage
              </span>
              <p className="mt-1 text-3xl font-extrabold text-white font-mono">
                {coverageRate}%
              </p>
              <span className="text-[10px] text-zinc-400">
                {verifiedCount} Verified Controls with Citations
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                Unsupported Gaps
              </span>
              <p className="mt-1 text-3xl font-extrabold text-amber-400 font-mono">
                {gapCount} Gaps Flagged
              </p>
              <span className="text-[10px] text-zinc-400">Zero Hallucinations Guarantee</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Readiness Score
              </span>
              <p className="mt-1 text-3xl font-extrabold text-yellow-400 font-mono">
                {report.summary.risk_score}<span className="text-base text-zinc-500">/100</span>
              </p>
              <span className="text-[10px] text-zinc-400 font-mono">{report.summary.readiness_status}</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Auditor Citation Mode
              </span>
              <p className="mt-1 text-2xl font-bold text-zinc-100 font-mono">Deterministic</p>
              <span className="text-[10px] text-zinc-400">Exact Section Proof</span>
            </div>
          </div>

          {/* Interactive Evidence Coverage Breakdown Bar */}
          <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400">Evidence Verification Distribution:</span>
              <div className="flex items-center space-x-3">
                <span className="text-emerald-400 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 mr-1.5" />
                  {verifiedCount} Supported ({coverageRate}%)
                </span>
                <span className="text-amber-400 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-amber-400 mr-1.5" />
                  {gapCount} Evidence Gaps ({100 - coverageRate}%)
                </span>
              </div>
            </div>
            <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${coverageRate}%` }}
              />
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${100 - coverageRate}%` }}
              />
            </div>
          </div>

          {/* ANSWER TABLE: 4 SPECIFIED COLUMNS */}
          {/* Question | Draft Answer | Exact Source Citation | Status */}
          <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-100">
                  Questionnaire Evidence Mapping Table ({matrix.length} Requirements)
                </h3>
                <p className="text-xs text-zinc-400">
                  Exact columns: Question, Draft Answer, Exact Source Citation (clickable to drawer), and Status.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <div className="relative w-48 sm:w-64">
                  <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search questions or answers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-1.5 pl-8 pr-2.5 text-xs text-zinc-200 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center space-x-1">
                  {(['ALL', 'VERIFIED_EVIDENCE', 'UNSUPPORTED_GAP'] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setStatusFilter(st)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        statusFilter === st
                          ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-semibold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {st === 'ALL' ? 'All' : st === 'VERIFIED_EVIDENCE' ? 'Supported' : 'Gaps'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-sans">
                  <tr>
                    <th className="py-2.5 px-3 font-medium w-1/4">Question</th>
                    <th className="py-2.5 px-3 font-medium w-2/5">Draft Answer</th>
                    <th className="py-2.5 px-3 font-medium w-1/5">Exact Source Citation</th>
                    <th className="py-2.5 px-3 font-medium w-1/6">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 leading-relaxed">
                  {filteredMatrix.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/30">
                      {/* Column 1: Question */}
                      <td className="py-3 px-3 align-top">
                        <span className="font-mono text-[11px] font-bold text-blue-400 block">
                          {item.question_id}
                        </span>
                        <span className="font-medium text-zinc-200 block mt-0.5">
                          {item.question}
                        </span>
                      </td>

                      {/* Column 2: Draft Answer */}
                      <td className="py-3 px-3 align-top">
                        {item.status === 'VERIFIED_EVIDENCE' ? (
                          <div className="text-zinc-300">
                            {item.answer}
                          </div>
                        ) : (
                          <div className="text-amber-300 bg-amber-500/5 p-2 rounded border border-amber-500/20">
                            <span className="font-bold text-amber-400">UNSUPPORTED GAP: </span>
                            {item.gap_reason}
                          </div>
                        )}
                      </td>

                      {/* Column 3: Exact Source Citation (Clickable to open CitationDrawer) */}
                      <td className="py-3 px-3 align-top">
                        {item.citation ? (
                          <button
                            onClick={() =>
                              handleOpenCitation(
                                item.citation!,
                                item.question_id,
                                item.question
                              )
                            }
                            className="flex items-center space-x-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20 transition group"
                          >
                            <ExternalLink className="h-3 w-3 text-blue-400 shrink-0" />
                            <span className="truncate max-w-[140px] font-mono">
                              {item.citation.file_path}:L{item.citation.line_start || 1}
                            </span>
                          </button>
                        ) : (
                          <span className="text-zinc-500 font-mono text-[11px]">
                            No document citation found
                          </span>
                        )}
                      </td>

                      {/* Column 4: Status (Supported vs Evidence Gap) */}
                      <td className="py-3 px-3 align-top">
                        {item.status === 'VERIFIED_EVIDENCE' ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                            <CheckCircle2 className="h-3 w-3" />
                            SUPPORTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400 font-mono">
                            <AlertTriangle className="h-3 w-3" />
                            EVIDENCE GAP
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

            </>
          )}

          {/* Fix Prompts */}
          {preview && (
            <LockedPlaceholder
              title="Policy remediation prompts"
              description="Copy-paste prompts that close each evidence gap come with the full report."
            />
          )}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span>Policy Remediation Prompts (Close Evidence Gaps)</span>
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
            <h3 className="text-sm font-bold text-zinc-200">
              Deterministic Gap Flags (
              {preview ? `top ${report.findings.length} of ${report.summary.total_findings}` : report.findings.length})
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
