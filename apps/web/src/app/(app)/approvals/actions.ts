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
  technical_review: 'ip_review', ip_review: 'legal_review', legal_review: 'approved',
  // CodeRabbit指摘: hold は元の段階を記録していないため、hold からの承認が
  // NEXT_STATUS[instance.status] 未定義により何も進まず"詰む"バグがあった。
  // MVPでは復帰先を technical_review に固定する（どの段階からの保留でも
  // 技術レビューからやり直す、という単純化）。本番実装では held_from_status
  // のような列を追加し、実際に保留した段階へ戻すことをバックログとする。
  hold: 'technical_review'
};

// CodeRabbit指摘: rejected/approved は終端状態であり、そこからの遷移規則が
// 定義されていなかった（hold からの再承認も進めなくなる不具合があった）。
const TERMINAL_STATUSES = new Set(['approved', 'rejected']);
const ALLOWED_DECISIONS = new Set(['approved', 'rejected', 'hold']);

export async function decideAction(formData: FormData) {
  const instanceId = String(formData.get('instanceId'));
  const decisionRaw = String(formData.get('decision'));
  const comment = String(formData.get('comment') ?? '');

  // CodeRabbit指摘: 型キャストのみでは実行時の任意値（'xyz'等）が
  // approvals.decision へそのまま保存され、承認履歴が汚染されうる。
  if (!ALLOWED_DECISIONS.has(decisionRaw)) return;
  const decision = decisionRaw as 'approved' | 'rejected' | 'hold';

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
  // 終端状態（承認済み／却下済み）からは遷移しない
  if (TERMINAL_STATUSES.has(instance.status)) {
    await db.insert(s.auditLogs).values({
      id: crypto.randomUUID(), actorUserId: approver.id, action: 'approve', targetType: 'workflow_instance',
      targetId: instanceId, result: 'denied', reason: 'already_terminal', meta: { status: instance.status }
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
  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);

  const auditId = crypto.randomUUID();
  const rawSql = getRawSql(dbUrl);
  await rawSql.transaction([
    rawSql`update workflow_instances set human_check_completed_at = now() where id = ${instanceId}`,
    rawSql`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
            values (${auditId}, ${me.id}, 'update', 'workflow_instance', ${instanceId}, 'success', '{"field":"human_check_completed"}'::jsonb)`
  ]);

  revalidatePath(`/approvals/${instanceId}`);
}
