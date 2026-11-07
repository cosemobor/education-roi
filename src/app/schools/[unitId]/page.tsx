import type { Metadata } from 'next';
import { getPrograms, getSchool } from '@/lib/data/store';
import type { School, ProgramRecord } from '@/types';
import SchoolDetail from '@/components/SchoolDetail';
import PageNav from '@/components/PageNav';

// Rendered per request (reads ?from=) from bundled in-memory data — no database.

interface PageProps {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ from?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { unitId: raw } = await params;
  const unitId = parseInt(raw, 10);
  if (isNaN(unitId)) return { title: 'Invalid School' };

  const row = getSchool(unitId);

  if (!row) return { title: 'School Not Found' };

  const description = `Explore earnings data for ${row.name} programs in ${row.city}, ${row.state}.`;
  return {
    title: row.name,
    description,
    openGraph: { title: `${row.name} - HEO`, description, images: ['/og-image.jpg'] },
  };
}

export default async function SchoolPage({ params, searchParams }: PageProps) {
  const { unitId: raw } = await params;
  const { from: fromTab } = await searchParams;
  const unitId = parseInt(raw, 10);

  if (isNaN(unitId)) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <p className="text-text-secondary">Invalid school ID.</p>
        <a href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          &larr; Back
        </a>
      </main>
    );
  }

  const schoolRow = getSchool(unitId);

  if (!schoolRow) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
        <p className="text-text-secondary">School not found.</p>
        <a href="/" className="mt-2 inline-block text-sm text-accent hover:underline">
          &larr; Back
        </a>
      </main>
    );
  }

  const school: School = {
    unitId: schoolRow.unitId,
    name: schoolRow.name,
    city: schoolRow.city ?? '',
    state: schoolRow.state ?? '',
    ownership: schoolRow.ownership ?? 0,
    ownershipLabel: schoolRow.ownershipLabel ?? '',
    admissionRate: schoolRow.admissionRate,
    satRead75: schoolRow.satRead75,
    satMath75: schoolRow.satMath75,
    size: schoolRow.size,
    costAttendance: schoolRow.costAttendance,
    tuitionInState: schoolRow.tuitionInState,
    tuitionOutState: schoolRow.tuitionOutState,
    netPricePublic: schoolRow.netPricePublic,
    netPricePrivate: schoolRow.netPricePrivate,
    completionRate: schoolRow.completionRate,
    selectivityTier: schoolRow.selectivityTier ?? '',
    lat: schoolRow.lat,
    lon: schoolRow.lon,
  };

  const rows = getPrograms({ unitId });

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
    ownership: school.ownership,
    ownershipLabel: school.ownershipLabel,
    admissionRate: school.admissionRate,
    satMath75: school.satMath75,
    satRead75: school.satRead75,
    size: school.size,
    completionRate: school.completionRate,
  }));

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:py-12">
      <PageNav />
      <SchoolDetail school={school} programs={programData} fromTab={fromTab} />
    </main>
  );
}
