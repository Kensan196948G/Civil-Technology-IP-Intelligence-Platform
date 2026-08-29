export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { stampSec } from '@/lib/labels';


const KIND_LABEL: Record<string, string> = { patent: '特許', paper: '論文', netis: 'NETIS' };

type SourceRow = { id: string; kind: string; source: string; n: number; latest: string | null };
type RawRow = { kind: string; source: string; n: number; latest: string | null };

export default async function DataSourcesPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select 'patent' as kind, source, count(*)::int as n, max(retrieved_at) as latest
    from patents group by source
    union all
    select 'paper' as kind, source, count(*)::int as n, max(retrieved_at) as latest
    from papers group by source
    union all
    select 'netis' as kind, source, count(*)::int as n, max(retrieved_at) as latest
    from netis_technologies group by source
    order by kind, n desc
  `);
  const rows: SourceRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: `${r.kind}-${r.source}`, kind: r.kind, source: r.source, n: Number(r.n), latest: r.latest
  }));

  return (
    <ListView
      title="データソース"
      moduleCode="S-18a / DATA SOURCES"
      description="特許・論文・NETIS技術データを取り込んでいる情報源（source列）と、取り込み件数・最終取得日時の一覧です。外部データ連携基盤の管理台帳として使用します。"
      badge="MVP"
      rows={rows}
      emptyMessage="データソースの取り込み実績がまだありません。"
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'source', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.source}</span> },
        { key: 'latest', mono: true, render: row => stampSec(row.latest) },
        { key: 'n', render: row => <span className="mono">{row.n} 件</span> }
      ]}
    />
  );
}
