// README §16 バックログ「Reporting出力（PDF/DOCX/XLSX）」対応。
// 生成済みレポートファイル（report_files.content）をダウンロードさせる。
// レイアウト（(app)/layout.tsx）の認証チェックは Route Handler には効かないため、
// ここで明示的にログイン必須（既存の認証チェックを踏襲）とする。
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { requireCurrentDbUser } from '@/lib/auth/require-user';
import { logAudit, logAuditDenied } from '@/lib/audit/log';

const EXTENSIONS: Record<string, string> = { html: 'html', pdf: 'pdf', docx: 'docx', xlsx: 'xlsx' };

/**
 * Content-Disposition のファイル名は、古いクライアント向けASCII専用の `filename=` と、
 * 日本語等を含められる `filename*=UTF-8''...`（RFC 6266）の両方を用意する。
 * `filename=` にUTF-8バイト列をそのまま入れるのは仕様上不正なため、非ASCII文字は除去する。
 */
function buildFilename(title: string, format: string): { ascii: string; utf8: string } {
  const ext = EXTENSIONS[format] ?? 'bin';
  const trimmedTitle = title.trim().slice(0, 80) || 'report';
  const utf8 = `${trimmedTitle}.${ext}`;
  const asciiBase = title.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim().slice(0, 80);
  const ascii = `${asciiBase || 'report'}.${ext}`;
  return { ascii, utf8 };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb(getDatabaseUrl());

  let user;
  try {
    user = await requireCurrentDbUser(db);
  } catch {
    redirect('/login');
  }

  const [row] = await db.select({
    reportId: s.reports.id,
    title: s.reports.title,
    format: s.reports.format,
    status: s.reports.status,
    fileId: s.reportFiles.id,
    content: s.reportFiles.content,
    mimeType: s.reportFiles.mimeType
  })
    .from(s.reports)
    .leftJoin(s.reportFiles, eq(s.reportFiles.reportId, s.reports.id))
    .where(eq(s.reports.id, id))
    .limit(1);

  if (!row || !row.fileId || !row.content || row.status !== 'success') {
    await logAuditDenied(db, {
      actorUserId: user.id, action: 'download', targetType: 'report', targetId: id,
      result: 'failure', reason: 'report_file_not_found'
    });
    return new Response('レポートファイルが見つかりません', { status: 404 });
  }

  await logAudit(db, {
    actorUserId: user.id, action: 'download', targetType: 'report', targetId: id, result: 'success'
  });

  const filename = buildFilename(row.title, row.format);
  const content = Buffer.from(row.content);
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': row.mimeType ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename.ascii}"; filename*=UTF-8''${encodeURIComponent(filename.utf8)}`,
      'Content-Length': String(content.length)
    }
  });
}
