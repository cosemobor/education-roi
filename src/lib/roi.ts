/**
 * Degree ROI: net present value of the earnings premium over a high-school
 * graduate, minus the cost of college, all in real (2024) dollars.
 *
 * Every input is measured data; the constants below cite their source.
 *
 * Timeline (years from the first day of college, end-of-year convention
 * for earnings, start-of-year for costs):
 *   t = 0..3   in school: pay net price + give up an 18–21-year-old
 *              high-school graduate's wages
 *   t = 4..10  years 1..7 after graduating: earn the program's median,
 *              minus what a high-school graduate (25–34) earns in that state
 *
 * Earnings path: Scorecard publishes medians at 1, 4, 5 and 7 years after
 * graduation (pooled cohorts measured in CY2022–23, 2024 dollars). Years in
 * between are straight-line interpolated; nothing is projected past year 7.
 *
 * Time value of money: real discount rate = S&P 500 total return 2000–2025
 * (Damodaran/NYU Stern, dividends reinvested) 7.99%/yr nominal, deflated by
 * CPI-U Dec-1999→Dec-2025 (2.55%/yr) → 5.31%/yr real. That is the return the
 * same money could have earned in the market instead.
 */

/** S&P 500 total-return CAGR 2000–2025, nominal (Damodaran histretSP). */
export const SP500_NOMINAL_CAGR = 0.0799;
/** CPI-U (CPIAUCNS) Dec 1999 → Dec 2025 annualized. */
export const CPI_2000_2025 = 0.0255;
/** Real discount rate used for present values. */
export const REAL_DISCOUNT_RATE = (1 + SP500_NOMINAL_CAGR) / (1 + CPI_2000_2025) - 1; // ≈ 0.0531

/** Median wage of HS-only workers 18–21 ÷ 25–34 (ACS 2024 PUMS, not enrolled, wages > 0). */
export const FORGONE_WAGE_RATIO = 0.571;
/** Median wage of "some college, no degree" 25–34 ÷ HS-only 25–34 (same source). */
export const SOME_COLLEGE_RATIO = 1.143;

export const YEARS_IN_SCHOOL = 4;
export const HORIZON_YEARS = 7;
/**
 * Years a non-completer is enrolled before leaving. Not published per school;
 * used only for the completion-weighted "expected" ROI and disclosed in the UI.
 */
export const NONCOMPLETER_YEARS = 2;

/** Graduation age assumed for mapping years-after-graduation to age (year 7 ≈ age 29). */
export const GRAD_AGE = 22;
/** Career view horizon: through age 45 (23 years after graduating). */
export const CAREER_END_AGE = 45;
/** Scorecard's HS benchmark covers ages 25–34; anchor its age curve at the midpoint. */
const HS_ANCHOR_AGE = 29.5;

/** Earnings-by-age curve: median wage by 5-year band (mid ages), null where suppressed. */
export interface AgeCurve {
  mids: number[];
  values: (number | null)[];
}

