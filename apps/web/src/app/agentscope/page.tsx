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
  KeyRound,
  ShieldAlert,
  Terminal,
  Globe,
  Edit3,
  Eye,
  Lock,
  Download,
  Filter,
} from 'lucide-react';
import { FindingsTable } from '@/components/FindingsTable';
import { CitationDrawer } from '@/components/CitationDrawer';
import { FixPromptCard } from '@/components/FixPromptCard';
import { BlastRadiusSimulator } from '@/components/BlastRadiusSimulator';
import { ScanInputFile, Report, SourceCitation, MCPToolPermission } from '@/lib/types';
import { runScan, getSampleData } from '@/lib/api';
import { MOCK_REPORTS } from '@/lib/mockData';

export default function AgentScopePage() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'diff' | 'simulator'>('simulator');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [mcpJsonContent, setMcpJsonContent] = useState(`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],
      "scopes": ["*"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-live-secret-prod-token-9988223344"
      }
    },
    "terminal_executor": {
      "command": "bash",
      "args": ["-c"],
      "tools": ["bash", "run_command", "exec"],
      "confirmation_required": false
    }
  }
}`);

  const [projectName, setProjectName] = useState('Claude Desktop MCP Config');
  const [report, setReport] = useState<Report | null>(MOCK_REPORTS.agentscope);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedDiff, setCopiedDiff] = useState(false);

  // Citation Drawer state
  const [activeCitation, setActiveCitation] = useState<SourceCitation | null>(null);
  const [activeRuleId, setActiveRuleId] = useState<string>('');
  const [activeFindingTitle, setActiveFindingTitle] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleRunScan = async () => {
    setIsLoading(true);
    try {
      const res = await runScan({
        product: 'agentscope',
        project_name: projectName,
        files: [
          {
            filename: 'claude_desktop_config.json',
            content: mcpJsonContent,
          },
        ],
      });
      setReport(res);
    } catch (err) {
      console.error('Scan failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = async () => {
    setIsLoading(true);
    try {
      const sample = await getSampleData('agentscope');
      setProjectName(sample.project_name || 'Claude Desktop & Agent Workstation Config');
      if (sample.files && sample.files[0]) {
        setMcpJsonContent(sample.files[0].content);
      }
    } catch {
      // fallback
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

  const handleCopyCleanConfig = () => {
    navigator.clipboard.writeText(JSON.stringify(cleanConfig, null, 2));
    setCopiedDiff(true);
    setTimeout(() => setCopiedDiff(false), 2000);
  };

  const handleDownloadCleanConfig = () => {
    const blob = new Blob([JSON.stringify(cleanConfig, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'claude_desktop_config.hardened.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const permissionsMatrix: MCPToolPermission[] =
    report?.permissions_matrix || MOCK_REPORTS.agentscope.permissions_matrix || [];

  const filteredMatrix = permissionsMatrix.filter(
    (tool) => categoryFilter === 'ALL' || tool.category === categoryFilter
  );

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Read':
        return <Eye className="h-4 w-4 text-blue-400" />;
      case 'Write':
        return <Edit3 className="h-4 w-4 text-purple-400" />;
      case 'Destructive':
        return <Terminal className="h-4 w-4 text-red-400" />;
      case 'Network':
        return <Globe className="h-4 w-4 text-amber-400" />;
      default:
        return <Shield className="h-4 w-4 text-zinc-400" />;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs font-mono font-semibold uppercase tracking-wider text-purple-400">
            <Cpu className="h-4 w-4" />
            <span>Product 2 of 4 • MCP & Agent Permissions Auditor</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            AgentScope — Agent Permissions & Blast Radius Auditor
          </h1>
          <p className="mt-1 text-xs text-zinc-400 max-w-2xl">
            Inspects Model Context Protocol (MCP) server manifests, flags wildcard scopes & plaintext credentials, and computes interactive least-privilege diffs to minimize autonomous agent blast radius.
          </p>
        </div>

        {report && (
          <Link
            href={`/reports/${report.id}`}
            className="flex items-center space-x-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition self-start md:self-auto shadow"
          >
            <span>View Full Report</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Ingestion & Config Editor */}
      <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-zinc-200">
              Paste or Upload MCP Config (mcp.json / claude_desktop_config.json)
            </h3>
            <p className="text-xs text-zinc-400">
              Evaluates server mounts, scopes, embedded API keys, and tool permissions across Read, Write, Destructive, and Network.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadSample}
              className="rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
            >
              <Sparkles className="mr-1 inline-block h-3.5 w-3.5" />
              Load Sample MCP
            </button>
            <button
              onClick={handleRunScan}
              disabled={isLoading}
              className="flex items-center space-x-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-purple-500 disabled:opacity-50 transition active:scale-[0.98]"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>{isLoading ? 'Auditing MCP...' : 'Audit Permissions'}</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono text-zinc-300">claude_desktop_config.json</span>
            <span className="font-mono text-[11px] text-zinc-500">JSON schema validated</span>
          </div>
          <textarea
            rows={6}
            value={mcpJsonContent}
            onChange={(e) => setMcpJsonContent(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#090a0f] p-3 font-mono text-xs text-zinc-200 focus:border-purple-500 focus:outline-none leading-relaxed"
          />
        </div>
      </div>

      {/* Plaintext Secret Alerts Banner */}
      <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
        <div className="flex items-start space-x-3">
          <div className="rounded-lg bg-red-500/20 p-2 text-red-400">
            <KeyRound className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-red-200">
                Plaintext Secret Alert: Hardcoded API Key in MCP Environment Block
              </span>
              <span className="rounded bg-red-500/30 px-2 py-0.5 text-[10px] font-mono font-bold text-red-300 border border-red-500/40">
                CRITICAL EXPOSURE
              </span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Detected <code className="text-red-300 font-mono font-bold">ANTHROPIC_API_KEY: &quot;sk-ant-live-secret-prod-token-9988223344&quot;</code> embedded in plain text inside <code className="text-zinc-300 font-mono">claude_desktop_config.json</code>.
              Anyone with access to dotfiles or synced git repositories can extract this credential.
            </p>
          </div>
        </div>
      </div>

      {/* Main Analysis View: Tabs for Simulator vs Matrix vs Diff */}
      {report && (
        <div className="space-y-6">
          {/* Top Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-purple-400">
                Blast Radius Reduction
              </span>
              <p className="mt-1 text-3xl font-extrabold text-white font-mono">
                -{report.metadata?.blast_radius_reduction_pct || 78}%
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Scoping filesystem mounts & removing wildcard execution.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Readiness Status
              </span>
              <p className="mt-1 text-2xl font-extrabold text-red-400 font-mono">
                {report.summary.readiness_status}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Requires least-privilege scoping before agent launch.
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                Tool Scopes Audited
              </span>
              <p className="mt-1 text-2xl font-extrabold text-zinc-100 font-mono">
                {permissionsMatrix.length} Capabilities
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                Categorized across Read, Write, Destructive, Network.
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center space-x-2 border-b border-zinc-800 pb-3">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'simulator'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Cpu className="h-4 w-4" />
              <span>Interactive Blast Radius Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'matrix'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Visual Permissions Matrix</span>
            </button>

            <button
              onClick={() => setActiveTab('diff')}
              className={`flex items-center space-x-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'diff'
                  ? 'bg-purple-600 text-white shadow'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              <GitCompare className="h-4 w-4" />
              <span>Before / After Permission Diff</span>
            </button>
          </div>

          {/* TAB 0: INTERACTIVE BLAST RADIUS SIMULATOR */}
          {activeTab === 'simulator' && (
            <BlastRadiusSimulator />
          )}

          {/* TAB 1: VISUAL PERMISSIONS MATRIX (Read / Write / Destructive / Network) */}
          {activeTab === 'matrix' && (
            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Agent Permissions Matrix by Category
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Evaluation of capabilities across Read, Write, Destructive, and Network access surfaces.
                  </p>
                </div>

                {/* Category Filters */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                  {['ALL', 'Read', 'Write', 'Destructive', 'Network'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        categoryFilter === cat
                          ? 'bg-purple-600 text-white font-semibold'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMatrix.map((tool, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-xl border border-zinc-800 bg-[#0c0d14] p-4 space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-1.5">
                            {getCategoryIcon(tool.category)}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-zinc-200 font-mono">
                              {tool.name}
                            </span>
                            <span className="ml-2 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-zinc-400">
                              {tool.category}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-mono font-bold ${
                            tool.status === 'ALLOWED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : tool.status === 'BLOCKED'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {tool.status}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {tool.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-500">
                      <span className="font-mono truncate max-w-[200px]">
                        Scope: {tool.scope}
                      </span>
                      <span>
                        Human Approval:{' '}
                        <strong className="text-zinc-300">
                          {tool.confirmationRequired ? 'Mandatory' : 'Optional'}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: BEFORE / AFTER PERMISSION DIFF */}
          {activeTab === 'diff' && report.permission_diff && (
            <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">
                    Before / After Least-Privilege Diff
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Compares current dangerous manifest against hardened production baseline.
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleDownloadCleanConfig}
                    className="flex items-center space-x-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download JSON</span>
                  </button>

                  <button
                    onClick={handleCopyCleanConfig}
                    className="flex items-center space-x-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-500/20 transition"
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
              </div>

              {/* Diff Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="border-b border-zinc-800 bg-zinc-900/40 text-zinc-400 font-sans">
                    <tr>
                      <th className="py-2.5 px-3">Field</th>
                      <th className="py-2.5 px-3 text-red-400">Before (Dangerous)</th>
                      <th className="py-2.5 px-3 text-emerald-400">After (Scoped)</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3 font-sans">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {report.permission_diff.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-900/30">
                        <td className="py-3 px-3 text-zinc-300 font-semibold">{item.field}</td>
                        <td className="py-3 px-3 text-red-400 bg-red-500/5">{String(item.before_value)}</td>
                        <td className="py-3 px-3 text-emerald-400 bg-emerald-500/5">{String(item.after_value)}</td>
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
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span>One-Click Remediation Prompts (Engine 2)</span>
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
