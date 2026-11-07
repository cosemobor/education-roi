/**
 * School cost history + earnings checkpoints from the College Scorecard
 * historical archive → src/data/school-history.json (committed).
 *
 * Costs: every institution-year file (MERGED<YYYY>_<YY>_PP.csv) from 2009–10,
 *   the first year with cost of attendance and net price:
 *   COSTT4_A (cost of attendance), NPT4_PUB / NPT4_PRIV (average net price,
 *   by control), TUITIONFEE_IN / TUITIONFEE_OUT. Each file holds the PRIOR
 *   academic year's costs (Scorecard cohort map: MERGED2025_26 = AY2024-25,
 *   "reported in IPEDS DCY2025-26"), so academic year = file year − 1.
 *   Real values in the latest academic year's dollars via CPI-U (FRED
 *   CPIAUCSL), using the calendar-year average of the fall year (2025–26 → 2025).
 *
 * Earnings checkpoints: the field-of-study files only carry comparable
 *   "working, not enrolled" medians in three releases (older releases used a
 *   different "highest credential" definition, some carry none):
 *     FieldOfStudyData1819_1920 → 1yr (+4yr)
 *     FieldOfStudyData1920_2021 → 1yr, 5yr
 *     Most-Recent-Cohorts-Field-of-Study (= FieldOfStudyData2122_2223 cohorts,
 *       current programs only) → 1yr, 4yr, 5yr, 7yr
 *   Per school: graduate-weighted average of bachelor's program medians
 *   (weights EARN_COUNT_WNE_<n>YR), as published (not CPI-adjusted).
 *
 * Archive (≈560MB, gitignored): set SCORECARD_ARCHIVE or place it at
 *   data/scorecard-archive/College_Scorecard_Raw_Data_<MMDDYYYY>.zip
 *   from https://collegescorecard.ed.gov/data/ (Download All Data).
 * Requires the `unzip` CLI.
 *
 * Usage: npx tsx scripts/build-school-history.ts
 */
import { execFileSync, spawn } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import readline from 'readline';

const ROOT = path.join(__dirname, '..');
const ARCHIVE_DIR = path.join(ROOT, 'data', 'scorecard-archive');
const OUT = path.join(ROOT, 'src', 'data', 'school-history.json');
const FIRST_COST_YEAR = 2009;

const EARNINGS_RELEASES = [
  { file: 'FieldOfStudyData1819_1920_PP.csv', label: '2018–20 graduates', horizons: [1] },
  { file: 'FieldOfStudyData1920_2021_PP.csv', label: '2019–21 graduates', horizons: [1, 5] },
  // Latest checkpoint = the canonical current file, so it matches the rankings
  { file: 'Most-Recent-Cohorts-Field-of-Study.csv', label: '2021–23 graduates', horizons: [1, 5, 7] },
] as const;

function findArchive(): string {
  if (process.env.SCORECARD_ARCHIVE) return process.env.SCORECARD_ARCHIVE;
  if (existsSync(ARCHIVE_DIR)) {
    const zips = readdirSync(ARCHIVE_DIR).filter((f) => /^College_Scorecard_Raw_Data_.*\.zip$/.test(f)).sort();
    if (zips.length) return path.join(ARCHIVE_DIR, zips[zips.length - 1]);
  }
  throw new Error(`No archive found. Download it into ${ARCHIVE_DIR} or set SCORECARD_ARCHIVE.`);
}

/** Minimal RFC-4180 line parser (Scorecard rows have no embedded newlines). */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

async function streamCsv(zip: string, member: string, onRow: (get: (col: string) => string) => void) {
  const proc = spawn('unzip', ['-p', zip, member]);
  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  let idx: Map<string, number> | null = null;
  for await (const line of rl) {
    const cells = parseCsvLine(line);
    if (!idx) {
      idx = new Map(cells.map((c, i) => [c.replace(/^﻿/, ''), i]));
      continue;
    }
    const map = idx;
    onRow((col) => {
      const i = map.get(col);
      return i == null ? '' : cells[i] ?? '';
    });
  }
}

