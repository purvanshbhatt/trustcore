import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactLink } from '@/components/ContactLink';
import { LegalPage, LegalSection, SubprocessorList } from '@/components/LegalPage';

// Every statement on this page describes implemented behaviour. Do not add a claim
// here (or on the landing page's trust strip) that the service does not enforce.

const TITLE = 'How TrustCore Handles Your Code';
const DESCRIPTION =
  'Uploads and GitHub archives are parsed in memory and never stored. How TrustCore handles reports, secrets, the optional AI layer and subprocessors.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/security' },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: '/security',
    siteName: 'TrustCore',
    type: 'article',
  },
};

const LINK_CLASS = 'font-semibold text-blue-400 hover:underline';

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Security"
      title={TITLE}
      intro="What happens to the code and documents you submit, what is stored, and which other companies are involved."
    >
      <LegalSection title="Your files are parsed in memory" id="files">
        <p>
          Uploads and GitHub archives are parsed in memory. They are never written to disk and never stored.
        </p>
        <p>Only the resulting report is stored, and only for signed-in users.</p>
      </LegalSection>

      {/* The five implemented controls, one block each. */}

      <LegalSection title="Zero-Retention Mode" id="zero-retention">
        <p>
          With Zero-Retention Mode on, the scan runs in memory. The report is returned to you but never
          written to Postgres, and its findings are never sent to the Gemini model.
        </p>
        <p>Scans by signed-out visitors are also never stored.</p>
      </LegalSection>

      <LegalSection title="Automatic secret redaction" id="secret-redaction">
        <p>
          Detected credentials are masked, leaving only the first 4 and last 4 characters, before a report is
          stored, returned or sent to the model.
        </p>
        <p>Logs hold no file contents.</p>
      </LegalSection>

      <LegalSection title="Server-side preview gating" id="preview-gating">
        <p>
          A free preview is cut on the server. It holds the overall score, the finding counts and the top 2
          findings, without snippets, line numbers or fix prompts.
        </p>
        <p>Locked content is never sent to the browser.</p>
      </LegalSection>

      <LegalSection title="Report isolation" id="isolation">
        <p>
          Each report belongs to one account. Every database query filters on the owning account, and Postgres
          Row Level Security is enabled on the reports table, so the table is closed to other accounts and to
          anonymous access.
        </p>
        <p>A report id that belongs to someone else behaves exactly like a missing one.</p>
        <p>You can delete a report permanently.</p>
      </LegalSection>

      <LegalSection title="Prompt-injection-safe fix prompts" id="fix-prompts">
        <p>
          Fix prompts never quote text from the scanned repository. They name the file path, the line and the
          rule only, and paths are reduced to safe characters.
        </p>
        <p>
          Any model-written text is validated. It cannot add or change findings, severities or counts, and a
          URL or a shell or install command causes it to be discarded.
        </p>
      </LegalSection>

      <LegalSection title="Deterministic first" id="deterministic">
        <p>Findings, severities and the readiness score come from deterministic rules.</p>
        <p>
          There is an optional AI layer. It only rewrites explanations and fix prompts from findings the rules
          have already verified, and its output is validated. It never receives source files, zero-retention
          scans or free previews.
        </p>
      </LegalSection>

      <LegalSection title="No model training" id="training">
        <p>TrustCore does not use customer code, uploads or reports to train models.</p>
      </LegalSection>

      <LegalSection title="Signed-out visitors" id="signed-out">
        <p>
          Signed-out visitors are identified by a salted hash of their IP address. It is used to enforce one
          free preview and rate limits.
        </p>
      </LegalSection>

      <LegalSection title="Subprocessors" id="subprocessors">
        <p>These companies process data on TrustCore&apos;s behalf, each for the purpose listed.</p>
        <SubprocessorList />
      </LegalSection>

      <LegalSection title="What a scan does not tell you" id="limits">
        <p>
          Automated scans can miss issues and can report false positives. A report is not a guarantee of
          security or compliance. The{' '}
          <Link href="/terms" className={LINK_CLASS}>
            Terms
          </Link>{' '}
          set this out in full, and the{' '}
          <Link href="/privacy" className={LINK_CLASS}>
            Privacy Policy
          </Link>{' '}
          covers personal data.
        </p>
      </LegalSection>

      <LegalSection title="Contact" id="contact">
        <p>
          Security questions: <ContactLink className={LINK_CLASS} placeholderClassName="text-zinc-400" />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
