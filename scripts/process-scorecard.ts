/**
 * Process raw Scorecard data into app-ready JSON files.
 *
 * Usage:
 *   npx tsx scripts/process-scorecard.ts
 *
 * Reads:  data/raw-institutions.json, data/raw-programs.json
 * Writes: data/programs.json, data/majors-summary.json, data/schools.json
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

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
  earn1yrCount: number | null;
  earn5yrCount: number | null;
  costAttendance: number | null;
  selectivityTier: string;
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
  growthRate1to5: number | null; // percentage growth from 1yr to 5yr
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
    if (p.earn1yr == null && p.earn4yr == null && p.earn5yr == null) continue;

    const school = schoolMap.get(p.unitId);
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
      earn1yrCount: p.earn1yrCount,
      earn5yrCount: p.earn5yrCount,
      costAttendance: school?.costAttendance ?? null,
      selectivityTier: school?.selectivityTier ?? 'Unknown',
    });
  }
  console.log(`  ${programs.length.toLocaleString()} programs with earnings data`);

  // 4. Compute major-level summaries
  console.log('\nComputing major summaries...');
  const majorMap = new Map<string, { title: string; earn1yr: number[]; earn4yr: number[]; earn5yr: number[] }>();

  for (const p of programs) {
    let entry = majorMap.get(p.cipCode);
    if (!entry) {
      entry = { title: p.cipTitle, earn1yr: [], earn4yr: [], earn5yr: [] };
      majorMap.set(p.cipCode, entry);
    }
    if (p.earn1yr != null) entry.earn1yr.push(p.earn1yr);
    if (p.earn4yr != null) entry.earn4yr.push(p.earn4yr);
    if (p.earn5yr != null) entry.earn5yr.push(p.earn5yr);
  }

  const majorsSummary: MajorSummary[] = [];
  for (const [cipCode, entry] of majorMap) {
    const med1 = median(entry.earn1yr);
    const med5 = median(entry.earn5yr);
    majorsSummary.push({
      cipCode,
      cipTitle: entry.title,
      schoolCount: entry.earn1yr.length,
      medianEarn1yr: med1,
      medianEarn4yr: median(entry.earn4yr),
      medianEarn5yr: med5,
      p25Earn1yr: percentile(entry.earn1yr, 25),
      p75Earn1yr: percentile(entry.earn1yr, 75),
      p25Earn5yr: percentile(entry.earn5yr, 25),
      p75Earn5yr: percentile(entry.earn5yr, 75),
      growthRate1to5: med1 && med5 ? Math.round(((med5 - med1) / med1) * 100) : null,
    });
  }

  // Sort by median 1yr earnings descending
  majorsSummary.sort((a, b) => (b.medianEarn1yr ?? 0) - (a.medianEarn1yr ?? 0));

  console.log(`  ${majorsSummary.length} unique majors`);

  // 5. Write output files
  console.log('\nWriting output files...');

  const schoolsArray = Array.from(schoolMap.values());
  writeFileSync(path.join(DATA_DIR, 'schools.json'), JSON.stringify(schoolsArray));
  console.log(`  schools.json: ${schoolsArray.length.toLocaleString()} schools`);

  writeFileSync(path.join(DATA_DIR, 'programs.json'), JSON.stringify(programs));
  console.log(`  programs.json: ${programs.length.toLocaleString()} programs`);

  writeFileSync(path.join(DATA_DIR, 'majors-summary.json'), JSON.stringify(majorsSummary, null, 2));
  console.log(`  majors-summary.json: ${majorsSummary.length} majors`);

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
