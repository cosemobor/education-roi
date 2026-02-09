import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function migrate() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      page TEXT,
      timestamp INTEGER NOT NULL
    )
  `);

  await client.execute(
    'CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id)',
  );
  await client.execute(
    'CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type)',
  );
  await client.execute(
    'CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(timestamp)',
  );

  console.log('Analytics table created successfully');
}

migrate().catch(console.error);
