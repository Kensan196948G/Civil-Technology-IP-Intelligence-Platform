'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
import { getDatabaseUrl } from '@/lib/env';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

// 先行技術調査の新規案件登録。
// 業務データ（investigations）と監査ログ（audit_logs）を原子的に書き込む
// （approvals/actions.ts, sites/actions.ts と同じパターン）。
export async function createInvestigation(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const query = String(formData.get('query') ?? '').trim();
  if (!title || !query) return;

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 登録者は認証Cookieから解決する（クライアント送信値は信用しない）
  const me = await requireCurrentDbUser(db);

  const investigationId = crypto.randomUUID();
  const auditId = crypto.randomUUID();

  const sql = getRawSql(dbUrl);
  await sql.transaction((txn) => [
    txn`insert into investigations (id, title, query, status, created_by)
        values (${investigationId}, ${title}, ${query}, 'open', ${me.id})`,
    txn`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
        values (${auditId}, ${me.id}, 'create', 'investigation', ${investigationId}, 'success', '{}'::jsonb)`
  ]);

  revalidatePath('/investigations/new');
  revalidatePath('/investigations');
  revalidatePath('/investigations/queries');
}
