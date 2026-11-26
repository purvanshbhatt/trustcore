// TEMPLATE AWAITING LEGAL REVIEW.
// This text is a plain-language template built only from the product's implemented
// data handling (see /security). It has not been reviewed by counsel: do not treat
// it as final legal copy, and do not add claims the service does not enforce.

import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink } from '@/components/ContactLink';
import { LegalPage, LegalSection, SubprocessorList } from '@/components/LegalPage';
import { LEGAL_ENTITY } from '@/lib/site';

const TITLE = 'Privacy Policy';
const DESCRIPTION =
  'What TrustCore processes when you scan code, what it stores, what it never keeps, and the subprocessors involved.';

export const metadata: Metadata = {
  title: `${TITLE} — TrustCore`,
  description: DESCRIPTION,
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: `${TITLE} — TrustCore`,
    description: DESCRIPTION,
    url: '/privacy',
    siteName: 'TrustCore',
    type: 'article',
  },
};

const LINK_CLASS = 'font-semibold text-blue-400 hover:underline';

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title={TITLE}
      intro={`What ${LEGAL_ENTITY} processes when you use TrustCore, what is stored, and what is never kept.`}
    >
      <LegalSection title="Who provides TrustCore" id="who">
        <p>
          TrustCore is provided by {LEGAL_ENTITY} (&quot;we&quot;). This policy covers the TrustCore website
          and the scanning service.
        </p>
      </LegalSection>

      <LegalSection title="Code and documents you submit" id="submissions">
        <p>
          Uploads and GitHub archives are parsed in memory. They are never written to disk and never stored.
        </p>
        <p>
          Detected credentials are masked, leaving only the first 4 and last 4 characters, before a report is
          returned, stored or sent to the AI layer. Logs contain no file contents.
        </p>
        <p>We do not use customer code, uploads or reports to train models.</p>
      </LegalSection>

      <LegalSection title="Reports" id="reports">
        <p>
          Only the report that results from a scan is stored, and only for signed-in users. Each report belongs
          to one account: other accounts cannot read it, list it or delete it.
        </p>
        <p>
          With Zero-Retention Mode on, the scan runs in memory and the report is returned to you but never
          stored. Scans by signed-out visitors are never stored.
        </p>
      </LegalSection>

      <LegalSection title="Accounts and sign-in" id="accounts">
        <p>Sign-in and the database are provided by Supabase.</p>
      </LegalSection>

      <LegalSection title="Payments" id="payments">
        <p>Payments are processed by Stripe. Card details never reach TrustCore.</p>
      </LegalSection>

      <LegalSection title="Signed-out visitors" id="signed-out">
        <p>
          Signed-out visitors are identified by a salted hash of their IP address. It is used to enforce one
          free preview and rate limits.
        </p>
      </LegalSection>

      <LegalSection title="Analytics" id="analytics">
        <p>
          We use PostHog for product analytics. It records five product events: a sample was loaded, a scan
          was started, a locked preview was shown, the paywall was opened, and a checkout was completed.
        </p>
        <p>
          These events are not tied to a page: no page views and no page addresses are recorded. No cookies
          are set. Events are grouped by a random, anonymous id that is kept for the current browser tab only.
        </p>
        <p>
          The events contain no file names, file contents, repository URLs, report ids or email addresses.
        </p>
        <p>
          As with any web request, PostHog&apos;s servers see the IP address an event is sent from. We do not
          add it to the event.
        </p>
      </LegalSection>

      <LegalSection title="The optional AI layer" id="ai">
        <p>
          Findings, severities and the readiness score come from deterministic rules. An optional AI layer,
          provided through the Google Gemini API, only rewrites explanations and fix prompts. It receives
          redacted findings only. It never receives source files, zero-retention scans or free previews.
        </p>
      </LegalSection>

      <LegalSection title="Subprocessors" id="subprocessors">
        <p>These companies process data on our behalf, each for the purpose listed.</p>
        <SubprocessorList />
      </LegalSection>

      <LegalSection title="Your choices" id="choices">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>You can delete a report permanently.</li>
          <li>You can turn on Zero-Retention Mode so that a report is returned but never stored.</li>
          <li>You can scan while signed out; those scans are never stored.</li>
        </ul>
        <p>
          More detail on how submitted code is handled is on the{' '}
          <Link href="/security" className={LINK_CLASS}>
            Security page
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Contact" id="contact">
        <p>
          Questions or requests about your data:{' '}
          <ContactLink className={LINK_CLASS} placeholderClassName="text-zinc-400" />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
