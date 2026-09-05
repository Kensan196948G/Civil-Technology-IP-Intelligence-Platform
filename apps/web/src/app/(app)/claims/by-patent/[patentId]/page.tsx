import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { redirect, notFound } from 'next/navigation';


export default async function ByPatent({ params }: { params: Promise<{ patentId: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [a] = await db.select().from(s.claimAnalyses).where(eq(s.claimAnalyses.patentId, p.patentId)).limit(1);
  if (!a) notFound();
  redirect(`/claims/${a.id}`);
}
