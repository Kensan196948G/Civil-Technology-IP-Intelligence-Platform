'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

const NEXT_STATUS: Record<string, string> = {
  draft: 'researching', researching: 'ai_reviewed', ai_reviewed: 'technical_review',
  technical_review: 'ip_review', ip_review: 'legal_review', legal_review: 'approved'
};

export async function decideAction(formData: FormData) {
  const instanceId = String(formData.get('instanceId'));
  const decision = String(formData.get('decision')) as 'approved' | 'rejected' | 'hold';
  const comment = String(formData.get('comment') ?? '');

  const db = getDb(getDatabaseUrl());
  // 承認者は認証Cookieから解決する。フォームの approverEmail は使わない
  // （CodeRabbit指摘: クライアントが承認者を偽装できてしまう脆弱性への対応）
  const approver = await requireCurrentDbUser(db);

  const [instance] = await db.select().from(s.workflowInstances).where(eq(s.workflowInstances.id, instanceId)).limit(1);
  if (!instance) return;

  // 自己承認の禁止
  if (instance.authorId === approver.id) {
    await db.insert(s.auditLogs).values({
      id: crypto.randomUUID(), actorUserId: approver.id, action: 'approve', targetType: 'workflow_instance',
      targetId: instanceId, result: 'denied', reason: 'self_approval_forbidden', meta: {}
    });
    revalidatePath(`/approvals/${instanceId}`);
    return;
  }
  // 人間確認事項が未完了なら承認不可（差戻し・保留は可）
  if (decision === 'approved' && instance.humanCheckRequired && !instance.humanCheckCompletedAt) {
    await db.insert(s.auditLogs).values({
      id: crypto.randomUUID(), actorUserId: approver.id, action: 'approve', targetType: 'workflow_instance',
      targetId: instanceId, result: 'denied', reason: 'human_check_incomplete', meta: {}
    });
    revalidatePath(`/approvals/${instanceId}`);
    return;
  }

  await db.insert(s.approvals).values({ id: crypto.randomUUID(), instanceId, approverId: approver.id, decision, comment });

  let newStatus = instance.status;
  if (decision === 'approved') newStatus = (NEXT_STATUS[instance.status] ?? instance.status) as any;
  if (decision === 'rejected') newStatus = 'rejected' as any;
  if (decision === 'hold') newStatus = 'hold' as any;
  await db.update(s.workflowInstances).set({ status: newStatus as any }).where(eq(s.workflowInstances.id, instanceId));

  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: approver.id, action: 'approve', targetType: 'workflow_instance',
    targetId: instanceId, result: 'success', meta: { decision, newStatus }
  });
  revalidatePath(`/approvals/${instanceId}`);
  revalidatePath('/approvals');
}

export async function completeHumanCheck(formData: FormData) {
  const instanceId = String(formData.get('instanceId'));
  const db = getDb(getDatabaseUrl());
  const me = await requireCurrentDbUser(db);
  await db.update(s.workflowInstances).set({ humanCheckCompletedAt: new Date() }).where(eq(s.workflowInstances.id, instanceId));
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: me.id, action: 'update', targetType: 'workflow_instance',
    targetId: instanceId, result: 'success', meta: { field: 'human_check_completed' }
  });
  revalidatePath(`/approvals/${instanceId}`);
}
