/**
 * Server-side data store. There is no database: the processed College
 * Scorecard JSON (built by scripts/process-scorecard.ts, copied into
 * src/data/ and committed) is bundled with the deploy and indexed in memory.
 *
 * Sort orders mirror the SQL the site used to run against Turso
 * (`ORDER BY x DESC` in SQLite puts NULLs last).
 */
import schoolsJson from '@/data/schools.json';
import programsJson from '@/data/programs.json';
import majorsJson from '@/data/majors-summary.json';
import rankingsJson from '@/data/school-rankings.json';
import type { RoiFields } from '@/types';

export interface SchoolRow {
  unitId: number;
  name: string;
  city: string | null;
  state: string | null;
  ownership: number | null;
  ownershipLabel: string | null;
  admissionRate: number | null;
  satRead75: number | null;
  satMath75: number | null;
  size: number | null;
  costAttendance: number | null;
  tuitionInState: number | null;
  tuitionOutState: number | null;
  netPricePublic: number | null;
  netPricePrivate: number | null;
  completionRate: number | null;
  selectivityTier: string | null;
  lat: number | null;
  lon: number | null;
}

export interface ProgramRow extends RoiFields {
  id: number;
  unitId: number;
  schoolName: string | null;
  state: string | null;
  cipCode: string;
  cipTitle: string | null;
  credLevel: number | null;
  credTitle: string | null;
  earn1yr: number | null;
  earn4yr: number | null;
  earn5yr: number | null;
  earn7yr: number | null;
  earn1yrCount: number | null;
  earn5yrCount: number | null;
  earn7yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string | null;
  careerCurve: 'major' | 'all' | null;
}

export interface MajorSummaryRow {
  cipCode: string;
  cipTitle: string;
  schoolCount: number | null;
  medianEarn1yr: number | null;
  medianEarn4yr: number | null;
  medianEarn5yr: number | null;
  p25Earn1yr: number | null;
  p75Earn1yr: number | null;
  p25Earn5yr: number | null;
  p75Earn5yr: number | null;
  medianEarn7yr: number | null;
  p25Earn7yr: number | null;
  p75Earn7yr: number | null;
  nationalMedianEarn7yr: number | null;
  growthRate: number | null;
  growthRate1to7: number | null;
}

export interface SchoolRankingRow extends RoiFields {
  unitId: number;
  name: string;
  city: string;
  state: string;
  ownership: number;
  ownershipLabel: string;
  admissionRate: number | null;
  satCombined: number | null;
  size: number | null;
  costAttendance: number | null;
  netPrice: number | null;
  completionRate: number | null;
  selectivityTier: string;
  programCount: number;
  medianEarn1yr: number | null;
  weightedEarn1yr: number | null;
  weightedEarn5yr: number | null;
  weightedEarn7yr: number | null;
  /** Legacy 1-yr earnings ÷ cost ratio — superseded by the NPV fields; not displayed. */
  roi: number | null;
  hsEarnings: number | null;
  maxEarn1yr: number | null;
  topProgram: string | null;
}

/** DESC with NULLs last (SQLite semantics). */
function descNullsLast<T>(get: (x: T) => number | null) {
  return (a: T, b: T) => {
    const va = get(a);
    const vb = get(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return vb - va;
  };
}

/**
 * Longest earnings horizon first: 7yr DESC, then 5yr, then 1yr — rows missing
 * a horizon sort after rows that have it (NULLs last at every level).
 */
function longestHorizonDesc<T>(
  get7: (x: T) => number | null,
  get5: (x: T) => number | null,
  get1: (x: T) => number | null,
) {
  const c7 = descNullsLast(get7);
  const c5 = descNullsLast(get5);
  const c1 = descNullsLast(get1);
  return (a: T, b: T) => c7(a, b) || c5(a, b) || c1(a, b);
}

/** SQLite BINARY collation: plain code-unit comparison. */
function binaryAsc(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

type RawMajor = Omit<MajorSummaryRow, 'growthRate'> & { growthRate1to5: number | null };

const schools = schoolsJson as unknown as SchoolRow[];
// `id` matches the AUTOINCREMENT ids the ingest assigned (insertion order).
const programs = (programsJson as unknown as Omit<ProgramRow, 'id'>[]).map(
  (p, i): ProgramRow => ({ id: i + 1, ...p }),
);

export const majorsSummary: MajorSummaryRow[] = (majorsJson as unknown as RawMajor[])
  .map(({ growthRate1to5, ...m }) => ({ ...m, growthRate: growthRate1to5 }))
  .sort(longestHorizonDesc((m) => m.medianEarn7yr, (m) => m.medianEarn5yr, (m) => m.medianEarn1yr));

export const schoolRankings: SchoolRankingRow[] = [
  ...(rankingsJson as unknown as SchoolRankingRow[]),
].sort(longestHorizonDesc((r) => r.weightedEarn7yr, (r) => r.weightedEarn5yr, (r) => r.weightedEarn1yr));

const schoolsById = new Map(schools.map((s) => [s.unitId, s]));
const majorsByCip = new Map(majorsSummary.map((m) => [m.cipCode, m]));

const byEarnings = longestHorizonDesc<ProgramRow>((p) => p.earn7yr, (p) => p.earn5yr, (p) => p.earn1yr);
const programsByCip = new Map<string, ProgramRow[]>();
const programsByUnit = new Map<number, ProgramRow[]>();
for (const p of programs) {
  (programsByCip.get(p.cipCode) ?? programsByCip.set(p.cipCode, []).get(p.cipCode)!).push(p);
  (programsByUnit.get(p.unitId) ?? programsByUnit.set(p.unitId, []).get(p.unitId)!).push(p);
}
for (const list of programsByCip.values()) list.sort(byEarnings);
for (const list of programsByUnit.values()) list.sort(byEarnings);

export const schoolsByName = [...schools].sort((a, b) => binaryAsc(a.name, b.name));

export function getSchool(unitId: number): SchoolRow | undefined {
  return schoolsById.get(unitId);
}

const rankingsById = new Map(schoolRankings.map((r) => [r.unitId, r]));

/** Pre-aggregated ranking row (earnings + ROI) for a school, if it is ranked. */
export function getSchoolRanking(unitId: number): SchoolRankingRow | undefined {
  return rankingsById.get(unitId);
}

export function getMajor(cipCode: string): MajorSummaryRow | undefined {
  return majorsByCip.get(cipCode);
}

/** Programs for a major and/or school, longest horizon first (7yr → 5yr → 1yr, NULLs last). */
export function getPrograms({ cip, unitId }: { cip?: string; unitId?: number }): ProgramRow[] {
  let rows: ProgramRow[];
  if (cip != null && unitId != null) {
    rows = (programsByCip.get(cip) ?? []).filter((p) => p.unitId === unitId);
  } else if (cip != null) {
    rows = programsByCip.get(cip) ?? [];
  } else if (unitId != null) {
    rows = programsByUnit.get(unitId) ?? [];
  } else {
    rows = [];
  }
  return rows;
}

/** Top `limit` programs with any earnings figure, longest horizon first. */
export function topProgramsByEarnings(limit: number): ProgramRow[] {
  return programs
    .filter((p) => p.earn7yr != null || p.earn5yr != null || p.earn1yr != null)
    .sort(byEarnings)
    .slice(0, limit);
}
