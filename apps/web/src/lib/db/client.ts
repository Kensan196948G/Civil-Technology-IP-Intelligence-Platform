import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

// Cloudflare Pages (Edge Runtime) では postgres.js の TCP ドライバは動作しない。
// ローカル開発時は Neon の HTTP ドライバを使用する（localhost では動作しないが、
// Cloudflare 上では DATABASE_URL が常に neon.tech を指す）。
// ローカルPostgresが必要な場合は、別途 `npm run dev` で Node.js ランタイムを使用する。
export function getDb(databaseUrl: string): Db {
  const sql = neon(databaseUrl);
  return drizzleNeon(sql, { schema });
}
