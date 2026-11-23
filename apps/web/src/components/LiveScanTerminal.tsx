'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CheckCircle2, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';

interface LiveScanTerminalProps {
  product?: string;
  onScanComplete?: () => void;
  autoStart?: boolean;
}

export function LiveScanTerminal({
  product = 'LaunchGate',
  onScanComplete,
  autoStart = true,
}: LiveScanTerminalProps) {
  const [currentStep, setCurrentStep] = useState(autoStart ? 0 : 4);
  const [isRunning, setIsRunning] = useState(autoStart);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const steps = [
    {
      id: 1,
      title: 'Engine 1 Ingestion: AST & File Tree Decomposition',
      detail: 'Parsing src/lib/api-client.ts, supabase/migrations, .env.production...',
      duration: '42ms',
      status: 'DONE',
    },
    {
      id: 2,
      title: 'Deterministic Rule Pack Evaluation (LaunchGate Pack v1.2)',
      detail: 'Secret regex matched OPENAI_API_KEY. Supabase RLS matched USING (true).',
      duration: '118ms',
      status: 'FINDINGS',
    },
    {
      id: 3,
      title: 'Supply-Chain & Package Registry Squatting Check',
      detail: 'NPM registry verification: auth0-next-toolkit flagged as hallucinated package.',
      duration: '89ms',
      status: 'HIGH RISK',
    },
    {
      id: 4,
      title: 'Engine 2 LLM Synthesis: Executive Summary & Cursor Prompts',
      detail: 'Formatted verified evidence into one-click copyable Cursor & Claude prompt cards.',
      duration: '210ms',
      status: 'GENERATED',
    },
  ];

  const handleSimulateScan = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRunning(true);
    setCurrentStep(0);

    let step = 0;
    timerRef.current = setInterval(() => {
      step += 1;
      if (step >= 4) {
        if (timerRef.current) clearInterval(timerRef.current);
        setCurrentStep(4);
        setIsRunning(false);
        if (onScanComplete) onScanComplete();
      } else {
        setCurrentStep(step);
      }
    }, 550);
  };

  useEffect(() => {
    if (autoStart) {
      handleSimulateScan();
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoStart]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#0c0d14] p-4 sm:p-5 font-mono text-xs shadow-lg">
      {/* Terminal Bar without faux browser chrome */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 font-sans">
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-blue-400">
            <Terminal className="h-3 w-3 mr-1 text-blue-400" />
            tc-runner
          </span>
          <span className="text-[11px] font-mono text-zinc-300">
            {product.toLowerCase()}::dual-engine
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSimulateScan}
            disabled={isRunning}
            className="flex items-center space-x-1 rounded-lg px-2.5 py-1 text-[11px] font-sans font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Auditing...' : 'Re-run Dual-Engine Scan'}</span>
          </button>
        </div>
      </div>

      {/* Terminal Stream Output */}
      <div className="mt-4 space-y-3 font-mono">
        {steps.map((step, idx) => {
          const isFinished = currentStep >= step.id;
          const isCurrent = currentStep === step.id - 1 && isRunning;

          return (
            <div
              key={step.id}
              className={`p-2.5 rounded-lg border transition-all ${
                isCurrent
                  ? 'border-blue-500/40 bg-blue-500/5'
                  : isFinished
                  ? 'border-zinc-800/80 bg-zinc-900/30'
                  : 'border-transparent opacity-40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {isFinished ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-zinc-700 shrink-0 ml-1 mr-1" />
                  )}
                  <span className={`font-semibold ${isFinished ? 'text-zinc-200' : 'text-zinc-400'}`}>
                    {step.title}
                  </span>
                </div>

                <div className="flex items-center space-x-2 text-[10px]">
                  <span className="text-zinc-500">{step.duration}</span>
                  <span
                    className={`rounded px-1.5 py-0.2 font-mono font-bold ${
                      step.status === 'FINDINGS' || step.status === 'HIGH RISK'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
              </div>

              {isFinished && (
                <p className="mt-1 text-[11px] text-zinc-400 pl-6 leading-relaxed">
                  {step.detail}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Terminal Footer */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
        <span>Dual-Engine Pipeline Latency: 459ms</span>
        <span className="text-emerald-400 flex items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
          Deterministic Evidence Cryptographically Verified
        </span>
      </div>
    </div>
  );
}
