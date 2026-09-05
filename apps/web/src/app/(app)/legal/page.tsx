import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { WORKFLOW_KIND_LABEL, WORKFLOW_STATUS_LABEL } from '@/lib/legal-workflow-labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

const STATUS_COLOR: Record<string, string> = {
  approved: 'var(--green)',
  rejected: 'var(--brick)',
  hold: 'var(--brick)',
  legal_review: 'var(--amber)',
  ip_review: 'var(--amber)',
  technical_review: 'var(--amber)'
};

// ナビゲーションの「審査案件一覧」と「法務レビュー結果」はどちらも
// クエリ文字列を持たず同一パス（/legal）を指すため、1画面で両方の意図を兼ねる。
export default async function LegalPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.workflowInstances)
    .where(visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id }))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="審査案件一覧（法務レビュー結果）"
      moduleCode="S-12 / LEGAL & IP CASE REGISTER"
      description="発明届・現場導入等のワークフロー案件を、技術・知財・法務レビューを含む全ステータス横断で一覧表示します。"
      rows={rows}
      emptyMessage="審査案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{WORKFLOW_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'author', render: row => `起案 ${authorById.get(row.authorId)?.displayName ?? '—'}` },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'status', render: row => {
          const color = STATUS_COLOR[row.status] ?? 'var(--ink-2)';
          return <span className="badge" style={{ color, border: `1px solid ${color}` }}>{WORKFLOW_STATUS_LABEL[row.status] ?? row.status}</span>;
        } }
      ]}
    />
  );
}
