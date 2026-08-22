'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function updateRowKind(formData: FormData) {
  const rowId = String(formData.get('rowId'));
  const analysisId = String(formData.get('analysisId'));
  const kind = String(formData.get('kind')) as 'match' | 'similar' | 'differ';
  const editedBy = String(formData.get('editedBy'));
  const db = getDb(getDatabaseUrl());
  await db.update(s.claimChartRows).set({ kind, editedBy, editedAt: new Date() }).where(eq(s.claimChartRows.id, rowId));
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: editedBy, action: 'update', targetType: 'claim_chart_row', targetId: rowId,
    result: 'success', meta: { kind }
  });
  revalidatePath(`/claims/${analysisId}`);
}
