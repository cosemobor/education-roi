/**
 * Earnings-by-age curves for the ROI "career view" (src/lib/roi.ts):
 * median wages of full-time, year-round workers by 5-year age band, for
 *   - bachelor's-as-highest-degree holders by ACS field of degree (FOD1P)
 *   - all bachelor's-as-highest-degree holders (fallback for unmapped majors)
 *   - high-school-only workers (the counterfactual also rises with age)
 * ACS 1-year PUMS 2021–2024 pooled (sample size), weekly-hours ≥ 35 and
 * 50–52 weeks worked, wages adjusted with ADJINC then CPI-U to 2024 dollars.
 * Cells with < 100 respondents are dropped.
 *
 * These are cross-sectional: today's 45-year-olds stand in for what today's
 * 29-year-olds will earn at 45. The UI labels the career view accordingly.
 *
 * Output: src/data/age-profiles.json · cache: data/acs/age-*.json (gitignored)
 * Needs CENSUS_API_KEY in .env.local (falls back to ../HAM/.env.local).
 * Usage: npx tsx scripts/build-age-profiles.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'acs');
const OUT = path.join(ROOT, 'src', 'data', 'age-profiles.json');
const YEARS = [2021, 2022, 2023, 2024];
const CPI_BASE_YEAR = 2024;
const MIN_N = 100;
export const BANDS = [
  { lo: 25, hi: 29 },
  { lo: 30, hi: 34 },
  { lo: 35, hi: 39 },
  { lo: 40, hi: 44 },
  { lo: 45, hi: 49 },
];

function apiKey(): string {
  for (const f of [path.join(ROOT, '.env.local'), path.join(ROOT, '..', 'HAM', '.env.local')]) {
    if (!existsSync(f)) continue;
    const m = readFileSync(f, 'utf8').match(/^CENSUS_API_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('CENSUS_API_KEY not found in .env.local or ../HAM/.env.local');
}

async function getRows(url: string, cacheName: string): Promise<string[][]> {
  const file = path.join(CACHE, cacheName);
  if (!existsSync(file)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${cacheName}: HTTP ${res.status}`);
    writeFileSync(file, await res.text());
    console.log(`  fetched ${cacheName}`);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as string[][];
}

async function cpiAnnual(): Promise<Map<number, number>> {
  const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL');
  const by = new Map<number, number[]>();
  for (const line of (await res.text()).trim().split('\n').slice(1)) {
    const [d, v] = line.split(',');
    const x = Number(v);
    if (Number.isFinite(x)) (by.get(Number(d.slice(0, 4))) ?? by.set(Number(d.slice(0, 4)), []).get(Number(d.slice(0, 4)))!).push(x);
  }
  return new Map([...by].filter(([, v]) => v.length === 12).map(([y, v]) => [y, v.reduce((a, b) => a + b) / 12]));
}

function weightedMedian(items: { v: number; w: number }[]): number {
  items.sort((a, b) => a.v - b.v);
  const total = items.reduce((a, b) => a + b.w, 0);
  let c = 0;
  for (const it of items) {
    c += it.w;
    if (c >= total / 2) return it.v;
  }
  return items[items.length - 1].v;
}

const bandOf = (age: number) => BANDS.findIndex((b) => age >= b.lo && age <= b.hi);

async function main() {
  mkdirSync(CACHE, { recursive: true });
  const key = apiKey();
  const cpi = await cpiAnnual();
  const base = cpi.get(CPI_BASE_YEAR)!;

  // cells: group → band → items
  const cells = new Map<string, { v: number; w: number }[][]>();
  const push = (g: string, b: number, v: number, w: number) => {
    const arr = cells.get(g) ?? cells.set(g, BANDS.map(() => [])).get(g)!;
    arr[b].push({ v, w });
  };

  for (const y of YEARS) {
    const common = `&AGEP=25:49&WKHP=35:99&WKWN=50:52&key=${key}`;
    const ba = await getRows(
      `https://api.census.gov/data/${y}/acs/acs1/pums?get=WAGP,FOD1P,PWGTP,ADJINC,AGEP&SCHL=21${common}`,
      `age-ba-${y}.json`,
    );
    const hs = await getRows(
      `https://api.census.gov/data/${y}/acs/acs1/pums?get=WAGP,PWGTP,ADJINC,AGEP&SCHL=16&SCHL=17${common}`,
      `age-hs-${y}.json`,
    );
    const toReal = (wagp: string, adj: string) => {
      let a = Number(adj);
      if (a > 100) a /= 1e6;
      return Number(wagp) * a * (base / cpi.get(y)!);
    };
    for (const [rows, group] of [[ba, 'ba'], [hs, 'hs']] as const) {
      const h = rows[0];
      const iW = h.indexOf('WAGP'), iP = h.indexOf('PWGTP'), iA = h.indexOf('ADJINC'), iAge = h.indexOf('AGEP'), iF = h.indexOf('FOD1P');
      for (const r of rows.slice(1)) {
        if (Number(r[iW]) <= 0) continue;
        const b = bandOf(Number(r[iAge]));
        if (b < 0) continue;
        const v = toReal(r[iW], r[iA]);
        const w = Number(r[iP]);
        if (group === 'hs') push('hs', b, v, w);
        else {
          push('all', b, v, w);
          push(`fod:${r[iF]}`, b, v, w);
        }
      }
    }
  }

  const summarize = (arr: { v: number; w: number }[][]) =>
    arr.map((items) => (items.length >= MIN_N ? Math.round(weightedMedian(items)) : null));

  const fields: Record<string, (number | null)[]> = {};
  const fieldN: Record<string, number> = {};
  for (const [g, arr] of cells) {
    if (!g.startsWith('fod:')) continue;
    const meds = summarize(arr);
    // Keep only fields with a usable curve from the 25–29 anchor onward
    if (meds[0] == null || meds.filter((m) => m != null).length < 3) continue;
    fields[g.slice(4)] = meds;
    fieldN[g.slice(4)] = arr.reduce((a, b) => a + b.length, 0);
  }

  const out = {
    source: 'U.S. Census Bureau, ACS 1-year PUMS 2021–2024 pooled; full-time, year-round workers; wages in 2024 dollars (CPI-U)',
    years: YEARS,
    dollars: CPI_BASE_YEAR,
    minN: MIN_N,
    bands: BANDS.map((b) => ({ ...b, mid: (b.lo + b.hi) / 2 })),
    hs: summarize(cells.get('hs')!),
    all: summarize(cells.get('all')!),
    fields,
    fieldN,
  };
  writeFileSync(OUT, JSON.stringify(out));
  console.log(`Wrote ${OUT}: ${Object.keys(fields).length} fields · HS ${JSON.stringify(out.hs)} · all ${JSON.stringify(out.all)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
