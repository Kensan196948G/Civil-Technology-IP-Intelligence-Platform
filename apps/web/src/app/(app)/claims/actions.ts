'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

export async function updateRowKind(formData: FormData) {
  const rowId = String(formData.get('rowId'));
  const analysisId = String(formData.get('analysisId'));
  const kind = String(formData.get('kind')) as 'match' | 'similar' | 'differ';

  const db = getDb(getDatabaseUrl());
  // 利用者は認証Cookieから解決する（フォームの値は信用しない）
  const me = await requireCurrentDbUser(db);

  await db.update(s.claimChartRows).set({ kind, editedBy: me.id, editedAt: new Date() }).where(eq(s.claimChartRows.id, rowId));
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: me.id, action: 'update', targetType: 'claim_chart_row', targetId: rowId,
    result: 'success', meta: { kind }
  });
  revalidatePath(`/claims/${analysisId}`);
}
