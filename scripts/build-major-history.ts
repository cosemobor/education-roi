/**
 * Earnings by college major over time — Census ACS 1-year PUMS microdata.
 *
 * For each ACS field of bachelor's degree (FOD1P), the weighted median annual
 * wage (WAGP × ADJINC, PWGTP weights) by year, 2009 → latest ACS 1-year.
 *
 * Population (consistent every year):
 *   - bachelor's degree is the HIGHEST degree (SCHL=21), so graduate-degree
 *     holders don't inflate a major's earnings
 *   - full-time year-round: usual hours ≥ 35 (WKHP) and 50–52 weeks worked
 *     (pre-2019 WKW=1; 2019+ WKWN=50–52 — the ACS weeks question changed)
 *   - positive wage income
 *   - age bands 25–34 (early career) and 35–44 (mid career)
 * Cells with fewer than MIN_N unweighted respondents are suppressed.
 * 2020 is skipped: the 2020 ACS 1-year was released only with experimental
 * weights and is not served by the PUMS API.
 * Real values: CPI-U annual average (FRED CPIAUCSL), constant CPI_BASE_YEAR $.
 *
 * Crosswalk to Scorecard majors: scripts/data/fod1p-cip4-crosswalk.json
 * (Census + NCES sources; see that file for method).
 *
 * Needs CENSUS_API_KEY (this repo's .env.local, else ~/GitHub/HAM/.env.local).
 * Raw API responses cache in data/acs/ (gitignored).
 * Output: src/data/major-history.json
 *
 * Usage: npx tsx scripts/build-major-history.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'acs');
const OUT = path.join(ROOT, 'src', 'data', 'major-history.json');
const XWALK = path.join(__dirname, 'data', 'fod1p-cip4-crosswalk.json');
const FIRST_YEAR = 2009;
const SKIP_YEARS = new Set([2020]);
const MIN_N = 100;
const BANDS: { key: string; lo: number; hi: number }[] = [
  { key: '25-34', lo: 25, hi: 34 },
  { key: '35-44', lo: 35, hi: 44 },
];

function apiKey(): string {
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '..', 'HAM', '.env.local')]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^CENSUS_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('CENSUS_API_KEY not found in .env.local (this repo or ../HAM)');
}

async function getJson(url: string, cacheFile: string | null): Promise<unknown> {
  if (cacheFile && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const text = await res.text();
  if (cacheFile) writeFileSync(cacheFile, text);
  return JSON.parse(text);
}

/** Latest ACS 1-year PUMS year the API serves. */
async function latestYear(): Promise<number> {
  for (let y = new Date().getFullYear(); y > FIRST_YEAR; y--) {
    const r = await fetch(`https://api.census.gov/data/${y}/acs/acs1/pums/variables.json`);
    if (r.ok) return y;
  }
  throw new Error('No ACS PUMS year found');
}

async function fetchYear(y: number, key: string): Promise<string[][]> {
  const weeks = y >= 2019 ? 'WKWN=50:52' : 'WKW=1';
  const url =
    `https://api.census.gov/data/${y}/acs/acs1/pums?get=WAGP,FOD1P,PWGTP,ADJINC,AGEP` +
    `&SCHL=21&AGEP=25:44&WKHP=35:99&${weeks}&key=${key}`;
  return (await getJson(url, path.join(CACHE, `pums_${y}.json`))) as string[][];
}

async function fodTitles(y: number): Promise<Record<string, string>> {
  const d = (await getJson(
    `https://api.census.gov/data/${y}/acs/acs1/pums/variables/FOD1P.json`,
    path.join(CACHE, `fod1p_${y}.json`),
  )) as { values?: { item?: Record<string, string> } };
  return d.values?.item ?? {};
}

async function cpiAnnual(): Promise<Map<number, number>> {
  const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL');
  if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
  const byYear = new Map<number, number[]>();
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const [date, v] = line.split(',');
    const val = Number(v);
    if (!Number.isFinite(val)) continue;
    const y = Number(date.slice(0, 4));
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(val);
  }
  const out = new Map<number, number>();
  // full-year averages only (12 months)
  for (const [y, vs] of byYear) if (vs.length === 12) out.set(y, vs.reduce((a, b) => a + b, 0) / 12);
  return out;
}

