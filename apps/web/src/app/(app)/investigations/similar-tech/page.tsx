import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; analysisId: string; patentTitle: string; applicantName: string; techName: string };

export default async function SimilarTechPage() {
  const db = getDb(getDatabaseUrl());
  // Claim比較（claim_chart_rows）で「類似」判定された構成要件を横断表示する。
  // 他社特許の構成と自社技術がどこで類似と判定されたかを一覧できる。
  const result = await db.execute(sql`
    select r.id, a.id as analysis_id, p.title as patent_title, p.applicant_name, t.name as tech_name
    from claim_chart_rows r
    join claim_analyses a on a.id = r.analysis_id
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    where r.kind = 'similar'
    order by r.seq
  `);
  const rows: Row[] = (result.rows as any[]).map(r => ({
    id: r.id, analysisId: r.analysis_id, patentTitle: r.patent_title,
    applicantName: r.applicant_name, techName: r.tech_name
  }));

  return (
    <ListView
      title="類似技術調査"
      moduleCode="S-04c / SIMILAR TECHNOLOGY"
      description="Claim比較で「類似」と判定された、他社特許構成要件と自社技術の対比一覧です。"
      rows={rows}
      emptyMessage="類似判定の構成要件はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.patentTitle}</span> },
        { key: 'vs', render: row => `${row.applicantName} vs. 自社「${row.techName}」` },
        { key: 'badge', render: () => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>類似</span>
        ) }
      ]}
    />
  );
}
