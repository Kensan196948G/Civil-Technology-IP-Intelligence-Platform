export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; patent_title: string; applicant_name: string; tech_name: string; match_n: number; total_n: number };

export default async function ClaimChartListPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select a.id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      count(r.id) filter (where r.kind='match') as match_n, count(r.id) as total_n
    from claim_analyses a
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, p.title, p.applicant_name, t.name
    order by p.title
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="Claim Chart"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="他社特許 × 自社技術ごとの Claim Chart（構成要件単位の対比表）の一覧です。各行から詳細な対比表を確認できます。"
      rows={rows}
      emptyMessage="Claim Chart データがまだありません。"
      rowHref={row => `/claims/${row.id}`}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.patent_title}</span> },
        { key: 'applicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicant_name}</span> },
        { key: 'tech', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>vs. {row.tech_name}</span> },
        { key: 'rate', mono: true, render: row => `${row.total_n > 0 ? Math.round((row.match_n / row.total_n) * 100) : 0}%` }
      ]}
    />
  );
}
