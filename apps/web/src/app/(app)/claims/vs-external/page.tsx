export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; title: string; applicant_name: string; country: string; tech_n: number; match_n: number; total_n: number };

export default async function VsExternalPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select p.id, p.title, p.applicant_name, p.country,
      count(distinct a.id) as tech_n,
      count(r.id) filter (where r.kind='match') as match_n,
      count(r.id) as total_n
    from patents p
    join claim_analyses a on a.patent_id = p.id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by p.id, p.title, p.applicant_name, p.country
    order by match_n desc nulls last, p.title
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="他社特許との比較"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="他社特許ごとに、Claim比較の対象となった自社技術の件数と構成要件の一致率をまとめます。"
      rows={rows}
      emptyMessage="他社特許との比較データがまだありません。"
      rowHref={row => `/patents/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'applicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicant_name}（{row.country}）</span> },
        { key: 'tech_n', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>比較自社技術 {row.tech_n} 件</span> },
        { key: 'rate', mono: true, render: row => `${row.total_n > 0 ? Math.round((row.match_n / row.total_n) * 100) : 0}%` }
      ]}
    />
  );
}
