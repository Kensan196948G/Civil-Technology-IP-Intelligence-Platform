import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const SOURCE_LABEL: Record<string, string> = { technology: '自社技術台帳', netis: 'NETIS登録技術' };

type Row = { id: string; source: string; field: string; n: number };
type RawRow = { source: string; field: string; n: number };

export default async function LandscapeByFieldPage() {
  const db = getDb(getDatabaseUrl());
  // 「技術分野」は自社技術台帳の kind（technology/method/material/machine）と
  // NETIS登録技術の category を横断集計して比較する。
  const res = await db.execute(sql`
    select 'technology' as source, kind as field, count(*)::int as n
    from technologies
    group by kind
    union all
    select 'netis' as source, coalesce(category, '未分類') as field, count(*)::int as n
    from netis_technologies
    group by category
    order by n desc, source asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map((r, i) => ({
    id: `${r.source}:${r.field}:${i}`, source: r.source, field: r.field, n: r.n
  }));

  return (
    <ListView
      title="技術分野比較"
      moduleCode="S-09 / LANDSCAPE — BY TECH FIELD"
      description="自社技術台帳（kind別）とNETIS登録技術（category別）の技術分野を横断比較します。"
      rows={rows}
      emptyMessage="集計対象の技術データがまだありません。"
      fields={[
        { key: 'source', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{SOURCE_LABEL[row.source] ?? row.source}</span>
        ) },
        { key: 'field', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.field}</span> },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
