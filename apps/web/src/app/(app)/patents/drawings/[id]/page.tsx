import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, asc, desc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { extractDrawingPartsAction } from '../actions';
import type { DemoRole } from '@/lib/auth/demo';

// M47 Patent Drawing / Image Intelligence — 図面詳細。
// Vision AIによる部品自動認識は実接続済み（ユーザー承認済み）。類似図面（drawing_similarities）は
// 本スライスのスコープ外のため既存のデモデータ表示のまま。

// RBAC §3 M04 Patent / M06 Claim: R/W は tech_manager, ip のみ。
const DRAWING_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'ip']);

function describeAiError(code: string): string {
  switch (code) {
    case 'role_not_allowed': return 'この操作を行う権限がありません（技術管理者・知財担当のみ）。';
    case 'image_not_uploaded': return '先に図面画像をアップロードしてください。';
    case 'ai_call_failed': return 'AI解析の実行に失敗しました。時間をおいて再度お試しください。';
    case 'no_valid_parts': return '有効な部品を認識できませんでした（AIが部品を検出できませんでした）。';
    default: return 'AI解析に失敗しました。';
  }
}

export default async function PatentDrawingDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aiError?: string }>;
})
{
  // Next.js 15: params / searchParams は Promise になったため await する
  const p = await params;
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const user = await getCurrentUser();
  const canOperate = !!user && DRAWING_WRITE_ROLES.has(user.role);

  // 詳細表示でも image_data（bytea, 重量列）本体は選択せず、mime_type のみで有無を判定する。
  // 実バイト列は /patents/drawings/[id]/image ルート経由でのみ取得する。
  const [drawing] = await db.select({
    id: s.patentDrawings.id,
    patentId: s.patentDrawings.patentId,
    figureNo: s.patentDrawings.figureNo,
    imageUrl: s.patentDrawings.imageUrl,
    caption: s.patentDrawings.caption,
    isSample: s.patentDrawings.isSample,
    createdAt: s.patentDrawings.createdAt,
    mimeType: s.patentDrawings.mimeType
  }).from(s.patentDrawings).where(eq(s.patentDrawings.id, p.id)).limit(1);
  if (!drawing) notFound();

  const [patent] = await db.select().from(s.patents).where(eq(s.patents.id, drawing.patentId)).limit(1);
  const parts = await db.select().from(s.drawingParts).where(eq(s.drawingParts.drawingId, drawing.id)).orderBy(asc(s.drawingParts.partNo));

  const elementIds = parts.filter(part => part.elementId).map(part => part.elementId as string);
  const elements = elementIds.length
    ? await db.select().from(s.claimElements).where(inArray(s.claimElements.id, elementIds))
    : [];
  const elementById = new Map(elements.map(e => [e.id, e]));

  const similarities = await db.select().from(s.drawingSimilarities)
    .where(eq(s.drawingSimilarities.drawingId, drawing.id))
    .orderBy(desc(s.drawingSimilarities.similarityScore));
  const similarDrawingIds = similarities.map(sim => sim.similarDrawingId);
  // image_data（bytea）は不要なため選択しない。
  const similarDrawings = similarDrawingIds.length
    ? await db.select({
        id: s.patentDrawings.id, patentId: s.patentDrawings.patentId, figureNo: s.patentDrawings.figureNo
      }).from(s.patentDrawings).where(inArray(s.patentDrawings.id, similarDrawingIds))
    : [];
  const similarDrawingById = new Map(similarDrawings.map(d => [d.id, d]));
  const similarPatentIds = [...new Set(similarDrawings.map(d => d.patentId))];
  const similarPatents = similarPatentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, similarPatentIds))
    : [];
  const similarPatentById = new Map(similarPatents.map(p2 => [p2.id, p2]));

  const hasUploadedImage = !!drawing.mimeType;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{drawing.figureNo}</h1>
        {drawing.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>
          対象特許：{patent ? <Link href={`/patents/${patent.id}`} style={{ color: 'var(--blue)' }}>{patent.title}</Link> : '特許（削除済み）'}
        </div>
        {drawing.caption && <div style={{ color: 'var(--ink-2)' }}>{drawing.caption}</div>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          図面イメージ
        </div>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
          {hasUploadedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/patents/drawings/${drawing.id}/image`} alt={drawing.figureNo} style={{ maxWidth: '100%', border: '1px solid var(--line)' }} />
          ) : drawing.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={drawing.imageUrl} alt={drawing.figureNo} style={{ maxWidth: '100%', border: '1px solid var(--line)' }} />
          ) : (
            <div style={{
              width: '100%', maxWidth: 480, aspectRatio: '4 / 3', border: '1px dashed var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12.5
            }}>
              図面画像は未登録です（プレースホルダ）
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>AIで部品を認識する（Vision AI）</div>
        {sp.aiError && <div className="notice notice-amber">{describeAiError(sp.aiError)}</div>}
        {!hasUploadedImage ? (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            この図面には画像がアップロードされていません。先に <Link href="/patents/drawings" style={{ color: 'var(--blue)' }}>図面一覧</Link> から画像をアップロードしてください。
          </div>
        ) : canOperate ? (
          <form action={extractDrawingPartsAction}>
            <input type="hidden" name="drawingId" value={drawing.id} />
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12.5 }}>AIで部品を認識する</button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>この操作を行う権限がありません（技術管理者・知財担当のみ）。</div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          部品一覧（符号・説明）
        </div>
        {parts.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            部品データはまだありません。
          </div>
        ) : (
          <div>
            {parts.map(part => {
              const element = part.elementId ? elementById.get(part.elementId) : undefined;
              return (
                <div key={part.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span className="mono" style={{ fontWeight: 700 }}>符号{part.partNo}</span>
                    <span style={{ fontSize: 13 }}>{part.description}</span>
                    {!part.isSample && <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)', fontSize: 10 }}>AI認識</span>}
                  </div>
                  {element && (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                      構成要件対応：<span className="mono" style={{ fontWeight: 700 }}>{element.label}</span>：{element.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          類似図面（スコア降順）
        </div>
        {similarities.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            類似図面の記録はまだありません。
          </div>
        ) : (
          <div>
            {similarities.map(sim => {
              const sd = similarDrawingById.get(sim.similarDrawingId);
              const sp2 = sd ? similarPatentById.get(sd.patentId) : undefined;
              return (
                <Link key={sim.id} href={`/patents/drawings/${sim.similarDrawingId}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}>
                  <span className="mono" style={{ fontSize: 15, color: 'var(--blue)' }}>{Number(sim.similarityScore).toFixed(1)}<span style={{ fontSize: 11, color: 'var(--ink-2)' }}> / 100</span></span>
                  <span style={{ flexGrow: 1, fontSize: 12.5 }}>
                    {sd?.figureNo ?? '—'} ｜ {sp2?.title ?? '特許（削除済み）'}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>詳細を見る →</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
