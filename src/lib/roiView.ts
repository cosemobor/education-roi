/**
 * Display helpers for the degree ROI (computed in src/lib/roi.ts at build
 * time). Pure + client-safe: picks the figure for the selected horizon/basis
 * and formats it.
 */
import type { RoiFields } from '@/types';

export type RoiHorizon = '7yr' | 'career';
export type RoiBasis = 'sp' | 'inflation';

export const HORIZON_LABEL: Record<RoiHorizon, string> = {
  '7yr': '7 years (measured)',
  career: 'Career to age 45',
};
export const BASIS_LABEL: Record<RoiBasis, string> = {
  sp: 'vs S&P 500',
  inflation: 'Inflation only',
};

export interface RoiPick {
  npv: number | null;
  roi: number | null;
  /** Discounted (vs S&P) payback year after graduation; null = not within the window. */
  payback: number | null;
  /** Completion-weighted ROI (discounted). */
  expectedRoi: number | null;
}

/** Inflation-only ROI for the career view: undiscounted NPV ÷ undiscounted cost. */
function careerRoiUndiscounted(r: RoiFields): number | null {
  if (r.careerNpvUndiscounted == null || r.npv7Undiscounted == null || r.roi7Undiscounted == null) return null;
  if (r.roi7Undiscounted === 0) return null;
  const costRaw = r.npv7Undiscounted / r.roi7Undiscounted; // 4 yrs of net price + forgone wages
  return costRaw > 0 ? r.careerNpvUndiscounted / costRaw : null;
}

export function pickRoi(r: RoiFields, horizon: RoiHorizon, basis: RoiBasis): RoiPick {
  if (horizon === '7yr') {
    return {
      npv: basis === 'sp' ? r.npv7 : r.npv7Undiscounted,
      roi: basis === 'sp' ? r.roi7 : r.roi7Undiscounted,
      payback: r.paybackYear,
      expectedRoi: r.expectedRoi7,
    };
  }
  return {
    npv: basis === 'sp' ? r.careerNpv : r.careerNpvUndiscounted,
    roi: basis === 'sp' ? r.careerRoi : careerRoiUndiscounted(r),
    payback: r.careerPaybackYear,
    expectedRoi: r.careerExpectedRoi,
  };
}

const MINUS = '−';

/** Signed compact dollars: +$120K / −$15K (sign so color is never the only cue). */
export function formatNpv(v: number | null | undefined): string {
  if (v == null) return '—';
  const sign = v >= 0 ? '+' : MINUS;
  const a = Math.abs(v);
  const body = a >= 1_000_000 ? `$${(a / 1_000_000).toFixed(1)}M` : a >= 1000 ? `$${Math.round(a / 1000)}K` : `$${Math.round(a)}`;
  return sign + body;
}

/** ROI multiple: 3.1× / −0.4× */
export function formatRoiX(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(1)}×`;
}

export function formatPayback(year: number | null | undefined, horizon: RoiHorizon, hasRoi: boolean): string {
  if (!hasRoi) return '—';
  if (year != null) return `yr ${year}`;
  return horizon === '7yr' ? '> 7 yrs' : '> career';
}

/** Tailwind text color class for a signed value (paired with the +/− sign). */
export function signClass(v: number | null | undefined): string {
  if (v == null) return 'text-text-secondary';
  return v >= 0 ? 'text-earn-above' : 'text-earn-below';
}

/** DESC/ASC comparator with nulls last in both directions. */
export function compareNullsLast(a: number | null, b: number | null, dir: 'asc' | 'desc'): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === 'asc' ? a - b : b - a;
}
