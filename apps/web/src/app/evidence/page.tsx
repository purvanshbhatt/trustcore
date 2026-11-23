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
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { ScanInputFile, Report, SourceCitation, EvidenceMappingItem } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function EvidenceWorkbenchPage() {
  const [files, setFiles] = useState<ScanInputFile[]>([]);
  const [projectName, setProjectName] = useState('Enterprise SOC 2 Questionnaire');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.evidence);
  const [isLoading, setIsLoading] = useState(false);
  const [filterGapOnly, setFilterGapOnly] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sample = await getSampleData('evidence');
      setProjectName(sample.project_name || 'SOC 2 Type II Vendor Review');
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
        product: 'evidence',
        project_name: projectName,
        files: files.length > 0 ? files : (MOCK_REPORTS.evidence.metadata?.sample_files || []),
      });
      setReport(res);
    } catch (err) {
      console.error('Evidence analysis failed:', err);
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
  const filteredMatrix = filterGapOnly
    ? matrix.filter((item) => item.status === 'UNSUPPORTED_GAP')
    : matrix;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <FileSpreadsheet className="h-4 w-4" />
            <span>Product 3 of 4 • Security Questionnaire Workbench</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Evidence-to-Answer — Zero-Hallucination Questionnaire Solver
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Ingest SOC 2 and security policies, map questionnaire requirements with exact line-level proof, and explicitly flag unsupported compliance gaps.
          </p>
        </div>

        {report && (
          <Link
            href={`/reports/${report.id}`}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 self-start md:self-auto"
          >
            <span>View Full Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Ingestion Dropzone */}
      <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">
              Upload Policies & Security Questionnaire
            </h3>
            <p className="text-xs text-zinc-400">
              Ingest markdown policies, text docs, or CSV questionnaires. Engine 1 checks exact proof without inventing compliance.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Questionnaire Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Mapping Evidence...' : 'Map Questionnaire'}</span>
            </button>
          </div>
        </div>

        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          onLoadSample={handleLoadSample}
          sampleLabel="Load SOC 2 Policy & Questionnaire"
          acceptLabel="Supported: Information_Security_Policy.md, SOC2.csv, ISO27001.txt"
        />
      </div>

      {/* Results Section */}
      {report && (
        <div className="space-y-6">
          {/* Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
                Evidence Coverage
              </span>
              <p className="mt-1 text-2xl font-bold text-white">
                {report.metadata?.coverage_rate || 67}%
              </p>
              <span className="text-[10px] text-zinc-400">
                {report.metadata?.verified_controls || 4} Verified Controls
              </span>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Evidence Gaps
              </span>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {report.metadata?.unsupported_gaps || 2} Gaps Flagged
              </p>
              <span className="text-[10px] text-zinc-400">Zero Hallucinations</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Readiness Score
              </span>
              <p className="mt-1 text-2xl font-bold text-yellow-400">
                {report.summary.risk_score}/100
              </p>
              <span className="text-[10px] text-zinc-400">{report.summary.readiness_status}</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Auditor Citation Mode
              </span>
              <p className="mt-1 text-2xl font-bold text-zinc-100">Exact Line Proof</p>
              <span className="text-[10px] text-zinc-400">Deterministic Engine 1</span>
            </div>
          </div>

          {/* Evidence Mapping Matrix Table */}
          <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  Questionnaire Evidence Mapping Table ({matrix.length} Controls)
                </h3>
                <p className="text-xs text-zinc-400">
                  Each row is either proven with verified file/section citations or explicitly flagged as an evidence gap.
                </p>
              </div>

              <button
                onClick={() => setFilterGapOnly(!filterGapOnly)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition ${
                  filterGapOnly
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {filterGapOnly ? 'Showing Gaps Only (2)' : 'Filter Unsupported Gaps Only'}
              </button>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {filteredMatrix.map((item) => (
                <div key={item.id} className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-blue-400">
                        {item.question_id}
                      </span>
                      {item.status === 'VERIFIED_EVIDENCE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          VERIFIED EVIDENCE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                          <AlertTriangle className="h-3 w-3" />
                          UNSUPPORTED GAP
                        </span>
                      )}
                    </div>

                    {item.citation && (
                      <button
                        onClick={() =>
                          handleOpenCitation(
                            item.citation!,
                            item.question_id,
                            item.question
                          )
                        }
                        className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <span>View Exact Source Proof</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <h4 className="text-sm font-medium text-zinc-200">
                    {item.question}
                  </h4>

                  <div className="rounded-lg bg-zinc-900/50 border border-zinc-800/60 p-3 text-xs leading-relaxed">
                    {item.status === 'VERIFIED_EVIDENCE' ? (
                      <div className="text-zinc-300">
                        <span className="text-zinc-500 font-semibold">Answer: </span>
                        {item.answer}
                      </div>
                    ) : (
                      <div className="text-amber-300">
                        <span className="font-semibold text-amber-400">Compliance Gap: </span>
                        {item.gap_reason}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fix Prompts */}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
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
            <h3 className="text-sm font-semibold text-zinc-200">
              Compliance Deficiencies & Gaps ({report.findings.length})
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
