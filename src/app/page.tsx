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
    cipTitle: r.cipTitle.replace(/\.+$/, ''),
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
      netPricePublic: schools.netPricePublic,
      netPricePrivate: schools.netPricePrivate,
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

  // For each school, find the top program and collect earnings data
  const programRows = await db
    .select({
      unitId: programs.unitId,
      cipTitle: programs.cipTitle,
      earn1yr: programs.earn1yr,
      earn1yrCount: programs.earn1yrCount,
      earn5yr: programs.earn5yr,
      earn5yrCount: programs.earn5yrCount,
    })
    .from(programs)
    .orderBy(desc(programs.earn1yr));

  // Build maps per school
  const topProgramMap = new Map<number, string>();
  const earn1yrBySchool = new Map<number, { earn: number; count: number }[]>();
  const earn5yrBySchool = new Map<number, { earn: number; count: number }[]>();
  for (const row of programRows) {
    if (!topProgramMap.has(row.unitId) && row.earn1yr != null) {
      topProgramMap.set(row.unitId, (row.cipTitle ?? '').replace(/\.+$/, ''));
    }
    if (row.earn1yr != null) {
      const arr = earn1yrBySchool.get(row.unitId) ?? [];
      arr.push({ earn: row.earn1yr, count: row.earn1yrCount ?? 1 });
      earn1yrBySchool.set(row.unitId, arr);
    }
    if (row.earn5yr != null) {
      const arr = earn5yrBySchool.get(row.unitId) ?? [];
      arr.push({ earn: row.earn5yr, count: row.earn5yrCount ?? 1 });
      earn5yrBySchool.set(row.unitId, arr);
    }
  }

  function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function weightedAvg(items: { earn: number; count: number }[]): number | null {
    let totalWeight = 0;
    let weightedSum = 0;
    for (const { earn, count } of items) {
      weightedSum += earn * count;
      totalWeight += count;
    }
    return totalWeight > 0 ? weightedSum / totalWeight : null;
  }

  const schoolRankings: SchoolRanking[] = schoolRows.map((r) => {
    const items = earn1yrBySchool.get(r.unitId);
    const items5yr = earn5yrBySchool.get(r.unitId);
    const medianVal = items ? median(items.map((i) => i.earn)) : r.avgEarn1yr;
    const weighted = items ? weightedAvg(items) : null;
    const weighted5yr = items5yr ? weightedAvg(items5yr) : null;
    const cost = r.costAttendance;
    const netPrice =
      (r.ownership ?? 0) === 1
        ? (r.netPricePublic ?? cost)
        : (r.netPricePrivate ?? cost);
    const totalCost = netPrice != null ? netPrice * 4 : null;
    const paybackYears =
      weighted != null && totalCost != null && weighted > 0
        ? totalCost / weighted
        : null;
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
      costAttendance: cost,
      netPrice,
      completionRate: r.completionRate,
      selectivityTier: r.selectivityTier ?? '',
      programCount: r.programCount,
      medianEarn1yr: medianVal,
      weightedEarn1yr: weighted,
      weightedEarn5yr: weighted5yr,
      paybackYears,
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
