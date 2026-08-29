export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type WorkTypeRow = { id: string; workType: string; patentN: number; techN: number; siteN: number; total: number };
type RawRow = { work_type: string; patent_n: number; tech_n: number; site_n: number; total: number };

export default async function WorkTypeMasterPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      wt as work_type,
      count(*) filter (where src = 'patent')::int as patent_n,
      count(*) filter (where src = 'technology')::int as tech_n,
      count(*) filter (where src = 'site')::int as site_n,
      count(*)::int as total
    from (
      select unnest(work_types) as wt, 'patent' as src from patents
      union all
      select unnest(work_types) as wt, 'technology' as src from technologies
      union all
      select unnest(work_types) as wt, 'site' as src from sites
    ) t
    group by wt
    order by total desc, wt asc
  `);
  const rows: WorkTypeRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: r.work_type, workType: r.work_type, patentN: Number(r.patent_n), techN: Number(r.tech_n),
    siteN: Number(r.site_n), total: Number(r.total)
  }));

  return (
    <ListView
      title="土木工種マスタ"
      moduleCode="S-18d / WORK TYPE MASTER"
      description="特許・技術・現場の各データが参照している工種コード（work_types）を横断集計した正規マスタです。工種タグの表記ゆれ・利用状況を横断で確認します。"
      badge="MVP"
      rows={rows}
      emptyMessage="工種マスタのデータがまだありません。"
      fields={[
        { key: 'workType', mono: true, grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.workType}</span> },
        { key: 'patentN', render: row => `特許 ${row.patentN}` },
        { key: 'techN', render: row => `技術 ${row.techN}` },
        { key: 'siteN', render: row => `現場 ${row.siteN}` },
        { key: 'total', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>計{row.total}</span> }
      ]}
    />
  );
}
