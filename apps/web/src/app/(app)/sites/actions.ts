'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { revalidatePath } from 'next/cache';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

export async function submitSiteIssue(formData: FormData) {
  const siteId = String(formData.get('siteId'));
  const body = String(formData.get('body') ?? '').trim();
  if (!body) return;

  const db = getDb(getDatabaseUrl());
  const me = await requireCurrentDbUser(db);

  const issueId = crypto.randomUUID();
  await db.insert(s.siteIssues).values({
    id: issueId, siteId, body, photos: [], status: 'open', createdBy: me.id
  });
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: me.id, action: 'create', targetType: 'site_issue', targetId: issueId, result: 'success', meta: {}
  });
  revalidatePath(`/sites/${siteId}/issue`);
}
