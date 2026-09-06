'use server';
// #11 C4 個別付与（grant）モデル: docs/10-requirements/05-rbac-matrix.md §4 の
// C4「個別付与された利用者のみ」の運用画面。付与操作は sysadmin のみに限定する
// （middleware.ts は /admin/* を executive/sysadmin に許可しているため、
//  ここでは executive による誤操作を防ぐため sysadmin であることを追加で検証する）。
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit } from '@/lib/audit/log';

const PATH = '/admin/project-permissions';

/**
 * 案件（workflow_instances 行）への個別アクセス権付与。
 * 発明届（kind='invention'）の場合は、その起点となる inventions 行（subject_id）にも
 * 同時に grant する（inventions 一覧・詳細と workflow 詳細の両方で一貫して可視にするため。
 * lib/authz/row-visibility.ts の grant 条件は target_type/target_id の完全一致で判定する）。
 */
export async function grantAccessAction(formData: FormData): Promise<void> {
  const db = getDb(getDatabaseUrl());
  const granter = await requireCurrentDbUser(db);

  const instanceId = String(formData.get('instanceId') ?? '').trim();
  const userEmail = String(formData.get('userEmail') ?? '').trim().toLowerCase();
  const note = String(formData.get('note') ?? '').trim() || null;

  if (granter.role !== 'sysadmin') {
    await logAudit(db, {
      actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
      targetId: instanceId || null, result: 'denied', reason: 'role_not_allowed',
      meta: { role: granter.role }
    });
    revalidatePath(PATH);
    return;
  }

  if (!instanceId || !userEmail) {
    await logAudit(db, {
      actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
      targetId: instanceId || null, result: 'denied', reason: 'invalid_input'
    });
    revalidatePath(PATH);
    return;
  }

  const [instance] = await db.select().from(s.workflowInstances)
    .where(eq(s.workflowInstances.id, instanceId)).limit(1);
  if (!instance) {
    await logAudit(db, {
      actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
      targetId: instanceId, result: 'denied', reason: 'target_not_found'
    });
    revalidatePath(PATH);
    return;
  }

  const [targetUser] = await db.select().from(s.users).where(eq(s.users.email, userEmail)).limit(1);
  if (!targetUser) {
    await logAudit(db, {
      actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
      targetId: instanceId, result: 'denied', reason: 'user_not_found', meta: { userEmail }
    });
    revalidatePath(PATH);
    return;
  }

  const grants: { id: string; targetType: string; targetId: string; userId: string; grantedBy: string; note: string | null }[] = [
    { id: crypto.randomUUID(), targetType: 'workflow_instance', targetId: instance.id, userId: targetUser.id, grantedBy: granter.id, note }
  ];
  // 発明届 workflow は起点の inventions 行にも同一利用者へ grant する（一覧/詳細の両方を一貫させる）。
  if (instance.subjectType === 'invention') {
    grants.push({ id: crypto.randomUUID(), targetType: 'invention', targetId: instance.subjectId, userId: targetUser.id, grantedBy: granter.id, note });
  }

  try {
    for (const g of grants) {
      // UNIQUE(target_type, target_id, user_id) により重複付与はスキップする（エラーにしない）。
      await db.insert(s.accessGrants).values(g).onConflictDoNothing();
    }
  } catch (err) {
    console.error('[project-permissions] grant insert failed', err);
    await logAudit(db, {
      actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
      targetId: instanceId, result: 'failure', reason: 'insert_failed'
    });
    revalidatePath(PATH);
    return;
  }

  await logAudit(db, {
    actorUserId: granter.id, action: 'grant_access', targetType: 'workflow_instance',
    targetId: instanceId, result: 'success',
    meta: { grantedUserId: targetUser.id, grantedUserEmail: userEmail, targets: grants.map(g => ({ targetType: g.targetType, targetId: g.targetId })) }
  });

  revalidatePath(PATH);
}

/** 個別付与の取り消し（sysadmin のみ）。 */
export async function revokeAccessAction(formData: FormData): Promise<void> {
  const db = getDb(getDatabaseUrl());
  const granter = await requireCurrentDbUser(db);
  const grantId = String(formData.get('grantId') ?? '').trim();

  if (granter.role !== 'sysadmin') {
    await logAudit(db, {
      actorUserId: granter.id, action: 'revoke_access', targetType: 'access_grant',
      targetId: grantId || null, result: 'denied', reason: 'role_not_allowed', meta: { role: granter.role }
    });
    revalidatePath(PATH);
    return;
  }
  if (!grantId) {
    revalidatePath(PATH);
    return;
  }

  const [grant] = await db.select().from(s.accessGrants).where(eq(s.accessGrants.id, grantId)).limit(1);
  if (!grant) {
    revalidatePath(PATH);
    return;
  }

  await db.delete(s.accessGrants).where(and(eq(s.accessGrants.id, grantId)));
  await logAudit(db, {
    actorUserId: granter.id, action: 'revoke_access', targetType: grant.targetType,
    targetId: grant.targetId, result: 'success', meta: { revokedUserId: grant.userId }
  });

  revalidatePath(PATH);
}
