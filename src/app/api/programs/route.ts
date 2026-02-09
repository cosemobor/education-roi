import { getDb } from '@/lib/db';
import { programs, schools } from '@/lib/db/schema';
import { eq, and, desc, isNotNull } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const checkLimit = createRateLimiter('programs', 60_000, 60);

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (checkLimit(ip)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

  const db = getDb();
  const { searchParams } = request.nextUrl;
  const cip = searchParams.get('cip');
  const schoolId = searchParams.get('school');
  const all = searchParams.get('all');

  if (!cip && !schoolId && !all) {
    return Response.json(
      { error: 'Provide ?cip=CODE, ?school=ID, or ?all=1' },
      { status: 400 },
    );
  }

  const selectFields = {
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
  };

  let rows;
  if (all) {
    // Lightweight response for "All Programs" scatter chart — no JOIN, minimal fields
    rows = await db
      .select({
        unitId: programs.unitId,
        schoolName: programs.schoolName,
        state: programs.state,
        cipTitle: programs.cipTitle,
        credTitle: programs.credTitle,
        earn1yr: programs.earn1yr,
        earn5yr: programs.earn5yr,
        costAttendance: programs.costAttendance,
        selectivityTier: programs.selectivityTier,
      })
      .from(programs)
      .where(isNotNull(programs.earn1yr))
      .orderBy(desc(programs.earn1yr))
      .limit(2000);
  } else {
    const conditions = [];
    if (cip) conditions.push(eq(programs.cipCode, cip));
    if (schoolId) {
      const unitId = parseInt(schoolId, 10);
      if (isNaN(unitId)) {
        return Response.json({ error: 'Invalid school ID' }, { status: 400 });
      }
      conditions.push(eq(programs.unitId, unitId));
    }
    rows = await db
      .select(selectFields)
      .from(programs)
      .leftJoin(schools, eq(programs.unitId, schools.unitId))
      .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      .orderBy(desc(programs.earn1yr));
  }

  const cacheControl =
    process.env.NODE_ENV === 'production'
      ? 'public, s-maxage=86400, stale-while-revalidate=604800'
      : 'no-store';

  const cleaned = rows.map((r) => ({
    ...r,
    cipTitle: (r.cipTitle ?? '').replace(/\.+$/, ''),
  }));

  return Response.json({ data: cleaned }, {
    headers: { 'Cache-Control': cacheControl },
  });
}
