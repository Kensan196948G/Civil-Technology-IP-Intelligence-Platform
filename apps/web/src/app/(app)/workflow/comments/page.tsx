export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, isNotNull, inArray, and, ne } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function WorkflowCommentsPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.approvals)
    .where(and(isNotNull(s.approvals.comment), ne(s.approvals.comment, '')))
    .orderBy(desc(s.approvals.decidedAt));

  const instanceIds = [...new Set(rows.map(r => r.instanceId))];
  const approverIds = [...new Set(rows.map(r => r.approverId))];
  const [instances, approvers] = await Promise.all([
    instanceIds.length ? db.select().from(s.workflowInstances).where(inArray(s.workflowInstances.id, instanceIds)) : Promise.resolve([]),
    approverIds.length ? db.select().from(s.users).where(inArray(s.users.id, approverIds)) : Promise.resolve([])
  ]);
  const instanceById = new Map(instances.map(i => [i.id, i]));
  const approverById = new Map(approvers.map(a => [a.id, a]));

  return (
    <ListView
      title="コメント"
      moduleCode="S-17 / WORKFLOW COMMENTS"
      description="承認・差戻し時に記録されたコメントの一覧です。"
      rows={rows}
      emptyMessage="コメント付きの承認履歴はまだありません。"
      rowHref={row => {
        const inst = instanceById.get(row.instanceId);
        return inst ? `/approvals/${inst.id}` : '/approvals';
      }}
      fields={[
        { key: 'title', grow: true, render: row => instanceById.get(row.instanceId)?.title ?? '—' },
        { key: 'author', render: row => approverById.get(row.approverId)?.displayName ?? '—' },
        { key: 'comment', render: row => row.comment }
      ]}
    />
  );
}
