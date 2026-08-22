import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = {
  patent: '特許ウォッチ', competitor: '競合企業ウォッチ', technology: '技術分野ウォッチ',
  ipc: 'IPC / CPCウォッチ', researcher: '発明者ウォッチ', paper: '論文ウォッチ', netis: 'NETISウォッチ'
};

export default async function WatchPage({ searchParams }: { searchParams: { kind?: string } }) {
  const db = getDb(getDatabaseUrl());
  const kind = searchParams.kind;
  const all = await db.select().from(s.watches).orderBy(desc(s.watches.createdAt));
  const rows = kind ? all.filter(w => w.kind === kind) : all;

  const ownerIds = [...new Set(rows.map(r => r.ownerId))];
  const owners = ownerIds.length ? await db.select().from(s.users).where(inArray(s.users.id, ownerIds)) : [];
  const ownerById = new Map(owners.map(o => [o.id, o]));

  return (
    <ListView
      title={kind ? `ウォッチ — ${KIND_LABEL[kind] ?? kind}` : 'マイウォッチ'}
      moduleCode="S-13 / WATCH & MONITORING"
      description="特許・競合企業・技術分野・IPC/CPC・発明者・論文・NETISなど、継続的に監視対象として登録した項目の一覧です。"
      rows={rows}
      emptyMessage="該当するウォッチ登録はまだありません。"
      fields={[
        { key: 'label', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.label}</span> },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'owner', render: row => ownerById.get(row.ownerId)?.displayName ?? '—' },
        { key: 'createdAt', mono: true, render: row => String(row.createdAt).slice(0, 10) }
      ]}
    />
  );
}
