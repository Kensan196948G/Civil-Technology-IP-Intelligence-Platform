// M48 Vision AI統合: アップロード済み技術文書ファイル（engineering_documents.file_data）を
// 配信する。reports/[id]/download/route.ts と同じ方針: レイアウトの認証チェックは
// Route Handler には効かないため、ここで明示的にログイン必須とする。
// 画像（photo/sketch）はプレビュー用途のためinline、PDFはダウンロードリンク用途のため
// attachment として返す。
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { requireCurrentDbUser } from '@/lib/auth/require-user';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb(getDatabaseUrl());

  try {
    await requireCurrentDbUser(db);
  } catch {
    redirect('/login');
  }

  const [row] = await db.select({
    title: s.engineeringDocuments.title,
    fileData: s.engineeringDocuments.fileData,
    mimeType: s.engineeringDocuments.mimeType
  }).from(s.engineeringDocuments).where(eq(s.engineeringDocuments.id, id)).limit(1);

  if (!row || !row.fileData || !row.mimeType) {
    return new Response('ファイルが見つかりません', { status: 404 });
  }

  const content = Buffer.from(row.fileData);
  const isImage = row.mimeType.startsWith('image/');
  const ext = row.mimeType === 'application/pdf' ? 'pdf' : row.mimeType.split('/')[1] ?? 'bin';
  const asciiTitle = row.title.replace(/[^\x20-\x7E]/g, '').replace(/["\\]/g, '').trim().slice(0, 80) || 'document';

  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': row.mimeType,
      'Content-Length': String(content.length),
      'Cache-Control': 'private, max-age=3600',
      ...(isImage
        ? {}
        : { 'Content-Disposition': `attachment; filename="${asciiTitle}.${ext}"` })
    }
  });
}
