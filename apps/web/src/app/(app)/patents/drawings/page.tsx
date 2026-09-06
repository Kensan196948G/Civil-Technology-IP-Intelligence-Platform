import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';

// M47 Patent Drawing / Image Intelligence — 特許図面の一覧。
// 依存: M04（特許取得）/ M06（Claim解析。部品と構成要件の対応は詳細画面で表示）。
// ⚠️ Vision AI（画像解析による部品自動認識・図面類似検索）の実呼び出しは未実装。
// 本画面はデータモデルと一覧・詳細表示のみを提供する（デモデータ）。

export default async function PatentDrawingsPage() {
  const db = getDb(getDatabaseUrl());
  const drawings = await db.select().from(s.patentDrawings).orderBy(desc(s.patentDrawings.createdAt));

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>特許図面・部品解析</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M47 / PATENT DRAWING INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        特許図面・部品（符号）対応・図面間の類似検索を管理します。Vision AI（画像解析による部品自動認識・
        類似図面検索）の実呼び出しは未接続で、本画面はデータモデルとデモデータの表示のみを提供します。
      </p>

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
