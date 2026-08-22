import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { getCurrentUser } from '@/lib/auth/current-user';
import { sql } from 'drizzle-orm';

export const runtime = 'edge';

// MVP版の検索API。本番のハイブリッド検索（pg_trgm+pgvector+RRF）は
// docs/30-design/06-search-and-rag-design.md の設計に基づき別途実装する。
export async function GET(req: Request) {
  // CodeRabbit指摘: 未認証アクセスを許していた。Cookie（デモ認証）を必須にする。
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: 'unauthenticated', message: 'ログインが必要です' }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;
  const rows = await db.execute(sql`
    select 'patent' as kind, id, title from patents where ${q} = '' or title ilike ${like}
    union all
    select 'paper' as kind, id, title from papers where ${q} = '' or title ilike ${like}
    union all
    select 'netis' as kind, id, name as title from netis_technologies where ${q} = '' or name ilike ${like}
    union all
    select 'tech' as kind, id, name as title from technologies where ${q} = '' or name ilike ${like}
    limit 50
  `);
  return Response.json({ query: q, count: rows.rows.length, results: rows.rows, note: 'MVPデモ用の簡易検索です' });
}
