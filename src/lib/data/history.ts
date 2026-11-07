/**
 * Over-time data for detail pages (kept out of store.ts so list pages and
 * APIs don't bundle it).
 *  - school-history.json: Scorecard cost history 2009–10 → latest + earnings
 *    checkpoints per release (scripts/build-school-history.ts)
 *  - major-history.json: ACS median wages by field of degree, 2009 → latest
 *    (scripts/build-major-history.ts)
 */
import schoolHistoryJson from '@/data/school-history.json';
import majorHistoryJson from '@/data/major-history.json';

export interface EarningsCheckpoint {
  label: string;
  e1?: number;
  e5?: number;
  e7?: number;
}

export interface SchoolHistory {
  years: string[];
  realDollarsOf: string;
  coa: (number | null)[];
  coaReal: (number | null)[];
  net: (number | null)[];
  netReal: (number | null)[];
  earnings: EarningsCheckpoint[];
}

export interface MajorHistoryPoint {
  year: number;
  median: number;
  medianReal: number;
  n: number;
}

export type AgeBand = '25-34' | '35-44';

export interface MajorHistoryField {
  fod1p: string;
  title: string;
  series: Record<AgeBand, MajorHistoryPoint[]>;
}

export interface MajorHistory {
  cpiBaseYear: number;
  fields: MajorHistoryField[];
  overall: Record<AgeBand, MajorHistoryPoint[]>;
}

interface SchoolHistoryFile {
  years: string[];
  realDollarsOf: string;
  schools: Record<
    string,
    {
      coa?: (number | null)[];
      coaReal?: (number | null)[];
      net?: (number | null)[];
      netReal?: (number | null)[];
      earnings?: EarningsCheckpoint[];
    }
  >;
}

interface MajorHistoryFile {
  cpiBaseYear: number;
  overall: Record<AgeBand, MajorHistoryPoint[]>;
  fields: (MajorHistoryField & { cip4: string[] })[];
}

const schoolFile = schoolHistoryJson as unknown as SchoolHistoryFile;
const majorFile = majorHistoryJson as unknown as MajorHistoryFile;

export function getSchoolHistory(unitId: number): SchoolHistory | null {
  const s = schoolFile.schools[String(unitId)];
  if (!s) return null;
  const blank = () => schoolFile.years.map(() => null);
  return {
    years: schoolFile.years,
    realDollarsOf: schoolFile.realDollarsOf,
    coa: s.coa ?? blank(),
    coaReal: s.coaReal ?? blank(),
    net: s.net ?? blank(),
    netReal: s.netReal ?? blank(),
    earnings: s.earnings ?? [],
  };
}

export function getMajorHistory(cipCode: string): MajorHistory | null {
  const fields = majorFile.fields
    .filter((f) => f.cip4.includes(cipCode))
    .filter((f) => (f.series['25-34']?.length ?? 0) + (f.series['35-44']?.length ?? 0) > 0)
    .map(({ fod1p, title, series }) => ({ fod1p, title, series }));
  if (fields.length === 0) return null;
  return { cpiBaseYear: majorFile.cpiBaseYear, fields, overall: majorFile.overall };
}
