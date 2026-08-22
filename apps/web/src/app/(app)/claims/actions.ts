'use server';
import { getDb } from '@/lib/db/client';
import { getRawSql } from '@/lib/db/raw';
import { getDatabaseUrl } from '@/lib/env';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

export async function updateRowKind(formData: FormData) {
  const rowId = String(formData.get('rowId'));
  const analysisId = String(formData.get('analysisId'));
  const kind = String(formData.get('kind')) as 'match' | 'similar' | 'differ';

  const dbUrl = getDatabaseUrl();
  const db = getDb(dbUrl);
  // 利用者は認証Cookieから解決する（フォームの値は信用しない）
  const me = await requireCurrentDbUser(db);
  const auditId = crypto.randomUUID();

  // 業務データ更新と監査ログ記録を原子的に行う（片方だけ成功する状態を防ぐ）
  const sql = getRawSql(dbUrl);
  await sql.transaction([
    sql`update claim_chart_rows set kind = ${kind}, edited_by = ${me.id}, edited_at = now() where id = ${rowId}`,
    sql`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, meta)
        values (${auditId}, ${me.id}, 'update', 'claim_chart_row', ${rowId}, 'success', ${JSON.stringify({ kind })}::jsonb)`
  ]);

  revalidatePath(`/claims/${analysisId}`);
}
