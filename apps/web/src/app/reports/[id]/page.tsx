'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  Download,
  Printer,
  Share2,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  Copy,
  Check,
  FileCode,
  Lock,
} from 'lucide-react';
import { Report, isPreviewReport } from '@/lib/types';
import { getReport, deleteReport, isDemoReport, toUiError, type UiError } from '@/lib/api';
import { PreviewLockedPanel } from '@/components/PreviewLock';
import { ReportBody } from '@/components/ReportBody';
import { ApiErrorNotice } from '@/components/ApiErrorNotice';
import { ReportFlags } from '@/components/ReportFlags';

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = (params?.id as string) || 'rpt_lg_demo_7721';

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<UiError | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<UiError | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  // Bumped by the Retry button to re-run the load effect.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const rep = await getReport(reportId);
        if (active) {
          setReport(rep);
        }
      } catch (err) {
        // 401/403/404 and other API errors: never substitute demo findings for a real report id.
        if (active) {
          setReport(null);
          setLoadError(toUiError(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [reportId, reloadToken]);

  const handleReload = () => setReloadToken((token) => token + 1);

  // Preview reports withhold citations and fix prompts, so exporting them is locked too.
  const preview = isPreviewReport(report);

  const handleDeleteReport = async () => {
    if (!report || isDeleting) return;
    const confirmed = window.confirm(
      'Delete this report permanently? This removes it from your account and cannot be undone.'
    );
    if (!confirmed) return;

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await deleteReport(report.id);
      router.push('/' + report.product);
    } catch (err) {
      setDeleteError(toUiError(err));
      setIsDeleting(false);
    }
  };

  const handleExportJSON = () => {
    if (!report || preview) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!report || preview) return;
    const md = [
      `# TrustCore Security & Readiness Report`,
      `**Report ID:** \`${report.id}\`  `,
      `**Title:** ${report.title}  `,
      `**Product:** ${report.product.toUpperCase()}  `,
      `**Date:** ${report.created_at}  `,
      `**Readiness Score:** ${report.summary.risk_score}/100 (${report.summary.readiness_status})  `,
      '',
      `## Executive Summary`,
      report.executive_summary,
      '',
      `## Summary Metrics`,
      `- Total Findings: ${report.summary.total_findings}`,
      `- Critical: ${report.summary.critical_count}`,
      `- High: ${report.summary.high_count}`,
      `- Medium: ${report.summary.medium_count}`,
      `- Low: ${report.summary.low_count}`,
      '',
      `## Deterministic Findings`,
    ];

    report.findings.forEach((f, i) => {
      md.push(`### ${i + 1}. [${f.severity}] ${f.title} (${f.rule_id})`);
      md.push(`- **Category:** ${f.category}`);
      md.push(`- **Description:** ${f.description}`);
      md.push(`- **File:** \`${f.citation.file_path}\` (Line ${f.citation.line_start || 'N/A'})`);
      md.push(`- **Snippet:** \`${f.citation.snippet}\``);
      md.push(`- **Impact:** ${f.impact}`);
      md.push('');
    });

    if (report.remediation_prompts && report.remediation_prompts.length > 0) {
      md.push(`## Actionable Remediation Prompts`);
      report.remediation_prompts.forEach((p) => {
        md.push(`### ${p.title} (Target: ${p.target_tool})`);
        md.push('```text');
        md.push(p.prompt_text);
        md.push('```');
        md.push('');
      });
    }

    const blob = new Blob([md.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (preview) return;
    window.print();
  };

  const handleShareLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Loading verifiable report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    const isNotFound = loadError === null || loadError.status === 404 || loadError.status === 403;
    return (
      <div className="p-8 text-center space-y-3">
        <h3 className="text-base font-semibold text-zinc-200">
          {isNotFound ? 'Report Not Found' : 'Report Unavailable'}
        </h3>
        {isNotFound ? (
          <p className="text-xs text-zinc-400">
            This report does not exist, was deleted, or belongs to another account.
          </p>
        ) : (
          // Load failures show the real error with Retry; a sample report is never shown in its place.
          <ApiErrorNotice error={loadError} onRetry={handleReload} className="mx-auto max-w-md text-left" />
        )}
        <Link href="/dashboard" className="inline-block text-xs text-blue-400 hover:underline">
          Return to Overview Hub
        </Link>
      </div>
    );
  }

  const canDelete = !isDemoReport(report);
  const exportLockedTitle = 'Exports unlock with the full report';

  return (
    <div className="space-y-8 pb-16 print:p-0">
      {/* Top Action Bar (Hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4 print:hidden">
        <Link
          href={`/${report.product}`}
          className="inline-flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="font-mono">Back to {report.product.toUpperCase()}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleShareLink}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
          >
            {copiedLink ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5" />
                <span>Share</span>
              </>
            )}
          </button>

          {/* Exports are locked for free-preview reports */}
          <button
            onClick={handleExportMarkdown}
            disabled={preview}
            title={preview ? exportLockedTitle : undefined}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900/60 disabled:hover:text-zinc-300"
          >
            {preview ? <Lock className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
            <span>Export Markdown</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={preview}
            title={preview ? exportLockedTitle : undefined}
            className="flex items-center space-x-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-zinc-900/60 disabled:hover:text-zinc-300"
          >
            {preview ? <Lock className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
            <span>Export JSON</span>
          </button>

          <button
            onClick={handlePrint}
            disabled={preview}
            title={preview ? exportLockedTitle : undefined}
            className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 shadow transition disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-blue-600"
          >
            {preview ? <Lock className="h-3.5 w-3.5" /> : <Printer className="h-3.5 w-3.5" />}
            <span>Print / PDF</span>
          </button>

          {canDelete && (
            <button
              onClick={handleDeleteReport}
              disabled={isDeleting}
              className="flex items-center space-x-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50 transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeleting ? 'Deleting…' : 'Delete Report'}</span>
            </button>
          )}
        </div>
      </div>

      <ApiErrorNotice error={deleteError} className="print:hidden" />

      {/* Report Header */}
      <div className="space-y-2">
        <ReportFlags report={report} />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-zinc-400">{report.id}</span>
          <span className="text-zinc-600">•</span>
          <span className="uppercase text-blue-400 font-mono font-bold tracking-wider">{report.product}</span>
          <span className="text-zinc-600">•</span>
          <span className="text-zinc-500 font-mono">
            {new Date(report.created_at).toLocaleString()}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {report.title}
        </h1>
      </div>

      {/* Free preview: what is withheld, with the unlock action (the gauge is in the banner below) */}
      {preview && <PreviewLockedPanel report={report} showGauge={false} />}

      <ReportBody report={report} />
    </div>
  );
}
