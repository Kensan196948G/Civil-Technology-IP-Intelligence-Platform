// M47 Vision AI統合: アップロード済み図面画像（patent_drawings.image_data）を配信する。
// reports/[id]/download/route.ts と同じ方針: レイアウトの認証チェックは Route Handler には
// 効かないため、ここで明示的にログイン必須とする。ダウンロードではなく画面表示
// （<img src="...">）用途のため Content-Disposition は付けない（inline 表示）。
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
    imageData: s.patentDrawings.imageData,
    mimeType: s.patentDrawings.mimeType
  }).from(s.patentDrawings).where(eq(s.patentDrawings.id, id)).limit(1);

  if (!row || !row.imageData || !row.mimeType) {
    return new Response('図面画像が見つかりません', { status: 404 });
  }

  const content = Buffer.from(row.imageData);
  return new Response(content, {
    status: 200,
    headers: {
      'Content-Type': row.mimeType,
      'Content-Length': String(content.length),
      'Cache-Control': 'private, max-age=3600'
    }
  });
}
