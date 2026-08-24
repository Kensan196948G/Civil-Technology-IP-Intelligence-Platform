import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';

// サイドバーの件数バッジ。設計案では固定値だったが、実データを出す。
// レイアウトは全ページで走るため1往復のクエリにまとめている。

export type NavCounts = {
  field: number | null;
  investigations: number | null;
  inventions: number | null;
  approvals: number | null;
  watches: number | null;
};

const EMPTY: NavCounts = { field: null, investigations: null, inventions: null, approvals: null, watches: null };

export async function loadNavCounts(): Promise<NavCounts> {
  try {
    const db = getDb(getDatabaseUrl());
    const r = await db.execute(sql`
      select
        (select count(*) from site_issues where status = 'open') as field,
        (select count(*) from investigations where status = 'open') as investigations,
        (select count(*) from inventions) as inventions,
        (select count(*) from workflow_instances
           where status not in ('approved', 'rejected', 'archived')) as approvals,
        (select count(*) from watches) as watches
    `);
    const row = r.rows[0] as Record<string, unknown> | undefined;
    if (!row) return EMPTY;
    const n = (v: unknown) => {
      const parsed = Number(v);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return {
      field: n(row.field),
      investigations: n(row.investigations),
      inventions: n(row.inventions),
      approvals: n(row.approvals),
      watches: n(row.watches)
    };
  } catch {
    // DB未設定・接続不可でもシェルは描画できるようにする（件数バッジを出さないだけ）。
    return EMPTY;
  }
}
