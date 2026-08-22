import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';

export const runtime = 'edge';

export default async function ByTech({ params }: { params: { techId: string } }) {
  const db = getDb(getDatabaseUrl());
  const [fa] = await db.select().from(s.fieldApplications).where(eq(s.fieldApplications.candidateId, params.techId)).limit(1);
  if (!fa) notFound();
  redirect(`/field/${fa.id}`);
}
