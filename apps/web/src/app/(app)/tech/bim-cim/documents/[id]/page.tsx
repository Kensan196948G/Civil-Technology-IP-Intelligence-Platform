import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { extractTechElementsAction } from '../actions';
import type { DemoRole } from '@/lib/auth/demo';

// M48 Engineering Document Intelligence — 技術文書詳細。
// Vision AIによる技術要素抽出は実接続済み（ユーザー承認済み）。

// actions.ts と同じロール（M48専用のRBAC行が無いため依存元の技術系ロールに揃える）。
const ENGINEERING_DOC_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'rnd', 'ip']);

const DOC_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', cad: 'CAD図', bim: 'BIM', photo: '写真', sketch: 'スケッチ'
};

function describeAiError(code: string): string {
  switch (code) {
    case 'role_not_allowed': return 'この操作を行う権限がありません（技術管理者・R&D担当・知財担当のみ）。';
    case 'file_not_uploaded': return '先にファイルをアップロードしてください。';
    case 'unsupported_doc_type': return 'この文書種別（CAD/BIM）はAI解析に対応していません。';
    case 'ai_call_failed': return 'AI解析の実行に失敗しました。時間をおいて再度お試しください。';
    case 'no_valid_elements': return '有効な技術要素を抽出できませんでした（AIが技術要素を検出できませんでした）。';
    default: return 'AI解析に失敗しました。';
  }
}

export default async function EngineeringDocumentDetailPage({
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
  const canOperate = !!user && ENGINEERING_DOC_WRITE_ROLES.has(user.role);

  // 詳細表示でも file_data（bytea, 重量列）本体は選択せず、mime_type のみで有無を判定する。
  // 実バイト列は /tech/bim-cim/documents/[id]/file ルート経由でのみ取得する。
  const [doc] = await db.select({
    id: s.engineeringDocuments.id,
    docType: s.engineeringDocuments.docType,
    title: s.engineeringDocuments.title,
    siteId: s.engineeringDocuments.siteId,
    sourceUrl: s.engineeringDocuments.sourceUrl,
    uploadedBy: s.engineeringDocuments.uploadedBy,
    isSample: s.engineeringDocuments.isSample,
    createdAt: s.engineeringDocuments.createdAt,
    mimeType: s.engineeringDocuments.mimeType
  }).from(s.engineeringDocuments).where(eq(s.engineeringDocuments.id, p.id)).limit(1);
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

  const hasUploadedFile = !!doc.mimeType;
  const isPdf = doc.mimeType === 'application/pdf';
  const isImage = !!doc.mimeType && doc.mimeType.startsWith('image/');
  const canAnalyze = doc.docType === 'pdf' || doc.docType === 'photo' || doc.docType === 'sketch';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{doc.title}</h1>
        <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{DOC_TYPE_LABEL[doc.docType] ?? doc.docType}</span>
        {doc.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>関連現場：{site?.name ?? '—'} ｜ アップロード：{uploader?.displayName ?? '—'}</div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          ファイル
        </div>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center' }}>
          {hasUploadedFile && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/tech/bim-cim/documents/${doc.id}/file`} alt={doc.title} style={{ maxWidth: '100%', border: '1px solid var(--line)' }} />
          ) : hasUploadedFile && isPdf ? (
            <a href={`/tech/bim-cim/documents/${doc.id}/file`} className="btn" style={{ fontSize: 12.5 }}>PDFをダウンロード</a>
          ) : (
            <div style={{
              width: '100%', maxWidth: 480, aspectRatio: '4 / 3', border: '1px dashed var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12.5
            }}>
              ファイルは未登録です
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>AIで技術要素を抽出する（Vision AI）</div>
        {sp.aiError && <div className="notice notice-amber">{describeAiError(sp.aiError)}</div>}
        {!canAnalyze ? (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>この文書種別（CAD/BIM）はAI解析に対応していません。</div>
        ) : !hasUploadedFile ? (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
            この文書にはファイルがアップロードされていません。先に <Link href="/tech/bim-cim/documents" style={{ color: 'var(--blue)' }}>文書一覧</Link> からファイルをアップロードしてください。
          </div>
        ) : canOperate ? (
          <form action={extractTechElementsAction}>
            <input type="hidden" name="documentId" value={doc.id} />
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12.5 }}>AIで技術要素を抽出する</button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>この操作を行う権限がありません（技術管理者・R&D担当・知財担当のみ）。</div>
        )}
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
                    {!el.isSample && <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)', fontSize: 10 }}>AI抽出</span>}
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
