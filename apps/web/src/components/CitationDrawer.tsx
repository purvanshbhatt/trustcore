'use client';

import React from 'react';
import { X, FileCode, CheckCircle2, ShieldAlert, Copy, Check } from 'lucide-react';
import { SourceCitation } from '@/lib/types';

interface CitationDrawerProps {
  citation: SourceCitation | null;
  ruleId?: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CitationDrawer({
  citation,
  ruleId,
  title,
  isOpen,
  onClose,
}: CitationDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen || !citation) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citation.snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = citation.snippet.split('\n');
  const startLine = citation.line_start || 1;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
        <div className="w-screen max-w-xl border-l border-zinc-800 bg-[#0d0e14] p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center space-x-3">
              <div className="rounded-md bg-blue-500/10 p-2 text-blue-400">
                <FileCode className="h-5 w-5" />
              </div>
              <div>
                <span className="font-mono text-xs font-semibold text-blue-400">
                  {ruleId || 'VERIFIED SOURCE CITATION'}
                </span>
                <h3 className="text-base font-medium text-zinc-100">
                  {title || 'Exact Evidence Reference'}
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="mt-6 space-y-6">
            {/* Deterministic Evidence Metadata */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Source File:</span>
                  <p className="mt-0.5 font-mono text-zinc-200 truncate">
                    {citation.file_path}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Location:</span>
                  <p className="mt-0.5 font-mono text-zinc-200">
                    {citation.line_start
                      ? `Lines ${citation.line_start}${citation.line_end && citation.line_end !== citation.line_start ? `-${citation.line_end}` : ''}`
                      : citation.section_title || 'Document Section'}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Source Type:</span>
                  <p className="mt-0.5 capitalize text-zinc-200">
                    {citation.source_type.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-500">Verification Engine:</span>
                  <p className="mt-0.5 text-emerald-400 font-mono">
                    Engine 1 Deterministic
                  </p>
                </div>
              </div>
            </div>

            {/* Verifiable Snippet */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                  Exact Source Snippet
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Snippet</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative overflow-hidden rounded-lg border border-zinc-800 bg-[#090a0f] font-mono text-xs">
                <div className="flex border-b border-zinc-800/80 bg-zinc-900/40 px-3 py-1.5 text-[11px] text-zinc-400">
                  <span>{citation.file_path}</span>
                </div>
                <div className="overflow-x-auto p-3 leading-relaxed">
                  {lines.map((line, idx) => (
                    <div key={idx} className="flex">
                      <span className="mr-4 inline-block w-6 select-none text-right text-zinc-600">
                        {startLine + idx}
                      </span>
                      <span className="text-zinc-300 whitespace-pre">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Guarantee Callout */}
            <div className="flex items-start space-x-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="font-semibold text-emerald-300">
                  Zero Hallucination Proof Guarantee
                </p>
                <p className="mt-0.5 text-emerald-400/80">
                  This snippet was deterministically parsed from the raw uploaded codebase/document without LLM interpolation.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
