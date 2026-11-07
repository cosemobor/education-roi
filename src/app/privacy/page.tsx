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
        Last updated: November 2026
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          1. Scope
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          This Privacy Policy applies only to this website (the &ldquo;Site&rdquo;). It does not apply to any other website, product, or service, including third-party sites linked from the Site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          2. Information We Collect
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site does not require registration or login, and we do not ask you to provide personal information to use it.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Like most websites, the Site and the service providers that operate it may automatically receive technical information that your browser or device sends when you visit, such as device, browser, and connection information and the pages requested.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site may store preferences on your device using browser storage or similar technologies so that it functions as expected.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          3. How We Use Information
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We use information to operate, maintain, secure, and improve the Site, and to comply with legal obligations. We do not sell personal information.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          4. Service Providers
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site relies on third-party service providers, such as hosting, content delivery, and mapping providers, that receive standard web requests when you use the Site. Their handling of information is governed by their own terms and privacy policies, and we do not control their practices.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          5. Disclosure
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We may disclose information if we believe it is required by law, legal process, or governmental request, or is necessary to protect the rights, property, or safety of the Site, its operators, or others, or in connection with a merger, acquisition, or transfer of assets.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          6. Data Retention
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Information is retained for as long as reasonably necessary for the purposes described above, or as required by law, and in accordance with the practices of our service providers.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          7. Security
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We use commercially reasonable measures to protect the Site. No method of transmission over the Internet or of electronic storage is completely secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          8. Children
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site is not directed at children under the age of 13, and we do not knowingly collect personal information from them. If you believe a child has provided personal information through the Site, please contact us so we can take appropriate action.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          9. Changes to This Policy
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We may update this Privacy Policy at any time. Changes take effect when posted to the Site. Your continued use of the Site after any change constitutes acceptance of the updated policy.
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
