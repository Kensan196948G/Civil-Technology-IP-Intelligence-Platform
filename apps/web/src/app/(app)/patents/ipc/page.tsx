export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type IpcRow = { id: string; ipc: string; n: number; applicants: string[] };

export default async function PatentIpcPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      ipc,
      count(*)::int as n,
      array_agg(distinct applicant_name order by applicant_name) as applicants
    from patents, unnest(ipc_codes) as ipc
    group by ipc
    order by n desc, ipc asc
  `);
  const rows: IpcRow[] = (result.rows as any[]).map(r => ({
    id: r.ipc,
    ipc: r.ipc,
    n: Number(r.n),
    applicants: r.applicants as string[]
  }));

  return (
    <ListView
      title="IPC / CPC分析"
      moduleCode="S-03 / IPC-CPC ANALYSIS"
      description="取り込み済み特許のIPC分類コードを集計した一覧です。件数が多い順に表示します（MVPではCPCコードは未取り込みのためIPCのみ）。"
      badge="MVP"
      rows={rows}
      emptyMessage="IPC分類データがまだありません。"
      fields={[
        { key: 'ipc', mono: true, grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.ipc}</span> },
        { key: 'applicants', render: row => row.applicants.join('、') },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n}件</span> }
      ]}
    />
  );
}
