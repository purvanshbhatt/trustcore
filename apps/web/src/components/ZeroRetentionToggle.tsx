'use client';

import React from 'react';
import { EyeOff } from 'lucide-react';

interface ZeroRetentionToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

/**
 * Zero-Retention Mode switch. When enabled the scan request is sent with
 * `ephemeral: true`: the API scans in memory, returns the report, and never
 * persists uploaded files or findings.
 */
export function ZeroRetentionToggle({ enabled, onChange, disabled = false }: ZeroRetentionToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      title="Scan in memory only. The report is returned once and never saved."
      className={`flex items-center space-x-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        enabled
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-zinc-800 bg-[#090a0f] text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <EyeOff className={`h-3.5 w-3.5 ${enabled ? 'text-emerald-400' : 'text-zinc-500'}`} />
      <span>Zero-Retention Mode</span>
      <span
        aria-hidden="true"
        className={`relative inline-block h-4 w-7 rounded-full transition ${
          enabled ? 'bg-emerald-500' : 'bg-zinc-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            enabled ? 'left-3.5' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}
