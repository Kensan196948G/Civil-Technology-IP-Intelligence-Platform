import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; workType: string; ourTechN: number; competitorPatentN: number; position: 'lead' | 'behind' | 'even' };
type RawRow = { work_type: string; our_tech_n: number; competitor_patent_n: number };

const POSITION_LABEL: Record<Row['position'], string> = { lead: '優位', behind: '劣位', even: '互角' };

export default async function LandscapeOurPositionPage() {
  const db = getDb(getDatabaseUrl());
  // 工種ごとに自社技術保有数と競合特許出願数を並べ、自社のポジション（優位/劣位/互角）を示す。
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
      coalesce(tc.n, 0) as our_tech_n,
      coalesce(pc.n, 0) as competitor_patent_n
    from wt
    left join pc on pc.work_type = wt.work_type
    left join tc on tc.work_type = wt.work_type
    order by wt.work_type asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.work_type,
    workType: r.work_type,
    ourTechN: r.our_tech_n,
    competitorPatentN: r.competitor_patent_n,
    position: r.our_tech_n > r.competitor_patent_n ? 'lead' : r.our_tech_n < r.competitor_patent_n ? 'behind' : 'even'
  }));

  return (
    <ListView
      title="自社ポジション"
      moduleCode="S-09 / LANDSCAPE — OUR POSITION"
      description="工種ごとに自社技術保有数と競合特許出願数を並べ、自社のポジションを俯瞰します。"
      rows={rows}
      emptyMessage="比較対象の工種データがまだありません。"
      fields={[
        { key: 'workType', grow: true, mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.workType}</span> },
        { key: 'ourTechN', render: row => `自社技術 ${row.ourTechN} 件` },
        { key: 'competitorPatentN', render: row => `競合特許 ${row.competitorPatentN} 件` },
        { key: 'position', render: row => (
          <span className="badge" style={{
            color: row.position === 'lead' ? 'var(--green)' : row.position === 'behind' ? 'var(--brick)' : 'var(--ink-2)',
            border: `1px solid ${row.position === 'lead' ? 'var(--green)' : row.position === 'behind' ? 'var(--brick)' : 'var(--line)'}`
          }}>
            {POSITION_LABEL[row.position]}
          </span>
        ) }
      ]}
    />
  );
}
