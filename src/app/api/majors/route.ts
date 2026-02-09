import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { majorsSummary } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';

const checkLimit = createRateLimiter('majors', 60_000, 60);

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  if (checkLimit(ip)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    );
  }
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
