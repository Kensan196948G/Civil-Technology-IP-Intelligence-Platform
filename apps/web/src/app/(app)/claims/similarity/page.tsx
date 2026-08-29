export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; patent_title: string; applicant_name: string; tech_name: string; match_n: number; total_n: number };

function rateColor(pct: number) {
  if (pct >= 70) return 'var(--brick)';
  if (pct >= 40) return 'var(--amber)';
  return 'var(--green)';
}

export default async function SimilarityPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select a.id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      count(r.id) filter (where r.kind='match') as match_n, count(r.id) as total_n
    from claim_analyses a
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, p.title, p.applicant_name, t.name
    order by
      count(r.id) filter (where r.kind = 'match')::numeric
        / nullif(count(r.id), 0) desc nulls last
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="類似度分析"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="他社特許 × 自社技術の組み合わせを、構成要件の一致率が高い順に並べます。一致率が高いほど侵害リスク確認の優先度が高くなります。"
      rows={rows}
      emptyMessage="類似度分析データがまだありません。"
      rowHref={row => `/claims/${row.id}`}
      badge="AI参考値"
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.patent_title}</span> },
        { key: 'meta', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicant_name} ｜ vs. {row.tech_name}</span> },
        { key: 'rate', mono: true, render: row => {
          const pct = row.total_n > 0 ? Math.round((row.match_n / row.total_n) * 100) : 0;
          return <span style={{ fontWeight: 700, color: rateColor(pct) }}>{pct}%</span>;
        } }
      ]}
    />
  );
}
