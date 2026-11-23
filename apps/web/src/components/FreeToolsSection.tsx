'use client';

import React, { useState } from 'react';
import {
  Zap,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Download,
  Copy,
  Check,
  ArrowRight,
  Terminal,
  FileCode,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export function FreeToolsSection() {
  const [activeTool, setActiveTool] = useState<'scan' | 'mcp' | 'soc2'>('scan');

  // Tool 1: 60-Second Scan State
  const [scanInput, setScanInput] = useState(
    `const OPENAI_API_KEY = "sk-proj-49f993a89bc2138947b198274a9b8c7d6e5f4a3b2c1d";\nCREATE POLICY "Public access" ON users FOR ALL USING (true);`
  );
  const [scanResult, setScanResult] = useState<{
    score: number;
    issues: string[];
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  // Tool 2: MCP Config Sanitizer State
  const [rawMcpJson, setRawMcpJson] = useState(`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],
      "env": {
        "ANTHROPIC_API_KEY": "sk-ant-live-secret-prod-token-9988223344"
      }
    },
    "shell_tools": {
      "command": "bash",
      "confirmation_required": false
    }
  }
}`);
  const [sanitizedMcpJson, setSanitizedMcpJson] = useState<string | null>(null);
  const [copiedMcp, setCopiedMcp] = useState(false);

  // Tool 3: SOC 2 Gap Checker State
  const [soc2Checks, setSoc2Checks] = useState<{ [key: string]: boolean }>({
    rls: true,
    canary: false,
    secrets: false,
    humanApproval: true,
    packages: false,
  });

  const handleRunFreeScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const issues: string[] = [];
      let score = 100;

      // Deterministic Checks
      if (
        scanInput.includes('sk-') ||
        scanInput.includes('API_KEY') ||
        scanInput.includes('sk_test_') ||
        scanInput.includes('sk_live_') ||
        scanInput.includes('AIzaSy') ||
        /eyJhbGciOi[a-zA-Z0-9_\-\.]{20,}/.test(scanInput)
      ) {
        issues.push('Hardcoded Secret Token Detected (OpenAI/Anthropic/Stripe/JWT service role pattern)');
        score -= 35;
      }

      if (
        scanInput.includes('USING (true)') ||
        scanInput.includes('FOR ALL') ||
        scanInput.includes('WITH CHECK (true)') ||
        /auth\.uid\(\)\s*IS\s*NULL/i.test(scanInput)
      ) {
        issues.push('Overly Permissive RLS Policy (Unauthenticated Public Data Access)');
        score -= 35;
      }

      if (
        scanInput.includes('auth0-next-toolkit') ||
        scanInput.includes('react-domm') ||
        scanInput.includes('express-security-kit')
      ) {
        issues.push('Unverified AI-Hallucinated Package in manifest dependencies');
        score -= 20;
      }

      if (scanInput.includes('postgresql://') && scanInput.includes('@')) {
        issues.push('Plaintext Database Connection String with Embedded Password');
        score -= 25;
      }

      if (issues.length === 0) {
        issues.push('No obvious secret leaks, database credentials, or permissive RLS policies detected.');
      }

      setScanResult({ score: Math.max(score, 10), issues });
      setIsScanning(false);
    }, 400);
  };

  const handleSanitizeMcp = () => {
    try {
      const parsed = JSON.parse(rawMcpJson);
      const serverDict = parsed.mcpServers || parsed.servers || parsed;

      if (typeof serverDict === 'object' && serverDict !== null) {
        for (const key of Object.keys(serverDict)) {
          const s = serverDict[key];
          if (typeof s !== 'object' || s === null) continue;

          // Restrict root mounts in args
          if (Array.isArray(s.args)) {
            s.args = s.args.map((arg: unknown) => {
              if (typeof arg === 'string') {
                if (arg === '/' || arg === '/root') return './workspace';
                if (arg.startsWith('--path=/')) return '--path=./workspace';
              }
              return arg;
            });
          }

          // Redact plaintext secrets in env
          if (s.env && typeof s.env === 'object') {
            for (const envKey of Object.keys(s.env)) {
              s.env[envKey] = `\${${envKey}}`;
            }
          }

          // Enforce confirmation
          if (s.confirmation_required === false) {
            s.confirmation_required = true;
          }
        }
      }
      setSanitizedMcpJson(JSON.stringify(parsed, null, 2));
    } catch {
      // Regex fallback handling varied spacing, single quotes, or comments
      const cleaned = rawMcpJson
        .replace(/"confirmation_required"\s*:\s*false/g, '"confirmation_required": true')
        .replace(/'confirmation_required'\s*:\s*false/g, "'confirmation_required': true")
        .replace(/"(sk-(?:ant|proj)?[a-zA-Z0-9_\-]{15,})"/g, '"${ANTHROPIC_API_KEY}"')
        .replace(/"(ghp_[a-zA-Z0-9]{20,})"/g, '"${GITHUB_TOKEN}"')
        .replace(/"(ey[a-zA-Z0-9_\-\.]{30,})"/g, '"${SUPABASE_SERVICE_KEY}"')
        .replace(/"\/"/g, '"./workspace"');
      setSanitizedMcpJson(cleaned);
    }
  };

  const handleCopySanitized = () => {
    if (!sanitizedMcpJson) return;
    navigator.clipboard.writeText(sanitizedMcpJson);
    setCopiedMcp(true);
    setTimeout(() => setCopiedMcp(false), 2000);
  };

  const soc2Score = Math.round(
    (Object.values(soc2Checks).filter(Boolean).length /
      Object.keys(soc2Checks).length) *
      100
  );

  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#11121d] to-[#0c0d14] p-5 sm:p-7 space-y-6">
      {/* Lead Magnet Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-5">
        <div>
          <div className="inline-flex items-center space-x-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-400 uppercase tracking-wider">
            <Zap className="h-3 w-3" />
            <span>Instant Developer Tools • No Signup Required</span>
          </div>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-white">
            TrustCore Free AI Readiness Suite
          </h2>
          <p className="mt-0.5 text-xs text-zinc-400">
            Run immediate zero-friction security audits right inside your browser session.
          </p>
        </div>

        {/* Free Tool Selector Pills */}
        <div className="flex items-center rounded-xl border border-zinc-800 bg-[#090a0f] p-1 text-xs">
          <button
            onClick={() => setActiveTool('scan')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
              activeTool === 'scan'
                ? 'bg-blue-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>60s Security Scan</span>
          </button>

          <button
            onClick={() => setActiveTool('mcp')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
              activeTool === 'mcp'
                ? 'bg-purple-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>MCP Sanitizer</span>
          </button>

          <button
            onClick={() => setActiveTool('soc2')}
            className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 font-medium transition ${
              activeTool === 'soc2'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>SOC 2 Gap Checker</span>
          </button>
        </div>
      </div>

      {/* TOOL 1: 60-Second AI Security Scan */}
      {activeTool === 'scan' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Paste Code, Env, or SQL Snippet
              </h3>
              <p className="text-xs text-zinc-400">
                Tests for committed OpenAI keys, unauthenticated RLS rules, and AI hallucinated packages.
              </p>
            </div>
            <button
              onClick={handleRunFreeScan}
              disabled={isScanning}
              className="flex items-center space-x-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-500 disabled:opacity-50 transition"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{isScanning ? 'Auditing Snippet...' : 'Run Free 60s Scan'}</span>
            </button>
          </div>

          <textarea
            rows={4}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-[#08090e] p-3 font-mono text-xs text-zinc-200 focus:border-blue-500 focus:outline-none leading-relaxed"
          />

          {scanResult && (
            <div className="rounded-xl border border-zinc-800 bg-[#090a10] p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <span
                    className={`font-mono text-lg font-bold ${
                      scanResult.score >= 80 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    Score: {scanResult.score}/100
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      scanResult.score >= 80
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {scanResult.score >= 80 ? 'PASSED HEURISTIC' : 'BLOCKED PRE-LAUNCH'}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 font-mono">
                  Engine 1 Deterministic Fast-Check
                </span>
              </div>

              <div className="space-y-1.5">
                {scanResult.issues.map((iss, i) => (
                  <div key={i} className="flex items-start space-x-2 text-xs text-zinc-300">
                    <ShieldAlert className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>{iss}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TOOL 2: Free MCP Config Sanitizer */}
      {activeTool === 'mcp' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                MCP Config Sanitizer (Claude Desktop & Agent Workstations)
              </h3>
              <p className="text-xs text-zinc-400">
                Strips hardcoded tokens into environment variables and jails filesystem access from root (/) to sandbox.
              </p>
            </div>
            <button
              onClick={handleSanitizeMcp}
              className="flex items-center space-x-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-purple-500 transition"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Sanitize & Restrict Privileges</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-zinc-400 font-mono mb-1 block">
                Raw MCP Configuration:
              </span>
              <textarea
                rows={7}
                value={rawMcpJson}
                onChange={(e) => setRawMcpJson(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-[#08090e] p-3 font-mono text-xs text-zinc-300 focus:border-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-emerald-400 font-mono">
                  Sanitized Production Manifest:
                </span>
                {sanitizedMcpJson && (
                  <button
                    onClick={handleCopySanitized}
                    className="flex items-center space-x-1 text-[11px] text-zinc-400 hover:text-white"
                  >
                    {copiedMcp ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedMcp ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="rounded-xl border border-zinc-800 bg-[#08090e] p-3 font-mono text-xs text-zinc-300 h-[152px] overflow-y-auto">
                {sanitizedMcpJson ? (
                  <pre className="whitespace-pre-wrap">{sanitizedMcpJson}</pre>
                ) : (
                  <span className="text-zinc-600">
                    Click &quot;Sanitize & Restrict Privileges&quot; to generate hardened JSON...
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOOL 3: Free SOC 2 Gap Checker */}
      {activeTool === 'soc2' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Interactive SOC 2 Readiness Self-Audit
              </h3>
              <p className="text-xs text-zinc-400">
                Toggle compliance controls to view your immediate readiness posture and compliance gaps.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-zinc-400">Readiness Score:</span>
              <span
                className={`text-base font-bold font-mono ${
                  soc2Score >= 80
                    ? 'text-emerald-400'
                    : soc2Score >= 60
                    ? 'text-amber-400'
                    : 'text-red-400'
                }`}
              >
                {soc2Score}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {[
              {
                id: 'rls',
                title: 'Row Level Security (RLS) on all user data tables',
                desc: 'Blocks unauthenticated public data reads and modifications.',
              },
              {
                id: 'canary',
                title: 'Canary token injection test harness active',
                desc: 'Alerts when adversarial prompt injection extracts internal secrets.',
              },
              {
                id: 'secrets',
                title: 'Zero plaintext API keys in dotfiles or repos',
                desc: 'All LLM and database credentials stored in secret managers.',
              },
              {
                id: 'humanApproval',
                title: 'Human-in-the-loop approval on destructive agent tools',
                desc: 'confirmation_required: true on bash and SQL execution.',
              },
              {
                id: 'packages',
                title: 'Automated AI package hallucination verification',
                desc: 'Verifies npm/pip packages exist in public registries before build.',
              },
            ].map((chk) => {
              const checked = !!soc2Checks[chk.id];
              return (
                <label
                  key={chk.id}
                  className={`flex items-start justify-between p-3 rounded-lg border cursor-pointer transition select-none ${
                    checked
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-zinc-800 bg-zinc-900/30 hover:border-zinc-700'
                  }`}
                >
                  <div className="space-y-0.5 pr-3">
                    <span className="text-xs font-semibold text-zinc-200 block">
                      {chk.title}
                    </span>
                    <p className="text-[11px] text-zinc-500">{chk.desc}</p>
                  </div>

                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setSoc2Checks((prev) => ({ ...prev, [chk.id]: e.target.checked }))
                    }
                    className="mt-1 h-4 w-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
