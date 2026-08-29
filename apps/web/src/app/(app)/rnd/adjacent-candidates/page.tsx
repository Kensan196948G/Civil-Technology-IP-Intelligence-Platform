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

export default async function RndAdjacentCandidatesPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select r.id, r.analysis_id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      r.our_text, r.rationale
    from claim_chart_rows r
    join claim_analyses a on a.id = r.analysis_id
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    where r.kind = 'differ'
    order by a.created_at desc, r.seq asc
  `);
  const rows: Row[] = (result.rows as any[]).map(r => ({
    id: r.id, analysisId: r.analysis_id, patentTitle: r.patent_title, applicantName: r.applicant_name,
    techName: r.tech_name, ourText: r.our_text, rationale: r.rationale
  }));

  return (
    <ListView
      title="周辺発明候補"
      moduleCode="S-10 / ADJACENT INVENTION CANDIDATES"
      description="他社特許の構成要件と自社案が「非該当」と判定された箇所です。他社特許の権利範囲に含まれない独自要素として、周辺の新規発明の候補になり得ます。"
      rows={rows}
      emptyMessage="周辺発明候補となるClaim比較結果はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', render: row => <span style={{ fontWeight: 700 }}>{row.patentTitle}</span> },
        { key: 'applicant', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.applicantName}</span> },
        { key: 'ourText', grow: true, render: row => <span style={{ fontSize: 12.5 }}>{row.ourText}</span> },
        { key: 'kind', render: () => (
          <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>非該当</span>
        ) }
      ]}
    />
  );
}
