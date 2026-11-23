'use client';

import React from 'react';
import { Copy, Check, Terminal, Sparkles, ArrowRight } from 'lucide-react';
import { RemediationPrompt } from '@/lib/types';

interface FixPromptCardProps {
  prompt: RemediationPrompt;
}

export function FixPromptCard({ prompt }: FixPromptCardProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.prompt_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getToolBadgeColor = (tool: string) => {
    if (tool.includes('Cursor') || tool.includes('Lovable')) {
      return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    }
    if (tool.includes('Claude') || tool.includes('Windsurf')) {
      return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    }
    if (tool.includes('Terminal')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#111219] p-5 transition-all hover:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <div className="flex items-center space-x-2">
          <span
            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${getToolBadgeColor(
              prompt.target_tool
            )}`}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            {prompt.target_tool}
          </span>
          <h4 className="text-sm font-semibold text-zinc-100">{prompt.title}</h4>
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center space-x-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Copied to Clipboard</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
              <span>Copy Prompt for Editor</span>
            </>
          )}
        </button>
      </div>

      <p className="text-xs text-zinc-400 mb-3">{prompt.description}</p>

      {/* Code / Prompt Block */}
      <div className="relative overflow-hidden rounded-lg border border-zinc-800/80 bg-[#090a0f] p-3.5 font-mono text-xs leading-relaxed text-zinc-300">
        <pre className="whitespace-pre-wrap font-mono text-[12px]">{prompt.prompt_text}</pre>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Engine 2 LLM Remediation Prompt</span>
        <span className="flex items-center text-zinc-400 hover:text-zinc-200 cursor-pointer" onClick={handleCopy}>
          Paste into your AI code editor prompt bar <ArrowRight className="ml-1 h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
