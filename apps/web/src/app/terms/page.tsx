// TEMPLATE AWAITING LEGAL REVIEW.
// This text is a plain-language template. It has not been reviewed by counsel: do
// not treat it as final legal copy. No governing-law jurisdiction is named on
// purpose; counsel decides that together with the legal entity.

import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink } from '@/components/ContactLink';
import { LegalPage, LegalSection } from '@/components/LegalPage';
import { LEGAL_ENTITY } from '@/lib/site';

const TITLE = 'Terms of Service';
const DESCRIPTION =
  'Plain-language terms for TrustCore: what automated scans can and cannot tell you, acceptable use, payment, and limits on liability.';

export const metadata: Metadata = {
  title: `${TITLE} — TrustCore`,
  description: DESCRIPTION,
  alternates: { canonical: '/terms' },
  openGraph: {
    title: `${TITLE} — TrustCore`,
    description: DESCRIPTION,
    url: '/terms',
    siteName: 'TrustCore',
    type: 'article',
  },
};

const LINK_CLASS = 'font-semibold text-blue-400 hover:underline';

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Terms"
      title={TITLE}
      intro={`These terms apply when you use TrustCore, which is provided by ${LEGAL_ENTITY}. By using the service you agree to them.`}
    >
      <LegalSection title="1. The service" id="service">
        <p>
          TrustCore runs automated scans on the code, configuration and documents you submit and returns a
          report of what it found.
        </p>
      </LegalSection>

      <LegalSection title="2. What a scan is, and what it is not" id="scans">
        <p>Automated scans can miss issues, and they can report false positives.</p>
        <p>
          Results are not a guarantee of security or compliance. A report is not a penetration test, an audit
          opinion or legal advice.
        </p>
        <p>You are responsible for the decisions you make based on a report.</p>
      </LegalSection>

      <LegalSection title="3. The code you submit" id="your-code">
        <p>You must have the right to scan the code you submit.</p>
        <p>
          How submitted code is handled is described on the{' '}
          <Link href="/security" className={LINK_CLASS}>
            Security page
          </Link>{' '}
          and in the{' '}
          <Link href="/privacy" className={LINK_CLASS}>
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use" id="acceptable-use">
        <p>When you use TrustCore, do not:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>submit code, configuration or documents you do not have the right to scan;</li>
          <li>try to get around rate limits, the free preview limit or payment;</li>
          <li>try to disrupt or overload the service, or to access data that belongs to another account;</li>
          <li>use the service to break the law.</li>
        </ul>
        <p>We may suspend or end access that breaks these rules.</p>
      </LegalSection>

      <LegalSection title="5. Plans and payment" id="payment">
        <p>
          Launch Audit is a one-time purchase for a single audit. Pro Builder is a monthly subscription. The
          price is shown before you pay, and payments are processed by Stripe.
        </p>
      </LegalSection>

      <LegalSection title="6. Done-For-You AI Readiness Sprint" id="sprint">
        <p>
          The Done-For-You AI Readiness Sprint is governed by a separate statement of work agreed with you.
        </p>
      </LegalSection>

      <LegalSection title='7. Provided "as is"' id="as-is">
        <p>
          The service is provided &quot;as is&quot;, without warranties of any kind, to the extent permitted by
          law.
        </p>
      </LegalSection>

      <LegalSection title="8. Limit on liability" id="liability">
        <p>
          To the extent permitted by law, {LEGAL_ENTITY}&apos;s total liability in connection with the service
          is limited to the greater of (a) the fees you paid in the 12 months before the claim and (b) USD 100.
        </p>
        <p>
          To the extent permitted by law, {LEGAL_ENTITY} is not liable for indirect or consequential losses.
        </p>
      </LegalSection>

      <LegalSection title="9. Governing law" id="governing-law">
        <p>
          These terms are governed by the laws stated in your order form or, absent one, the provider&apos;s
          place of incorporation.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact" id="contact">
        <p>
          Questions about these terms:{' '}
          <ContactLink className={LINK_CLASS} placeholderClassName="text-zinc-400" />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
