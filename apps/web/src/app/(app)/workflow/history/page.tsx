import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const DECISION_LABEL: Record<string, string> = { approved: '承認', rejected: '差戻し', hold: '保留' };

export default async function WorkflowHistoryPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.approvals).orderBy(desc(s.approvals.decidedAt));

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
      title="承認履歴"
      moduleCode="S-17 / WORKFLOW HISTORY"
      description="すべての承認判断（承認・差戻し・保留）の履歴です。"
      rows={rows}
      emptyMessage="承認履歴はまだありません。"
      rowHref={row => {
        const inst = instanceById.get(row.instanceId);
        return inst ? `/approvals/${inst.id}` : '/approvals';
      }}
      fields={[
        { key: 'decidedAt', mono: true, render: row => String(row.decidedAt).slice(0, 16).replace('T', ' ') },
        { key: 'title', grow: true, render: row => instanceById.get(row.instanceId)?.title ?? '—' },
        { key: 'approver', render: row => approverById.get(row.approverId)?.displayName ?? '—' },
        { key: 'decision', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{DECISION_LABEL[row.decision] ?? row.decision}</span>
        ) }
      ]}
    />
  );
}
