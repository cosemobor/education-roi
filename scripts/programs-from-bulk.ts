/**
 * Build data/raw-programs.json from the College Scorecard bulk file
 * Most-Recent-Cohorts-Field-of-Study.csv instead of the API.
 *
 * Why: the API's nested latest.programs.cip_4_digit array omits ~4% of
 * programs (70,944 bachelor's rows in the bulk file vs 67,995 via the API as
 * of the Nov 2026 release). The bulk file is the canonical current dataset.
 *
 * Output shape is identical to what fetch-scorecard.ts used to write, so
 * process-scorecard.ts is unchanged. State comes from raw-institutions.json
 * (fetch-scorecard.ts still fetches institutions from the API).
 *
 * Archive: data/scorecard-archive/College_Scorecard_Raw_Data_<MMDDYYYY>.zip
 * (or SCORECARD_ARCHIVE) — see build-school-history.ts. Requires `unzip`.
 *
 * Usage: npx tsx scripts/programs-from-bulk.ts
 */
import { execFileSync, spawn } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import readline from 'readline';

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const ARCHIVE_DIR = path.join(DATA_DIR, 'scorecard-archive');
const MEMBER = 'Most-Recent-Cohorts-Field-of-Study.csv';

function findArchive(): string {
  if (process.env.SCORECARD_ARCHIVE) return process.env.SCORECARD_ARCHIVE;
  const zips = existsSync(ARCHIVE_DIR)
    ? readdirSync(ARCHIVE_DIR).filter((f) => /^College_Scorecard_Raw_Data_.*\.zip$/.test(f)).sort()
    : [];
  if (!zips.length) throw new Error(`No archive in ${ARCHIVE_DIR} (or set SCORECARD_ARCHIVE)`);
  return path.join(ARCHIVE_DIR, zips[zips.length - 1]);
}

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

const num = (v: string | undefined): number | null => {
  if (v == null || v === '' || v === 'NULL' || v === 'NA' || v === 'PS' || v === 'PrivacySuppressed') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const OWNERSHIP: Record<string, number> = {
  'Public': 1,
  'Private, nonprofit': 2,
  'Private, for-profit': 3,
};

async function main() {
  const zip = findArchive();
  const members = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8', maxBuffer: 1 << 24 }).split('\n');
  if (!members.includes(MEMBER)) throw new Error(`${MEMBER} not in ${zip}`);

  const institutions: Record<string, unknown>[] = JSON.parse(
    readFileSync(path.join(DATA_DIR, 'raw-institutions.json'), 'utf8'),
  );
  const stateById = new Map(institutions.map((i) => [i['id'] as number, (i['school.state'] as string) || '']));

  const proc = spawn('unzip', ['-p', zip, MEMBER]);
  const rl = readline.createInterface({ input: proc.stdout, crlfDelay: Infinity });
  let idx: Map<string, number> | null = null;
  const programs: Record<string, unknown>[] = [];
  const unknownControl = new Set<string>();

  for await (const line of rl) {
    const c = parseCsvLine(line);
    if (!idx) {
      idx = new Map(c.map((h, i) => [h.replace(/^﻿/, ''), i]));
      continue;
    }
    const map = idx;
    const g = (k: string) => c[map.get(k)!];
    const unitId = Number(g('UNITID'));
    const control = g('CONTROL');
    if (!(control in OWNERSHIP)) unknownControl.add(control);
    programs.push({
      unitId,
      schoolName: g('INSTNM'),
      state: stateById.get(unitId) ?? '',
      ownership: OWNERSHIP[control] ?? 0,
      cipCode: g('CIPCODE'),
      cipTitle: g('CIPDESC'),
      credLevel: Number(g('CREDLEV')),
      credTitle: g('CREDDESC'),
      earn1yr: num(g('EARN_MDN_1YR')),
      earn1yrCount: num(g('EARN_COUNT_WNE_1YR')),
      earn4yr: num(g('EARN_MDN_4YR')),
      earn4yrCount: num(g('EARN_COUNT_WNE_4YR')),
      earn5yr: num(g('EARN_MDN_5YR')),
      earn5yrCount: num(g('EARN_COUNT_WNE_5YR')),
      earn7yr: num(g('EARN_MDN_7YR')),
      earn7yrCount: num(g('EARN_COUNT_WNE_7YR')),
      earn7yrNational: num(g('EARN_MDN_7YR_NAT')),
    });
  }

  if (unknownControl.size) console.warn(`⚠️ Unknown CONTROL values: ${[...unknownControl].join(' | ')}`);
  writeFileSync(path.join(DATA_DIR, 'raw-programs.json'), JSON.stringify(programs));
  // Institution-level ROI inputs not in the API fetch: state HS-graduate
  // earnings benchmark (ACS, 2024 $) and completion rate.
  const INST = 'Most-Recent-Cohorts-Institution.csv';
  const extras: Record<number, { hsEarningsState: number | null; hsEarningsNational: number | null; completionRate: number | null }> = {};
  {
    const p2 = spawn('unzip', ['-p', zip, INST]);
    const rl2 = readline.createInterface({ input: p2.stdout, crlfDelay: Infinity });
    let ix: Map<string, number> | null = null;
    for await (const line of rl2) {
      const c = parseCsvLine(line);
      if (!ix) { ix = new Map(c.map((h, i) => [h.replace(/^\uFEFF/, ''), i])); continue; }
      const m2 = ix;
      const g2 = (k: string) => c[m2.get(k)!];
      extras[Number(g2('UNITID'))] = {
        hsEarningsState: num(g2('EARN_THR_STATE')),
        hsEarningsNational: num(g2('EARN_THR_NAT')),
        completionRate: num(g2('C150_4')) ?? num(g2('C150_4_POOLED')),
      };
    }
  }
  writeFileSync(path.join(DATA_DIR, 'raw-inst-extras.json'), JSON.stringify(extras));
  console.log(`Wrote raw-inst-extras.json: ${Object.keys(extras).length.toLocaleString()} institutions`);

  // Record which Scorecard release this is (archive file date MMDDYYYY → ISO)
  const m = path.basename(zip).match(/_(\d{2})(\d{2})(\d{4})\.zip$/);
  const release = m ? `${m[3]}-${m[1]}-${m[2]}` : new Date().toISOString().slice(0, 10);
  writeFileSync(path.join(DATA_DIR, 'release.json'), JSON.stringify({ release, archive: path.basename(zip) }));
  const b = programs.filter((p) => p.credLevel === 3);
  console.log(
    `Wrote raw-programs.json from ${path.basename(zip)}: ${programs.length.toLocaleString()} programs, ` +
      `${b.length.toLocaleString()} bachelor's (${b.filter((p) => p.earn7yr != null).length.toLocaleString()} with 7yr)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
