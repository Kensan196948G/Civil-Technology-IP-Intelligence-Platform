import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const pgPools = new Map<string, ReturnType<typeof postgres>>();

type Db = ReturnType<typeof drizzleNeon<typeof schema>>;

// ローカルPostgres等 neon.tech 以外のホストは pg TCP ドライバ (postgres.js) を使う。
export function getDb(databaseUrl: string): Db {
  const isNeon = /neon\.tech(:\d+)?$/.test(new URL(databaseUrl).host);
  if (!isNeon) {
    let pg = pgPools.get(databaseUrl);
    if (!pg) {
      pg = postgres(databaseUrl, { max: 5 });
      pgPools.set(databaseUrl, pg);
    }
    const db = drizzlePg(pg, { schema });
    // drizzle-orm/postgres-js の execute() は配列を直接返すが、
    // drizzle-orm/neon-http は { rows: [...] } でラップして返す。
    // 呼び出し側は Neon の形に合わせて書かれているため、ここで形を揃える。
    const originalExecute = db.execute.bind(db);
    (db as unknown as { execute: unknown }).execute = async (query: Parameters<typeof db.execute>[0]) => {
      const result = await originalExecute(query);
      return { rows: result };
    };
    return db as unknown as Db;
  }
  const sql = neon(databaseUrl);
  return drizzleNeon(sql, { schema });
}
