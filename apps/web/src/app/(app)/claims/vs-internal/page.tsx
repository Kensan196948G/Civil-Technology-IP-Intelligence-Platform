import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; name: string; kind: string; maturity: string | null; patent_n: number; match_n: number; total_n: number };

export default async function VsInternalPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select t.id, t.name, t.kind, t.maturity,
      count(distinct a.id) as patent_n,
      count(r.id) filter (where r.kind='match') as match_n,
      count(r.id) as total_n
    from technologies t
    join claim_analyses a on a.technology_id = t.id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by t.id, t.name, t.kind, t.maturity
    order by patent_n desc, t.name
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="自社技術との比較"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="自社技術ごとに、Claim比較の対象となった他社特許の件数と構成要件の一致率をまとめます。"
      rows={rows}
      emptyMessage="自社技術との比較データがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'maturity', render: row => row.maturity ?? '—' },
        { key: 'patent_n', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>比較特許 {row.patent_n} 件</span> },
        { key: 'rate', mono: true, render: row => `${row.total_n > 0 ? Math.round((row.match_n / row.total_n) * 100) : 0}%` }
      ]}
    />
  );
}
