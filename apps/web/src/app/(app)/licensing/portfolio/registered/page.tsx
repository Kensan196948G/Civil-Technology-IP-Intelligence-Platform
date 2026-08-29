export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function PortfolioRegisteredPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(and(eq(s.workflowInstances.kind, 'invention'), eq(s.workflowInstances.status, 'approved')))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="登録特許"
      moduleCode="S-11l / LICENSING & IP PORTFOLIO"
      description="自社IP資産ポートフォリオのうち、審査ワークフローで承認（登録）済みの案件です。"
      badge="MVP"
      rows={rows}
      emptyMessage="登録済みの案件はまだありません。すべての案件は審査プロセス中です。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'author', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案：{authorById.get(row.authorId)?.displayName ?? '—'}</span> },
        { key: 'status', render: () => (
          <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>登録</span>
        ) }
      ]}
    />
  );
}
