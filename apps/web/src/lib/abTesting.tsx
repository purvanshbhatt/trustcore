'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type LayoutDensity = 'standard' | 'compact' | 'executive';
export type CtaVariant = 'variant_a_speed' | 'variant_b_mcp' | 'variant_c_soc2';
export type RemediationFormat = 'split_cards' | 'diff_stream';

export interface ABExperimentState {
  density: LayoutDensity;
  ctaVariant: CtaVariant;
  remediationFormat: RemediationFormat;
  setDensity: (density: LayoutDensity) => void;
  setCtaVariant: (variant: CtaVariant) => void;
  setRemediationFormat: (format: RemediationFormat) => void;
  trackCtaClick: (variant?: CtaVariant) => void;
  conversionMetrics: {
    variant_a_speed: { clicks: number; conversionRate: string };
    variant_b_mcp: { clicks: number; conversionRate: string };
    variant_c_soc2: { clicks: number; conversionRate: string };
  };
}

const defaultState: ABExperimentState = {
  density: 'standard',
  ctaVariant: 'variant_b_mcp',
  remediationFormat: 'split_cards',
  setDensity: () => {},
  setCtaVariant: () => {},
  setRemediationFormat: () => {},
  trackCtaClick: () => {},
  conversionMetrics: {
    variant_a_speed: { clicks: 342, conversionRate: '14.8%' },
    variant_b_mcp: { clicks: 512, conversionRate: '28.4%' },
    variant_c_soc2: { clicks: 429, conversionRate: '21.2%' },
  },
};

const ABExperimentContext = createContext<ABExperimentState>(defaultState);

export function ABExperimentProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensity] = useState<LayoutDensity>('standard');
  const [ctaVariant, setCtaVariant] = useState<CtaVariant>('variant_b_mcp');
  const [remediationFormat, setRemediationFormat] = useState<RemediationFormat>('split_cards');
  const [metrics, setMetrics] = useState(defaultState.conversionMetrics);

  // Load persisted experiment states if available in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDensity = localStorage.getItem('tc_ab_density') as LayoutDensity | null;
      if (savedDensity && ['standard', 'compact', 'executive'].includes(savedDensity)) {
        setDensity(savedDensity);
      }
      const savedCta = localStorage.getItem('tc_ab_cta') as CtaVariant | null;
      if (savedCta && ['variant_a_speed', 'variant_b_mcp', 'variant_c_soc2'].includes(savedCta)) {
        setCtaVariant(savedCta);
      }
      const savedFormat = localStorage.getItem('tc_ab_format') as RemediationFormat | null;
      if (savedFormat && ['split_cards', 'diff_stream'].includes(savedFormat)) {
        setRemediationFormat(savedFormat);
      }
      const savedMetrics = localStorage.getItem('tc_ab_metrics');
      if (savedMetrics) {
        try {
          setMetrics(JSON.parse(savedMetrics));
        } catch {
          // fallback
        }
      }
    }
  }, []);

  const handleSetDensity = (d: LayoutDensity) => {
    setDensity(d);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tc_ab_density', d);
    }
  };

  const handleSetCtaVariant = (v: CtaVariant) => {
    setCtaVariant(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tc_ab_cta', v);
    }
  };

  const handleSetRemediationFormat = (f: RemediationFormat) => {
    setRemediationFormat(f);
    if (typeof window !== 'undefined') {
      localStorage.setItem('tc_ab_format', f);
    }
  };

  const trackCtaClick = (variant?: CtaVariant) => {
    const target = variant || ctaVariant;
    setMetrics((prev) => {
      const curr = prev[target] || { clicks: 100, conversionRate: '15.0%' };
      const newClicks = curr.clicks + 1;
      const baseImpressions = 1800;
      const rate = ((newClicks / baseImpressions) * 100).toFixed(1) + '%';
      const updated = {
        ...prev,
        [target]: {
          clicks: newClicks,
          conversionRate: rate,
        },
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('tc_ab_metrics', JSON.stringify(updated));
      }
      return updated;
    });
  };

  return (
    <ABExperimentContext.Provider
      value={{
        density,
        ctaVariant,
        remediationFormat,
        setDensity: handleSetDensity,
        setCtaVariant: handleSetCtaVariant,
        setRemediationFormat: handleSetRemediationFormat,
        trackCtaClick,
        conversionMetrics: metrics,
      }}
    >
      {children}
    </ABExperimentContext.Provider>
  );
}

export function useABExperiment() {
  return useContext(ABExperimentContext);
}
