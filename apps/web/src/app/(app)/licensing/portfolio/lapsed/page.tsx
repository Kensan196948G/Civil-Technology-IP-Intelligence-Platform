import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const STATUS_LABEL: Record<string, string> = { rejected: '却下', archived: '放棄（アーカイブ）' };

export default async function PortfolioLapsedPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(and(eq(s.workflowInstances.kind, 'invention'), inArray(s.workflowInstances.status, ['rejected', 'archived'])))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="失効・放棄"
      moduleCode="S-11m / LICENSING & IP PORTFOLIO"
      description="自社IP資産ポートフォリオのうち、審査で却下、またはその後アーカイブ（放棄）となった案件です。"
      badge="MVP"
      rows={rows}
      emptyMessage="失効・放棄となった案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'author', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案：{authorById.get(row.authorId)?.displayName ?? '—'}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>{STATUS_LABEL[row.status] ?? row.status}</span>
        ) }
      ]}
    />
  );
}
