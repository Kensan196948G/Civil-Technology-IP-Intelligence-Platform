import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type IpcRow = { id: string; ipc: string; n: number; firstSeen: string | null; lastSeen: string | null };
type RawRow = { ipc: string; n: number; first_seen: string | null; last_seen: string | null };

export default async function IpcMasterPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select
      ipc,
      count(*)::int as n,
      min(application_date) as first_seen,
      max(publication_date) as last_seen
    from patents, unnest(ipc_codes) as ipc
    group by ipc
    order by ipc asc
  `);
  const rows: IpcRow[] = (result.rows as unknown as RawRow[]).map(r => ({
    id: r.ipc, ipc: r.ipc, n: Number(r.n), firstSeen: r.first_seen, lastSeen: r.last_seen
  }));

  return (
    <ListView
      title="IPC / CPCマスタ"
      moduleCode="S-18c / IPC-CPC MASTER"
      description="取り込み済み特許から抽出したIPC分類コードの正規マスタです。分類コードの表記ゆれ確認・付与件数の把握に使用します（MVPではCPCコードは未取り込みのためIPCのみ）。"
      badge="MVP"
      rows={rows}
      emptyMessage="IPCマスタのデータがまだありません。"
      fields={[
        { key: 'ipc', mono: true, grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.ipc}</span> },
        { key: 'firstSeen', mono: true, render: row => row.firstSeen ?? '—' },
        { key: 'lastSeen', mono: true, render: row => row.lastSeen ?? '—' },
        { key: 'n', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.n}件</span> }
      ]}
    />
  );
}
