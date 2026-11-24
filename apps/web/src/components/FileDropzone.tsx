'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, File, Trash2, Code2, Sparkles, Loader2, Info } from 'lucide-react';
import { ScanInputFile, ProductType, IngestSkippedFile } from '@/lib/types';
import { ingestUpload, isMockEnabled, toUiError, MAX_UPLOAD_BYTES, type UiError } from '@/lib/api';
import { ApiErrorNotice } from '@/components/ApiErrorNotice';

interface FileDropzoneProps {
  files: ScanInputFile[];
  onFilesChange: (files: ScanInputFile[]) => void;
  onLoadSample?: () => void;
  sampleLabel?: string;
  acceptLabel?: string;
  /** Product hint sent to the ingestion API so it applies that product's allow-list. */
  product?: ProductType;
  /** Value for the file input `accept` attribute, e.g. ".csv,.xlsx". */
  accept?: string;
  title?: string;
}

interface IngestSummary {
  readonly added: number;
  readonly skippedCount: number;
  readonly skipped: IngestSkippedFile[];
  readonly truncated: boolean;
}

/** Formats that need server-side parsing and cannot be read as text in mock mode. */
const SERVER_ONLY_EXTENSIONS: readonly string[] = ['zip', 'pdf', 'xlsx'];
const SKIPPED_PREVIEW_LIMIT = 5;

