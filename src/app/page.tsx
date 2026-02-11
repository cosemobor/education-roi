import { Suspense } from 'react';
import { getDb } from '@/lib/db';
import { majorsSummary, schoolRankings } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import type { MajorSummary, SchoolRanking } from '@/types';
import AppShell from './AppShell';

export const revalidate = 3600; // Re-generate at most once per hour

export default async function Home() {
  const db = getDb();

  // Fetch majors summary (~800 rows)
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

  // Fetch pre-computed school rankings (~4000 rows)
  const schoolRows = await db
    .select()
    .from(schoolRankings)
    .orderBy(desc(schoolRankings.weightedEarn1yr));

  const schoolData: SchoolRanking[] = schoolRows.map((r) => ({
    unitId: r.unitId,
    name: r.name,
    city: r.city,
    state: r.state,
    ownership: r.ownership,
    ownershipLabel: r.ownershipLabel,
    admissionRate: r.admissionRate,
    satCombined: r.satCombined,
    size: r.size,
    costAttendance: r.costAttendance,
    netPrice: r.netPrice,
    completionRate: r.completionRate,
    selectivityTier: r.selectivityTier,
    programCount: r.programCount,
    medianEarn1yr: r.medianEarn1yr,
    weightedEarn1yr: r.weightedEarn1yr,
    weightedEarn5yr: r.weightedEarn5yr,
    roi: r.roi,
    maxEarn1yr: r.maxEarn1yr,
    topProgram: r.topProgram,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <Suspense>
        <AppShell majorsSummary={majorsData} schoolRankings={schoolData} />
      </Suspense>
    </main>
  );
}
