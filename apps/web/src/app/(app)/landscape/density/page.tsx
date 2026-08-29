import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type Row = { id: string; ipcCode: string; n: number; densityPct: number };
type RawRow = { ipc_code: string; n: number };

export default async function LandscapeDensityPage() {
  const db = getDb(getDatabaseUrl());
  const res = await db.execute(sql`
    select ipc as ipc_code, count(*)::int as n
    from patents, unnest(ipc_codes) as ipc
    group by ipc
    order by n desc, ipc asc
  `);
  const raw = res.rows as unknown as RawRow[];
  const total = raw.reduce((acc, r) => acc + r.n, 0);
  const rows: Row[] = raw.map(r => ({
    id: r.ipc_code, ipcCode: r.ipc_code, n: r.n, densityPct: total > 0 ? Math.round((r.n / total) * 1000) / 10 : 0
  }));

  return (
    <ListView
      title="特許密度"
      moduleCode="S-09 / LANDSCAPE — PATENT DENSITY"
      description="IPCコード（完全一致）単位での出願件数と、全体に占める割合（密度）です。"
      rows={rows}
      emptyMessage="集計対象のIPCコード付き特許がまだありません。"
      fields={[
        { key: 'ipcCode', grow: true, mono: true, render: row => <span style={{ fontWeight: 700 }}>{row.ipcCode}</span> },
        { key: 'densityPct', mono: true, render: row => `${row.densityPct}%` },
        { key: 'n', mono: true, render: row => `${row.n} 件` }
      ]}
    />
  );
}
