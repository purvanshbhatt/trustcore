'use client';

import React from 'react';
import { FlaskConical, Inbox } from 'lucide-react';

interface IllustrativeExampleProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Frames a fixed, built-in example (it is not computed from the user's scan) with
 * a visible label so it cannot be mistaken for their results.
 */
export function IllustrativeExample({ children, className = '' }: IllustrativeExampleProps) {
  return (
    <div className={`rounded-xl border border-dashed border-amber-500/40 bg-amber-500/[0.03] p-3 ${className}`}>
      <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-amber-300">
        <FlaskConical className="h-3.5 w-3.5" />
        Illustrative example — not your data
      </div>
      {children}
    </div>
  );
}

interface EmptyReportStateProps {
  title?: string;
  description: string;
}

/** Shown before the first scan in live mode, where no sample report is preloaded. */
export function EmptyReportState({ title = 'No results yet', description }: EmptyReportStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-[#0d0e14] p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-sm font-bold text-zinc-200">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-zinc-500">{description}</p>
    </div>
  );
}
