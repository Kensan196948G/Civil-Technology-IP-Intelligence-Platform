import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = {
  id: string;
  analysisId: string;
  patentTitle: string;
  applicantName: string;
  techName: string;
  ourText: string;
  rationale: string | null;
};

export default async function RndImprovementCandidatesPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select r.id, r.analysis_id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      r.our_text, r.rationale
    from claim_chart_rows r
    join claim_analyses a on a.id = r.analysis_id
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    where r.kind = 'similar'
    order by a.created_at desc, r.seq asc
  `);
  const rows: Row[] = (result.rows as any[]).map(r => ({
    id: r.id, analysisId: r.analysis_id, patentTitle: r.patent_title, applicantName: r.applicant_name,
    techName: r.tech_name, ourText: r.our_text, rationale: r.rationale
  }));

  return (
    <ListView
      title="改良発明"
      moduleCode="S-10 / IMPROVEMENT CANDIDATES"
      description="他社特許の構成要件と自社案が「類似」と判定された箇所です。差分を埋めることで自社の改良発明として出願できる可能性があります。"
      rows={rows}
      emptyMessage="改良発明候補となるClaim比較結果はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', render: row => <span style={{ fontWeight: 700 }}>{row.patentTitle}</span> },
        { key: 'applicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicantName}</span> },
        { key: 'ourText', grow: true, render: row => <span style={{ fontSize: 12.5 }}>{row.ourText}</span> },
        { key: 'kind', render: () => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>類似</span>
        ) }
      ]}
    />
  );
}
