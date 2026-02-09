import type { Metadata } from 'next';
import Link from 'next/link';
import PageNav from '@/components/PageNav';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy policy for Higher Education Outcomes.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <PageNav />

      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Last updated: February 2026
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          1. Information We Collect
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site uses browser local storage to remember your preferences, such
          as whether you have completed the guided tour. This data is stored
          locally on your device and is not transmitted to any server.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Our hosting provider (Vercel) automatically collects standard server
          logs, which include IP addresses, browser type, referring URLs, and
          pages requested. We do not collect personal information such as names,
          email addresses, or account credentials. The Site does not require user
          registration or login.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We collect anonymous usage analytics to improve the Site. This includes
          page views, time spent on pages, feature interactions (such as search
          queries, major and school selections, and tab switches), and tour
          completion status. Each browser tab is assigned a random session
          identifier stored in sessionStorage, which is automatically cleared
          when the tab is closed. No personal data, IP addresses, or cookies are
          used for analytics.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          2. How We Use Information
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Server logs are used to operate, maintain, and monitor the
          performance of the Site. Anonymous analytics data is used to
          understand how visitors interact with the Site and to improve the
          user experience. We do not sell personal information.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          3. Third-Party Services
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site relies on third-party services to function. These services
          receive standard web requests when you use the Site and are governed
          by their own privacy policies:
        </p>
        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
          <li>
            <strong>Vercel</strong> &mdash; Hosting and serverless infrastructure
          </li>
          <li>
            <strong>Turso</strong> &mdash; Database hosting
          </li>
        </ul>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We do not control the data practices of these third-party services.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          4. Cookies
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site does not set cookies. Browser local storage is used solely
          for site functionality (e.g., remembering tour completion) and is
          not transmitted to any server.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          5. Data Sharing
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We do not sell or share personal information with third parties for
          marketing purposes. We will disclose information if required by law,
          legal process, or governmental request, or to protect our rights,
          property, or safety.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          6. Data Retention
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Server logs are retained in accordance with our hosting
          provider&apos;s standard practices. Anonymous analytics data is
          retained for up to one year and may be periodically purged. We do
          not independently store personal information about visitors beyond
          what is captured in standard server logs.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          7. Security
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We use commercially reasonable measures to protect the Site and its
          infrastructure. However, no method of transmission over the Internet
          or method of electronic storage is 100% secure, and we cannot
          guarantee absolute security.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          8. Children
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site is not directed at children under the age of 13. We do not
          knowingly collect information from children under 13. If you believe
          a child has provided information through the Site, please contact us
          so we can take appropriate action.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          9. Changes to This Policy
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We reserve the right to update this Privacy Policy at any time.
          Changes take effect immediately upon posting to the Site. Your
          continued use of the Site after any modification constitutes your
          acceptance of the updated policy.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          10. Contact
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Questions about this Privacy Policy may be directed to{' '}
          <a
            href="https://x.com/calebosemobor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            @calebosemobor
          </a>{' '}
          on X.
        </p>
      </section>

      <div className="mt-12 flex gap-4 border-t border-gray-200 pt-6">
        <Link href="/" className="text-sm text-accent hover:underline">
          Explorer
        </Link>
        <Link href="/terms" className="text-sm text-accent hover:underline">
          Terms of Use
        </Link>
        <Link href="/about" className="text-sm text-accent hover:underline">
          About
        </Link>
      </div>
    </main>
  );
}
