'use client';

import React from 'react';
import { EyeOff, FlaskConical, Lock } from 'lucide-react';
import { isPreviewReport, type Report } from '@/lib/types';

interface ReportFlagsProps {
  report: Report | null;
}

/** True when the report came from a Zero-Retention scan and was never persisted. */
export function isEphemeralReport(report: Report | null): boolean {
  return report?.metadata?.ephemeral === true;
}

/**
 * Status badges for the active report: "Ephemeral — not saved" for scans that
 * were never persisted, "Free preview" for gated reports, and a demo-data note
 * when the result is mock-mode data or the built-in sample report.
 */
export function ReportFlags({ report }: ReportFlagsProps) {
  if (report === null) {
    return null;
  }
  const ephemeral = isEphemeralReport(report);
  const isMock = report.metadata?.is_mock === true;
  const preview = isPreviewReport(report);
  if (!ephemeral && !isMock && !preview) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {preview && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 font-mono font-semibold text-blue-300">
          <Lock className="h-3.5 w-3.5" />
          Free preview — score and top findings only
        </span>
      )}
      {ephemeral && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-mono font-semibold text-emerald-300">
          <EyeOff className="h-3.5 w-3.5" />
          Ephemeral — not saved
        </span>
      )}
      {isMock && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 font-mono font-semibold text-amber-300">
          <FlaskConical className="h-3.5 w-3.5" />
          {report.metadata?.mock_reason === 'sample'
            ? 'Sample report — illustrative data, not your scan'
            : 'Demo data — mock mode (NEXT_PUBLIC_USE_MOCK=true)'}
        </span>
      )}
    </div>
  );
}
