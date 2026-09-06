import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { uploadDrawingImageAction } from './actions';
import type { DemoRole } from '@/lib/auth/demo';

// M47 Patent Drawing / Image Intelligence — 特許図面の一覧。
// 依存: M04（特許取得）/ M06（Claim解析。部品と構成要件の対応は詳細画面で表示）。
// Vision AI（画像解析による部品自動認識）は実接続済み（ユーザー承認済み）。
// 図面間の類似検索（drawing_similarities）はコスト・組合せ爆発の観点から本スライスの
// スコープ外とし、既存のシードデータ表示のままとする。

// RBAC §3 M04 Patent / M06 Claim: R/W は tech_manager, ip のみ。
const DRAWING_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

function describeUploadError(code: string): string {
  switch (code) {
    case 'missing_input': return '対象特許と図番を入力してください。';
    case 'role_not_allowed': return 'この操作を行う権限がありません（技術管理者・知財担当のみ）。';
    case 'patent_not_found': return '指定された特許が見つかりません。';
    case 'file_missing': return '画像ファイルを選択してください。';
    case 'file_empty': return '空のファイルはアップロードできません。';
    case 'file_too_large': return 'ファイルサイズが上限（5MB）を超えています。';
    case 'mime_type_not_allowed': return '対応していない形式です（PNG / JPEG / WebP のみ）。';
    default: return 'アップロードに失敗しました。';
  }
}

export default async function PatentDrawingsPage({
  searchParams
}: {
  searchParams: Promise<{ uploadError?: string }>;
}) {
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const user = await getCurrentUser();
  const canUpload = !!user && DRAWING_WRITE_ROLES.has(user.role);

  // 一覧クエリでは image_data（bytea, 重量列）は選択しない（reports/page.tsx と同じ方針）。
  // mime_type（軽量な有無フラグ）のみ選択し、「画像あり」バッジの表示に使う。
  const drawings = await db.select({
    id: s.patentDrawings.id,
    patentId: s.patentDrawings.patentId,
    figureNo: s.patentDrawings.figureNo,
    imageUrl: s.patentDrawings.imageUrl,
    caption: s.patentDrawings.caption,
    isSample: s.patentDrawings.isSample,
    createdAt: s.patentDrawings.createdAt,
    mimeType: s.patentDrawings.mimeType
  }).from(s.patentDrawings).orderBy(desc(s.patentDrawings.createdAt));

  const patentIds = [...new Set(drawings.map(d => d.patentId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const drawingIds = drawings.map(d => d.id);
  const parts = drawingIds.length
    ? await db.select().from(s.drawingParts).where(inArray(s.drawingParts.drawingId, drawingIds))
    : [];
  const partCountByDrawing = new Map<string, number>();
  for (const part of parts) {
    partCountByDrawing.set(part.drawingId, (partCountByDrawing.get(part.drawingId) ?? 0) + 1);
  }

  // アップロードフォーム用の特許選択肢（全件。デモ規模のため件数制限は設けない）。
  const allPatents = canUpload
    ? await db.select({ id: s.patents.id, title: s.patents.title }).from(s.patents).orderBy(asc(s.patents.title))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>特許図面・部品解析</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M47 / PATENT DRAWING INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        特許図面・部品（符号）対応・図面間の類似検索を管理します。画像をアップロードし、
        Vision AIで部品（符号・説明）を自動認識できます。類似図面検索はコスト・組合せ爆発の
        観点から本スライスのスコープ外とし、既存のデモデータ表示のままとしています。
      </p>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>図面画像をアップロード</div>
        {sp.uploadError && (
          <div className="notice notice-amber">{describeUploadError(sp.uploadError)}</div>
        )}
        {canUpload ? (
          <form action={uploadDrawingImageAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              対象特許
              <select name="patentId" required style={{ minWidth: 260 }}>
                <option value="">選択してください</option>
                {allPatents.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              図番
              <input name="figureNo" required placeholder="例: 図1" style={{ width: 120 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              キャプション（任意）
              <input name="caption" placeholder="例: ケーソン据付装置の全体図" style={{ width: 220 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              画像ファイル（PNG / JPEG / WebP、5MBまで）
              <input type="file" name="file" accept="image/png,image/jpeg,image/webp" required />
            </label>
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12.5 }}>
              アップロード
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>アップロード権限がありません（技術管理者・知財担当のみ）。</div>
        )}
      </div>

      {drawings.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          特許図面データがまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {drawings.map(d => {
          const patent = patentById.get(d.patentId);
          return (
            <Link key={d.id} href={`/patents/drawings/${d.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{d.figureNo}</span>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{patent?.title ?? '特許（削除済み）'}</span>
                {d.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
                {d.mimeType && <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>画像あり</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                部品数 <span className="mono">{partCountByDrawing.get(d.id) ?? 0}</span>件
                {d.caption && <> ｜ {d.caption}</>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
