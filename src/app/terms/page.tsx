import type { Metadata } from 'next';
import Link from 'next/link';
import PageNav from '@/components/PageNav';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'Terms of use for Higher Education Outcomes.',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <PageNav />

      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        Terms of Use
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Last updated: February 2026
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          1. Acceptance of Terms
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          By accessing or using Higher Education Outcomes
          (&ldquo;HEO,&rdquo; &ldquo;the Site&rdquo;), you agree to be bound
          by these Terms of Use. If you do not agree to these terms, do not
          access or use the Site.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          2. Description of Service
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          HEO is an informational tool that presents education earnings and
          outcomes data aggregated from publicly available sources,
          including the U.S. Department of Education College Scorecard. The Site
          is provided for general informational purposes only. Nothing on this
          Site constitutes financial advice, investment advice, legal advice,
          career advice, or any other form of professional counsel. You should
          not rely on the information presented here to make educational,
          financial, or career decisions.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          3. No Representations or Warranties
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          The Site and all data, content, and materials available through it are
          provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo;
          basis without warranties of any kind, whether express, implied, or
          statutory. We expressly disclaim all warranties, including but not
          limited to implied warranties of merchantability, fitness for a
          particular purpose, accuracy, completeness, timeliness, and
          non-infringement. The data presented may contain errors, omissions,
          inaccuracies, or structural lag between data sources.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          4. Limitation of Liability
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          To the fullest extent permitted by applicable law, in no event shall
          the operator of this Site be liable for any direct, indirect,
          incidental, special, consequential, or punitive damages, including but
          not limited to loss of profits, data, use, or goodwill, arising out of
          or in connection with your access to, use of, or reliance on the Site
          or any data, content, or materials available through it, regardless of
          the theory of liability.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          5. Indemnification
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          You agree to indemnify, defend, and hold harmless the operator of this
          Site and its affiliates, officers, agents, and representatives from and
          against any and all claims, damages, losses, liabilities, costs, and
          expenses (including reasonable attorneys&apos; fees) arising out of or
          related to: (a) your use of the Site; (b) your violation of these
          Terms; or (c) your violation of any rights of any third party.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          6. Prohibited Uses
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          You agree not to:
        </p>
        <ul className="mt-2 space-y-2 text-sm text-text-secondary">
          <li>
            Use automated means, including bots, scrapers, crawlers, or similar
            tools, to access, collect, or harvest data from the Site.
          </li>
          <li>
            Redistribute, republish, or commercially exploit data obtained from
            the Site without prior written permission.
          </li>
          <li>
            Use the Site or its data in any manner that is harmful, fraudulent,
            deceptive, threatening, harassing, or otherwise objectionable.
          </li>
          <li>
            Interfere with or disrupt the Site&apos;s infrastructure, servers, or
            networks.
          </li>
          <li>
            Attempt to gain unauthorized access to any portion of the Site or
            its systems.
          </li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          7. Intellectual Property
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          All content, design, code, and compilation of the Site are the
          property of the operator. Underlying public data sources (including
          U.S. Department of Education College Scorecard data) are subject to
          their respective licenses and terms. Your use of the Site does not
          grant you any ownership rights to any content or materials.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          8. Modifications
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          We reserve the right to modify these Terms of Use at any time without
          prior notice. Changes take effect immediately upon posting to the Site.
          Your continued use of the Site after any modification constitutes your
          acceptance of the revised terms.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          9. Governing Law
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          These Terms shall be governed by and construed in accordance with the
          laws of the United States. Any disputes arising under or in connection
          with these Terms shall be subject to the exclusive jurisdiction of the
          courts of competent jurisdiction.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text-primary">
          10. Contact
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Questions about these Terms may be directed to{' '}
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
        <Link href="/privacy" className="text-sm text-accent hover:underline">
          Privacy Policy
        </Link>
        <Link href="/about" className="text-sm text-accent hover:underline">
          About
        </Link>
      </div>
    </main>
  );
}
