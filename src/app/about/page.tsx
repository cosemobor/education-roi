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
          reports earnings of federal financial aid recipients one, four, five,
          and seven years after graduation. Rankings default to seven-year
          earnings where available; schools and majors without seven-year
          data (the Department suppresses small cohorts) can be ranked by
          shorter horizons instead. Figures reflect the Scorecard data as
          updated in November 2026; the Department refreshed earnings for newer
          graduating cohorts during 2026, so rankings can differ from earlier
          versions of this site.
        </p>
        <p>
          <strong>College rankings</strong> use graduate-weighted average
          earnings &mdash; each program&rsquo;s median earnings are weighted by
          the number of graduates reporting, so large programs count more than
          small ones. This prevents specialized schools with a handful of
          high-earning programs from dominating the rankings.
        </p>
        <p>
          <strong>ROI (Return on Investment)</strong> asks: compared with going
          straight to work after high school and putting the cost of college
          into the stock market, how far ahead (or behind) does a graduate end
          up? It is a net present value (NPV) in real 2024 dollars:
        </p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Earnings premium.</strong> Each year&rsquo;s median earnings
            minus what a high-school graduate earns in the school&rsquo;s state
            (the Scorecard&rsquo;s benchmark: median earnings of high-school
            graduates aged 25&ndash;34, from the Census American Community
            Survey, in 2024 dollars).
          </li>
          <li>
            <strong>Earnings path.</strong> The Scorecard publishes program
            medians 1, 4, 5 and 7 years after graduation (pooled cohorts measured
            in 2022&ndash;23, in 2024 dollars). Years in between are filled in
            with straight lines; nothing past year 7 is projected in the
            7-year view.
          </li>
          <li>
            <strong>Cost.</strong> Four years of the school&rsquo;s average net
            price (after grants), plus the wages given up while in school: what
            an 18&ndash;21-year-old high-school graduate earns, measured at 57.1%
            of the 25&ndash;34 benchmark (ACS 2024 microdata).
          </li>
          <li>
            <strong>Time value of money.</strong> Future dollars are discounted
            at the S&amp;P 500&rsquo;s total return (dividends reinvested) from
            2000 to 2025 &mdash; 7.99% a year, or 5.31% after inflation (CPI-U
            averaged 2.55% a year), per Aswath Damodaran&rsquo;s NYU Stern
            dataset. The <em>inflation only</em> view shows the same figures
            without discounting.
          </li>
          <li>
            <strong>ROI multiple</strong> = NPV &divide; present value of the
            cost. <strong>Payback</strong> is the year after graduation when the
            discounted premium has covered the cost.
          </li>
          <li>
            <strong>Career to age 45</strong> (an estimate, labeled as such)
            extends years 8&ndash;23 using the major&rsquo;s earnings-by-age
            curve from Census ACS 2021&ndash;24 microdata: each program keeps its
            year-7 level and grows the way the major does nationally with age.
            These curves are cross-sectional &mdash; today&rsquo;s older workers
            stand in for future earnings. The high-school comparison rises with
            age the same way. Majors without their own curve use the curve for
            all bachelor&rsquo;s degrees.
          </li>
          <li>
            <strong>If you might not finish</strong> weights the result by the
            school&rsquo;s graduation rate. Non-completers are assumed to be
            enrolled for two years and then earn the measured some-college
            premium (1.143&times; a high-school graduate, ACS 2024).
          </li>
        </ul>
        <p>
          Caveats: stock-market returns are pre-tax and ignore that a degree
          can&rsquo;t be sold like shares; earnings cover federal-aid
          recipients; small programs are suppressed by the Department of
          Education.
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
          <MetricDef term="NPV (Net Present Value)">
            Dollars a graduate comes out ahead (+) or behind (&minus;) a
            high-school graduate who invested the cost of college in the
            S&amp;P 500, over the selected horizon, in real 2024 dollars.
          </MetricDef>
          <MetricDef term="ROI (Return on Investment)">
            NPV divided by the present value of the cost (net price plus
            forgone wages), shown as a multiple: 2.0&times; means the degree
            returned twice its cost beyond what the market would have.
            Negative means the market alternative came out ahead.
          </MetricDef>
          <MetricDef term="Payback">
            The year after graduation when the cumulative discounted earnings
            premium first covers the cost. &ldquo;&gt; 7 yrs&rdquo; or
            &ldquo;&gt; career&rdquo; means not within the window.
          </MetricDef>
          <MetricDef term="Earnings Growth Rate">
            The percentage change from first-year to fifth-year median earnings
            (seven-year earnings are shown alongside where reported).
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
            <strong>Net price is an average</strong> &mdash; ROI uses the
            school&rsquo;s average net price after grants for aided students.
            Individual students may pay more or less depending on their aid
            package and family income.
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
