import { getDb } from '@/lib/db';
import { majorsSummary } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const rows = await db
    .select()
    .from(majorsSummary)
    .orderBy(desc(majorsSummary.medianEarn1yr));

  return Response.json({ data: rows }, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
