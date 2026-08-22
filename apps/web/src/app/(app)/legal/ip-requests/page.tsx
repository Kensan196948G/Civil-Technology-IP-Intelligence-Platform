import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { WORKFLOW_KIND_LABEL, WORKFLOW_STATUS_LABEL } from '@/lib/legal-workflow-labels';

export const runtime = 'edge';

export default async function LegalIpRequestsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(eq(s.workflowInstances.status, 'ip_review'))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="知財審査依頼"
      moduleCode="S-12 / IP REVIEW REQUESTS"
      description="workflow_instances のうち、現在ステータスが「知財レビュー中（ip_review）」の案件です。知財担当への審査依頼として一覧化しています。"
      rows={rows}
      emptyMessage="現在、知財審査待ちの案件はありません。"
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
