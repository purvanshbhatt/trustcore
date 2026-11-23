'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles, FileCode, ArrowRight, Eye, ShieldCheck, ShieldAlert } from 'lucide-react';

interface CodeDiffPreviewProps {
  filename?: string;
  language?: string;
  originalCode?: string;
  remediatedCode?: string;
  findingTitle?: string;
}

export function CodeDiffPreview({
  filename = 'src/lib/api-client.ts',
  language = 'typescript',
  originalCode = `// Vulnerable: Hardcoded Secret & Client Leaked Service Role
import { createClient } from '@supabase/supabase-js';

export const OPENAI_API_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d";
export const SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE
);`,
  remediatedCode = `// Remediated: Environment Sealed & Restricted Client Scope
import { createClient } from '@supabase/supabase-js';

// Server-side only: never export or expose to browser client
const getOpenAIKey = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing from environment");
  return key;
};

// Client uses public anon key only; service role restricted to backend API
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);`,
  findingTitle = 'Hardcoded OpenAI & Supabase Service Role Keys',
}: CodeDiffPreviewProps) {
  const [viewMode, setViewMode] = useState<'diff' | 'remediated' | 'original'>('diff');
  const [copied, setCopied] = useState(false);

  const activeContent =
    viewMode === 'remediated' ? remediatedCode : originalCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(viewMode === 'remediated' ? remediatedCode : originalCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const origLines = originalCode.split('\n');
  const remLines = remediatedCode.split('\n');

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0c0d14] overflow-hidden font-mono text-xs">
      {/* Code Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/60 px-4 py-2.5 font-sans">
        <div className="flex items-center space-x-2">
          <FileCode className="h-4 w-4 text-blue-400" />
          <span className="font-mono text-xs font-semibold text-zinc-200">{filename}</span>
          <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase font-mono text-zinc-400">
            {language}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mode Switcher */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-black/40 p-0.5 text-[11px]">
            <button
              onClick={() => setViewMode('original')}
              className={`rounded px-2 py-1 font-medium transition ${
                viewMode === 'original'
                  ? 'bg-red-500/20 text-red-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Vulnerable
            </button>
            <button
              onClick={() => setViewMode('diff')}
              className={`rounded px-2 py-1 font-medium transition ${
                viewMode === 'diff'
                  ? 'bg-blue-600/30 text-blue-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Side-by-Side Diff
            </button>
            <button
              onClick={() => setViewMode('remediated')}
              className={`rounded px-2 py-1 font-medium transition ${
                viewMode === 'remediated'
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Remediated Fix
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 rounded bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Diff / Code Viewer */}
      {viewMode === 'diff' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800/80">
          {/* Left: Vulnerable */}
          <div className="p-3 bg-red-500/[0.02] overflow-x-auto">
            <div className="flex items-center space-x-1.5 mb-2 pb-1.5 border-b border-zinc-800/50 text-[11px] font-sans text-red-400 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Current Code (Vulnerable)</span>
            </div>
            <div className="space-y-0.5 leading-relaxed">
              {origLines.map((line, idx) => {
                const isTainted =
                  line.includes('OPENAI_API_KEY') ||
                  line.includes('SUPABASE_SERVICE_ROLE');
                return (
                  <div
                    key={idx}
                    className={`flex items-start ${
                      isTainted ? 'bg-red-500/15 text-red-300 font-bold' : 'text-zinc-400'
                    }`}
                  >
                    <span className="w-6 select-none text-right pr-3 text-zinc-600 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Remediated */}
          <div className="p-3 bg-emerald-500/[0.02] overflow-x-auto">
            <div className="flex items-center space-x-1.5 mb-2 pb-1.5 border-b border-zinc-800/50 text-[11px] font-sans text-emerald-400 font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Engine 2 Remediated Baseline</span>
            </div>
            <div className="space-y-0.5 leading-relaxed">
              {remLines.map((line, idx) => {
                const isFixed =
                  line.includes('process.env.OPENAI_API_KEY') ||
                  line.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY');
                return (
                  <div
                    key={idx}
                    className={`flex items-start ${
                      isFixed
                        ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                        : 'text-zinc-300'
                    }`}
                  >
                    <span className="w-6 select-none text-right pr-3 text-zinc-600 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="whitespace-pre">{line}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 overflow-x-auto">
          <div className="space-y-0.5 leading-relaxed">
            {(viewMode === 'remediated' ? remLines : origLines).map((line, idx) => (
              <div key={idx} className="flex items-start text-zinc-300">
                <span className="w-6 select-none text-right pr-3 text-zinc-600 shrink-0">
                  {idx + 1}
                </span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="border-t border-zinc-800 bg-zinc-900/30 px-4 py-2 flex items-center justify-between text-[11px] font-sans text-zinc-400">
        <span>Remediation pattern: Environment Variable Externalization</span>
        <span className="text-zinc-500 font-mono">Rule LG-SEC-001</span>
      </div>
    </div>
  );
}
