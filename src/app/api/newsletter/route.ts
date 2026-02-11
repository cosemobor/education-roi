import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { newsletterSignups } from '@/lib/db/schema';
import { createRateLimiter, getClientIp } from '@/lib/rate-limit';
import { eq } from 'drizzle-orm';

const checkLimit = createRateLimiter('newsletter', 60_000, 5);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (checkLimit(ip)) {
      return Response.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const source = body.source === 'banner' ? 'banner' : 'popup';

    if (!email || !EMAIL_REGEX.test(email) || email.length > 254) {
      return Response.json({ error: 'Valid email required' }, { status: 400 });
    }

    const db = getDb();

    const existing = await db
      .select()
      .from(newsletterSignups)
      .where(eq(newsletterSignups.email, email))
      .limit(1);

    if (existing.length > 0) {
      return Response.json({ ok: true, message: 'Already subscribed' });
    }

    await db.insert(newsletterSignups).values({
      email,
      source,
      createdAt: new Date(),
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
