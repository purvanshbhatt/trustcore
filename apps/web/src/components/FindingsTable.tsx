'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  ExternalLink,
  Search,
  Filter,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { Finding, Severity, SourceCitation, isCitationLocked } from '@/lib/types';

interface FindingsTableProps {
  findings: Finding[];
  onSelectCitation: (citation: SourceCitation, ruleId: string, title: string) => void;
}

export function FindingsTable({ findings, onSelectCitation }: FindingsTableProps) {
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredFindings = findings.filter((f) => {
    const matchesSeverity =
      selectedSeverity === 'ALL' || f.severity === selectedSeverity;
    const matchesSearch =
      searchQuery === '' ||
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.rule_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.citation.file_path.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const getSeverityBadge = (severity: Severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-red-400">
            <ShieldAlert className="h-3 w-3" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-orange-400">
            <AlertTriangle className="h-3 w-3" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            MEDIUM
          </span>
        );
      case 'LOW':
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-mono font-bold text-blue-400">
            <Info className="h-3 w-3" />
            {severity}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search findings, rules, files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#0c0d14] py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-blue-500 focus:outline-none font-mono"
          />
        </div>

        <div className="flex w-full sm:w-auto items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((sev) => (
            <button
              key={sev}
              onClick={() => setSelectedSeverity(sev)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium font-mono transition ${
                selectedSeverity === sev
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-bold'
                  : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Findings Table List */}
      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-[#10111a]">
        {filteredFindings.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="mx-auto h-8 w-8 text-emerald-400" />
            <h4 className="mt-2 text-sm font-bold text-zinc-200">No findings matched</h4>
            <p className="mt-1 text-xs text-zinc-500">
              No security violations or evidence gaps found for this filter criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {filteredFindings.map((finding) => (
              <div
                key={finding.id}
                className="group flex flex-col md:flex-row items-start md:items-center justify-between p-4 transition hover:bg-zinc-900/40 gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {getSeverityBadge(finding.severity)}
                    <span className="font-mono text-[11px] font-bold text-zinc-300">
                      {finding.rule_id}
                    </span>
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      {finding.category}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-zinc-100">
                    {finding.title}
                  </h4>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {finding.description}
                  </p>

                  <div className="flex items-center space-x-2 text-[11px] text-zinc-500">
                    <span className="text-zinc-400 font-mono">
                      {finding.citation.file_path}
                    </span>
                    {finding.citation.line_start && (
                      <span className="font-mono text-zinc-500">• Line {finding.citation.line_start}</span>
                    )}
                  </div>
                </div>

                {/* Citation Drawer Trigger (locked when a preview report withholds the exact source) */}
                {isCitationLocked(finding.citation) ? (
                  <span
                    title="Exact source citations unlock with the full report"
                    className="flex shrink-0 cursor-not-allowed items-center space-x-1.5 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-500"
                  >
                    <Lock className="h-3.5 w-3.5" />
                    <span>Citation locked</span>
                  </span>
                ) : (
                  <button
                    onClick={() =>
                      onSelectCitation(
                        finding.citation,
                        finding.rule_id,
                        finding.title
                      )
                    }
                    className="flex shrink-0 items-center space-x-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition hover:border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  >
                    <span>View Evidence Citation</span>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
