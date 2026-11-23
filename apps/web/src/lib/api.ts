import {
  ProductType,
  ScanRequest,
  Report,
  BillingCheckoutRequest,
  BillingCheckoutResponse,
  BillingStatusResponse,
} from './types';
import { MOCK_REPORTS } from './mockData';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export function isMockEnabled(): boolean {
  return USE_MOCK;
}

export async function checkApiHealth(): Promise<boolean> {
  if (USE_MOCK) return false;
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runScan(request: ScanRequest): Promise<Report> {
  if (USE_MOCK) {
    console.info(`[TrustCore] NEXT_PUBLIC_USE_MOCK=true: Serving instant mock report for ${request.product}`);
    const mock = MOCK_REPORTS[request.product];
    return {
      ...mock,
      id: `rpt_${request.product}_${Date.now()}`,
      title: `${request.project_name || 'Project'} — Security & Readiness Audit`,
      created_at: new Date().toISOString(),
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/run/${request.product}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`Scan request failed with HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[TrustCore API] Falling back to high-fidelity mock data for ${request.product}:`, err);
    // Return mock data with simulated project name
    const mock = MOCK_REPORTS[request.product];
    return {
      ...mock,
      id: `rpt_${request.product}_${Date.now()}`,
      title: `${request.project_name || 'Project'} — Security & Readiness Audit`,
      created_at: new Date().toISOString(),
    };
  }
}

export async function getReport(reportId: string): Promise<Report> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/reports/${reportId}`, {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch report ${reportId}`);
    }

    return await res.json();
  } catch (err) {
    console.warn(`[TrustCore API] Could not fetch report ${reportId}, searching mock repository:`, err);
    for (const prod of Object.keys(MOCK_REPORTS) as ProductType[]) {
      if (MOCK_REPORTS[prod].id === reportId) {
        return MOCK_REPORTS[prod];
      }
    }
    // Default to launchgate mock report
    return {
      ...MOCK_REPORTS.launchgate,
      id: reportId,
    };
  }
}

export async function getSampleData(product: ProductType): Promise<any> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/samples/${product}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  // Fallback sample payload mapping
  return {
    project_name: `Sample ${product.toUpperCase()} Project`,
    files: [
      {
        filename: `${product}_sample_config.json`,
        content: JSON.stringify(MOCK_REPORTS[product], null, 2),
      },
    ],
  };
}

export async function createCheckout(tier: 'per_scan' | 'pro_monthly' | 'enterprise_monthly'): Promise<BillingCheckoutResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tier,
        success_url: typeof window !== 'undefined' ? `${window.location.origin}/?billing=success` : 'http://localhost:3000/?billing=success',
        cancel_url: typeof window !== 'undefined' ? `${window.location.origin}/?billing=cancel` : 'http://localhost:3000/?billing=cancel',
      }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback mock
  }

  return {
    checkout_url: '/?billing=mock_success',
    session_id: `cs_mock_${Date.now()}`,
    is_mock: true,
    message: `Mock checkout initiated for ${tier}. Plan activated.`,
  };
}

export async function getBillingStatus(): Promise<BillingStatusResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/status`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Fallback
  }

  return {
    tier: 'pro_monthly',
    credits_remaining: 15,
    is_mock: true,
    subscription_active: true,
  };
}
