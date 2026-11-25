import type { Metadata } from 'next';
import { SampleAudit } from './SampleAudit';

const TITLE = 'Live sample audit — TrustCore';
const DESCRIPTION =
  'Open a full TrustCore report for a bundled demo app: readiness score, cited findings and copy-paste fix prompts. No login and no upload.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/sample' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/sample',
    siteName: 'TrustCore',
    type: 'website',
  },
};

export default function SamplePage() {
  return <SampleAudit />;
}
