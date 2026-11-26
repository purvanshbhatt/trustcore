'use client';

import React, { useEffect } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { SecurityGauge } from '@/components/SecurityGauge';
import { track } from '@/lib/analytics';
import { useBilling } from '@/lib/billing';
import { getLockedInfo, isPreviewReport, type Report } from '@/lib/types';

interface PreviewLockedPanelProps {
  report: Report;
  /** Hide the score gauge where the page already renders one. */
  showGauge?: boolean;
}

/**
 * Reports whose `preview_locked` event already fired in this page load, so one
 * report counts once however often its panel mounts. The ids stay in memory and
 * are never sent anywhere.
 */
const trackedPreviewReports = new Set<string>();

/**
 * Free-preview summary: the overall score plus what is withheld until checkout
 * (remaining findings, exact citations, fix prompts, exports).
 */
export function PreviewLockedPanel({ report, showGauge = true }: PreviewLockedPanelProps) {
  const { openPaywall } = useBilling();
  const { hiddenFindings } = getLockedInfo(report);
  const shown = report.findings.length;
  const reportId = report.id;
  const product = report.product;
  const preview = isPreviewReport(report);

  // This panel renders wherever a preview report is displayed (the four tool pages and /reports/[id]).
  useEffect(() => {
    if (!preview || trackedPreviewReports.has(reportId)) {
      return;
    }
    trackedPreviewReports.add(reportId);
    // Enumerated value only: never the report id.
    track('preview_locked', { product });
  }, [preview, reportId, product]);

  return (
    <div className="rounded-xl border border-blue-500/40 bg-blue-500/5 p-5 print:hidden">
      <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-12">
        {showGauge && (
          <div className="flex justify-center md:col-span-3">
            <SecurityGauge score={report.summary.risk_score} label="Overall Readiness Score" size="sm" showSimulator={false} />
          </div>
        )}

        <div className={`space-y-2 ${showGauge ? 'md:col-span-6' : 'md:col-span-9'}`}>
          <div className="flex items-center space-x-2 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-300">
            <Lock className="h-3.5 w-3.5" />
            <span>Free preview</span>
          </div>
          <h3 className="text-sm font-bold text-zinc-100">
            Showing your overall score and the top {shown} finding{shown === 1 ? '' : 's'}
          </h3>
          <p className="text-xs leading-relaxed text-zinc-300">
            {hiddenFindings > 0 ? (
              <>
                <strong className="font-mono text-white">{hiddenFindings}</strong> more finding
                {hiddenFindings === 1 ? ' is' : 's are'} hidden.{' '}
              </>
            ) : null}
            Exact source citations, copy-paste fix prompts and Markdown / PDF exports unlock after checkout.
          </p>
        </div>

        <div className="flex justify-start md:col-span-3 md:justify-end">
          <button
            type="button"
            onClick={() => openPaywall('preview_panel')}
            className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-500 active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Unlock full report</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface LockedPlaceholderProps {
  /** What is withheld, e.g. "Fix prompts". */
  title: string;
  description?: string;
  className?: string;
}

/** Stand-in for a section a preview report does not include. It never shows sample content. */
export function LockedPlaceholder({
  title,
  description = 'Included in the full report. Unlock it with a scan credit or a subscription.',
  className = '',
}: LockedPlaceholderProps) {
  const { openPaywall } = useBilling();

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-zinc-700 bg-[#0d0e14] px-4 py-3.5 text-xs ${className}`}
    >
      <div className="flex items-start space-x-2.5">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400">
          <Lock className="h-4 w-4" />
        </div>
        <div>
          <p className="font-semibold text-zinc-200">{title} — locked in the free preview</p>
          <p className="mt-0.5 text-zinc-500">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openPaywall('locked_section')}
        className="shrink-0 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-1.5 font-semibold text-blue-200 transition hover:bg-blue-500/20"
      >
        Unlock
      </button>
    </div>
  );
}
