import { type NextRequest } from 'next/server';
import { getSchool, schoolsByName } from '@/lib/data/store';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const checkLimit = createRateLimiter('schools', 60_000, 60);
const CACHE = { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' };

export function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (checkLimit(ip)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }
  const id = request.nextUrl.searchParams.get('id');

  if (id) {
    const unitId = parseInt(id, 10);
    if (isNaN(unitId)) {
      return Response.json({ error: 'Invalid school ID' }, { status: 400 });
    }
    const school = getSchool(unitId);
    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }
    return Response.json({ data: school }, { headers: CACHE });
  }

  // Return all schools (id, name, city, state for search)
  const rows = schoolsByName.map(({ unitId, name, city, state }) => ({ unitId, name, city, state }));
  return Response.json({ data: rows }, { headers: CACHE });
}
