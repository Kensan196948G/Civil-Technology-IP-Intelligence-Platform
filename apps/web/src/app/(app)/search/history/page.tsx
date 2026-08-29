import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';


const STATUS_LABEL: Record<string, string> = { open: '調査中', closed: '完了' };

export default async function SearchHistoryPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt));

  const userIds = [...new Set(rows.map(r => r.createdBy))];
  const users = userIds.length ? await db.select().from(s.users).where(inArray(s.users.id, userIds)) : [];
  const userById = new Map(users.map(u => [u.id, u]));

  return (
    <ListView
      title="検索履歴・保存検索"
      moduleCode="S-02 / SEARCH HISTORY"
      description="保存された調査クエリ（先行技術調査案件）の一覧です。検索条件と実行者を確認できます。"
      rows={rows}
      emptyMessage="保存された検索履歴はまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'query', mono: true, render: row => row.query },
        { key: 'status', render: row => (
          <span className="badge" style={{
            color: row.status === 'open' ? 'var(--blue)' : 'var(--green)',
            border: `1px solid ${row.status === 'open' ? 'var(--blue)' : 'var(--green)'}`
          }}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) },
        { key: 'createdBy', render: row => userById.get(row.createdBy)?.displayName ?? '—' },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}
