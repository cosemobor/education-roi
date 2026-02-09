import { getDb } from '@/lib/db';
import { programs, schools } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const cip = searchParams.get('cip');
  const schoolId = searchParams.get('school');

  if (!cip && !schoolId) {
    return Response.json(
      { error: 'Provide ?cip=CODE and/or ?school=ID' },
      { status: 400 },
    );
  }

  const conditions = [];
  if (cip) conditions.push(eq(programs.cipCode, cip));
  if (schoolId) {
    const unitId = parseInt(schoolId, 10);
    if (isNaN(unitId)) {
      return Response.json({ error: 'Invalid school ID' }, { status: 400 });
    }
    conditions.push(eq(programs.unitId, unitId));
  }

  const rows = await db
    .select({
      id: programs.id,
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
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .orderBy(desc(programs.earn1yr));

  const cacheControl =
    process.env.NODE_ENV === 'production'
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'no-store';

  return Response.json({ data: rows }, {
    headers: { 'Cache-Control': cacheControl },
  });
}
