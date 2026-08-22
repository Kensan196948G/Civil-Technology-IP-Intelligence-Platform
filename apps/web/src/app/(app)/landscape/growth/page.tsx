import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; workType: string; patentN: number; techN: number; diff: number };
type RawRow = { work_type: string; patent_n: number; tech_n: number; diff: number };

export default async function LandscapeGrowthPage() {
  const db = getDb(getDatabaseUrl());
  // 競合特許の出願数（patents.work_types）と自社技術台帳の保有数（technologies.work_types）を
  // 工種単位で比較し、差分（競合出願数 − 自社保有数）の大きい順に並べる。
  // 差分が大きい＝競合が活発で自社の備えが薄い「成長・注視領域」、
  // 差分が小さい（マイナス）＝自社が優位な「成熟・自社優位領域」とみなす。
  const res = await db.execute(sql`
    with wt as (
      select distinct unnest(work_types) as work_type from patents
      union
      select distinct unnest(work_types) as work_type from technologies
    ),
    pc as (
      select w as work_type, count(*)::int as n from patents, unnest(work_types) as w group by w
    ),
    tc as (
      select w as work_type, count(*)::int as n from technologies, unnest(work_types) as w group by w
    )
    select wt.work_type,
      coalesce(pc.n, 0) as patent_n,
      coalesce(tc.n, 0) as tech_n,
      coalesce(pc.n, 0) - coalesce(tc.n, 0) as diff
    from wt
    left join pc on pc.work_type = wt.work_type
    left join tc on tc.work_type = wt.work_type
    order by diff desc, wt.work_type asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.work_type, workType: r.work_type, patentN: r.patent_n, techN: r.tech_n, diff: r.diff
  }));

  return (
    <ListView
      title="成長・衰退領域"
      moduleCode="S-09 / LANDSCAPE — GROWTH AREAS"
      description="工種ごとに競合特許件数と自社技術保有件数を比較し、差分の大きい順（競合が活発＝成長・注視領域）に並べます。"
      rows={rows}
      emptyMessage="比較対象の工種データがまだありません。"
      fields={[
        { key: 'workType', grow: true, mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.workType}</span> },
        { key: 'patentN', render: row => `競合特許 ${row.patentN} 件` },
        { key: 'techN', render: row => `自社技術 ${row.techN} 件` },
        { key: 'diff', render: row => (
          <span className="badge" style={{
            color: row.diff > 0 ? 'var(--amber)' : row.diff < 0 ? 'var(--blue)' : 'var(--ink-2)',
            border: `1px solid ${row.diff > 0 ? 'var(--amber)' : row.diff < 0 ? 'var(--blue)' : 'var(--line)'}`
          }}>
            {row.diff > 0 ? `成長領域 +${row.diff}` : row.diff < 0 ? `自社優位 ${row.diff}` : '拮抗'}
          </span>
        ) }
      ]}
    />
  );
}
