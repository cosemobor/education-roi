import { getDb } from '@/lib/db';
import { majorsSummary, programs, schools } from '@/lib/db/schema';
import { desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { MajorSummary, SchoolRanking } from '@/types';
import AppShell from './AppShell';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const db = getDb();

  // Fetch majors summary
  const majorsRows = await db
    .select()
    .from(majorsSummary)
    .orderBy(desc(majorsSummary.medianEarn1yr));

  const majorsData: MajorSummary[] = majorsRows.map((r) => ({
    cipCode: r.cipCode,
    cipTitle: r.cipTitle,
    schoolCount: r.schoolCount ?? 0,
    medianEarn1yr: r.medianEarn1yr,
    medianEarn4yr: r.medianEarn4yr,
    medianEarn5yr: r.medianEarn5yr,
    p25Earn1yr: r.p25Earn1yr,
    p75Earn1yr: r.p75Earn1yr,
    p25Earn5yr: r.p25Earn5yr,
    p75Earn5yr: r.p75Earn5yr,
    growthRate: r.growthRate,
  }));

  // Fetch school rankings with aggregated program data
  const schoolRows = await db
    .select({
      unitId: schools.unitId,
      name: schools.name,
      city: schools.city,
      state: schools.state,
      ownership: schools.ownership,
      ownershipLabel: schools.ownershipLabel,
      admissionRate: schools.admissionRate,
      satMath75: schools.satMath75,
      satRead75: schools.satRead75,
      size: schools.size,
      costAttendance: schools.costAttendance,
      completionRate: schools.completionRate,
      selectivityTier: schools.selectivityTier,
      programCount: sql<number>`count(${programs.id})`.as('program_count'),
      avgEarn1yr: sql<number>`avg(${programs.earn1yr})`.as('avg_earn_1yr'),
      maxEarn1yr: sql<number>`max(${programs.earn1yr})`.as('max_earn_1yr'),
    })
    .from(schools)
    .innerJoin(programs, eq(schools.unitId, programs.unitId))
    .where(isNotNull(programs.earn1yr))
    .groupBy(schools.unitId)
    .orderBy(desc(sql`avg(${programs.earn1yr})`));

  // For each school, find the top program name
  const topProgramRows = await db
    .select({
      unitId: programs.unitId,
      cipTitle: programs.cipTitle,
      earn1yr: programs.earn1yr,
    })
    .from(programs)
    .where(isNotNull(programs.earn1yr))
    .orderBy(desc(programs.earn1yr));

  // Build a map: unitId -> top program title
  const topProgramMap = new Map<number, string>();
  for (const row of topProgramRows) {
    if (!topProgramMap.has(row.unitId)) {
      topProgramMap.set(row.unitId, row.cipTitle ?? '');
    }
  }

  // Compute median per school: collect all earn1yr per school, find the middle
  const earnBySchool = new Map<number, number[]>();
  for (const row of topProgramRows) {
    if (row.earn1yr != null) {
      const arr = earnBySchool.get(row.unitId) ?? [];
      arr.push(row.earn1yr);
      earnBySchool.set(row.unitId, arr);
    }
  }

  function median(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  const schoolRankings: SchoolRanking[] = schoolRows.map((r) => {
    const earns = earnBySchool.get(r.unitId);
    return {
      unitId: r.unitId,
      name: r.name,
      city: r.city ?? '',
      state: r.state ?? '',
      ownership: r.ownership ?? 0,
      ownershipLabel: r.ownershipLabel ?? '',
      admissionRate: r.admissionRate,
      satCombined:
        r.satMath75 != null && r.satRead75 != null
          ? r.satMath75 + r.satRead75
          : null,
      size: r.size,
      costAttendance: r.costAttendance,
      completionRate: r.completionRate,
      selectivityTier: r.selectivityTier ?? '',
      programCount: r.programCount,
      medianEarn1yr: earns ? median(earns) : r.avgEarn1yr,
      maxEarn1yr: r.maxEarn1yr,
      topProgram: topProgramMap.get(r.unitId) ?? null,
    };
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <AppShell majorsSummary={majorsData} schoolRankings={schoolRankings} />
    </main>
  );
}
