import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; cluster: string; n: number; companies: number };
type RawRow = { cluster: string; n: number; companies: number };

export default async function LandscapeClustersPage() {
  const db = getDb(getDatabaseUrl());
  // IPCコードの上位3桁（セクション+クラス、例: E02, B63）で技術クラスタを形成する。
  const res = await db.execute(sql`
    select left(ipc, 3) as cluster, count(*)::int as n, count(distinct applicant_name)::int as companies
    from patents, unnest(ipc_codes) as ipc
    group by cluster
    order by n desc, cluster asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.cluster, cluster: r.cluster, n: r.n, companies: r.companies
  }));

  return (
    <ListView
      title="技術クラスタ"
      moduleCode="S-09 / LANDSCAPE — TECH CLUSTERS"
      description="特許のIPCコード上位3桁（セクション＋クラス）で技術クラスタを形成し、出願集中度を集計します。"
      rows={rows}
      emptyMessage="クラスタを形成できるIPCコード付き特許がまだありません。"
      fields={[
        { key: 'cluster', mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.cluster}</span> },
        { key: 'companies', grow: true, render: row => `${row.companies} 社が参入`
        },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
