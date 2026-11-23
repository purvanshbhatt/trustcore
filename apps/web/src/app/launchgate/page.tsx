'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Rocket,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  ArrowRight,
  FileCode,
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { ScanInputFile, Report, SourceCitation } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function LaunchGatePage() {
  const [files, setFiles] = useState<ScanInputFile[]>([]);
  const [projectName, setProjectName] = useState('Lovable AI App');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.launchgate);
  const [isLoading, setIsLoading] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sample = await getSampleData('launchgate');
      setProjectName(sample.project_name || 'Lovable SaaS Starter');
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
        product: 'launchgate',
        project_name: projectName,
        files: files.length > 0 ? files : (MOCK_REPORTS.launchgate.metadata?.sample_files || []),
      });
      setReport(res);
    } catch (err) {
      console.error('Scan failed:', err);
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

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
            <Rocket className="h-4 w-4" />
            <span>Product 1 of 4 • Pre-Launch Security Gate</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            LaunchGate — App Security & Readiness Gate
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Audits Cursor, Lovable, and Replit generated projects for leaked secrets, open Supabase RLS rules, and hallucinated packages.
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

      {/* Ingestion Section */}
      <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-200">
              Codebase & Configuration Ingestion
            </h3>
            <p className="text-xs text-zinc-400">
              Upload source files, SQL migrations, .env files, or package.json for deterministic analysis.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-500 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Running Scan...' : 'Run Security Gate'}</span>
            </button>
          </div>
        </div>

        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          onLoadSample={handleLoadSample}
          sampleLabel="Load Cursor/Lovable App Sample"
        />
      </div>

      {/* Results Section */}
      {report && (
        <div className="space-y-6">
          {/* Readiness Gate Banner */}
          <div
            className={`rounded-xl border p-5 ${
              report.summary.readiness_status === 'BLOCKED'
                ? 'border-red-500/30 bg-red-500/5'
                : report.summary.readiness_status === 'WARNING'
                ? 'border-yellow-500/30 bg-yellow-500/5'
                : 'border-emerald-500/30 bg-emerald-500/5'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold text-lg ${
                    report.summary.readiness_status === 'BLOCKED'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : report.summary.readiness_status === 'WARNING'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  }`}
                >
                  {report.summary.risk_score}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Readiness Status:
                    </span>
                    <span
                      className={`font-bold text-sm ${
                        report.summary.readiness_status === 'BLOCKED'
                          ? 'text-red-400'
                          : report.summary.readiness_status === 'WARNING'
                          ? 'text-yellow-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {report.summary.readiness_status}
                    </span>
                  </div>
                  <h3 className="mt-0.5 text-base font-semibold text-zinc-100">
                    {report.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-xs font-medium">
                <div>
                  <span className="text-zinc-500">Critical:</span>{' '}
                  <span className="text-red-400 font-bold">{report.summary.critical_count}</span>
                </div>
                <div>
                  <span className="text-zinc-500">High:</span>{' '}
                  <span className="text-orange-400 font-bold">{report.summary.high_count}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Total Findings:</span>{' '}
                  <span className="text-zinc-200 font-bold">{report.summary.total_findings}</span>
                </div>
              </div>
            </div>

            {/* Executive Summary Narrative */}
            <div className="mt-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
              {report.executive_summary}
            </div>
          </div>

          {/* One-Click Copy-Paste Fix Prompts */}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>Copy-Paste Fix Prompts (Engine 2 LLM Layer)</span>
                </h3>
                <span className="text-xs text-zinc-500">
                  Ready to paste into Cursor / Lovable prompt bar
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.remediation_prompts.map((p, idx) => (
                  <FixPromptCard key={idx} prompt={p} />
                ))}
              </div>
            </div>
          )}

          {/* Deterministic Findings Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-200">
              Deterministic Vulnerability Findings ({report.findings.length})
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
