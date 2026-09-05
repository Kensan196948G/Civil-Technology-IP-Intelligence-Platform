import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { WORKFLOW_KIND_LABEL, WORKFLOW_STATUS_LABEL } from '@/lib/legal-workflow-labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

export default async function LegalRequestsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.workflowInstances)
    .where(and(
      eq(s.workflowInstances.status, 'legal_review'),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    ))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="法務審査依頼"
      moduleCode="S-12 / LEGAL REVIEW REQUESTS"
      description="workflow_instances のうち、現在ステータスが「法務レビュー中（legal_review）」の案件です。法務担当への審査依頼として一覧化しています。"
      rows={rows}
      emptyMessage="現在、法務審査待ちの案件はありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{WORKFLOW_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'author', render: row => `起案 ${authorById.get(row.authorId)?.displayName ?? '—'}` },
        { key: 'due', mono: true, render: row => `期限 ${row.dueOn ?? '—'}` },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{WORKFLOW_STATUS_LABEL[row.status] ?? row.status}</span>
        ) }
      ]}
    />
  );
}