function weightedMedian(items: { v: number; w: number }[]): number {
  items.sort((a, b) => a.v - b.v);
  const total = items.reduce((a, b) => a + b.w, 0);
  let cum = 0;
  for (const it of items) {
    cum += it.w;
    if (cum >= total / 2) return it.v;
  }
  return items[items.length - 1].v;
}

interface Point { year: number; median: number; medianReal: number; n: number }

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const key = apiKey();
  const last = await latestYear();
  const years: number[] = [];
  for (let y = FIRST_YEAR; y <= last; y++) if (!SKIP_YEARS.has(y)) years.push(y);
  console.log(`ACS 1-year PUMS ${FIRST_YEAR}–${last} (skipping ${[...SKIP_YEARS].join(', ')})`);

  const cpi = await cpiAnnual();
  const cpiBaseYear = cpi.has(last) ? last : Math.max(...cpi.keys());
  const base = cpi.get(cpiBaseYear)!;

  // series[fod][band] and an all-majors series per band
  const series = new Map<string, Map<string, Point[]>>();
  const overall = new Map<string, Point[]>(BANDS.map((b) => [b.key, []]));
  const titles: Record<string, string> = {};

  for (const y of years) {
    const rows = await fetchYear(y, key);
    const h = rows[0];
    const iW = h.indexOf('WAGP'), iF = h.indexOf('FOD1P'), iP = h.indexOf('PWGTP');
    const iA = h.indexOf('ADJINC'), iAge = h.indexOf('AGEP');
    const cells = new Map<string, { v: number; w: number }[]>();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const wagp = Number(r[iW]);
      if (!(wagp > 0)) continue;
      let adj = Number(r[iA]);
      if (adj > 100) adj /= 1e6; // older years encode ADJINC as an integer ×1e6
      const age = Number(r[iAge]);
      const band = BANDS.find((b) => age >= b.lo && age <= b.hi);
      if (!band) continue;
      const fod = String(r[iF]).padStart(4, '0');
      const item = { v: wagp * adj, w: Number(r[iP]) };
      for (const k of [`${fod}|${band.key}`, `ALL|${band.key}`]) {
        (cells.get(k) ?? cells.set(k, []).get(k)!).push(item);
      }
    }
    const deflate = (v: number) => Math.round((v * base) / cpi.get(y)!);
    for (const [k, items] of cells) {
      if (items.length < MIN_N) continue;
      const [fod, band] = k.split('|');
      const med = Math.round(weightedMedian(items));
      const pt: Point = { year: y, median: med, medianReal: deflate(med), n: items.length };
      if (fod === 'ALL') overall.get(band)!.push(pt);
      else {
        const byBand = series.get(fod) ?? series.set(fod, new Map()).get(fod)!;
        (byBand.get(band) ?? byBand.set(band, []).get(band)!).push(pt);
      }
    }
    Object.assign(titles, await fodTitles(y)); // later years override older labels
    console.log(`  ${y}: ${rows.length - 1} records`);
  }

  const xwalk = JSON.parse(readFileSync(XWALK, 'utf8')) as { cip4ToFod1p: Record<string, string[]> };
  const cipByFod = new Map<string, string[]>();
  for (const [cip4, fods] of Object.entries(xwalk.cip4ToFod1p)) {
    for (const f of fods) (cipByFod.get(f) ?? cipByFod.set(f, []).get(f)!).push(cip4);
  }

  const fields = [...series.entries()]
    .map(([fod1p, byBand]) => ({
      fod1p,
      title: titles[fod1p] ?? fod1p,
      cip4: (cipByFod.get(fod1p) ?? []).sort(),
      series: Object.fromEntries(BANDS.map((b) => [b.key, byBand.get(b.key) ?? []])),
    }))
    .sort((a, b) => a.fod1p.localeCompare(b.fod1p));

  const output = {
    source:
      "U.S. Census Bureau, American Community Survey 1-year PUMS. Median annual wages (WAGP, ADJINC-adjusted, PWGTP-weighted) of full-time year-round workers (35+ hrs/week, 50–52 weeks) whose highest degree is a bachelor's. 2020 omitted (no standard 1-year release). Cells with < 100 respondents suppressed. Real values: CPI-U (FRED CPIAUCSL).",
    cpiBaseYear,
    minN: MIN_N,
    years,
    overall: Object.fromEntries(overall),
    fields,
  };
  writeFileSync(OUT, JSON.stringify(output));
  console.log(`Wrote ${OUT}: ${fields.length} fields, ${(JSON.stringify(output).length / 1e6).toFixed(2)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