/** Wage at an age by linear interpolation between band midpoints (clamped at the ends). */
export function curveAt(c: AgeCurve, age: number): number | null {
  const pts = c.mids.map((m, i) => [m, c.values[i]] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (pts.length === 0) return null;
  if (age <= pts[0][0]) return pts[0][1];
  if (age >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [a0, v0] = pts[i];
    const [a1, v1] = pts[i + 1];
    if (age >= a0 && age <= a1) return v0 + ((v1 - v0) * (age - a0)) / (a1 - a0);
  }
  return null;
}

export interface CareerCurves {
  /** The major's own curve (or all bachelor's when the major has none). */
  major: AgeCurve;
  /** High-school-only workers. */
  hs: AgeCurve;
}

export interface RoiInputs {
  e1: number | null;
  e4?: number | null;
  e5?: number | null;
  e7: number | null;
  /** Annual average net price (after grants), 2024 dollars. */
  netPrice: number | null;
  /** Median earnings of HS graduates 25–34 in the school's state, 2024 dollars. */
  hsEarnings: number | null;
  /** Share finishing within 150% of normal time (0–1). */
  completionRate?: number | null;
  /** When given, also compute the career view (years 8..23 from ACS age curves). */
  career?: CareerCurves | null;
}

export interface RoiResult {
  /** NPV of (premium − cost), discounted at REAL_DISCOUNT_RATE. */
  npv: number;
  /** npv ÷ present value of cost. */
  roi: number;
  /** Same with no discounting (inflation-adjusted only). */
  npvUndiscounted: number;
  roiUndiscounted: number;
  /** Present value of cost (net price + forgone wages). */
  costPv: number;
  /** Year after graduation when the cumulative discounted premium covers cost; null if not within 7. */
  paybackYear: number | null;
  /** Completion-weighted NPV and ROI (null without a completion rate). */
  expectedNpv: number | null;
  expectedRoi: number | null;
  /** Interpolated earnings for years 1..7. */
  path: number[];
  /** Career view through age 45 (null without curves): measured years 1–7 + ACS age curve years 8–23. */
  careerNpv: number | null;
  careerRoi: number | null;
  careerNpvUndiscounted: number | null;
  careerPaybackYear: number | null;
  careerExpectedNpv: number | null;
  careerExpectedRoi: number | null;
}

/** Earnings for years 1..7 by straight-line interpolation between published points. */
export function earningsPath(e1: number, e7: number, e4?: number | null, e5?: number | null): number[] {
  const anchors: [number, number][] = [[1, e1]];
  if (e4 != null) anchors.push([4, e4]);
  if (e5 != null) anchors.push([5, e5]);
  anchors.push([7, e7]);
  const path: number[] = [];
  for (let y = 1; y <= HORIZON_YEARS; y++) {
    let i = 0;
    while (i < anchors.length - 1 && anchors[i + 1][0] < y) i++;
    const [x0, v0] = anchors[i];
    const [x1, v1] = anchors[Math.min(i + 1, anchors.length - 1)];
    path.push(x1 === x0 ? v0 : v0 + ((v1 - v0) * (y - x0)) / (x1 - x0));
  }
  return path;
}

const pv = (amount: number, t: number, r: number) => amount / Math.pow(1 + r, t);

/** Returns null when any required input is missing or non-positive. */
export function computeRoi(inp: RoiInputs, r: number = REAL_DISCOUNT_RATE): RoiResult | null {
  const { e1, e4, e5, e7, netPrice, hsEarnings, completionRate } = inp;
  if (e1 == null || e7 == null || netPrice == null || hsEarnings == null) return null;
  if (e1 <= 0 || e7 <= 0 || hsEarnings <= 0 || netPrice < 0) return null;

  const path = earningsPath(e1, e7, e4, e5);
  const yearlyCost = netPrice + FORGONE_WAGE_RATIO * hsEarnings;

  let costPv = 0;
  let costRaw = 0;
  for (let t = 0; t < YEARS_IN_SCHOOL; t++) {
    costPv += pv(yearlyCost, t, r);
    costRaw += yearlyCost;
  }

  let premiumPv = 0;
  let premiumRaw = 0;
  let paybackYear: number | null = null;
  path.forEach((earn, i) => {
    const premium = earn - hsEarnings;
    const t = YEARS_IN_SCHOOL + i; // year 1 after graduating lands at t = 4
    premiumPv += pv(premium, t, r);
    premiumRaw += premium;
    if (paybackYear == null && premiumPv >= costPv) paybackYear = i + 1;
  });

  const npv = premiumPv - costPv;
  const npvUndiscounted = premiumRaw - costRaw;

  // ── Career view: extend years 8..23 along the major's ACS age curve ────
  let careerNpv: number | null = null;
  let careerNpvUndiscounted: number | null = null;
  let careerPaybackYear: number | null = paybackYear;
  let careerExtensionPv = 0; // premium PV for years 8..23 (graduate)
  let careerDropExtensionPv = 0; // some-college premium PV for the same years
  const careerYears = CAREER_END_AGE - GRAD_AGE; // 23
  const c = inp.career;
  const majorAt7 = c ? curveAt(c.major, GRAD_AGE + HORIZON_YEARS) : null;
  const hsAnchor = c ? curveAt(c.hs, HS_ANCHOR_AGE) : null;
  if (c && majorAt7 && hsAnchor) {
    let extRaw = 0;
    let cumPv = premiumPv;
    for (let y = HORIZON_YEARS + 1; y <= careerYears; y++) {
      const age = GRAD_AGE + y;
      const m = curveAt(c.major, age);
      const h = curveAt(c.hs, age);
      if (m == null || h == null) continue;
      const earn = e7 * (m / majorAt7);
      const hsEarn = hsEarnings * (h / hsAnchor);
      const t = YEARS_IN_SCHOOL + y - 1;
      const premPv = pv(earn - hsEarn, t, r);
      careerExtensionPv += premPv;
      careerDropExtensionPv += pv((SOME_COLLEGE_RATIO - 1) * hsEarn, t, r);
      extRaw += earn - hsEarn;
      cumPv += premPv;
      if (careerPaybackYear == null && cumPv >= costPv) careerPaybackYear = y;
    }
    careerNpv = npv + careerExtensionPv;
    careerNpvUndiscounted = npvUndiscounted + extRaw;
  }

  let expectedNpv: number | null = null;
  let expectedRoi: number | null = null;
  let careerExpectedNpv: number | null = null;
  let careerExpectedRoi: number | null = null;
  if (completionRate != null && completionRate >= 0 && completionRate <= 1) {
    // Non-completer: enrolled NONCOMPLETER_YEARS, then earns the measured
    // some-college premium over a HS graduate through the same horizon (t ≤ 10).
    let dropCostPv = 0;
    for (let t = 0; t < NONCOMPLETER_YEARS; t++) dropCostPv += pv(yearlyCost, t, r);
    let dropPremiumPv = 0;
    const end = YEARS_IN_SCHOOL + HORIZON_YEARS - 1;
    for (let t = NONCOMPLETER_YEARS; t <= end; t++) {
      dropPremiumPv += pv((SOME_COLLEGE_RATIO - 1) * hsEarnings, t, r);
    }
    const p = completionRate;
    expectedNpv = p * npv + (1 - p) * (dropPremiumPv - dropCostPv);
    const expectedCost = p * costPv + (1 - p) * dropCostPv;
    expectedRoi = expectedCost > 0 ? expectedNpv / expectedCost : null;
    if (careerNpv != null) {
      careerExpectedNpv = p * careerNpv + (1 - p) * (dropPremiumPv + careerDropExtensionPv - dropCostPv);
      careerExpectedRoi = expectedCost > 0 ? careerExpectedNpv / expectedCost : null;
    }
  }

  return {
    npv,
    roi: costPv > 0 ? npv / costPv : 0,
    npvUndiscounted,
    roiUndiscounted: costRaw > 0 ? npvUndiscounted / costRaw : 0,
    costPv,
    paybackYear,
    expectedNpv,
    expectedRoi,
    path,
    careerNpv,
    careerRoi: careerNpv != null && costPv > 0 ? careerNpv / costPv : null,
    careerNpvUndiscounted,
    careerPaybackYear: careerNpv != null ? careerPaybackYear : null,
    careerExpectedNpv,
    careerExpectedRoi,
  };
}
