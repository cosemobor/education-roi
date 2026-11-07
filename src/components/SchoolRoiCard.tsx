import type { RoiFields } from '@/types';
import {
  FORGONE_WAGE_RATIO,
  REAL_DISCOUNT_RATE,
  SP500_NOMINAL_CAGR,
  YEARS_IN_SCHOOL,
} from '@/lib/roi';
import { formatNpv, formatPayback, formatRoiX, pickRoi, signClass, type RoiHorizon } from '@/lib/roiView';
import { formatCurrency } from '@/lib/formatters';

interface SchoolRoiCardProps {
  schoolName: string;
  state: string;
  /** Average net price after grants (per year, 2024 $). */
  netPrice: number | null;
  /** Median earnings of HS graduates 25–34 in the school's state (2024 $). */
  hsEarnings: number | null;
  roi: RoiFields;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** Plain-English one-liner for the headline (7-year, vs S&P) figure. */
function summary(npv: number | null, horizon: RoiHorizon): string | null {
  if (npv == null) return null;
  const amount = formatNpv(Math.abs(npv)).replace(/^[+−]/, '');
  const span = horizon === '7yr' ? 'Over the first 7 years after graduating' : 'Through age 45';
  return npv >= 0
    ? `${span}, graduates come out ${amount} ahead of a high-school graduate who put the same money into the S&P 500.`
    : `${span}, graduates are ${amount} behind a high-school graduate who put the same money into the S&P 500.`;
}

export default function SchoolRoiCard({
  schoolName,
  state,
  netPrice,
  hsEarnings,
  roi,
}: SchoolRoiCardProps) {
  const has = roi.npv7 != null;
  const forgone = hsEarnings != null ? FORGONE_WAGE_RATIO * hsEarnings : null;
  const yearly = netPrice != null && forgone != null ? netPrice + forgone : null;
  let costPv: number | null = null;
  if (yearly != null) {
    costPv = 0;
    for (let t = 0; t < YEARS_IN_SCHOOL; t++) costPv += yearly / Math.pow(1 + REAL_DISCOUNT_RATE, t);
  }

  const rows: { horizon: RoiHorizon; label: string; note: string }[] = [
    { horizon: '7yr', label: '7 years (measured)', note: 'Scorecard earnings, years 1–7' },
    { horizon: 'career', label: 'Career to age 45', note: 'estimated from Census age profiles' },
  ];

  return (
    <section className="mt-10 rounded-lg border border-gray-200 bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold text-text-primary">ROI breakdown</h2>
      <p className="mt-1 text-sm text-text-secondary">
        {schoolName}&rsquo;s bachelor&rsquo;s programs, graduate-weighted &middot; real 2024 dollars
      </p>

      {!has ? (
        <p className="mt-3 text-sm text-text-secondary">
          Not enough data to compute ROI for this school (it needs 1- and 7-year earnings for at least one
          program, an average net price, and a state high-school earnings benchmark).
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm font-medium text-text-primary">{summary(roi.npv7, '7yr')}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Net price / yr</p>
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(netPrice)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">Forgone wages / yr</p>
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(forgone)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                Cost of {YEARS_IN_SCHOOL} years (PV)
              </p>
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(costPv)}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                HS-grad benchmark ({state})
              </p>
              <p className="text-sm font-semibold text-text-primary">{formatCurrency(hsEarnings)}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-secondary">
                  <th className="py-1.5 pr-4 font-medium">Horizon</th>
                  <th className="py-1.5 pr-4 text-right font-medium">NPV vs S&amp;P 500</th>
                  <th className="py-1.5 pr-4 text-right font-medium">ROI</th>
                  <th className="py-1.5 pr-4 text-right font-medium">NPV, inflation only</th>
                  <th className="py-1.5 pr-4 text-right font-medium">Payback</th>
                  <th className="py-1.5 text-right font-medium">If you might not finish</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                {rows.map(({ horizon, label, note }) => {
                  const sp = pickRoi(roi, horizon, 'sp');
                  const infl = pickRoi(roi, horizon, 'inflation');
                  return (
                    <tr key={horizon} className="border-t border-gray-100">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{label}</span>
                        <span className="block text-[11px] text-text-secondary">{note}</span>
                      </td>
                      <td className={`py-2 pr-4 text-right font-semibold tabular-nums ${signClass(sp.npv)}`}>
                        {formatNpv(sp.npv)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">{formatRoiX(sp.roi)}</td>
                      <td className={`py-2 pr-4 text-right tabular-nums ${signClass(infl.npv)}`}>
                        {formatNpv(infl.npv)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {formatPayback(sp.payback, horizon, sp.npv != null)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{formatRoiX(sp.expectedRoi)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-text-secondary">
            NPV = present value of graduates&rsquo; earnings above a high-school graduate in {state}, minus{' '}
            {YEARS_IN_SCHOOL} years of net price and the wages an 18&ndash;21-year-old high-school graduate
            would have earned instead. &ldquo;vs S&amp;P 500&rdquo; discounts at the index&rsquo;s 2000&ndash;2025
            total return ({pct(SP500_NOMINAL_CAGR)} a year, {pct(REAL_DISCOUNT_RATE)} after inflation); &ldquo;inflation
            only&rdquo; does not discount. ROI = NPV &divide; present value of cost. Payback is the year after
            graduation when the discounted premium covers the cost. &ldquo;If you might not finish&rdquo; weights
            by the school&rsquo;s graduation rate. Career figures beyond year 7
            are estimated from Census earnings-by-age profiles for each major.
          </p>
        </>
      )}
    </section>
  );
}
