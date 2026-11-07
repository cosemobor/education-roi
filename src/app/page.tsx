import { Suspense } from 'react';
import { majorsSummary, schoolRankings } from '@/lib/data/store';
import type { MajorSummary, SchoolRanking } from '@/types';
import AppShell from './AppShell';

// Static: data is bundled at build time (src/data/), no database.

export default function Home() {

  // Fetch majors summary (~800 rows)
  const majorsRows = majorsSummary;

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
    medianEarn7yr: r.medianEarn7yr,
    p25Earn7yr: r.p25Earn7yr,
    p75Earn7yr: r.p75Earn7yr,
    nationalMedianEarn7yr: r.nationalMedianEarn7yr,
    growthRate: r.growthRate,
    growthRate1to7: r.growthRate1to7,
  }));

  // Fetch pre-computed school rankings (~4000 rows)
  const schoolRows = schoolRankings;

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
    weightedEarn7yr: r.weightedEarn7yr,
    hsEarnings: r.hsEarnings,
    npv7: r.npv7,
    roi7: r.roi7,
    npv7Undiscounted: r.npv7Undiscounted,
    roi7Undiscounted: r.roi7Undiscounted,
    paybackYear: r.paybackYear,
    expectedNpv7: r.expectedNpv7,
    expectedRoi7: r.expectedRoi7,
    careerNpv: r.careerNpv,
    careerRoi: r.careerRoi,
    careerNpvUndiscounted: r.careerNpvUndiscounted,
    careerPaybackYear: r.careerPaybackYear,
    careerExpectedRoi: r.careerExpectedRoi,
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
