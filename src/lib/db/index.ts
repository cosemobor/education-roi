import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let _db: Database | undefined;

export function getDb(): Database {
  if (!_db) {
    const tursoClient = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    });
    _db = drizzle(tursoClient, { schema });
  }
  return _db;
}
