import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; country: string; workType: string; n: number };
type RawRow = { country: string; work_type: string; n: number };

export default async function LandscapeMapPage() {
  const db = getDb(getDatabaseUrl());
  // 国・地域 × 工種のクロス集計で、どの国のどの工種に出願が分布しているかを地図的に俯瞰する。
  const res = await db.execute(sql`
    select country, wt as work_type, count(*)::int as n
    from patents, unnest(work_types) as wt
    group by country, wt
    order by country asc, n desc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map((r, i) => ({
    id: `${r.country}:${r.work_type}:${i}`, country: r.country, workType: r.work_type, n: r.n
  }));

  return (
    <ListView
      title="技術マップ"
      moduleCode="S-09 / LANDSCAPE — TECH MAP"
      description="出願国・地域と工種のクロス集計です。どの国がどの工種に注力しているかを俯瞰できます。"
      rows={rows}
      emptyMessage="集計対象の特許データがまだありません。"
      fields={[
        { key: 'country', mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.country}</span> },
        { key: 'workType', grow: true, mono: true, render: row => row.workType },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
