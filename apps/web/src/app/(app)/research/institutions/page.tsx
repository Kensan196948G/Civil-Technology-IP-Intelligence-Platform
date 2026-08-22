import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type InstitutionRow = {
  id: string;
  affiliation: string;
  researcher_count: string;
  fields: string | null;
};

export default async function ResearchInstitutionsPage() {
  const db = getDb(getDatabaseUrl());
  // 「当社」を含む所属（自社の技術研究所）は社内組織であり大学・研究機関ではないため除外する。
  const result = await db.execute(sql`
    select affiliation as id, affiliation,
      count(*) as researcher_count,
      string_agg(distinct field, '、' order by field) as fields
    from researchers
    where affiliation is not null and affiliation not like '%当社%'
    group by affiliation
    order by count(*) desc, affiliation asc
  `);
  const rows = (result.rows as InstitutionRow[]).map(r => ({ ...r, id: r.affiliation }));

  return (
    <ListView
      title="大学・研究機関"
      moduleCode="S-07c / RESEARCH INSTITUTIONS"
      description="発明者・研究者の所属先から抽出した、社外の大学・研究機関の一覧です（自社の技術研究所は除きます）。"
      rows={rows}
      emptyMessage="外部の大学・研究機関データはまだありません。"
      fields={[
        { key: 'affiliation', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.affiliation}</span> },
        { key: 'researcher_count', mono: true, render: row => `研究者 ${row.researcher_count} 名` },
        { key: 'fields', render: row => row.fields ?? '—' }
      ]}
    />
  );
}
