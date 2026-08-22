import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; cluster: string; n: number; companies: number };
type RawRow = { cluster: string; n: number; companies: number };

export default async function LandscapeWhitespacePage() {
  const db = getDb(getDatabaseUrl());
  // 技術クラスタ（IPC上位3桁）のうち、出願企業数が1社以下の疎な領域を
  // ホワイトスペース候補（競合の参入が薄い領域）として抽出する。
  const res = await db.execute(sql`
    select left(ipc, 3) as cluster, count(*)::int as n, count(distinct applicant_name)::int as companies
    from patents, unnest(ipc_codes) as ipc
    group by cluster
    having count(distinct applicant_name) <= 1
    order by n asc, cluster asc
  `);
  const rows: Row[] = (res.rows as unknown as RawRow[]).map(r => ({
    id: r.cluster, cluster: r.cluster, n: r.n, companies: r.companies
  }));

  return (
    <ListView
      title="ホワイトスペース候補"
      moduleCode="S-09 / LANDSCAPE — WHITESPACE"
      description="技術クラスタ（IPC上位3桁）のうち、出願企業数が1社以下の疎な領域をホワイトスペース候補として抽出します。"
      rows={rows}
      emptyMessage="現在のデータでは、参入企業数が1社以下のホワイトスペース候補クラスタは見つかりませんでした。"
      fields={[
        { key: 'cluster', mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.cluster}</span> },
        { key: 'companies', grow: true, render: row => `参入 ${row.companies} 社` },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
