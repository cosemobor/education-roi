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

export interface ProgramRow {
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
  earn1yrCount: number | null;
  earn5yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string | null;
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
  growthRate: number | null;
}

export interface SchoolRankingRow {
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
  roi: number | null;
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
  .sort(descNullsLast((m) => m.medianEarn1yr));

export const schoolRankings: SchoolRankingRow[] = [
  ...(rankingsJson as unknown as SchoolRankingRow[]),
].sort(descNullsLast((r) => r.weightedEarn1yr));

const schoolsById = new Map(schools.map((s) => [s.unitId, s]));
const majorsByCip = new Map(majorsSummary.map((m) => [m.cipCode, m]));

const byEarn1yr = descNullsLast<ProgramRow>((p) => p.earn1yr);
const programsByCip = new Map<string, ProgramRow[]>();
const programsByUnit = new Map<number, ProgramRow[]>();
for (const p of programs) {
  (programsByCip.get(p.cipCode) ?? programsByCip.set(p.cipCode, []).get(p.cipCode)!).push(p);
  (programsByUnit.get(p.unitId) ?? programsByUnit.set(p.unitId, []).get(p.unitId)!).push(p);
}
for (const list of programsByCip.values()) list.sort(byEarn1yr);
for (const list of programsByUnit.values()) list.sort(byEarn1yr);

export const schoolsByName = [...schools].sort((a, b) => binaryAsc(a.name, b.name));

export function getSchool(unitId: number): SchoolRow | undefined {
  return schoolsById.get(unitId);
}

export function getMajor(cipCode: string): MajorSummaryRow | undefined {
  return majorsByCip.get(cipCode);
}

/** Programs for a major and/or school, earn1yr DESC (NULLs last). */
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

/** Top `limit` programs with a 1-yr earnings figure, earn1yr DESC. */
export function topProgramsByEarnings(limit: number): ProgramRow[] {
  return programs
    .filter((p) => p.earn1yr != null)
    .sort(byEarn1yr)
    .slice(0, limit);
}
