import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; workType: string; n: number; companies: number };
type RawRow = { work_type: string; n: number; companies: number };

export default async function LandscapeByWorkTypePage() {
  const db = getDb(getDatabaseUrl());
  const res = await db.execute(sql`
    select wt as work_type, count(*)::int as n, count(distinct applicant_name)::int as companies
    from patents, unnest(work_types) as wt
    group by wt
    order by n desc, wt asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.work_type, workType: r.work_type, n: r.n, companies: r.companies
  }));

  return (
    <ListView
      title="工種別比較"
      moduleCode="S-09 / LANDSCAPE — BY WORK TYPE"
      description="他社特許を工種（work_types）単位で集計し、どの工種で出願が集中しているかを比較します。"
      rows={rows}
      emptyMessage="集計対象の特許データがまだありません。"
      fields={[
        { key: 'workType', grow: true, mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.workType}</span> },
        { key: 'companies', render: row => `${row.companies} 社` },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
