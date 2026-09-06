'use server';
import { redirect } from 'next/navigation';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit } from '@/lib/audit/log';
import { buildReportData } from '@/lib/reports/aggregate';
import { generateReportFile } from '@/lib/reports/generate';

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

  // README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
  // レコード作成後、関連DBデータを集計してファイル本体を生成し report_files に保存する。
  // 生成に失敗しても reports レコード自体は残し、status='failed' として扱う
  // （既存のUXパターン: 一覧画面に「失敗」表示し、ダウンロード導線は出さない）。
  let status: 'success' | 'failed' = 'success';
  let failureReason: string | null = null;

  try {
    const data = await buildReportData(db, kind, title);
    const file = await generateReportFile(format, data);
    await db.insert(s.reports).values({ id: reportId, kind, title, format, createdBy: user.id, status: 'success' });
    await db.insert(s.reportFiles).values({
      id: crypto.randomUUID(),
      reportId,
      content: file.content,
      mimeType: file.mimeType,
      byteSize: file.content.byteLength
    });
  } catch (err) {
    status = 'failed';
    failureReason = err instanceof Error ? err.message : String(err);
    // ファイル生成に失敗した場合でも、reports レコードは失敗として記録する
    // （createReportAction の呼び出し元は redirect のみを期待しており、
    //  ここで例外を投げると画面遷移自体が失敗しユーザーに何も伝わらないため）。
    await db.insert(s.reports).values({ id: reportId, kind, title, format, createdBy: user.id, status: 'failed' });
  }

  // 監査ログ NFR-L-001: レポート生成も主要操作として記録する（従来は未記録だった）。
  await logAudit(db, {
    actorUserId: user.id, action: 'create', targetType: 'report',
    targetId: reportId, result: status === 'success' ? 'success' : 'failure',
    reason: failureReason,
    meta: { kind, format }
  });

  redirect('/reports');
}
