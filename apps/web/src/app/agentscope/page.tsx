'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Shield,
  Play,
  Sparkles,
  ArrowRight,
  GitCompare,
  FileCode,
  ShieldCheck,
  AlertOctagon,
  Check,
  Copy,
} from 'lucide-react';
import { FileDropzone } from '@/components/FileDropzone';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { ScanInputFile, Report, SourceCitation, PermissionDiffItem } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function AgentScopePage() {
  const [files, setFiles] = useState<ScanInputFile[]>([]);
  const [projectName, setProjectName] = useState('Claude Desktop MCP Config');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.agentscope);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedDiff, setCopiedDiff] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sample = await getSampleData('agentscope');
      setProjectName(sample.project_name || 'Claude Desktop MCP Suite');
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
        product: 'agentscope',
        project_name: projectName,
        files: files.length > 0 ? files : (MOCK_REPORTS.agentscope.metadata?.sample_files || []),
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

  const handleCopyCleanConfig = () => {
    const cleanConfig = {
      mcpServers: {
        filesystem: {
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', './workspace', '--readonly'],
          scopes: ['read_only', 'workspace_files'],
          env: {
            ANTHROPIC_API_KEY: '${ANTHROPIC_API_KEY}',
          },
        },
        terminal_executor: {
          command: 'bash',
          args: ['-c'],
          tools: ['bash'],
          confirmation_required: true,
        },
      },
    };
    navigator.clipboard.writeText(JSON.stringify(cleanConfig, null, 2));
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <Cpu className="h-4 w-4" />
            <span>Product 2 of 4 • MCP & Agent Permissions Auditor</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            AgentScope — Agent Permissions & Blast Radius Auditor
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Inspects Model Context Protocol (MCP) server configurations, flags wildcard scopes & plaintext credentials, and generates least-privilege diffs.
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
              Upload MCP Manifest or Agent Config
            </h3>
            <p className="text-xs text-zinc-400">
              Drop <code className="text-purple-300">claude_desktop_config.json</code>, agent manifest, or YAML tool definitions.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Config Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
            />
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-purple-500 disabled:opacity-50"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Auditing MCP...' : 'Audit Permissions'}</span>
            </button>
          </div>
        </div>

        <FileDropzone
          files={files}
          onFilesChange={setFiles}
          onLoadSample={handleLoadSample}
          sampleLabel="Load Over-Privileged MCP Sample"
          acceptLabel="Supported: claude_desktop_config.json, mcp.json, agent.yaml"
        />
      </div>

      {/* Results and Diff View */}
      {report && (
        <div className="space-y-6">
          {/* Blast Radius Reduction Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-400">
                Blast Radius Reduction
              </span>
              <p className="mt-1 text-3xl font-extrabold text-white">
                -{report.metadata?.blast_radius_reduction_pct || 78}%
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Achieved by scoping filesystem mounts and removing wildcard tools.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Readiness Gate
              </span>
              <p className="mt-1 text-2xl font-bold text-red-400">
                {report.summary.readiness_status}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Requires applying least-privilege diff before production deployment.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                Audited Capabilities
              </span>
              <p className="mt-1 text-2xl font-bold text-zinc-100">
                {report.metadata?.audited_tools_count || 5} Tools / Mounts
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {report.findings.length} permission violations identified.
              </p>
            </div>
          </div>

          {/* Interactive Before / After Permission Diff View */}
          {report.permission_diff && report.permission_diff.length > 0 && (
            <div className="rounded-xl border border-zinc-800 bg-[#101118] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div className="flex items-center space-x-2">
                  <div className="rounded-lg bg-purple-500/10 p-1.5 text-purple-400">
                    <GitCompare className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      Before / After Permission Diff View
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Deterministic comparison between active config and suggested least-privilege configuration.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleCopyCleanConfig}
                  className="flex items-center space-x-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20"
                >
                  {copiedDiff ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied Least-Privilege Config</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Recommended Config</span>
                    </>
                  )}
                </button>
              </div>

              {/* Diff Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Config Field</th>
                      <th className="py-2.5 px-3 font-medium text-red-400">Active (Over-Privileged)</th>
                      <th className="py-2.5 px-3 font-medium text-emerald-400">Recommended (Least-Privilege)</th>
                      <th className="py-2.5 px-3 font-medium">Action</th>
                      <th className="py-2.5 px-3 font-medium">Deterministic Justification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {report.permission_diff.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30">
                        <td className="py-3 px-3 text-zinc-300 font-semibold">{item.field}</td>
                        <td className="py-3 px-3 text-red-400 bg-red-500/5 whitespace-pre">
                          {String(item.before_value)}
                        </td>
                        <td className="py-3 px-3 text-emerald-400 bg-emerald-500/5 whitespace-pre">
                          {String(item.after_value)}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              item.action === 'RESTRICTED'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : item.action === 'REMOVED'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                            }`}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-sans text-zinc-400 max-w-xs">{item.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fix Prompts */}
          {report.remediation_prompts && report.remediation_prompts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>One-Click Remediation Prompts</span>
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
              Identified MCP Permission Findings ({report.findings.length})
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
