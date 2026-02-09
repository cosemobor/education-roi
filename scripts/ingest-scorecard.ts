/**
 * Ingest processed Scorecard data into Turso database.
 *
 * Usage:
 *   npx tsx scripts/ingest-scorecard.ts
 *
 * Reads:  data/schools.json, data/programs.json, data/majors-summary.json
 * Writes: Turso database tables (schools, programs, majors_summary)
 *
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local
 */

import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import { sql } from 'drizzle-orm';
import * as schema from '../src/lib/db/schema';

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

const DATA_DIR = path.join(__dirname, '..', 'data');

function loadJson<T>(filename: string): T {
  const filepath = path.join(DATA_DIR, filename);
  if (!existsSync(filepath)) {
    throw new Error(`File not found: ${filepath}. Run fetch + process scripts first.`);
  }
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

async function main() {
  console.log('Connecting to Turso...');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  const db = drizzle(client, { schema });

  // Drop and recreate tables to ensure schema is up to date
  console.log('\nCreating tables...');
  await db.run(sql`DROP TABLE IF EXISTS programs`);
  await db.run(sql`DROP TABLE IF EXISTS majors_summary`);
  await db.run(sql`DROP TABLE IF EXISTS schools`);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS schools (
      unit_id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      state TEXT,
      ownership INTEGER,
      ownership_label TEXT,
      admission_rate REAL,
      sat_read_75 REAL,
      sat_math_75 REAL,
      size INTEGER,
      cost_attendance REAL,
      tuition_in_state REAL,
      tuition_out_state REAL,
      net_price_public REAL,
      net_price_private REAL,
      completion_rate REAL,
      selectivity_tier TEXT,
      lat REAL,
      lon REAL
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit_id INTEGER NOT NULL REFERENCES schools(unit_id),
      school_name TEXT,
      state TEXT,
      cip_code TEXT NOT NULL,
      cip_title TEXT,
      cred_level INTEGER,
      cred_title TEXT,
      earn_1yr REAL,
      earn_4yr REAL,
      earn_5yr REAL,
      earn_1yr_count INTEGER,
      earn_5yr_count INTEGER,
      cost_attendance REAL,
      selectivity_tier TEXT
    )
  `);
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS majors_summary (
      cip_code TEXT PRIMARY KEY,
      cip_title TEXT NOT NULL,
      school_count INTEGER,
      median_earn_1yr REAL,
      median_earn_4yr REAL,
      median_earn_5yr REAL,
      p25_earn_1yr REAL,
      p75_earn_1yr REAL,
      p25_earn_5yr REAL,
      p75_earn_5yr REAL,
      growth_rate REAL
    )
  `);

  // Create indexes
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_schools_name ON schools(name)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_schools_state ON schools(state)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_programs_cip ON programs(cip_code)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS idx_programs_unit ON programs(unit_id)`);

  // Load data
  console.log('\nLoading JSON data...');

  interface SchoolJson {
    unitId: number; name: string; city: string; state: string;
    ownership: number; ownershipLabel: string; admissionRate: number | null;
    satRead75: number | null; satMath75: number | null; size: number | null;
    costAttendance: number | null; tuitionInState: number | null;
    tuitionOutState: number | null; netPricePublic: number | null;
    netPricePrivate: number | null; completionRate: number | null;
    selectivityTier: string; lat: number | null; lon: number | null;
  }

  interface ProgramJson {
    unitId: number; schoolName: string; state: string;
    cipCode: string; cipTitle: string; credLevel: number; credTitle: string;
    earn1yr: number | null; earn4yr: number | null; earn5yr: number | null;
    earn1yrCount: number | null; earn5yrCount: number | null; costAttendance: number | null;
    selectivityTier: string;
  }

  interface MajorJson {
    cipCode: string; cipTitle: string; schoolCount: number;
    medianEarn1yr: number | null; medianEarn4yr: number | null;
    medianEarn5yr: number | null; p25Earn1yr: number | null;
    p75Earn1yr: number | null; p25Earn5yr: number | null;
    p75Earn5yr: number | null; growthRate1to5: number | null;
  }

  const schoolsData = loadJson<SchoolJson[]>('schools.json');
  const programsData = loadJson<ProgramJson[]>('programs.json');
  const majorsData = loadJson<MajorJson[]>('majors-summary.json');

  console.log(`  ${schoolsData.length.toLocaleString()} schools`);
  console.log(`  ${programsData.length.toLocaleString()} programs`);
  console.log(`  ${majorsData.length} majors`);

  // Clear existing data
  console.log('\nClearing existing data...');
  await db.run(sql`DELETE FROM programs`);
  await db.run(sql`DELETE FROM majors_summary`);
  await db.run(sql`DELETE FROM schools`);

  // Insert schools
  console.log('\nInserting schools...');
  const BATCH_SIZE = 50;
  for (let i = 0; i < schoolsData.length; i += BATCH_SIZE) {
    const batch = schoolsData.slice(i, i + BATCH_SIZE);
    await db.insert(schema.schools).values(
      batch.map((s) => ({
        unitId: s.unitId,
        name: s.name,
        city: s.city,
        state: s.state,
        ownership: s.ownership,
        ownershipLabel: s.ownershipLabel,
        admissionRate: s.admissionRate,
        satRead75: s.satRead75,
        satMath75: s.satMath75,
        size: s.size,
        costAttendance: s.costAttendance,
        tuitionInState: s.tuitionInState,
        tuitionOutState: s.tuitionOutState,
        netPricePublic: s.netPricePublic,
        netPricePrivate: s.netPricePrivate,
        completionRate: s.completionRate,
        selectivityTier: s.selectivityTier,
        lat: s.lat,
        lon: s.lon,
      })),
    );
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= schoolsData.length) {
      process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, schoolsData.length).toLocaleString()} / ${schoolsData.length.toLocaleString()}`);
    }
  }
  console.log(' done');

  // Insert programs
  console.log('\nInserting programs...');
  for (let i = 0; i < programsData.length; i += BATCH_SIZE) {
    const batch = programsData.slice(i, i + BATCH_SIZE);
    await db.insert(schema.programs).values(
      batch.map((p) => ({
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
        costAttendance: p.costAttendance,
        selectivityTier: p.selectivityTier,
      })),
    );
    if ((i + BATCH_SIZE) % 1000 === 0 || i + BATCH_SIZE >= programsData.length) {
      process.stdout.write(`\r  ${Math.min(i + BATCH_SIZE, programsData.length).toLocaleString()} / ${programsData.length.toLocaleString()}`);
    }
  }
  console.log(' done');

  // Insert majors summary
  console.log('\nInserting majors summary...');
  for (let i = 0; i < majorsData.length; i += BATCH_SIZE) {
    const batch = majorsData.slice(i, i + BATCH_SIZE);
    await db.insert(schema.majorsSummary).values(
      batch.map((m) => ({
        cipCode: m.cipCode,
        cipTitle: m.cipTitle,
        schoolCount: m.schoolCount,
        medianEarn1yr: m.medianEarn1yr,
        medianEarn4yr: m.medianEarn4yr,
        medianEarn5yr: m.medianEarn5yr,
        p25Earn1yr: m.p25Earn1yr,
        p75Earn1yr: m.p75Earn1yr,
        p25Earn5yr: m.p25Earn5yr,
        p75Earn5yr: m.p75Earn5yr,
        growthRate: m.growthRate1to5,
      })),
    );
  }
  console.log(`  ${majorsData.length} majors inserted`);

  // Verify counts
  console.log('\n=== Verification ===');
  const [schoolCount] = await db.all(sql`SELECT COUNT(*) as count FROM schools`);
  const [programCount] = await db.all(sql`SELECT COUNT(*) as count FROM programs`);
  const [majorCount] = await db.all(sql`SELECT COUNT(*) as count FROM majors_summary`);
  console.log(`  Schools: ${(schoolCount as { count: number }).count}`);
  console.log(`  Programs: ${(programCount as { count: number }).count}`);
  console.log(`  Majors: ${(majorCount as { count: number }).count}`);

  console.log('\nDone!');
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
