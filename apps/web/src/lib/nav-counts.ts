import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql, eq } from 'drizzle-orm';
import * as s from '@/lib/db/schema';
import type { CurrentUser } from '@/lib/auth/current-user';
import { isC3ReaderRole } from '@/lib/authz/row-visibility';

// サイドバーの件数バッジ。設計案では固定値だったが、実データを出す。
// レイアウトは全ページで走るため1往復のクエリにまとめている。
//
// #11 C3/C4 行レベル制御: バッジの件数にも権限外の C3 を含めない（README §14 ルール1）。
// 発明（C3）・発明 workflow（C3）は「R ロール」または「起案者本人」のみ件数へ数える。

export type NavCounts = {
  field: number | null;
  investigations: number | null;
  inventions: number | null;
  approvals: number | null;
  watches: number | null;
};

const EMPTY: NavCounts = { field: null, investigations: null, inventions: null, approvals: null, watches: null };

export async function loadNavCounts(user: CurrentUser | null): Promise<NavCounts> {
  try {
    if (!user) return EMPTY;
    const db = getDb(getDatabaseUrl());
    const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
    const viewerUserId = me?.id;
    const c3Reader = isC3ReaderRole(user.role);

    // R ロールは C1〜C3 を件数に含める。engineer/viewer は C1/C2 ＋ 自分が起案した C3。
    const invScope = c3Reader
      ? sql`1 = 1` // C1〜C3（C4 は現行データ無し。必要時は絞る）
      : viewerUserId
        ? sql`(classification IN ('C1','C2') OR (classification = 'C3' AND submitted_by = ${viewerUserId}))`
        : sql`classification IN ('C1','C2')`;
    const wfScope = c3Reader
      ? sql`1 = 1`
      : viewerUserId
        ? sql`(classification IN ('C1','C2') OR (classification = 'C3' AND author_id = ${viewerUserId}))`
        : sql`classification IN ('C1','C2')`;

    const r = await db.execute(sql`
      select
        (select count(*) from site_issues where status = 'open') as field,
        (select count(*) from investigations where status = 'open') as investigations,
        (select count(*) from inventions where ${invScope}) as inventions,
        (select count(*) from workflow_instances
           where status not in ('approved', 'rejected', 'archived') and ${wfScope}) as approvals,
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
