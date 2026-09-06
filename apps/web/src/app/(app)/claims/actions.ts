'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
import { getDatabaseUrl } from '@/lib/env';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { auditLogTxnStatement } from '@/lib/audit/log';

export async function updateRowKind(formData: FormData) {
  const rowId = String(formData.get('rowId'));
  const analysisId = String(formData.get('analysisId'));
  const kind = String(formData.get('kind')) as 'match' | 'similar' | 'differ';

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 利用者は認証Cookieから解決する（フォームの値は信用しない）
  const me = await requireCurrentDbUser(db);

  // 業務データ更新と監査ログ記録を原子的に行う（片方だけ成功する状態を防ぐ）
  const sql = getRawSql(dbUrl);
  await sql.transaction((txn) => [
    txn`update claim_chart_rows set kind = ${kind}, edited_by = ${me.id}, edited_at = now() where id = ${rowId}`,
    auditLogTxnStatement(txn, {
      actorUserId: me.id, action: 'update', targetType: 'claim_chart_row',
      targetId: rowId, result: 'success', meta: { kind }
    })
  ]);

  revalidatePath(`/claims/${analysisId}`);
}
