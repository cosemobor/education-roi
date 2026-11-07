import { getPrograms, getSchool, topProgramsByEarnings } from '@/lib/data/store';
import { type NextRequest } from 'next/server';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const checkLimit = createRateLimiter('programs', 60_000, 60);

export function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (checkLimit(ip)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }

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

  let rows;
  if (all) {
    // Lightweight response for "All Programs" scatter chart — no join, minimal fields
    rows = topProgramsByEarnings(2000).map((p) => ({
      unitId: p.unitId,
      schoolName: p.schoolName,
      state: p.state,
      cipTitle: p.cipTitle,
      credTitle: p.credTitle,
      earn1yr: p.earn1yr,
      earn5yr: p.earn5yr,
      costAttendance: p.costAttendance,
      selectivityTier: p.selectivityTier,
    }));
  } else {
    let unitId: number | undefined;
    if (schoolId) {
      unitId = parseInt(schoolId, 10);
      if (isNaN(unitId)) {
        return Response.json({ error: 'Invalid school ID' }, { status: 400 });
      }
    }
    rows = getPrograms({ cip: cip ?? undefined, unitId }).map((p) => {
      const s = getSchool(p.unitId);
      return {
        id: p.id,
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
        ownership: s?.ownership ?? null,
        ownershipLabel: s?.ownershipLabel ?? null,
        admissionRate: s?.admissionRate ?? null,
        satMath75: s?.satMath75 ?? null,
        satRead75: s?.satRead75 ?? null,
        size: s?.size ?? null,
        completionRate: s?.completionRate ?? null,
      };
    });
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
