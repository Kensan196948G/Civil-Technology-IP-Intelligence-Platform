'use server';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

const ALLOWED_KINDS = new Set([
  'tech-survey', 'patent-survey', 'prior-art', 'claim-compare', 'novelty', 'inventive-step',
  'ai-examine', 'competitor', 'landscape', 'whitespace', 'field-application', 'rnd', 'licensing', 'executive'
]);
const ALLOWED_FORMATS = new Set(['html', 'pdf', 'docx', 'xlsx']);

export async function createReportAction(formData: FormData) {
  const db = getDb(getDatabaseUrl());
  const user = await requireCurrentDbUser(db);

  const kind = String(formData.get('kind') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  const format = String(formData.get('format') ?? 'html');
  if (!ALLOWED_KINDS.has(kind)) throw new Error('不正なレポート種別です');
  if (!ALLOWED_FORMATS.has(format)) throw new Error('不正な出力形式です');
  if (!title) throw new Error('タイトルを入力してください');

  await db.insert(s.reports).values({
    id: crypto.randomUUID(),
    kind, title, format,
    createdBy: user.id
  });

  redirect('/reports');
}
