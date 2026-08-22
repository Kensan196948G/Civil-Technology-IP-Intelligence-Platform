import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const STATUS_LABEL: Record<string, string> = { open: '調査中', closed: '完了' };

export default async function InvestigationsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt));

  const creatorIds = [...new Set(rows.map(r => r.createdBy))];
  const creators = creatorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, creatorIds)) : [];
  const creatorById = new Map(creators.map(u => [u.id, u]));

  return (
    <ListView
      title="過去調査"
      moduleCode="S-04 / PRIOR ART INVESTIGATION"
      description="登録済みの先行技術調査案件の一覧です。"
      rows={rows}
      emptyMessage="調査案件はまだありません。「新規調査」から登録してください。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'query', mono: true, render: row => row.query },
        { key: 'creator', render: row => creatorById.get(row.createdBy)?.displayName ?? '—' },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status === 'open' ? 'var(--blue)' : 'var(--green)', border: `1px solid ${row.status === 'open' ? 'var(--blue)' : 'var(--green)'}` }}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) }
      ]}
    />
  );
}
