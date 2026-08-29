import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = {
  id: string; analysis_id: string; element_label: string; our_text: string; quoted_text: string; rationale: string | null;
  patent_title: string; tech_name: string;
};

export default async function ClaimDiffPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select r.id, r.analysis_id, e.label as element_label, r.our_text, r.quoted_text, r.rationale,
      p.title as patent_title, t.name as tech_name
    from claim_chart_rows r
    join claim_elements e on e.id = r.element_id
    join claim_analyses a on a.id = r.analysis_id
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    where r.kind = 'differ'
    order by p.title, e.seq
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <ListView
      title="差分・特徴抽出"
      moduleCode="S-13 / CLAIM INTELLIGENCE"
      description="Claim Chart 上で「相違」と判定された構成要件のみを抽出します。自社案が他社特許の構成要件と異なる特徴点の確認に使います。"
      rows={rows}
      emptyMessage="相違と判定された構成要件はまだありません。"
      rowHref={row => `/claims/${row.analysis_id}`}
      fields={[
        { key: 'label', mono: true, render: row => row.element_label },
        { key: 'diff', grow: true, render: row => (
          <span>
            <span style={{ color: 'var(--brick)' }}>他社：{row.quoted_text}</span>
            <br />
            <span style={{ color: 'var(--green)' }}>自社：{row.our_text}</span>
          </span>
        ) },
        { key: 'meta', render: row => <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{row.patent_title} vs. {row.tech_name}</span> }
      ]}
    />
  );
}
