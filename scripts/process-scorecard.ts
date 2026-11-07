/**
 * Process raw Scorecard data into app-ready JSON files.
 *
 * Usage:
 *   npx tsx scripts/process-scorecard.ts
 *
 * Reads:  data/raw-institutions.json, data/raw-programs.json
 * Writes: src/data/{programs,majors-summary,schools,school-rankings}.json (COMMITTED —
 *         the site bundles these; there is no database)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { gzipSync } from 'zlib';
import path from 'path';
import { computeRoi, curveAt, GRAD_AGE, HORIZON_YEARS, type AgeCurve, type CareerCurves, type RoiResult } from '../src/lib/roi';

const DATA_DIR = path.join(__dirname, '..', 'data'); // raw inputs (gitignored)
const OUT_DIR = path.join(__dirname, '..', 'src', 'data'); // app-ready outputs (committed)

// --- Types ---

interface RawInstitution {
  id: number;
  'school.name': string;
  'school.city': string;
  'school.state': string;
  'school.ownership': number;
  'latest.admissions.admission_rate.overall': number | null;
  'latest.admissions.sat_scores.75th_percentile.critical_reading': number | null;
  'latest.admissions.sat_scores.75th_percentile.math': number | null;
  'latest.student.size': number | null;
  'latest.cost.attendance.academic_year': number | null;
  'latest.cost.tuition.in_state': number | null;
  'latest.cost.tuition.out_of_state': number | null;
  'latest.cost.avg_net_price.public': number | null;
  'latest.cost.avg_net_price.private': number | null;
  'latest.completion.rate_suppressed.four_year': number | null;
  'location.lat': number | null;
  'location.lon': number | null;
}

interface RawProgram {
  unitId: number;
  schoolName: string;
  state: string;
  ownership: number;
  cipCode: string;
  cipTitle: string;
  credLevel: number;
  credTitle: string;
  earn1yr: number | null;
  earn1yrCount: number | null;
  earn4yr: number | null;
  earn4yrCount: number | null;
  earn5yr: number | null;
  earn5yrCount: number | null;
  earn7yr: number | null;
  earn7yrCount: number | null;
  earn7yrNational: number | null;
}

// --- Output types ---

interface School {
  unitId: number;
  name: string;
  city: string;
  state: string;
  ownership: number; // 1=public, 2=private nonprofit, 3=for-profit
  ownershipLabel: string;
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
  selectivityTier: string;
  lat: number | null;
  lon: number | null;
}

interface ProgramRecord {
  unitId: number;
  schoolName: string;
  state: string;
  cipCode: string;
  cipTitle: string;
  credLevel: number;
  credTitle: string;
  earn1yr: number | null;
  earn4yr: number | null;
  earn5yr: number | null;
  earn7yr: number | null;
  earn1yrCount: number | null;
  earn5yrCount: number | null;
  earn7yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string;
  // ROI over 7 years after graduation (src/lib/roi.ts), real 2024 $
  npv7: number | null;
  roi7: number | null;
  npv7Undiscounted: number | null;
  roi7Undiscounted: number | null;
  paybackYear: number | null;
  expectedNpv7: number | null;
  expectedRoi7: number | null;
  // Career view through age 45 (ACS age curves beyond year 7)
  careerNpv: number | null;
  careerRoi: number | null;
  careerNpvUndiscounted: number | null;
  careerPaybackYear: number | null;
  careerExpectedRoi: number | null;
  careerCurve: 'major' | 'all' | null; // which ACS curve extended it
}

type RoiFields = Pick<
  ProgramRecord,
  | 'npv7' | 'roi7' | 'npv7Undiscounted' | 'roi7Undiscounted' | 'paybackYear' | 'expectedNpv7' | 'expectedRoi7'
  | 'careerNpv' | 'careerRoi' | 'careerNpvUndiscounted' | 'careerPaybackYear' | 'careerExpectedRoi'
>;

function roiFields(r: RoiResult | null): RoiFields {
  const round = (v: number | null | undefined) => (v == null ? null : Math.round(v));
  const pct = (v: number | null | undefined) => (v == null ? null : Math.round(v * 1000) / 1000);
  return {
    npv7: round(r?.npv),
    roi7: pct(r?.roi),
    npv7Undiscounted: round(r?.npvUndiscounted),
    roi7Undiscounted: pct(r?.roiUndiscounted),
    paybackYear: r?.paybackYear ?? null,
    expectedNpv7: round(r?.expectedNpv),
    expectedRoi7: pct(r?.expectedRoi),
    careerNpv: round(r?.careerNpv),
    careerRoi: pct(r?.careerRoi),
    careerNpvUndiscounted: round(r?.careerNpvUndiscounted),
    careerPaybackYear: r?.careerPaybackYear ?? null,
    careerExpectedRoi: pct(r?.careerExpectedRoi),
  };
}

/** Average net price after grants for the school's control type (no sticker-price fallback). */
function netPriceOf(s: { ownership: number; netPricePublic: number | null; netPricePrivate: number | null } | undefined) {
  if (!s) return null;
  return s.ownership === 1 ? s.netPricePublic : s.netPricePrivate;
}

