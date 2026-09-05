import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, isNotNull, inArray, and, ne } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 承認履歴（コメント）も、対象の workflow（C3）が閲覧できない場合は
// 表示しない（履歴から C3 案件の存在を推測させない）。

export default async function WorkflowCommentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const rowsAll = await db.select().from(s.approvals)
    .where(and(isNotNull(s.approvals.comment), ne(s.approvals.comment, '')))
    .orderBy(desc(s.approvals.decidedAt));

  const instanceIds = [...new Set(rowsAll.map(r => r.instanceId))];
  const approverIds = [...new Set(rowsAll.map(r => r.approverId))];
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const [instances, approvers] = await Promise.all([
    instanceIds.length
      ? db.select().from(s.workflowInstances).where(and(
          inArray(s.workflowInstances.id, instanceIds),
          visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
        ))
      : Promise.resolve([]),
    approverIds.length ? db.select().from(s.users).where(inArray(s.users.id, approverIds)) : Promise.resolve([])
  ]);
  const instanceById = new Map(instances.map(i => [i.id, i]));
  const approverById = new Map(approvers.map(a => [a.id, a]));
  // 閲覧できない workflow に属する承認履歴は行ごと除外する（存在を出さない）
  const rows = rowsAll.filter(r => instanceById.has(r.instanceId));

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
