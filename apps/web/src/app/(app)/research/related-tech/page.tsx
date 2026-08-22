import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type TechRelevanceRow = {
  id: string;
  name: string;
  kind: string;
  maturity: string | null;
  patent_link_count: string;
  field_link_count: string;
};

export default async function ResearchRelatedTechPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select t.id, t.name, t.kind, t.maturity,
      (select count(*) from claim_analyses ca where ca.technology_id = t.id) as patent_link_count,
      (select count(*) from field_applications fa where fa.candidate_type = 'technology' and fa.candidate_id = t.id) as field_link_count
    from technologies t
    order by t.created_at desc
    limit 100
  `);
  const rows = result.rows as TechRelevanceRow[];

  return (
    <ListView
      title="技術との関連"
      moduleCode="S-07h / TECHNOLOGY RELEVANCE"
      description="自社技術ごとに、関連する特許のClaim比較件数・現場適用（施工事例）件数を集計した関連度一覧です。"
      rows={rows}
      emptyMessage="技術データがまだありません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'patent', render: row => `特許関連 ${row.patent_link_count} 件` },
        { key: 'field', render: row => `施工事例 ${row.field_link_count} 件` }
      ]}
    />
  );
}
