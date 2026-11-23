'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Cpu,
  Lock,
  Unlock,
  Terminal,
  Globe,
  FileCode,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

interface BlastRadiusSimulatorProps {
  initialMode?: 'unrestricted' | 'hardened';
}

export function BlastRadiusSimulator({
  initialMode = 'unrestricted',
}: BlastRadiusSimulatorProps) {
  const [mode, setMode] = useState<'unrestricted' | 'hardened'>(initialMode);
  const [activeSurface, setActiveSurface] = useState<string | null>(null);

  const isHardened = mode === 'hardened';
  const blastRadiusPct = isHardened ? 22 : 100;
  const reductionPct = 78;

  const surfaces = [
    {
      id: 'filesystem',
      name: 'Filesystem Access',
      icon: FileCode,
      unrestricted: 'Root Mount (/) with recursive read/write scopes (*)',
      hardened: 'Jailed Path (./workspace) with read-only constraint',
      risk: isHardened ? 'LOW' : 'CRITICAL',
      color: isHardened ? 'text-emerald-400' : 'text-red-400',
      stroke: isHardened ? '#10b981' : '#ef4444',
      radius: isHardened ? 28 : 88,
    },
    {
      id: 'execution',
      name: 'Shell & Code Execution',
      icon: Terminal,
      unrestricted: 'Autonomous bash execution with confirmation_required: false',
      hardened: 'Human-in-the-loop approval prompt mandatory on exec',
      risk: isHardened ? 'LOW' : 'CRITICAL',
      color: isHardened ? 'text-emerald-400' : 'text-red-400',
      stroke: isHardened ? '#10b981' : '#ef4444',
      radius: isHardened ? 36 : 74,
    },
    {
      id: 'network',
      name: 'Network & Egress',
      icon: Globe,
      unrestricted: 'Unrestricted arbitrary external socket calls',
      hardened: 'Scoped to trusted internal API hosts only',
      risk: isHardened ? 'LOW' : 'HIGH',
      color: isHardened ? 'text-emerald-400' : 'text-amber-400',
      stroke: isHardened ? '#10b981' : '#f59e0b',
      radius: isHardened ? 24 : 60,
    },
    {
      id: 'credentials',
      name: 'Credential Storage',
      icon: Lock,
      unrestricted: 'Plaintext Anthropic token hardcoded in JSON manifest',
      hardened: 'Runtime env reference (${ANTHROPIC_API_KEY}) sealed',
      risk: isHardened ? 'ZERO' : 'CRITICAL',
      color: isHardened ? 'text-emerald-400' : 'text-red-400',
      stroke: isHardened ? '#10b981' : '#ef4444',
      radius: isHardened ? 16 : 46,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#10111a] p-5 sm:p-6 space-y-5">
      {/* Header and Toggle Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400">
              Interactive Attack Surface Visualizer
            </span>
          </div>
          <h3 className="mt-1 text-base font-bold text-white">
            AgentScope Blast Radius Simulator
          </h3>
          <p className="text-xs text-zinc-400">
            Dynamically evaluate how least-privilege scoping contracts the autonomous agent attack surface.
          </p>
        </div>

        {/* Mode Switcher Buttons */}
        <div className="flex items-center rounded-lg border border-zinc-800 bg-[#090a0f] p-1 text-xs">
          <button
            onClick={() => setMode('unrestricted')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 font-medium transition ${
              !isHardened
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Unlock className="h-3.5 w-3.5 text-red-400" />
            <span>Unrestricted Manifest</span>
          </button>

          <button
            onClick={() => setMode('hardened')}
            className={`flex items-center space-x-1.5 rounded-md px-3 py-1.5 font-medium transition ${
              isHardened
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Hardened Least-Privilege</span>
          </button>
        </div>
      </div>

      {/* Main Visualizer Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* SVG Circular Radar Simulator */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center relative p-4">
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
              {/* Concentric grid lines */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="#1f2333" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r="65" fill="none" stroke="#1f2333" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r="40" fill="none" stroke="#1f2333" strokeDasharray="3 3" />
              <circle cx="100" cy="100" r="15" fill="none" stroke="#1f2333" />

              {/* Crosshairs */}
              <line x1="100" y1="5" x2="100" y2="195" stroke="#1c202d" strokeWidth="1" />
              <line x1="5" y1="100" x2="195" y2="100" stroke="#1c202d" strokeWidth="1" />

              {/* Blast Radius Fill Polygon / Circle */}
              <circle
                cx="100"
                cy="100"
                r={isHardened ? 30 : 88}
                fill={isHardened ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.15)'}
                stroke={isHardened ? '#10b981' : '#ef4444'}
                strokeWidth="2"
                className="transition-all duration-700 ease-in-out"
              />

              {/* Surface Nodes */}
              {surfaces.map((s, idx) => {
                const angle = (idx * (360 / surfaces.length) - 90) * (Math.PI / 180);
                const currentR = s.radius;
                const cx = 100 + currentR * Math.cos(angle);
                const cy = 100 + currentR * Math.sin(angle);
                const isSelected = activeSurface === s.id;

                return (
                  <g
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setActiveSurface((prev) => (prev === s.id ? null : s.id))}
                  >
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 9 : 6}
                      fill={isHardened ? '#10b981' : '#ef4444'}
                      className="transition-all duration-500"
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 16 : 10}
                      fill="none"
                      stroke={isHardened ? '#10b981' : '#ef4444'}
                      strokeOpacity="0.4"
                      className="animate-ping"
                      style={{
                        transformBox: 'fill-box',
                        transformOrigin: 'center',
                        animationDuration: '3s',
                      }}
                    />
                  </g>
                );
              })}

              {/* Center Agent Core Icon */}
              <circle cx="100" cy="100" r="12" fill="#181b28" stroke="#3b82f6" strokeWidth="1.5" />
            </svg>

            {/* Overlay Center Badge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className={`text-2xl font-black font-mono tracking-tight ${isHardened ? 'text-emerald-400' : 'text-red-400'}`}>
                {blastRadiusPct}%
              </span>
              <span className="text-[9px] uppercase tracking-wider font-semibold text-zinc-400">
                {isHardened ? '-78% Reduced' : 'Unrestricted'}
              </span>
            </div>
          </div>

          <div className="mt-2 text-center">
            <span className="text-[11px] text-zinc-400">
              {isHardened
                ? 'Hardened baseline limits tools to sandboxed workspace scope.'
                : 'Default configuration grants unchecked system and credential exposure.'}
            </span>
          </div>
        </div>

        {/* Detailed Surface Cards */}
        <div className="lg:col-span-7 space-y-2.5">
          {surfaces.map((s) => {
            const Icon = s.icon;
            const isSelected = activeSurface === s.id;

            return (
              <div
                key={s.id}
                onClick={() => setActiveSurface((prev) => (prev === s.id ? null : s.id))}
                className={`cursor-pointer rounded-xl border p-3.5 transition ${
                  isSelected
                    ? 'border-purple-500/60 bg-purple-500/5'
                    : 'border-zinc-800 bg-[#0c0d14] hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 text-zinc-300">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-200">{s.name}</h4>
                    </div>
                  </div>

                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold border ${
                      s.risk === 'CRITICAL'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : s.risk === 'HIGH'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {s.risk} RISK
                  </span>
                </div>

                <div className="mt-2 text-[11px] text-zinc-400 font-mono">
                  {isHardened ? (
                    <div className="flex items-start space-x-1.5 text-emerald-300 bg-emerald-500/5 p-2 rounded border border-emerald-500/20">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{s.hardened}</span>
                    </div>
                  ) : (
                    <div className="flex items-start space-x-1.5 text-red-300 bg-red-500/5 p-2 rounded border border-red-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>{s.unrestricted}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
