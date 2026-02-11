import type { Metadata } from 'next';
import Link from 'next/link';
import PageNav from '@/components/PageNav';

export const metadata: Metadata = {
  title: 'About',
  description:
    'Methodology, data sources, and assumptions behind Higher Education Outcomes.',
  openGraph: {
    title: 'About - HEO',
    description:
      'Methodology, data sources, and assumptions behind Higher Education Outcomes.',
  },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-secondary">
        {children}
      </div>
    </section>
  );
}

function MetricDef({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
      <dt className="font-semibold text-text-primary">{term}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <PageNav />

      <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">
        Higher Education Outcomes &mdash; Methodology &amp; Data Sources
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Built by{' '}
        <a
          href="https://x.com/calebosemobor"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          @calebosemobor
        </a>
      </p>

      <Section title="What is HEO?">
        <p>
          Hi, I&rsquo;m Caleb. I built this project because I was curious to see
          what the data actually looked like when you compare earnings outcomes
          across different schools and majors, and I figured other people might
          be interested too. I have a background in private equity and corporate
          development. I graduated from Georgetown University with a double major
          in Accounting and Finance, plus a minor in music. HEO is a personal,
          data-driven project meant to give a clearer picture of which
          combinations of school and major lead to the best earnings outcomes,
          using U.S. Department of Education data, simple assumptions, and
          transparent methodology.
        </p>
        <p>
          It covers over 4,000 programs across hundreds of schools, letting you
          compare earnings outcomes by major, by school, or across the full
          landscape of college programs.
        </p>
        <p>
          Find me on{' '}
          <a
            href="https://x.com/calebosemobor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            X (@calebosemobor)
          </a>
        </p>
      </Section>

      {/* HAM Index promo */}
      <section className="mt-8 rounded-lg border-2 border-accent/30 bg-accent/5 px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-lg" aria-hidden="true">&#127968;</span>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Housing Affordability Map
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-text-secondary">
              See how your post-college earnings compare to home prices across
              the U.S. &mdash; explore housing affordability by county using
              income, home price, and mortgage data.
            </p>
            <a
              href="https://hamindex.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              Explore Housing Data &rarr;
            </a>
          </div>
        </div>
      </section>

      <Section title="Methodology">
        <p>
          All data is sourced from the{' '}
          <strong>U.S. Department of Education College Scorecard</strong>, which
          reports earnings of federal financial aid recipients one, four, and
          five years after graduation.
        </p>
        <p>
          <strong>College rankings</strong> use graduate-weighted average
          earnings &mdash; each program&rsquo;s median earnings are weighted by
          the number of graduates reporting, so large programs count more than
          small ones. This prevents specialized schools with a handful of
          high-earning programs from dominating the rankings.
        </p>
        <p>
          <strong>ROI (Return on Investment)</strong> is calculated as
          first-year weighted average earnings divided by cost of attendance.
          A higher ratio means graduates earn more relative to what they paid.
          We use published cost of attendance rather than net price because net
          price varies significantly by family income, financial aid package, and
          scholarship awards &mdash; making it inconsistent across students.
        </p>
        <p>
          <strong>Major rankings</strong> use graduate-weighted average earnings
          across all schools offering that major, with percentile ranges
          (25th&ndash;75th) to show the spread of outcomes across institutions.
        </p>
        <p>
          Earnings reflect median values &mdash; half of graduates earn more and
          half earn less.
        </p>
      </Section>

      <Section title="Metric Definitions">
        <dl className="space-y-3">
          <MetricDef term="Graduate-Weighted Average Earnings">
            Each program&rsquo;s median earnings multiplied by its number of
            graduates, then summed and divided by total graduates. Gives more
            weight to programs that produce more graduates.
          </MetricDef>
          <MetricDef term="ROI (Return on Investment)">
            First-year weighted average earnings divided by cost of attendance.
            Displayed as a multiplier (e.g., 1.5x means graduates earn 1.5
            times what they paid). Higher is better. Uses published cost of
            attendance for consistency across schools.
          </MetricDef>
          <MetricDef term="Earnings Growth Rate">
            The percentage change from first-year to fifth-year median earnings.
            Shows how quickly graduates&rsquo; earnings increase after entering
            the workforce.
          </MetricDef>
          <MetricDef term="Selectivity Tiers">
            Schools are grouped into tiers based on admission rate, SAT scores,
            and institutional characteristics: Ivy League, Ivy Adjacent, Top 40,
            Competitive, and Standard. These tiers help contextualize earnings
            comparisons.
          </MetricDef>
        </dl>
      </Section>

      <Section title="Data Sources">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 font-semibold text-text-primary">
                  Source
                </th>
                <th className="px-3 py-2 font-semibold text-text-primary">
                  Data Provided
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2.5 font-medium text-text-primary">
                  <a
                    href="https://collegescorecard.ed.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    College Scorecard
                  </a>
                </td>
                <td className="px-3 py-2.5 text-text-secondary">
                  Program-level earnings (1yr, 4yr, 5yr), enrollment counts,
                  cost of attendance, net price, admission rates, SAT scores,
                  completion rates
                </td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2.5 font-medium text-text-primary">
                  <a
                    href="https://api.data.gov/ed/collegescorecard/v1/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Scorecard API
                  </a>
                </td>
                <td className="px-3 py-2.5 text-text-secondary">
                  Programmatic access to all Scorecard fields, used for
                  automated data ingestion
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Assumptions & Limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Federal aid recipients only</strong> &mdash; Earnings data
            covers only students who received federal financial aid, which may
            not represent all graduates.
          </li>
          <li>
            <strong>Small sample suppression</strong> &mdash; The College
            Scorecard suppresses data where sample sizes are too small to protect
            student privacy. Some programs and schools may be missing.
          </li>
          <li>
            <strong>Cost of attendance</strong> &mdash; ROI calculations use
            published cost of attendance (sticker price) rather than net price
            after financial aid. This provides a consistent baseline across
            schools, though individual students may pay more or less depending
            on their aid package.
          </li>
          <li>
            <strong>No cost-of-living adjustment</strong> &mdash; Earnings are
            not adjusted for regional cost of living. A $60K salary in rural
            Kansas has different purchasing power than $60K in San Francisco.
          </li>
          <li>
            <strong>Historical, not predictive</strong> &mdash; All data
            reflects past outcomes. Future earnings for current students may
            differ due to economic conditions, industry changes, or policy
            shifts.
          </li>
        </ul>
      </Section>

      <div className="mt-12 flex gap-4 border-t border-gray-200 pt-6">
        <Link href="/" className="text-sm text-accent hover:underline">
          Explorer
        </Link>
        <Link href="/terms" className="text-sm text-accent hover:underline">
          Terms of Use
        </Link>
        <Link href="/privacy" className="text-sm text-accent hover:underline">
          Privacy Policy
        </Link>
      </div>
    </main>
  );
}
