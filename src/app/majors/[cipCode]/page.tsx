import type { Metadata } from 'next';
import { getDb } from '@/lib/db';
import { programs, schools, majorsSummary } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { MajorSummary, ProgramRecord } from '@/types';
import MajorDetail from '@/components/MajorDetail';
import PageNav from '@/components/PageNav';

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ cipCode: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cipCode } = await params;
  const db = getDb();
  const [row] = await db
    .select({ cipTitle: majorsSummary.cipTitle, medianEarn1yr: majorsSummary.medianEarn1yr })
    .from(majorsSummary)
    .where(eq(majorsSummary.cipCode, cipCode))
    .limit(1);

  if (!row) return { title: 'Major Not Found' };

  const cleanTitle = row.cipTitle.replace(/\.+$/, '');
  const description = row.medianEarn1yr
    ? `${cleanTitle} graduates earn a median of $${Math.round(row.medianEarn1yr).toLocaleString()} in their first year.`
    : `Explore earnings data for ${cleanTitle} across all schools.`;

  return {
    title: cleanTitle,
    description,
    openGraph: { title: `${cleanTitle} - HEO`, description, images: ['/og-image.jpg'] },
  };
}

export default async function MajorPage({ params, searchParams }: PageProps) {
  const { cipCode } = await params;
  const { from: fromTab } = await searchParams;
  const db = getDb();

  // Fetch major summary
  const [majorRow] = await db
    .select()
    .from(majorsSummary)
    .where(eq(majorsSummary.cipCode, cipCode))
    .limit(1);

  if (!majorRow) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <p className="text-text-secondary">Major not found.</p>
        <a href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          &larr; Back to all majors
        </a>
      </main>
    );
  }

  const major: MajorSummary = {
    cipCode: majorRow.cipCode,
    cipTitle: majorRow.cipTitle.replace(/\.+$/, ''),
    schoolCount: majorRow.schoolCount ?? 0,
    medianEarn1yr: majorRow.medianEarn1yr,
    medianEarn4yr: majorRow.medianEarn4yr,
    medianEarn5yr: majorRow.medianEarn5yr,
    p25Earn1yr: majorRow.p25Earn1yr,
    p75Earn1yr: majorRow.p75Earn1yr,
    p25Earn5yr: majorRow.p25Earn5yr,
    p75Earn5yr: majorRow.p75Earn5yr,
    growthRate: majorRow.growthRate,
  };

  // Fetch all programs for this major with school data
  const rows = await db
    .select({
      unitId: programs.unitId,
      schoolName: programs.schoolName,
      state: programs.state,
      cipCode: programs.cipCode,
      cipTitle: programs.cipTitle,
      credLevel: programs.credLevel,
      credTitle: programs.credTitle,
      earn1yr: programs.earn1yr,
      earn4yr: programs.earn4yr,
      earn5yr: programs.earn5yr,
      earn1yrCount: programs.earn1yrCount,
      earn5yrCount: programs.earn5yrCount,
      costAttendance: programs.costAttendance,
      selectivityTier: programs.selectivityTier,
      ownership: schools.ownership,
      ownershipLabel: schools.ownershipLabel,
      admissionRate: schools.admissionRate,
      satMath75: schools.satMath75,
      satRead75: schools.satRead75,
      size: schools.size,
      completionRate: schools.completionRate,
    })
    .from(programs)
    .leftJoin(schools, eq(programs.unitId, schools.unitId))
    .where(eq(programs.cipCode, cipCode))
    .orderBy(desc(programs.earn1yr));

  const programData: ProgramRecord[] = rows.map((r) => ({
    unitId: r.unitId,
    schoolName: r.schoolName ?? '',
    state: r.state ?? '',
    cipCode: r.cipCode,
    cipTitle: (r.cipTitle ?? '').replace(/\.+$/, ''),
    credLevel: r.credLevel ?? 0,
    credTitle: r.credTitle ?? '',
    earn1yr: r.earn1yr,
    earn4yr: r.earn4yr,
    earn5yr: r.earn5yr,
    earn1yrCount: r.earn1yrCount,
    earn5yrCount: r.earn5yrCount,
    costAttendance: r.costAttendance,
    selectivityTier: r.selectivityTier ?? '',
    ownership: r.ownership,
    ownershipLabel: r.ownershipLabel,
    admissionRate: r.admissionRate,
    satMath75: r.satMath75,
    satRead75: r.satRead75,
    size: r.size,
    completionRate: r.completionRate,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <PageNav />
      <MajorDetail major={major} programs={programData} fromTab={fromTab} />
    </main>
  );
}
