import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and, desc, notInArray, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const STATUS_LABEL: Record<string, string> = {
  draft: '起案', researching: '調査中', ai_reviewed: 'AI一次レビュー済み',
  technical_review: '技術審査中', ip_review: '知財審査中', legal_review: '法務審査中', hold: '保留'
};

export default async function PortfolioPendingPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(and(
      eq(s.workflowInstances.kind, 'invention'),
      notInArray(s.workflowInstances.status, ['approved', 'rejected', 'archived'])
    ))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="審査中特許"
      moduleCode="S-11k / LICENSING & IP PORTFOLIO"
      description="自社IP資産ポートフォリオのうち、まだ登録（承認）にも却下・放棄にも至っていない、審査プロセス進行中の案件です。"
      badge="MVP"
      rows={rows}
      emptyMessage="審査中の案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'author', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案：{authorById.get(row.authorId)?.displayName ?? '—'}</span> },
        { key: 'dueOn', mono: true, render: row => row.dueOn ?? '—' },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{STATUS_LABEL[row.status] ?? row.status}</span>
        ) }
      ]}
    />
  );
}