const num = (v: string): number | null => {
  if (v === '' || v === 'NULL' || v === 'NA' || v === 'PS' || v === 'PrivacySuppressed') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

async function cpiByYear(): Promise<Map<number, number>> {
  const cache = path.join(ROOT, 'data', 'cpiaucsl.csv');
  if (!existsSync(cache)) {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL');
    if (!res.ok) throw new Error(`FRED CPIAUCSL → HTTP ${res.status}`);
    mkdirSync(path.dirname(cache), { recursive: true });
    writeFileSync(cache, await res.text());
  }
  const sums = new Map<number, { s: number; n: number }>();
  for (const line of readFileSync(cache, 'utf8').trim().split('\n').slice(1)) {
    const [d, v] = line.split(',');
    const y = Number(d.slice(0, 4));
    const x = Number(v);
    if (!Number.isFinite(x)) continue;
    const e = sums.get(y) ?? { s: 0, n: 0 };
    e.s += x; e.n++;
    sums.set(y, e);
  }
  // Only full calendar years (12 months) — partial years would skew the base
  return new Map([...sums].filter(([, e]) => e.n === 12).map(([y, e]) => [y, e.s / e.n]));
}

async function main() {
  const zip = findArchive();
  console.log(`Archive: ${zip}`);
  const members = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 24 })
    .split('\n')
    .filter((m) => !m.startsWith('__MACOSX'));

  // Restrict to schools the site knows about
  const schools: { unitId: number; ownership: number }[] = JSON.parse(
    readFileSync(path.join(ROOT, 'src', 'data', 'schools.json'), 'utf8'),
  );
  const ownership = new Map(schools.map((s) => [s.unitId, s.ownership]));

  // ── Costs ────────────────────────────────────────────────────────────
  const costFiles = members
    .map((m) => ({ m, y: Number(m.match(/^MERGED(\d{4})_\d{2}_PP\.csv$/)?.[1]) }))
    .filter((x) => x.y - 1 >= FIRST_COST_YEAR - 1 && x.y >= FIRST_COST_YEAR)
    .sort((a, b) => a.y - b.y);
  // Academic year = file year − 1 (fall year ay → label 'ay-(ay+1)')
  const years = costFiles.map((x) => `${x.y - 1}-${String(x.y % 100).padStart(2, '0')}`);
  const cpi = await cpiByYear();
  const baseFallYear = costFiles[costFiles.length - 1].y - 1;
  // Latest fall year may not have a full CPI year yet → use the latest full year
  const cpiBaseYear = cpi.has(baseFallYear) ? baseFallYear : Math.max(...cpi.keys());
  const cpiBase = cpi.get(cpiBaseYear)!;

  type Cost = { coa: (number | null)[]; net: (number | null)[]; tuitionIn: (number | null)[]; tuitionOut: (number | null)[] };
  const cost = new Map<number, Cost>();
  for (let yi = 0; yi < costFiles.length; yi++) {
    const { m, y } = costFiles[yi];
    let rows = 0;
    await streamCsv(zip, m, (get) => {
      const id = Number(get('UNITID'));
      if (!ownership.has(id)) return;
      rows++;
      let c = cost.get(id);
      if (!c) {
        const blank = () => new Array<number | null>(costFiles.length).fill(null);
        c = { coa: blank(), net: blank(), tuitionIn: blank(), tuitionOut: blank() };
        cost.set(id, c);
      }
      c.coa[yi] = num(get('COSTT4_A'));
      c.net[yi] = ownership.get(id) === 1 ? num(get('NPT4_PUB')) : num(get('NPT4_PRIV'));
      c.tuitionIn[yi] = num(get('TUITIONFEE_IN'));
      c.tuitionOut[yi] = num(get('TUITIONFEE_OUT'));
    });
    console.log(`  ${m}: ${rows} schools`);
    void y;
  }

  // CPI multipliers per cost year (fall year)
  const deflator = costFiles.map(({ y }) => {
    const c = cpi.get(y - 1) ?? cpi.get(cpiBaseYear)!;
    return cpiBase / c;
  });

  // ── Earnings checkpoints ────────────────────────────────────────────
  type Acc = Map<number, { s: number; w: number }>;
  const earn = new Map<number, Record<string, { label: string; e1?: number; e5?: number; e7?: number }>>();
  for (const rel of EARNINGS_RELEASES) {
    if (!members.includes(rel.file)) {
      console.warn(`  ⚠️ ${rel.file} missing from archive — skipped`);
      continue;
    }
    const acc: Record<number, Acc> = { 1: new Map(), 5: new Map(), 7: new Map() };
    await streamCsv(zip, rel.file, (get) => {
      if (get('CREDLEV') !== '3') return;
      const id = Number(get('UNITID'));
      if (!ownership.has(id)) return;
      for (const h of rel.horizons) {
        const e = num(get(`EARN_MDN_${h}YR`));
        if (e == null) continue;
        const w = num(get(`EARN_COUNT_WNE_${h}YR`)) ?? 1;
        const a = acc[h].get(id) ?? { s: 0, w: 0 };
        a.s += e * w; a.w += w;
        acc[h].set(id, a);
      }
    });
    for (const h of rel.horizons) {
      for (const [id, a] of acc[h]) {
        if (a.w <= 0) continue;
        const rec = earn.get(id) ?? {};
        const r = (rec[rel.file] ??= { label: rel.label });
        (r as Record<string, unknown>)[`e${h}`] = Math.round(a.s / a.w);
        earn.set(id, rec);
      }
    }
    console.log(`  ${rel.file}: 1yr for ${acc[1].size} schools`);
  }

  // ── Output ──────────────────────────────────────────────────────────
  const round = (v: number | null, k = 1) => (v == null ? null : Math.round(v * k));
  const out: Record<string, unknown> = {};
  for (const id of new Set([...cost.keys(), ...earn.keys()])) {
    const c = cost.get(id);
    const e = earn.get(id);
    const hasCost = c && (c.coa.some((v) => v != null) || c.net.some((v) => v != null));
    if (!hasCost && !e) continue;
    out[id] = {
      ...(hasCost
        ? {
            coa: c!.coa,
            coaReal: c!.coa.map((v, i) => round(v == null ? null : v * deflator[i])),
            net: c!.net,
            netReal: c!.net.map((v, i) => round(v == null ? null : v * deflator[i])),
            tuitionIn: c!.tuitionIn,
            tuitionOut: c!.tuitionOut,
          }
        : {}),
      ...(e ? { earnings: EARNINGS_RELEASES.map((r) => e[r.file]).filter(Boolean) } : {}),
    };
  }

  const payload = {
    source: 'U.S. Dept. of Education College Scorecard, historical institution and field-of-study files',
    years,
    realDollarsOf: years[years.length - 1],
    cpiBaseCalendarYear: cpiBaseYear,
    earningsNote:
      'Graduate-weighted median earnings of federal aid recipients working and not enrolled, bachelor’s programs, as published per release (not inflation-adjusted).',
    schools: out,
  };
  writeFileSync(OUT, JSON.stringify(payload));
  console.log(`Wrote ${OUT}: ${Object.keys(out).length} schools, ${years[0]} → ${years[years.length - 1]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
