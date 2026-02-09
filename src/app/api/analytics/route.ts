import { type NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { analyticsEvents } from '@/lib/db/schema';
import { createRateLimiter } from '@/lib/rate-limit';

const checkLimit = createRateLimiter('analytics', 60_000, 100);

const VALID_EVENT_TYPES = new Set([
  'page_view',
  'page_exit',
  'tab_switch',
  'search_query',
  'search_select',
  'major_click',
  'school_click',
  'program_click',
  'tour_complete',
  'tour_skip',
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const events = body.events;

    if (!Array.isArray(events) || events.length === 0) {
      return Response.json({ error: 'Events array required' }, { status: 400 });
    }

    if (events.length > 20) {
      return Response.json({ error: 'Max 20 events per batch' }, { status: 400 });
    }

    const sessionId = events[0]?.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 50) {
      return Response.json({ error: 'Valid session ID required' }, { status: 400 });
    }

    // Developer IP exclusion
    const excludedIp = process.env.EXCLUDED_IP;
    if (excludedIp) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        request.headers.get('x-real-ip') ??
        '';
      if (ip === excludedIp) {
        return Response.json({ ok: true });
      }
    }

    if (checkLimit(sessionId)) {
      return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    const db = getDb();
    const validEvents = events.filter(
      (e: Record<string, unknown>) =>
        typeof e.type === 'string' &&
        VALID_EVENT_TYPES.has(e.type) &&
        typeof e.timestamp === 'number',
    );

    if (validEvents.length > 0) {
      await db.insert(analyticsEvents).values(
        validEvents.map((e: Record<string, unknown>) => ({
          sessionId,
          eventType: e.type as string,
          eventData: e.data ? JSON.stringify(e.data) : null,
          page: (typeof e.page === 'string' ? e.page : null)?.slice(0, 200) ?? null,
          timestamp: new Date(e.timestamp as number),
        })),
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
