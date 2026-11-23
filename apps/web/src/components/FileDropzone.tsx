'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, File, Trash2, Code2, Sparkles, Plus } from 'lucide-react';
import { ScanInputFile } from '@/lib/types';

interface FileDropzoneProps {
  files: ScanInputFile[];
  onFilesChange: (files: ScanInputFile[]) => void;
  onLoadSample: () => void;
  sampleLabel?: string;
  acceptLabel?: string;
}

export function FileDropzone({
  files,
  onFilesChange,
  onLoadSample,
  sampleLabel = 'Load Realistic Sample',
  acceptLabel = 'Supported: .json, .sql, .ts, .js, .py, .md, .env',
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteFilename, setPasteFilename] = useState('snippet.ts');
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

  const processUploadedFiles = async (fileList: FileList) => {
    const newFiles: ScanInputFile[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
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
    onFilesChange([...files, ...newFiles]);
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
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-blue-400">
          <UploadCloud className="h-6 w-6" />
        </div>

        <h4 className="mt-3 text-sm font-bold text-zinc-100">
          Drop repo files, configs, or manifests here
        </h4>
        <p className="mt-1 text-xs text-zinc-500 font-mono">{acceptLabel}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 hover:text-white"
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

          <button
            type="button"
            onClick={onLoadSample}
            className="flex items-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
            {sampleLabel}
          </button>
        </div>
      </div>

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
