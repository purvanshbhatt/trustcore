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
  UploadCloud,
  Check,
  Copy,
} from 'lucide-react';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { ScanInputFile, Report, SourceCitation } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function LaunchGatePage() {
  const [inputMode, setInputMode] = useState<'sample' | 'github' | 'zip' | 'snippet'>('sample');
  const [githubUrl, setGithubUrl] = useState('https://github.com/lovable-dev/saas-starter-template');
  const [githubBranch, setGithubBranch] = useState('main');
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const [codeSnippet, setCodeSnippet] = useState(`// Leaked keys & open RLS policy snippet
const OPENAI_API_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d";
const SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9...";

-- Open RLS rule
CREATE POLICY "Public read and write access" ON public.user_profiles
  FOR ALL USING (true);`);
  const [snippetFilename, setSnippetFilename] = useState('client-api.ts');

  const [projectName, setProjectName] = useState('Lovable SaaS Starter');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.launchgate);
  const [isLoading, setIsLoading] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRunScan = async () => {
    setIsLoading(true);
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
        // Simulated parsed files from repo
        scanFiles = [
          {
            filename: 'src/lib/api-client.ts',
            content: codeSnippet,
          },
          {
            filename: '.env.production',
            content: 'STRIPE_SECRET_KEY=sk_test_51M0CKSTRIPEKEY99283746152433\nNEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=ey...',
          },
          {
            filename: 'package.json',
            content: '{\n  "dependencies": {\n    "auth0-next-toolkit": "^1.0.4",\n    "react-domm": "^18.2.0"\n  }\n}',
          },
        ];
      } else {
        // Sample or ZIP mode
        const sample = await getSampleData('launchgate');
        scanFiles = sample.files || [];
      }

      const res = await runScan({
        product: 'launchgate',
        project_name: projectName,
        files: scanFiles,
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

  const handleZipDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setZipFileName(e.dataTransfer.files[0].name);
      setProjectName(e.dataTransfer.files[0].name.replace('.zip', ''));
    }
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
            LaunchGate — Pre-Launch Security Gate
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Automated gate for apps built with Cursor, Lovable, or Replit. Detects leaked secrets, open Supabase/Firebase RLS rules, and hallucinated npm packages.
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

      {/* Ingestion Tabs */}
      <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              Select Ingestion Mode
            </h3>
            <p className="text-xs text-zinc-400">
              Scan a GitHub repo, upload a Cursor/Lovable ZIP bundle, paste code snippets, or try preloaded test cases.
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
              Contains hardcoded OpenAI API key in <code className="text-zinc-300">src/lib/api-client.ts</code>, open Supabase RLS policy <code className="text-zinc-300">USING (true)</code> in migration SQL, leaked service role key in <code className="text-zinc-300">.env.production</code>, and hallucinated npm package <code className="text-zinc-300">auth0-next-toolkit</code> in <code className="text-zinc-300">package.json</code>.
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
                  className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-2 pl-9 pr-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Branch</label>
              <input
                type="text"
                placeholder="main"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#090a0f] py-2 px-3 text-xs text-zinc-200 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Tab 3: ZIP Upload */}
        {inputMode === 'zip' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleZipDrop}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-800 bg-[#0d0e14] p-8 text-center"
          >
            <UploadCloud className="h-8 w-8 text-blue-400 mb-2" />
            <h4 className="text-sm font-semibold text-zinc-200">
              {zipFileName ? `Staged: ${zipFileName}` : 'Drop Cursor or Lovable Export .zip file'}
            </h4>
            <p className="mt-1 text-xs text-zinc-500">
              Automatic AST unzipping and in-memory scan (max 50MB)
            </p>
          </div>
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
      </div>

      {/* Severity Summary Cards */}
      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
                  Critical
                </span>
                <ShieldAlert className="h-4 w-4 text-red-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {report.summary.critical_count}
              </p>
              <span className="text-[10px] text-zinc-400">Leaked API keys & open RLS</span>
            </div>

            <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-orange-400">
                  High Severity
                </span>
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-white">
                {report.summary.high_count}
              </p>
              <span className="text-[10px] text-zinc-400">Hallucinated packages</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Readiness Score
                </span>
                <span className="text-xs font-bold text-red-400">BLOCKED</span>
              </div>
              <p className="mt-2 text-3xl font-extrabold text-red-400">
                {report.summary.risk_score}<span className="text-base text-zinc-500">/100</span>
              </p>
              <span className="text-[10px] text-zinc-400">Pre-launch gate blocked</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  Total Findings
                </span>
                <FileCode className="h-4 w-4 text-blue-400" />
              </div>
              <p className="mt-2 text-3xl font-extrabold text-zinc-100">
                {report.summary.total_findings}
              </p>
              <span className="text-[10px] text-zinc-400">Exact source cited</span>
            </div>
          </div>

          {/* One-Click Copy-Paste Fix Prompts for Cursor / Claude */}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span>One-Click Copy Fix Prompts for Cursor / Claude (Engine 2)</span>
                </h3>
                <span className="text-xs text-zinc-500">
                  Click to copy pre-formatted prompt for your AI code editor
                </span>
              </div>

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
