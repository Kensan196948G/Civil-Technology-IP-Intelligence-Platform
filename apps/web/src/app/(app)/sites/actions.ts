'use server';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function submitSiteIssue(formData: FormData) {
  const siteId = String(formData.get('siteId'));
  const body = String(formData.get('body') ?? '').trim();
  const userEmail = String(formData.get('userEmail'));
  if (!body) return;
  const db = getDb(getDatabaseUrl());
  const [user] = await db.select().from(s.users).where(eq(s.users.email, userEmail)).limit(1);
  const issueId = crypto.randomUUID();
  await db.insert(s.siteIssues).values({
    id: issueId, siteId, body, photos: [], status: 'open', createdBy: user!.id
  });
  await db.insert(s.auditLogs).values({
    id: crypto.randomUUID(), actorUserId: user!.id, action: 'create', targetType: 'site_issue', targetId: issueId, result: 'success', meta: {}
  });
  revalidatePath(`/sites/${siteId}/issue`);
}
