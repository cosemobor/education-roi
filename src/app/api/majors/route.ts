import { majorsSummary } from '@/lib/data/store';

// Prerendered at build time and served from the CDN — the data only changes
// when src/data/ is rebuilt and redeployed.
export const dynamic = 'force-static';

export function GET() {
  return Response.json({ data: majorsSummary });
}
