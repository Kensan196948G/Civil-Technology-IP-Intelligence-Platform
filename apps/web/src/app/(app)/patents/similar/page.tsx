import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type SimilarRow = {
  id: string;
  patentTitle: string;
  techName: string;
  matchN: number;
  similarN: number;
  differN: number;
  totalN: number;
};

// 「類似特許」= 自社技術案とのClaim比較（claim_analyses / claim_chart_rows）で
// 構成要件レベルの一致・類似が検出された他社特許。一致+類似の要件比率が高いほど
// 類似度が高いとみなす。
export default async function PatentSimilarPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      a.id as analysis_id,
      p.title as patent_title,
      t.name as tech_name,
      count(*) filter (where r.kind = 'match')::int as match_n,
      count(*) filter (where r.kind = 'similar')::int as similar_n,
      count(*) filter (where r.kind = 'differ')::int as differ_n,
      count(r.id)::int as total_n
    from claim_analyses a
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, p.title, t.name
    having count(r.id) filter (where r.kind in ('match', 'similar')) > 0
    order by (count(*) filter (where r.kind in ('match','similar'))) desc
  `);
  const rows: SimilarRow[] = (result.rows as any[]).map(r => ({
    id: r.analysis_id,
    patentTitle: r.patent_title,
    techName: r.tech_name,
    matchN: Number(r.match_n),
    similarN: Number(r.similar_n),
    differN: Number(r.differ_n),
    totalN: Number(r.total_n)
  }));

  return (
    <ListView
      title="類似特許"
      moduleCode="S-03 / SIMILAR PATENTS"
      description="自社技術案とのClaim比較（構成要件分析）で一致・類似が検出された他社特許の一覧です。一致＋類似の構成要件が多いほど上位に表示されます。"
      rows={rows}
      emptyMessage="Claim比較が未実施のためデータがありません。"
      rowHref={row => `/claims/${row.id}`}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.patentTitle}</span> },
        { key: 'tech', render: row => <span style={{ color: 'var(--ink-2)' }}>vs {row.techName}</span> },
        { key: 'match', render: row => <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>一致 {row.matchN}</span> },
        { key: 'similar', render: row => <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>類似 {row.similarN}</span> },
        { key: 'differ', render: row => <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line)' }}>相違 {row.differN}</span> }
      ]}
    />
  );
}
