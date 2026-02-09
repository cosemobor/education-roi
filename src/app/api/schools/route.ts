import { getDb } from '@/lib/db';
import { schools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const id = searchParams.get('id');

  if (id) {
    const unitId = parseInt(id, 10);
    if (isNaN(unitId)) {
      return Response.json({ error: 'Invalid school ID' }, { status: 400 });
    }

    const [school] = await db
      .select()
      .from(schools)
      .where(eq(schools.unitId, unitId));

    if (!school) {
      return Response.json({ error: 'School not found' }, { status: 404 });
    }

    return Response.json({ data: school }, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  }

  // Return all schools (id, name, city, state for search)
  const rows = await db
    .select({
      unitId: schools.unitId,
      name: schools.name,
      city: schools.city,
      state: schools.state,
    })
    .from(schools)
    .orderBy(schools.name);

  return Response.json({ data: rows }, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
