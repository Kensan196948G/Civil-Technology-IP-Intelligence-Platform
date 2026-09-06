'use server';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit } from '@/lib/audit/log';

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

  const reportId = crypto.randomUUID();
  await db.insert(s.reports).values({
    id: reportId,
    kind, title, format,
    createdBy: user.id
  });
  // 監査ログ NFR-L-001: レポート生成も主要操作として記録する（従来は未記録だった）。
  await logAudit(db, {
    actorUserId: user.id, action: 'create', targetType: 'report',
    targetId: reportId, result: 'success', meta: { kind, format }
  });

  redirect('/reports');
}
