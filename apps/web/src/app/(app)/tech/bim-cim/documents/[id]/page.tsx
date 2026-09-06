import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

// M48 Engineering Document Intelligence — 技術文書詳細。
// ⚠️ Vision AI・文書解析AIの実呼び出しは未実装。抽出要素・特許マッチはデモデータ。

const DOC_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', cad: 'CAD図', bim: 'BIM', photo: '写真', sketch: 'スケッチ'
};

export default async function EngineeringDocumentDetailPage({ params }: { params: Promise<{ id: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [doc] = await db.select().from(s.engineeringDocuments).where(eq(s.engineeringDocuments.id, p.id)).limit(1);
  if (!doc) notFound();

  const [site] = doc.siteId
    ? await db.select().from(s.sites).where(eq(s.sites.id, doc.siteId)).limit(1)
    : [undefined];
  const [uploader] = doc.uploadedBy
    ? await db.select().from(s.users).where(eq(s.users.id, doc.uploadedBy)).limit(1)
    : [undefined];

  const elements = await db.select().from(s.extractedTechElements)
    .where(eq(s.extractedTechElements.documentId, doc.id))
    .orderBy(desc(s.extractedTechElements.confidence));

  const elementIds = elements.map(e => e.id);
  const matches = elementIds.length
    ? await db.select().from(s.documentElementPatentMatches).where(inArray(s.documentElementPatentMatches.elementId, elementIds))
    : [];
  const matchesByElement = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = matchesByElement.get(m.elementId) ?? [];
    arr.push(m);
    matchesByElement.set(m.elementId, arr);
  }
  const patentIds = [...new Set(matches.map(m => m.patentId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(pt => [pt.id, pt]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{doc.title}</h1>
        <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{DOC_TYPE_LABEL[doc.docType] ?? doc.docType}</span>
        {doc.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>関連現場：{site?.name ?? '—'} ｜ アップロード：{uploader?.displayName ?? '—'}</div>
        <div style={{ color: 'var(--ink-2)' }}>
          Vision AI・文書解析AIの実呼び出しは未接続です。抽出技術要素・特許マッチはデモデータによる表示です。
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          抽出技術要素（信頼度付き）
        </div>
        {elements.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            抽出された技術要素はまだありません。
          </div>
        ) : (
          <div>
            {elements.map(el => {
              const elMatches = (matchesByElement.get(el.id) ?? []).slice().sort((a, b) => Number(b.matchScore) - Number(a.matchScore));
              return (
                <div key={el.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{el.elementLabel}</span>
                    {el.confidence != null && (
                      <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>信頼度 {Number(el.confidence).toFixed(2)}</span>
                    )}
                  </div>
                  {el.description && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{el.description}</div>}
                  {elMatches.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                      {elMatches.map(m => {
                        const patent = patentById.get(m.patentId);
                        return (
                          <Link key={m.id} href={patent ? `/patents/${patent.id}` : '#'} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)' }}>
                            <span className="mono" style={{ fontSize: 13, color: 'var(--blue)' }}>{Number(m.matchScore).toFixed(1)}<span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}> / 100</span></span>
                            <span style={{ fontSize: 12 }}>{patent?.title ?? '特許（削除済み）'}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>マッチする特許はまだありません。</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