interface MajorSummary {
  cipCode: string;
  cipTitle: string;
  schoolCount: number;
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
  nationalMedianEarn7yr: number | null; // Scorecard's national median for this field of study
  growthRate1to5: number | null; // percentage growth from 1yr to 5yr
  growthRate1to7: number | null; // percentage growth from 1yr to 7yr
}

// --- Helpers ---

function ownershipLabel(code: number): string {
  if (code === 1) return 'Public';
  if (code === 2) return 'Private Nonprofit';
  if (code === 3) return 'Private For-Profit';
  return 'Unknown';
}

function selectivityTier(admRate: number | null): string {
  if (admRate == null) return 'Unknown';
  if (admRate < 0.1) return 'Most Selective';
  if (admRate < 0.25) return 'Highly Selective';
  if (admRate < 0.5) return 'Selective';
  if (admRate < 0.75) return 'Moderate';
  return 'Open';
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr: number[], pct: number): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function weightedAvg(items: { earn: number; count: number }[]): number | null {
  if (items.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const { earn, count } of items) {
    weightedSum += earn * count;
    totalWeight += count;
  }
  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
}

// --- Main ---

function main() {
  // 1. Load raw data
  console.log('Loading raw data...');
  const rawInstitutions: RawInstitution[] = JSON.parse(
    readFileSync(path.join(DATA_DIR, 'raw-institutions.json'), 'utf-8'),
  );
  const rawPrograms: RawProgram[] = JSON.parse(
    readFileSync(path.join(DATA_DIR, 'raw-programs.json'), 'utf-8'),
  );
  console.log(`  ${rawInstitutions.length.toLocaleString()} institutions`);
  console.log(`  ${rawPrograms.length.toLocaleString()} programs`);
  const extrasPath = path.join(DATA_DIR, 'raw-inst-extras.json');
  const instExtras: Record<string, { hsEarningsState: number | null; hsEarningsNational: number | null; completionRate: number | null }> =
    existsSync(extrasPath) ? JSON.parse(readFileSync(extrasPath, 'utf-8')) : {};
  if (!existsSync(extrasPath)) console.warn('  ⚠️ raw-inst-extras.json missing — run programs-from-bulk.ts; ROI will be empty');
  // ACS earnings-by-age curves (scripts/build-age-profiles.ts) + FOD1P↔CIP crosswalk
  const agePath = path.join(__dirname, '..', 'src', 'data', 'age-profiles.json');
  const xwalkPath = path.join(__dirname, 'data', 'fod1p-cip4-crosswalk.json');
  const ages = existsSync(agePath)
    ? (JSON.parse(readFileSync(agePath, 'utf-8')) as { bands: { mid: number }[]; hs: (number | null)[]; all: (number | null)[]; fields: Record<string, (number | null)[]>; fieldN: Record<string, number> })
    : null;
  const cipToFod: Record<string, string[]> = existsSync(xwalkPath)
    ? (JSON.parse(readFileSync(xwalkPath, 'utf-8')).cip4ToFod1p ?? {})
    : {};
  const mids = ages ? ages.bands.map((b) => b.mid) : [];
  const hsCurve: AgeCurve | null = ages ? { mids, values: ages.hs } : null;
  const allCurve: AgeCurve | null = ages ? { mids, values: ages.all } : null;
  if (!ages) console.warn('  ⚠️ age-profiles.json missing — run build-age-profiles.ts; no career view');
  /** The major's own curve (largest-sample mapped field) or the all-bachelor's fallback. */
  const careerFor = (cip: string): { curves: CareerCurves; kind: 'major' | 'all' } | null => {
    if (!ages || !hsCurve || !allCurve) return null;
    const fods = (cipToFod[cip] ?? []).filter((f) => ages.fields[f]);
    if (fods.length) {
      const best = fods.sort((a, b) => (ages.fieldN[b] ?? 0) - (ages.fieldN[a] ?? 0))[0];
      return { curves: { major: { mids, values: ages.fields[best] }, hs: hsCurve }, kind: 'major' };
    }
    return { curves: { major: allCurve, hs: hsCurve }, kind: 'all' };
  };
  const hsOf = (id: number) => instExtras[id]?.hsEarningsState ?? instExtras[id]?.hsEarningsNational ?? null;

  // 2. Build school lookup
  console.log('\nProcessing schools...');
  const schoolMap = new Map<number, School>();
  for (const inst of rawInstitutions) {
    const admRate = inst['latest.admissions.admission_rate.overall'];
    schoolMap.set(inst.id, {
      unitId: inst.id,
      name: inst['school.name'] || '',
      city: inst['school.city'] || '',
      state: inst['school.state'] || '',
      ownership: inst['school.ownership'] || 0,
      ownershipLabel: ownershipLabel(inst['school.ownership']),
      admissionRate: admRate,
      satRead75: inst['latest.admissions.sat_scores.75th_percentile.critical_reading'],
      satMath75: inst['latest.admissions.sat_scores.75th_percentile.math'],
      size: inst['latest.student.size'],
      costAttendance: inst['latest.cost.attendance.academic_year'],
      tuitionInState: inst['latest.cost.tuition.in_state'],
      tuitionOutState: inst['latest.cost.tuition.out_of_state'],
      netPricePublic: inst['latest.cost.avg_net_price.public'],
      netPricePrivate: inst['latest.cost.avg_net_price.private'],
      completionRate: inst['latest.completion.rate_suppressed.four_year'],
      selectivityTier: selectivityTier(admRate),
      lat: inst['location.lat'],
      lon: inst['location.lon'],
    });
  }
  console.log(`  ${schoolMap.size.toLocaleString()} schools indexed`);

  // 3. Build program records (Bachelor's only, with at least 1yr earnings)
  console.log('\nProcessing programs...');
  const bachelors = rawPrograms.filter((p) => p.credLevel === 3);
  console.log(`  ${bachelors.length.toLocaleString()} bachelor's programs`);

  const programs: ProgramRecord[] = [];
  for (const p of bachelors) {
    if (p.earn1yr == null && p.earn4yr == null && p.earn5yr == null && p.earn7yr == null) continue;

    const school = schoolMap.get(p.unitId);
    const career = careerFor(p.cipCode);
    const roi = computeRoi({
      career: career?.curves ?? null,
      e1: p.earn1yr, e4: p.earn4yr, e5: p.earn5yr, e7: p.earn7yr,
      netPrice: netPriceOf(school),
      hsEarnings: hsOf(p.unitId),
      completionRate: instExtras[p.unitId]?.completionRate ?? school?.completionRate ?? null,
    });
    programs.push({
      unitId: p.unitId,
      schoolName: p.schoolName,
      state: p.state,
      cipCode: p.cipCode,
      cipTitle: p.cipTitle,
      credLevel: p.credLevel,
      credTitle: p.credTitle,
      earn1yr: p.earn1yr,
      earn4yr: p.earn4yr,
      earn5yr: p.earn5yr,
      earn7yr: p.earn7yr,
      earn1yrCount: p.earn1yrCount,
      earn5yrCount: p.earn5yrCount,
      earn7yrCount: p.earn7yrCount,
      costAttendance: school?.costAttendance ?? null,
      selectivityTier: school?.selectivityTier ?? 'Unknown',
      ...roiFields(roi),
      careerCurve: roi?.careerNpv != null ? (career?.kind ?? null) : null,
    });
  }
  console.log(`  ${programs.length.toLocaleString()} programs with earnings data`);

  // 4. Compute major-level summaries (weighted by completer count)
  console.log('\nComputing major summaries (weighted by completer count)...');
  interface MajorEntry {
    title: string;
    earn1yr: { earn: number; count: number }[];
    earn4yr: { earn: number; count: number }[];
    earn5yr: { earn: number; count: number }[];
    earn7yr: { earn: number; count: number }[];
  }
  const majorMap = new Map<string, MajorEntry>();

  for (const p of programs) {
    let entry = majorMap.get(p.cipCode);
    if (!entry) {
      entry = { title: p.cipTitle, earn1yr: [], earn4yr: [], earn5yr: [], earn7yr: [] };
      majorMap.set(p.cipCode, entry);
    }
    // Use completer count as weight; default to 1 if count is missing
    if (p.earn1yr != null) entry.earn1yr.push({ earn: p.earn1yr, count: p.earn1yrCount ?? 1 });
    if (p.earn4yr != null) entry.earn4yr.push({ earn: p.earn4yr, count: 1 }); // no count field for 4yr
    if (p.earn5yr != null) entry.earn5yr.push({ earn: p.earn5yr, count: p.earn5yrCount ?? 1 });
    if (p.earn7yr != null) entry.earn7yr.push({ earn: p.earn7yr, count: p.earn7yrCount ?? 1 });
  }

  // Scorecard's national 7yr median per field of study (same on every row of a CIP)
  const national7yr = new Map<string, number>();
  for (const p of bachelors) {
    if (p.earn7yrNational != null && !national7yr.has(p.cipCode)) national7yr.set(p.cipCode, p.earn7yrNational);
  }

  const majorsSummary: MajorSummary[] = [];
  for (const [cipCode, entry] of majorMap) {
    const avg1 = weightedAvg(entry.earn1yr);
    const avg5 = weightedAvg(entry.earn5yr);
    // Raw values for percentiles (unweighted — shows school-level distribution)
    const raw1yr = entry.earn1yr.map((e) => e.earn);
    const raw5yr = entry.earn5yr.map((e) => e.earn);
    const avg7 = weightedAvg(entry.earn7yr);
    const raw7yr = entry.earn7yr.map((e) => e.earn);
    majorsSummary.push({
      cipCode,
      cipTitle: entry.title,
      schoolCount: entry.earn1yr.length,
      medianEarn1yr: avg1,
      medianEarn4yr: weightedAvg(entry.earn4yr),
      medianEarn5yr: avg5,
      p25Earn1yr: percentile(raw1yr, 25),
      p75Earn1yr: percentile(raw1yr, 75),
      p25Earn5yr: percentile(raw5yr, 25),
      p75Earn5yr: percentile(raw5yr, 75),
      medianEarn7yr: avg7,
      p25Earn7yr: percentile(raw7yr, 25),
      p75Earn7yr: percentile(raw7yr, 75),
      nationalMedianEarn7yr: national7yr.get(cipCode) ?? null,
      growthRate1to5: avg1 && avg5 ? Math.round(((avg5 - avg1) / avg1) * 100) : null,
      growthRate1to7: avg1 && avg7 ? Math.round(((avg7 - avg1) / avg1) * 100) : null,
    });
  }

  // Sort by 7yr earnings (the longest horizon), then 5yr, then 1yr; missing last
  const byLongest = (x: { e7: number | null; e5: number | null; e1: number | null }) =>
    [x.e7 ?? -1, x.e5 ?? -1, x.e1 ?? -1];
  const cmpDesc = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  };
  majorsSummary.sort((a, b) =>
    cmpDesc(
      byLongest({ e7: a.medianEarn7yr, e5: a.medianEarn5yr, e1: a.medianEarn1yr }),
      byLongest({ e7: b.medianEarn7yr, e5: b.medianEarn5yr, e1: b.medianEarn1yr }),
    ),
  );

  console.log(`  ${majorsSummary.length} unique majors`);

  // 4b. Compute school-level rankings (pre-aggregated for homepage)
  console.log('\nComputing school rankings...');

  interface SchoolEarnings {
    earn1yr: { earn: number; count: number }[];
    earn5yr: { earn: number; count: number }[];
    earn7yr: { earn: number; count: number }[];
    // ROI path: programs with both 1yr and 7yr, weighted by 7yr graduates
    roiPath: { w: number; e1: number; e4w: number; e4: number; e5w: number; e5: number; e7: number };
    // Graduate-weighted blend of program age curves, normalized to 1 at year 7
    curveW: number;
    curveSum: number[];
    maxEarn1yr: number;
    topProgram: string | null;
    programCount: number;
  }

  const schoolEarningsMap = new Map<number, SchoolEarnings>();
  // Programs are already sorted by earn1yr desc (from step 3 processing)
  for (const p of programs) {
    let entry = schoolEarningsMap.get(p.unitId);
    if (!entry) {
      entry = { earn1yr: [], earn5yr: [], earn7yr: [], roiPath: { w: 0, e1: 0, e4w: 0, e4: 0, e5w: 0, e5: 0, e7: 0 }, curveW: 0, curveSum: mids.map(() => 0), maxEarn1yr: 0, topProgram: null, programCount: 0 };
      schoolEarningsMap.set(p.unitId, entry);
    }
    if (p.earn1yr != null) {
      entry.earn1yr.push({ earn: p.earn1yr, count: p.earn1yrCount ?? 1 });
      entry.programCount++;
      if (p.earn1yr > entry.maxEarn1yr) {
        entry.maxEarn1yr = p.earn1yr;
        if (!entry.topProgram) {
          entry.topProgram = p.cipTitle.replace(/\.+$/, '');
        }
      }
    }
    if (p.earn5yr != null) {
      entry.earn5yr.push({ earn: p.earn5yr, count: p.earn5yrCount ?? 1 });
    }
    if (p.earn7yr != null) {
      entry.earn7yr.push({ earn: p.earn7yr, count: p.earn7yrCount ?? 1 });
    }
    if (p.earn1yr != null && p.earn7yr != null) {
      const w = p.earn7yrCount ?? 1;
      const rp = entry.roiPath;
      rp.w += w; rp.e1 += p.earn1yr * w; rp.e7 += p.earn7yr * w;
      if (p.earn4yr != null) { rp.e4w += w; rp.e4 += p.earn4yr * w; }
      if (p.earn5yr != null) { rp.e5w += w; rp.e5 += p.earn5yr * w; }
      const cf = careerFor(p.cipCode);
      const at7 = cf ? curveAt(cf.curves.major, GRAD_AGE + HORIZON_YEARS) : null;
      if (cf && at7) {
        entry.curveW += w;
        mids.forEach((m, i) => { entry!.curveSum[i] += w * ((curveAt(cf.curves.major, m) ?? at7) / at7); });
      }
    }
  }

  interface SchoolRankingRecord {
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
    roi: number | null;
    hsEarnings: number | null;
    npv7: number | null;
    roi7: number | null;
    npv7Undiscounted: number | null;
    roi7Undiscounted: number | null;
    paybackYear: number | null;
    expectedNpv7: number | null;
    expectedRoi7: number | null;
    careerNpv: number | null;
    careerRoi: number | null;
    careerNpvUndiscounted: number | null;
    careerPaybackYear: number | null;
    careerExpectedRoi: number | null;
    maxEarn1yr: number | null;
    topProgram: string | null;
  }

  const schoolRankings: SchoolRankingRecord[] = [];
  for (const [unitId, earnings] of schoolEarningsMap) {
    if (earnings.programCount === 0) continue;
    const school = schoolMap.get(unitId);
    if (!school) continue;

    const raw1yr = earnings.earn1yr.map((e) => e.earn);
    const med1yr = median(raw1yr);
    const w1yr = weightedAvg(earnings.earn1yr);
    const w5yr = weightedAvg(earnings.earn5yr);
    const w7yr = weightedAvg(earnings.earn7yr);
    const cost = school.costAttendance;
    const satCombined =
      school.satMath75 != null && school.satRead75 != null
        ? school.satMath75 + school.satRead75
        : null;
    const netPrice =
      school.ownership === 1
        ? (school.netPricePublic ?? cost)
        : (school.netPricePrivate ?? cost);
    const roi =
      w1yr != null && cost != null && cost > 0
        ? Math.round((w1yr / cost) * 100) / 100
        : null;

    const rp = earnings.roiPath;
    const schoolRoi =
      rp.w > 0
        ? computeRoi({
            e1: rp.e1 / rp.w,
            e4: rp.e4w > 0 ? rp.e4 / rp.e4w : null,
            e5: rp.e5w > 0 ? rp.e5 / rp.e5w : null,
            e7: rp.e7 / rp.w,
            netPrice: netPriceOf(school),
            hsEarnings: hsOf(unitId),
            completionRate: instExtras[unitId]?.completionRate ?? school.completionRate ?? null,
            career:
              hsCurve && earnings.curveW > 0
                ? { major: { mids, values: earnings.curveSum.map((v) => v / earnings.curveW) }, hs: hsCurve }
                : null,
          })
        : null;

    schoolRankings.push({
      unitId,
      name: school.name,
      city: school.city,
      state: school.state,
      ownership: school.ownership,
      ownershipLabel: school.ownershipLabel,
      admissionRate: school.admissionRate,
      satCombined,
      size: school.size,
      costAttendance: cost,
      netPrice,
      completionRate: school.completionRate,
      selectivityTier: school.selectivityTier,
      programCount: earnings.programCount,
      medianEarn1yr: med1yr,
      weightedEarn1yr: w1yr,
      weightedEarn5yr: w5yr,
      weightedEarn7yr: w7yr,
      roi,
      hsEarnings: hsOf(unitId),
      ...roiFields(schoolRoi),
      maxEarn1yr: earnings.maxEarn1yr,
      topProgram: earnings.topProgram,
    });
  }

  // Default order: 7yr earnings, then 5yr, then 1yr; schools missing 7yr follow
  schoolRankings.sort((a, b) =>
    cmpDesc(
      byLongest({ e7: a.weightedEarn7yr, e5: a.weightedEarn5yr, e1: a.weightedEarn1yr }),
      byLongest({ e7: b.weightedEarn7yr, e5: b.weightedEarn5yr, e1: b.weightedEarn1yr }),
    ),
  );
  console.log(`  ${schoolRankings.length.toLocaleString()} school rankings`);

  // 5. Write output files
  console.log('\nWriting output files...');

  const schoolsArray = Array.from(schoolMap.values());
  writeFileSync(path.join(OUT_DIR, 'schools.json'), JSON.stringify(schoolsArray));
  console.log(`  schools.json: ${schoolsArray.length.toLocaleString()} schools`);

  writeFileSync(path.join(OUT_DIR, 'programs.json'), JSON.stringify(programs));
  console.log(`  programs.json: ${programs.length.toLocaleString()} programs`);

  writeFileSync(path.join(OUT_DIR, 'majors-summary.json'), JSON.stringify(majorsSummary, null, 2));
  console.log(`  majors-summary.json: ${majorsSummary.length} majors`);

  writeFileSync(path.join(OUT_DIR, 'school-rankings.json'), JSON.stringify(schoolRankings));
  console.log(`  school-rankings.json: ${schoolRankings.length.toLocaleString()} school rankings`);

  // 5b. Dated snapshot (committed, not shipped): the site builds its own
  // consistent history one Scorecard release at a time.
  const releasePath = path.join(DATA_DIR, 'release.json');
  if (existsSync(releasePath)) {
    const { release } = JSON.parse(readFileSync(releasePath, 'utf-8')) as { release: string };
    const snapDir = path.join(__dirname, '..', 'snapshots');
    mkdirSync(snapDir, { recursive: true });
    const snapshot = {
      release,
      createdAt: new Date().toISOString(),
      programs: programs.map((p) => [p.unitId, p.cipCode, p.earn1yr, p.earn4yr, p.earn5yr, p.earn7yr, p.earn1yrCount, p.earn5yrCount, p.earn7yrCount]),
      programColumns: ['unitId', 'cipCode', 'earn1yr', 'earn4yr', 'earn5yr', 'earn7yr', 'earn1yrCount', 'earn5yrCount', 'earn7yrCount'],
      schools: schoolsArray.map((s) => [s.unitId, s.costAttendance, s.netPricePublic, s.netPricePrivate, s.tuitionInState, s.tuitionOutState]),
      schoolColumns: ['unitId', 'costAttendance', 'netPricePublic', 'netPricePrivate', 'tuitionInState', 'tuitionOutState'],
      majors: majorsSummary,
    };
    const file = path.join(snapDir, `scorecard-${release}.json.gz`);
    writeFileSync(file, gzipSync(JSON.stringify(snapshot)));
    console.log(`  snapshot: ${path.relative(process.cwd(), file)}`);
  } else {
    console.warn('  ⚠️ data/release.json missing — run programs-from-bulk.ts; no snapshot written');
  }

  // 6. Print top 20 majors
  console.log('\n=== Top 20 Majors by Median 1-Year Earnings ===');
  console.log(`${'Rank'.padStart(4)} ${'Major'.padEnd(50)} ${'1yr Med'.padStart(10)} ${'5yr Med'.padStart(10)} ${'Growth'.padStart(8)} ${'Schools'.padStart(8)}`);
  console.log('-'.repeat(94));
  for (let i = 0; i < Math.min(20, majorsSummary.length); i++) {
    const m = majorsSummary[i];
    const earn1 = m.medianEarn1yr ? `$${m.medianEarn1yr.toLocaleString()}` : 'N/A';
    const earn5 = m.medianEarn5yr ? `$${m.medianEarn5yr.toLocaleString()}` : 'N/A';
    const growth = m.growthRate1to5 != null ? `${m.growthRate1to5}%` : 'N/A';
    console.log(
      `${(i + 1).toString().padStart(4)} ${m.cipTitle.padEnd(50)} ${earn1.padStart(10)} ${earn5.padStart(10)} ${growth.padStart(8)} ${m.schoolCount.toString().padStart(8)}`,
    );
  }
}

main();
