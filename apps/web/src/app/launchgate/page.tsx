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
  Github,
  Archive,
  Code2,
  FileText,
  Check,
  Copy,
  Terminal,
} from 'lucide-react';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { LiveScanTerminal } from '@/components/LiveScanTerminal';
import { CodeDiffPreview } from '@/components/CodeDiffPreview';
import { FileDropzone } from '@/components/FileDropzone';
import { ZeroRetentionToggle } from '@/components/ZeroRetentionToggle';
import { ReportFlags, isEphemeralReport } from '@/components/ReportFlags';
import { ApiErrorNotice } from '@/components/ApiErrorNotice';
import { PreviewLockedPanel, LockedPlaceholder } from '@/components/PreviewLock';
import { IllustrativeExample, EmptyReportState } from '@/components/DemoNotice';
import { ScanInputFile, Report, SourceCitation, isPreviewReport } from '@/lib/types';
import { runScan, getSampleData, ingestGithub, isMockEnabled, isDemoReport, toUiError, type UiError } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';
import { useABExperiment } from '@/lib/abTesting';
import { useBilling } from '@/lib/billing';

export default function LaunchGatePage() {
  const { remediationFormat, setRemediationFormat } = useABExperiment();
  const [inputMode, setInputMode] = useState<'sample' | 'github' | 'zip' | 'snippet'>('sample');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
  const [stagedFiles, setStagedFiles] = useState<ScanInputFile[]>([]);
  const [ephemeral, setEphemeral] = useState(false);
  const [scanError, setScanError] = useState<UiError | null>(null);
  const [ingestNote, setIngestNote] = useState<string | null>(null);
  const [codeSnippet, setCodeSnippet] = useState(`// Leaked keys & open RLS policy snippet
const OPENAI_API_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d";
const SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...";

-- Open RLS rule
CREATE POLICY "Public read and write access" ON public.user_profiles
  FOR ALL USING (true);`);
  const [snippetFilename, setSnippetFilename] = useState('client-api.ts');

  const [projectName, setProjectName] = useState('Lovable SaaS Starter');
  // Live mode starts empty: the demo report is preloaded only when NEXT_PUBLIC_USE_MOCK=true.
  const [report, setReport] = useState<Report | null>(isMockEnabled() ? MOCK_REPORTS.launchgate : null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const { refresh: refreshBilling } = useBilling();

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRunScan = async () => {
    setScanError(null);
    setIngestNote(null);

    if (inputMode === 'zip' && stagedFiles.length === 0) {
      setScanError({
        status: null,
        message: 'Stage a .zip export or source files in the dropzone before running the scan.',
      });
      return;
    }
    if (inputMode === 'github') {
      if (!githubUrl.trim()) {
        setScanError({ status: null, message: 'Enter a public GitHub repository URL.' });
        return;
      }
      if (isMockEnabled()) {
        setScanError({
          status: null,
          message:
            'GitHub ingestion needs the live API: set NEXT_PUBLIC_USE_MOCK=false and start the TrustCore API.',
        });
        return;
      }
    }

    setIsLoading(true);
    setShowTerminal(true);
    try {
      let scanFiles: ScanInputFile[] = [];

      if (inputMode === 'snippet') {
        scanFiles = [
          {
            filename: snippetFilename,
            content: codeSnippet,
          },
        ];
      } else if (inputMode === 'github') {
        const ingested = await ingestGithub(githubUrl, githubBranch);
        if (ingested.files.length === 0) {
          throw new Error('No scannable text files were found in that repository.');
        }
        scanFiles = ingested.files;
        setIngestNote(
          `Fetched ${ingested.files.length} file${ingested.files.length === 1 ? '' : 's'} from ${ingested.source}` +
            (ingested.skipped_count > 0 ? ` • skipped ${ingested.skipped_count}` : '') +
            (ingested.truncated ? ' • truncated at the ingestion limit' : '')
        );
      } else if (inputMode === 'zip') {
        scanFiles = stagedFiles;
      } else {
        const sample = await getSampleData('launchgate');
        scanFiles = sample.files || [];
      }

      const res = await runScan({
        product: 'launchgate',
        project_name: projectName,
        files: scanFiles,
        ephemeral,
      });
      setReport(res);
    } catch (err) {
      console.error('Scan failed:', err);
      setShowTerminal(false);
      setScanError(toUiError(err));
    } finally {
      setIsLoading(false);
      // A scan spends a credit or the free preview: re-read the plan.
      void refreshBilling();
    }
  };

  const preview = isPreviewReport(report);
  // Fixed built-in widgets are only "the result" for demo data; on a live report they are labelled examples.
  const isDemo = report !== null && isDemoReport(report);
  // CodeDiffPreview renders one fixed before/after diff; it is not generated from the scan.
  const codeDiffExample = isDemo ? (
    <CodeDiffPreview />
  ) : (
    <IllustrativeExample>
      <CodeDiffPreview />
    </IllustrativeExample>
  );
  const readinessTone =
    report?.summary.readiness_status === 'PASSED'
      ? 'text-emerald-400'
      : report?.summary.readiness_status === 'WARNING'
      ? 'text-yellow-400'
      : 'text-red-400';

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
          <div className="flex items-center space-x-2 text-xs font-mono font-semibold uppercase tracking-wider text-blue-400">
            <Rocket className="h-4 w-4" />
            <span>Product 1 of 4 • Pre-Launch Security Gate</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            LaunchGate — Pre-Launch Security Gate
          </h1>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
            Automated compliance gate for apps generated with Cursor, Lovable, or Replit. Detects leaked secrets, open Supabase/Firebase RLS rules, and hallucinated npm packages before deployment.
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

      {/* Ingestion Tabs */}
      <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Select Ingestion Mode
            </h3>
            <p className="text-xs text-zinc-400">
              Scan a GitHub repo, upload a Cursor/Lovable ZIP export, paste code snippets, or try preloaded test cases.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ZeroRetentionToggle enabled={ephemeral} onChange={setEphemeral} disabled={isLoading} />
            <input
              type="text"
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none font-mono"
            />
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50 transition active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Scanning Code...' : 'Run LaunchGate'}</span>
            </button>
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800/80 pb-4">
          <button
            onClick={() => setInputMode('sample')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'sample'
                ? 'bg-blue-600 text-white shadow'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Realistic AI App Sample</span>
          </button>

          <button
            onClick={() => setInputMode('github')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'github'
                ? 'bg-blue-600 text-white shadow'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Github className="h-3.5 w-3.5" />
            <span>GitHub Repository URL</span>
          </button>

          <button
            onClick={() => setInputMode('zip')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'zip'
                ? 'bg-blue-600 text-white shadow'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>ZIP Archive Upload</span>
          </button>

          <button
            onClick={() => setInputMode('snippet')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              inputMode === 'snippet'
                ? 'bg-blue-600 text-white shadow'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Code / Env Snippet</span>
          </button>
        </div>

        {/* Tab 1: Realistic Sample */}
        {inputMode === 'sample' && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-300">
                Preloaded Scenario: Lovable SaaS App with Supabase & OpenAI
              </span>
              <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] text-blue-300 font-mono">
                4 Files Staged
              </span>
            </div>
            <p className="text-zinc-400 leading-relaxed">
              Contains hardcoded OpenAI API key in <code className="text-zinc-300 font-mono">src/lib/api-client.ts</code>, open Supabase RLS policy <code className="text-zinc-300 font-mono">USING (true)</code> in migration SQL, leaked service role key in <code className="text-zinc-300 font-mono">.env.production</code>, and hallucinated npm package <code className="text-zinc-300 font-mono">auth0-next-toolkit</code> in <code className="text-zinc-300 font-mono">package.json</code>.
            </p>
          </div>
        )}

        {/* Tab 2: GitHub URL */}
        {inputMode === 'github' && (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-xs text-zinc-400">Repository URL</label>
              <div className="relative">
                <Github className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="https://github.com/organization/repository"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none font-mono"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Branch</label>
              <input
                type="text"
                placeholder="default branch"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-2 px-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none font-mono"
              />
            </div>
          </div>
        )}

        {/* Tab 3: ZIP Upload */}
        {inputMode === 'zip' && (
          <FileDropzone
            files={stagedFiles}
            onFilesChange={setStagedFiles}
            product="launchgate"
            title="Drop Cursor or Lovable Export .zip file"
            acceptLabel="ZIP repo export or source/config files • in-memory scan (max 15 MB) • node_modules, .git and binaries skipped"
          />
        )}

        {/* Tab 4: Code Snippet */}
        {inputMode === 'snippet' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Filename or Migration:</span>
              <input
                type="text"
                value={snippetFilename}
                onChange={(e) => setSnippetFilename(e.target.value)}
                className="rounded border border-zinc-800 bg-[#090a0f] px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none"
              />
            </div>
            <textarea
              rows={6}
              value={codeSnippet}
              onChange={(e) => setCodeSnippet(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] p-3 font-mono text-xs text-zinc-200 focus:border-blue-500 focus:outline-none leading-relaxed"
            />
          </div>
        )}

        {/* Scan / ingestion status: failures surface here with Retry, never as sample data */}
        <ApiErrorNotice
          error={scanError}
          onRetry={scanError !== null && scanError.status !== null ? handleRunScan : undefined}
        />
        {ingestNote && (
          <p className="text-xs font-mono text-zinc-400">{ingestNote}</p>
        )}
      </div>

      {/* Live Scan Terminal Simulator Widget (scripted demo output: mock mode only) */}
      {showTerminal && isMockEnabled() && (
        <LiveScanTerminal product="LaunchGate" />
      )}

      {!report && !isLoading && (
        <EmptyReportState description="Choose an ingestion mode above and run LaunchGate. Findings from your own code appear here; no sample results are shown." />
      )}

      {/* Severity Summary Cards */}
      {report && (
        <div className="space-y-6">
          <ReportFlags report={report} />
          {preview && <PreviewLockedPanel report={report} />}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
                  Critical
                </span>
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-white font-mono">
                {report.summary.critical_count}
              </p>
              <span className="text-[10px] text-zinc-400">Secrets, open RLS, exposed keys</span>
            </div>

            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-orange-400">
                  High Severity
                </span>
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-white font-mono">
                {report.summary.high_count}
              </p>
              <span className="text-[10px] text-zinc-400">Unverified packages & risky config</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Readiness Score
                </span>
                <span className={`text-xs font-bold font-mono ${readinessTone}`}>
                  {report.summary.readiness_status}
                </span>
              </div>
              <p className={`mt-2 text-3xl font-extrabold font-mono ${readinessTone}`}>
                {report.summary.risk_score}<span className="text-base text-zinc-500">/100</span>
              </p>
              <span className="text-[10px] text-zinc-400">
                Pre-launch gate {report.summary.readiness_status.toLowerCase()}
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Total Findings
                </span>
                <FileCode className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-zinc-100 font-mono">
                {report.summary.total_findings}
              </p>
              <span className="text-[10px] text-zinc-400">Exact source cited</span>
            </div>
          </div>

          {/* Remediation Format Experiment Controls & Content */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                  Engine 2 Remediation Workbench
                </span>
                <h3 className="text-sm font-bold text-zinc-100">
                  {remediationFormat === 'diff_stream'
                    ? 'Unified Code Diff Remediation Stream'
                    : 'One-Click Prompt Cards for AI Editors'}
                </h3>
              </div>

              {/* In-place A/B Experiment Toggle Switcher */}
              <div className="flex items-center rounded-lg border border-zinc-800 bg-[#090a0f] p-1 text-xs">
                <button
                  onClick={() => setRemediationFormat('split_cards')}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    remediationFormat === 'split_cards'
                      ? 'bg-purple-600 text-white font-semibold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Prompt Cards
                </button>
                <button
                  onClick={() => setRemediationFormat('diff_stream')}
                  className={`rounded-md px-3 py-1 font-medium transition ${
                    remediationFormat === 'diff_stream'
                      ? 'bg-blue-600 text-white font-semibold shadow'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Diff Stream
                </button>
              </div>
            </div>

            {preview ? (
              <LockedPlaceholder
                title="Fix prompts"
                description="Copy-paste remediation prompts for Cursor, Claude and Lovable come with the full report."
              />
            ) : remediationFormat === 'diff_stream' ? (
              <div className="space-y-4">
                {codeDiffExample}
                {report.remediation_prompts && report.remediation_prompts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {report.remediation_prompts.map((p, idx) => (
                      <FixPromptCard key={idx} prompt={p} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {report.remediation_prompts && report.remediation_prompts.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {report.remediation_prompts.map((p, idx) => (
                      <FixPromptCard key={idx} prompt={p} />
                    ))}
                  </div>
                )}
                {codeDiffExample}
              </div>
            )}
          </div>

          {/* Findings Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-zinc-200">
              Deterministic Vulnerability Findings (
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
