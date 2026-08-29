import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; label: string; text: string; claimNo: number; patentId: string; patentTitle: string };

export default async function ByElementPage() {
  const db = getDb(getDatabaseUrl());
  // 他社特許の請求項を構成要件（A, B, C…）単位に分解し、要件ラベル順で横断表示する。
  const result = await db.execute(sql`
    select e.id, e.label, e.text, c.claim_no, p.id as patent_id, p.title as patent_title
    from claim_elements e
    join patent_claims c on c.id = e.claim_id
    join patents p on p.id = c.patent_id
    order by e.label, p.title, e.seq
  `);
  const rows: Row[] = (result.rows as any[]).map(r => ({
    id: r.id, label: r.label, text: r.text, claimNo: r.claim_no, patentId: r.patent_id, patentTitle: r.patent_title
  }));

  return (
    <ListView
      title="構成要件別調査"
      moduleCode="S-04d / BY CLAIM ELEMENT"
      description="他社特許の請求項を構成要件（A, B, C…）単位に分解し、要件別に横断参照します。"
      rows={rows}
      emptyMessage="構成要件データがまだありません。"
      rowHref={row => `/patents/${row.patentId}`}
      fields={[
        { key: 'label', mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.label}</span> },
        { key: 'text', grow: true, render: row => row.text },
        { key: 'patent', render: row => `${row.patentTitle}（請求項${row.claimNo}）` }
      ]}
    />
  );
}
