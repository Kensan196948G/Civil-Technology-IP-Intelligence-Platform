'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
import { getDatabaseUrl } from '@/lib/env';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

export async function submitSiteIssue(formData: FormData) {
  const siteId = String(formData.get('siteId'));
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  const me = await requireCurrentDbUser(db);

  const issueId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  // 業務データ作成と監査ログ記録を原子的に行う
  const sql = getRawSql(dbUrl);
  await sql.transaction((txn) => [
    txn`insert into site_issues (id, site_id, body, photos, status, created_by)
        values (${issueId}, ${siteId}, ${body}, '{}', 'open', ${me.id})`,
    txn`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
        values (${auditId}, ${me.id}, 'create', 'site_issue', ${issueId}, 'success', '{}'::jsonb)`
  ]);

  revalidatePath(`/sites/${siteId}/issue`);
}
