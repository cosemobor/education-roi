import { ImageResponse } from 'next/og';
import { getDb } from '@/lib/db';
import { schools, programs } from '@/lib/db/schema';
import { eq, isNotNull, sql } from 'drizzle-orm';

export const runtime = 'edge';
export const alt = 'School Earnings Data';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: { params: Promise<{ unitId: string }> }) {
  const { unitId: raw } = await params;
  const unitId = parseInt(raw, 10);

  const db = getDb();
  const [row] = await db
    .select({
      name: schools.name,
      city: schools.city,
      state: schools.state,
      programCount: sql<number>`count(${programs.id})`.as('cnt'),
      avgEarn1yr: sql<number>`avg(${programs.earn1yr})`.as('avg1'),
    })
    .from(schools)
    .leftJoin(programs, eq(schools.unitId, programs.unitId))
    .where(eq(schools.unitId, unitId))
    .groupBy(schools.unitId)
    .limit(1);

  const name = row?.name ?? 'School';
  const location = row?.city && row?.state ? `${row.city}, ${row.state}` : '';
  const programCount = row?.programCount ?? 0;
  const avgEarn = row?.avgEarn1yr ? `$${Math.round(row.avgEarn1yr).toLocaleString()}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 50%, #1e40af 100%)',
          fontFamily: 'system-ui, sans-serif',
          color: '#ffffff',
          padding: '60px',
        }}
      >
        <div
          style={{
            fontSize: '24px',
            fontWeight: 700,
            opacity: 0.7,
            marginBottom: '16px',
            background: 'rgba(255,255,255,0.15)',
            padding: '6px 16px',
            borderRadius: '8px',
          }}
        >
          HEO · School
        </div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: 800,
            lineHeight: 1.1,
            textAlign: 'center',
            letterSpacing: '-0.02em',
            marginBottom: '12px',
            maxWidth: '900px',
          }}
        >
          {name}
        </div>
        {location && (
          <div style={{ fontSize: '24px', opacity: 0.7, marginBottom: '40px' }}>
            {location}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            fontSize: '22px',
          }}
        >
          {avgEarn && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <span style={{ opacity: 0.7 }}>Avg 1yr Earnings</span>
              <span style={{ fontSize: '36px', fontWeight: 800 }}>{avgEarn}</span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <span style={{ opacity: 0.7 }}>Programs</span>
            <span style={{ fontSize: '36px', fontWeight: 800 }}>{programCount}</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
