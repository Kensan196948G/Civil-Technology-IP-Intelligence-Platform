'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
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

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
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

  let newStatus: string = instance.status;
  if (decision === 'approved') newStatus = NEXT_STATUS[instance.status] ?? instance.status;
  if (decision === 'rejected') newStatus = 'rejected';
  if (decision === 'hold') newStatus = 'hold';

  const approvalId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  // CodeRabbit指摘: 承認記録・状態更新・監査ログの3書き込みが個別クエリだと、
  // 途中で失敗した場合に不整合な状態が残る。原子的トランザクションにまとめる。
  // 制約: neon-http は行ロック(FOR UPDATE)を伴う対話型トランザクションを提供しないため、
  // 「全部成功/全部失敗」は保証するが、同時承認の競合防止（真の排他制御）はカバーしない。
  // 真の同時実行安全性は本番実装のバックログとする（lib/db/raw.ts 参照）。
  const sql = getRawSql(dbUrl);
  await sql.transaction([
    sql`insert into approvals (id, instance_id, approver_id, decision, comment)
        values (${approvalId}, ${instanceId}, ${approver.id}, ${decision}, ${comment})`,
    sql`update workflow_instances set status = ${newStatus} where id = ${instanceId}`,
    sql`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
        values (${auditId}, ${approver.id}, 'approve', 'workflow_instance', ${instanceId}, 'success',
                ${JSON.stringify({ decision, newStatus })}::jsonb)`
  ]);

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