function extensionOf(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileDropzone({
  files,
  onFilesChange,
  onLoadSample,
  sampleLabel = 'Load Realistic Sample',
  acceptLabel = 'Supported: .json, .sql, .ts, .js, .py, .md, .env',
  product,
  accept,
  title = 'Drop repo files, configs, or manifests here',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteFilename, setPasteFilename] = useState('snippet.ts');
  const [pasteContent, setPasteContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<UiError | null>(null);
  const [summary, setSummary] = useState<IngestSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Latest staged files, so an upload that resolves late appends to current state.
  const filesRef = useRef(files);
  filesRef.current = files;
  // Last files the user picked, kept so a failed upload can be retried as-is.
  const lastSelectionRef = useRef<File[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processUploadedFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processUploadedFiles(e.target.files);
    }
    // Allow re-selecting the same file after a failed or removed upload.
    e.target.value = '';
  };

  const readLocally = async (selected: File[]) => {
    const newFiles: ScanInputFile[] = [];
    const serverOnly: string[] = [];
    for (const file of selected) {
      if (SERVER_ONLY_EXTENSIONS.includes(extensionOf(file.name))) {
        serverOnly.push(file.name);
        continue;
      }
      try {
        const text = await file.text();
        newFiles.push({
          filename: file.name,
          content: text,
          file_type: file.type || file.name.split('.').pop(),
        });
      } catch (err) {
        console.error(`Error reading ${file.name}:`, err);
      }
    }
    if (newFiles.length > 0) {
      onFilesChange([...filesRef.current, ...newFiles]);
    }
    if (serverOnly.length > 0) {
      setUploadError({
        status: null,
        message: `Mock mode cannot parse ${serverOnly.join(', ')}. ZIP, PDF, and XLSX uploads need the live API: set NEXT_PUBLIC_USE_MOCK=false and start the TrustCore API.`,
      });
    }
  };

  const processUploadedFiles = async (fileList: FileList) => {
    await uploadSelection(Array.from(fileList));
  };

  /** Retry re-sends the last selection, so a failed upload never has to be re-picked. */
  const handleRetryUpload = () => {
    if (lastSelectionRef.current.length > 0) {
      void uploadSelection(lastSelectionRef.current);
    }
  };

  const uploadSelection = async (selected: File[]) => {
    if (isUploading) return;
    lastSelectionRef.current = selected;
    setUploadError(null);
    setSummary(null);

    const totalBytes = selected.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_UPLOAD_BYTES) {
      setUploadError({
        status: null,
        message: `Upload is ${formatMegabytes(totalBytes)}; the limit is ${formatMegabytes(MAX_UPLOAD_BYTES)} per upload.`,
      });
      return;
    }

    if (isMockEnabled()) {
      await readLocally(selected);
      return;
    }

    setIsUploading(true);
    try {
      const result = await ingestUpload(selected, product);
      if (result.files.length > 0) {
        onFilesChange([...filesRef.current, ...result.files]);
      }
      setSummary({
        added: result.files.length,
        skippedCount: result.skipped_count,
        skipped: result.skipped,
        truncated: result.truncated,
      });
    } catch (err) {
      setUploadError(toUiError(err));
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddPastedSnippet = () => {
    if (!pasteContent.trim()) return;
    onFilesChange([
      ...files,
      {
        filename: pasteFilename || 'snippet.txt',
        content: pasteContent,
      },
    ]);
    setPasteContent('');
    setPasteMode(false);
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    onFilesChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-busy={isUploading}
        className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-800 bg-[#0c0d15] hover:border-zinc-700'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-blue-400">
          {isUploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <UploadCloud className="h-6 w-6" />
          )}
        </div>

        <h4 className="mt-3 text-sm font-bold text-zinc-100 text-center">
          {isUploading ? 'Uploading & extracting…' : title}
        </h4>
        <p className="mt-1 text-xs text-zinc-500 font-mono text-center">{acceptLabel}</p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
          >
            Browse Files
          </button>

          <button
            type="button"
            onClick={() => setPasteMode(!pasteMode)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            <Code2 className="mr-1.5 inline-block h-3.5 w-3.5 text-blue-400" />
            Paste Code/Config
          </button>

          {onLoadSample && (
            <button
              type="button"
              onClick={onLoadSample}
              className="flex items-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
              {sampleLabel}
            </button>
          )}
        </div>
      </div>

      {/* Upload / ingestion error */}
      <ApiErrorNotice
        error={uploadError}
        onRetry={uploadError !== null && uploadError.status !== null ? handleRetryUpload : undefined}
      />

      {/* Ingestion summary: what was staged, skipped, or truncated */}
      {summary && (
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f17] px-3.5 py-2.5 text-xs text-zinc-300 space-y-1.5">
          <div className="flex items-center space-x-2">
            <Info className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>
              Staged <strong className="font-mono text-zinc-100">{summary.added}</strong> file
              {summary.added === 1 ? '' : 's'}
              {summary.skippedCount > 0 && (
                <>
                  {' '}
                  • skipped <strong className="font-mono text-amber-300">{summary.skippedCount}</strong>
                </>
              )}
              {summary.truncated && (
                <span className="text-amber-300"> • truncated at the ingestion limit</span>
              )}
            </span>
          </div>
          {summary.added === 0 && (
            <p className="text-amber-300">No scannable text files were found in this upload.</p>
          )}
          {summary.skipped.length > 0 && (
            <ul className="space-y-0.5 font-mono text-[11px] text-zinc-500">
              {summary.skipped.slice(0, SKIPPED_PREVIEW_LIMIT).map((item, idx) => (
                <li key={`${item.path}-${idx}`} className="truncate">
                  {item.path} — {item.reason}
                </li>
              ))}
              {summary.skippedCount > SKIPPED_PREVIEW_LIMIT && (
                <li>…and {summary.skippedCount - SKIPPED_PREVIEW_LIMIT} more</li>
              )}
            </ul>
          )}
        </div>
      )}

      {/* Code Paste Drawer */}
      {pasteMode && (
        <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">
              Paste Code, SQL, Policy, or Config
            </span>
            <input
              type="text"
              placeholder="Filename, e.g. schema.sql"
              value={pasteFilename}
              onChange={(e) => setPasteFilename(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-[#090a0f] px-2.5 py-1 font-mono text-xs text-zinc-200 focus:outline-none"
            />
          </div>
          <textarea
            rows={5}
            placeholder="Paste code or config text..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#08090f] p-3 font-mono text-xs text-zinc-200 focus:border-blue-500 focus:outline-none leading-relaxed"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setPasteMode(false)}
              className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddPastedSnippet}
              className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 shadow"
            >
              Add Snippet
            </button>
          </div>
        </div>
      )}

      {/* Selected Files Chips/List */}
      {files.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-[#0e0f17] p-4">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
              Staged Inputs ({files.length})
            </span>
            <button
              onClick={() => onFilesChange([])}
              className="text-xs text-zinc-500 hover:text-red-400 transition"
            >
              Clear All
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-xs"
              >
                <div className="flex items-center space-x-2 min-w-0">
                  <File className="h-4 w-4 shrink-0 text-blue-400" />
                  <span className="font-mono text-zinc-300 truncate">
                    {file.filename}
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveFile(idx)}
                  className="ml-2 text-zinc-500 hover:text-red-400 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
