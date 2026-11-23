'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

interface SecurityGaugeProps {
  score?: number;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showSimulator?: boolean;
}

export function SecurityGauge({
  score = 42,
  maxScore = 100,
  label = 'AI Readiness Posture',
  size = 'md',
  showSimulator = true,
}: SecurityGaugeProps) {
  const [simulatedScore, setSimulatedScore] = useState<number | null>(null);

  const currentScore = simulatedScore !== null ? simulatedScore : score;
  const isSimulated = simulatedScore !== null;

  // Arc calculation (240 degree gauge from 150 deg to 390 deg)
  const radius = size === 'sm' ? 40 : size === 'lg' ? 70 : 54;
  const strokeWidth = size === 'sm' ? 6 : size === 'lg' ? 10 : 8;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * (240 / 360);
  const safeMax = maxScore > 0 ? maxScore : 100;
  const normalizedScore = Math.min(Math.max(currentScore, 0), safeMax);
  const strokeDashoffset = arcLength - (arcLength * normalizedScore) / safeMax;

  const getStatus = (val: number) => {
    if (val >= 80) return { text: 'PASSED', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', stroke: '#10b981' };
    if (val >= 60) return { text: 'WARNING', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', stroke: '#f59e0b' };
    return { text: 'BLOCKED', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', stroke: '#ef4444' };
  };

  const status = getStatus(currentScore);

  const dimension = size === 'sm' ? 100 : size === 'lg' ? 170 : 136;
  const center = dimension / 2;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: dimension, height: dimension * 0.88 }}>
        <svg
          width={dimension}
          height={dimension}
          viewBox={`0 0 ${dimension} ${dimension}`}
          className="overflow-visible"
        >
          {/* Background Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#1f2333"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(150 ${center} ${center})`}
          />

          {/* Threshold marker at 75 */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.15)"
            strokeWidth={strokeWidth + 2}
            strokeDasharray={`2 ${circumference}`}
            strokeDashoffset={-(arcLength * 0.75)}
            transform={`rotate(150 ${center} ${center})`}
          />

          {/* Active Score Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={status.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={normalizedScore === 0 ? `0 ${circumference}` : `${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(150 ${center} ${center})`}
            className="transition-all duration-700 ease-out"
          />
        </svg>

        {/* Center Score Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2 text-center pointer-events-none">
          <span className={`font-mono font-extrabold tracking-tight ${size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl'} ${status.color}`}>
            {currentScore}
          </span>
          <span className="text-[10px] text-zinc-500 font-mono -mt-0.5">/100</span>
        </div>
      </div>

      {/* Status Pill */}
      <div className="mt-1 flex items-center space-x-1.5">
        <span className={`inline-flex items-center space-x-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase border ${status.bg} ${status.color} ${status.border}`}>
          {currentScore >= 80 ? (
            <ShieldCheck className="h-3 w-3" />
          ) : currentScore >= 60 ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <ShieldAlert className="h-3 w-3" />
          )}
          <span>{status.text}</span>
        </span>
      </div>

      <span className="mt-1 text-[11px] text-zinc-400 font-medium text-center">
        {label}
      </span>

      {/* Interactive Simulation Controls */}
      {showSimulator && (
        <div className="mt-3 flex items-center space-x-2 pt-2 border-t border-zinc-800/80 w-full justify-center">
          <button
            onClick={() => setSimulatedScore(isSimulated ? null : 96)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition ${
              isSimulated
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-zinc-800/80 text-zinc-300 border border-zinc-700/60 hover:bg-zinc-700 hover:text-white'
            }`}
          >
            <Sparkles className="h-3 w-3 text-emerald-400" />
            <span>{isSimulated ? 'Reset Baseline' : 'Simulate Fix (96/100)'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
