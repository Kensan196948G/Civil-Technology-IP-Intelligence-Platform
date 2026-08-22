'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

const NEXT_STATUS: Record<string, string> = {
  draft: 'researching', researching: 'ai_reviewed', ai_reviewed: 'technical_review',
  technical_review: 'ip_review', ip_review: 'legal_review', legal_review: 'approved'
};

export async function decideAction(formData: FormData) {
  const instanceId = String(formData.get('instanceId'));
  const decision = String(formData.get('decision')) as 'approved' | 'rejected' | 'hold';
  const approverEmail = String(formData.get('approverEmail'));
  const comment = String(formData.get('comment') ?? '');

  const db = getDb(getDatabaseUrl());
  const [approver] = await db.select().from(s.users).where(eq(s.users.email, approverEmail)).limit(1);
  const [instance] = await db.select().from(s.workflowInstances).where(eq(s.workflowInstances.id, instanceId)).limit(1);
  if (!instance || !approver) return;

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
  const userEmail = String(formData.get('userEmail'));
  const db = getDb(getDatabaseUrl());
  const [user] = await db.select().from(s.users).where(eq(s.users.email, userEmail)).limit(1);
  await db.update(s.workflowInstances).set({ humanCheckCompletedAt: new Date() }).where(eq(s.workflowInstances.id, instanceId));
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: user?.id, action: 'update', targetType: 'workflow_instance',
    targetId: instanceId, result: 'success', meta: { field: 'human_check_completed' }
  });
  revalidatePath(`/approvals/${instanceId}`);
}
