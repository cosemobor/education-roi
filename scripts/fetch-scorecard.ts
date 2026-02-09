/**
 * Fetch College Scorecard data from the Department of Education API.
 *
 * Usage:
 *   npx tsx scripts/fetch-scorecard.ts
 *
 * Requires SCORECARD_API_KEY in .env.local (get one free at https://api.data.gov/signup/)
 * Outputs raw JSON to data/raw-institutions.json and data/raw-programs.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const API_KEY = process.env.SCORECARD_API_KEY || 'DEMO_KEY';
const BASE_URL = 'https://api.data.gov/ed/collegescorecard/v1/schools';
const PER_PAGE = 100;
const DATA_DIR = path.join(__dirname, '..', 'data');

// --- Institution fields ---
const INSTITUTION_FIELDS = [
  'id',
  'school.name',
  'school.city',
  'school.state',
  'school.ownership',
  'latest.admissions.admission_rate.overall',
  'latest.admissions.sat_scores.75th_percentile.critical_reading',
  'latest.admissions.sat_scores.75th_percentile.math',
  'latest.student.size',
  'latest.cost.attendance.academic_year',
  'latest.cost.tuition.in_state',
  'latest.cost.tuition.out_of_state',
  'latest.cost.avg_net_price.public',
  'latest.cost.avg_net_price.private',
  'latest.completion.rate_suppressed.four_year',
  'location.lat',
  'location.lon',
].join(',');

// --- Field of Study fields ---
const FOS_FIELDS = [
  'id',
  'school.name',
  'school.state',
  'school.ownership',
  'latest.programs.cip_4_digit.code',
  'latest.programs.cip_4_digit.title',
  'latest.programs.cip_4_digit.credential.level',
  'latest.programs.cip_4_digit.credential.title',
  'latest.programs.cip_4_digit.earnings.1_yr.overall_median_earnings',
  'latest.programs.cip_4_digit.earnings.1_yr.working_not_enrolled.overall_count',
  'latest.programs.cip_4_digit.earnings.4_yr.overall_median_earnings',
  'latest.programs.cip_4_digit.earnings.4_yr.working_not_enrolled.overall_count',
  'latest.programs.cip_4_digit.earnings.5_yr.overall_median_earnings',
  'latest.programs.cip_4_digit.earnings.5_yr.working_not_enrolled.overall_count',
].join(',');

interface ApiResponse {
  metadata: { total: number; page: number; per_page: number };
  results: Record<string, unknown>[];
}

async function fetchPage(url: string): Promise<ApiResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<ApiResponse>;
}

async function fetchAllPages(
  baseParams: string,
  label: string,
): Promise<Record<string, unknown>[]> {
  const allResults: Record<string, unknown>[] = [];
  let page = 0;
  let total = Infinity;

  while (page * PER_PAGE < total) {
    const url = `${BASE_URL}?api_key=${API_KEY}&per_page=${PER_PAGE}&page=${page}&${baseParams}`;
    process.stdout.write(`\r  Fetching ${label} page ${page + 1}...`);

    const data = await fetchPage(url);
    total = data.metadata.total;
    allResults.push(...data.results);
    page++;

    if (page === 1) {
      console.log(` (${total.toLocaleString()} total records)`);
    }

    // Rate limit: DEMO_KEY allows 30 req / 10s window
    if (API_KEY === 'DEMO_KEY') {
      await new Promise((r) => setTimeout(r, 350));
    } else {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  console.log(`\n  Done: ${allResults.length.toLocaleString()} records fetched.`);
  return allResults;
}

async function main() {
  console.log(`Using API key: ${API_KEY === 'DEMO_KEY' ? 'DEMO_KEY (rate-limited)' : 'custom key'}\n`);

  // 1. Fetch institutions (degree-granting, currently operating)
  console.log('=== Fetching Institution Data ===');
  const instParams = `fields=${INSTITUTION_FIELDS}&school.operating=1&school.degrees_awarded.predominant__range=1..4`;
  const institutions = await fetchAllPages(instParams, 'institutions');
  const instPath = path.join(DATA_DIR, 'raw-institutions.json');
  writeFileSync(instPath, JSON.stringify(institutions, null, 2));
  console.log(`  Saved to ${instPath}\n`);

  // 2. Fetch field-of-study data
  // The programs are nested within school results, so we fetch schools
  // with program data included. We filter to degree-granting schools.
  console.log('=== Fetching Field of Study Data ===');
  const fosParams = `fields=${FOS_FIELDS}&school.operating=1&school.degrees_awarded.predominant__range=1..4`;
  const fosSchools = await fetchAllPages(fosParams, 'field-of-study');

  // Flatten: each school has an array of programs, extract each as its own record
  interface Program {
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

  const programs: Program[] = [];
  for (const school of fosSchools) {
    const unitId = school['id'] as number;
    const schoolName = (school['school.name'] as string) || '';
    const state = (school['school.state'] as string) || '';
    const ownership = (school['school.ownership'] as number) || 0;

    const cip4 = school['latest.programs.cip_4_digit'] as Record<string, unknown>[] | undefined;
    if (!Array.isArray(cip4)) continue;

    for (const prog of cip4) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = prog as any;
      const cred = p.credential || {};
      const e1 = p.earnings?.['1_yr'] || {};
      const e4 = p.earnings?.['4_yr'] || {};
      const e5 = p.earnings?.['5_yr'] || {};

      programs.push({
        unitId,
        schoolName,
        state,
        ownership,
        cipCode: p.code || '',
        cipTitle: p.title || '',
        credLevel: cred.level ?? 0,
        credTitle: cred.title || '',
        earn1yr: e1.overall_median_earnings ?? null,
        earn1yrCount: e1.working_not_enrolled?.overall_count ?? null,
        earn4yr: e4.overall_median_earnings ?? null,
        earn4yrCount: e4.working_not_enrolled?.overall_count ?? null,
        earn5yr: e5.overall_median_earnings ?? null,
        earn5yrCount: e5.working_not_enrolled?.overall_count ?? null,
      });
    }
  }

  const fosPath = path.join(DATA_DIR, 'raw-programs.json');
  writeFileSync(fosPath, JSON.stringify(programs, null, 2));
  console.log(`  Flattened ${programs.length.toLocaleString()} program records`);
  console.log(`  Saved to ${fosPath}\n`);

  // Quick stats
  const bachelors = programs.filter((p) => p.credLevel === 3);
  const withEarnings = bachelors.filter((p) => p.earn1yr != null);
  console.log('=== Quick Stats ===');
  console.log(`  Total programs: ${programs.length.toLocaleString()}`);
  console.log(`  Bachelor's programs: ${bachelors.length.toLocaleString()}`);
  console.log(`  Bachelor's with 1yr earnings: ${withEarnings.length.toLocaleString()}`);
  const uniqueMajors = new Set(bachelors.map((p) => p.cipCode));
  const uniqueSchools = new Set(bachelors.map((p) => p.unitId));
  console.log(`  Unique majors (CIP codes): ${uniqueMajors.size}`);
  console.log(`  Unique schools: ${uniqueSchools.size}`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
