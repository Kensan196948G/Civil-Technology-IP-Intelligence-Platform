import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';


export default async function ByPatent({ params }: { params: { patentId: string } }) {
  const db = getDb(getDatabaseUrl());
  const [a] = await db.select().from(s.claimAnalyses).where(eq(s.claimAnalyses.patentId, params.patentId)).limit(1);
  if (!a) notFound();
  redirect(`/claims/${a.id}`);
}
