import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { uploadEngineeringDocumentAction } from './actions';
import type { DemoRole } from '@/lib/auth/demo';

// M48 Engineering Document Intelligence — 技術文書の一覧。
// PDF・写真・スケッチから抽出した技術要素→特許マッチングを扱う（Vision AI実接続済み。
// ユーザー承認済み）。CAD/BIMはバイナリ形式をAIで直接解析できないため、本スライスでは
// アップロード導線を提供しない（データモデル上のdoc_type自体は許容するが未対応）。
// 依存: M02（sites）/ M03（users）/ M04（patents）/ M09（技術要素抽出）。

// M48はM02/M03/M04/M09に依存する。M48専用のRBAC行が無いため、依存元に共通する
// 技術系ロール（tech_manager, rnd, ip）に書込権限を揃える（actions.tsと同じ判断）。
const ENGINEERING_DOC_WRITE_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>(['tech_manager', 'rnd', 'ip']);

const DOC_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', cad: 'CAD図', bim: 'BIM', photo: '写真', sketch: 'スケッチ'
};

function describeUploadError(code: string): string {
  switch (code) {
    case 'missing_input': return 'タイトルと文書種別（PDF / 写真 / スケッチ）を入力してください。';
    case 'role_not_allowed': return 'この操作を行う権限がありません（技術管理者・R&D担当・知財担当のみ）。';
    case 'site_not_found': return '指定された現場が見つかりません。';
    case 'file_missing': return 'ファイルを選択してください。';
    case 'file_empty': return '空のファイルはアップロードできません。';
    case 'file_too_large': return 'ファイルサイズが上限（8MB）を超えています。';
    case 'mime_type_not_allowed': return '対応していない形式です（PDF、または PNG / JPEG / WebP 画像のみ）。';
    default: return 'アップロードに失敗しました。';
  }
}

export default async function EngineeringDocumentsPage({
  searchParams
}: {
  searchParams: Promise<{ uploadError?: string }>;
}) {
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const db = getDb(getDatabaseUrl());
  const user = await getCurrentUser();
  const canUpload = !!user && ENGINEERING_DOC_WRITE_ROLES.has(user.role);

  // 一覧クエリでは file_data（bytea, 重量列）は選択しない（reports/page.tsx と同じ方針）。
  const docs = await db.select({
    id: s.engineeringDocuments.id,
    docType: s.engineeringDocuments.docType,
    title: s.engineeringDocuments.title,
    siteId: s.engineeringDocuments.siteId,
    sourceUrl: s.engineeringDocuments.sourceUrl,
    uploadedBy: s.engineeringDocuments.uploadedBy,
    isSample: s.engineeringDocuments.isSample,
    createdAt: s.engineeringDocuments.createdAt,
    mimeType: s.engineeringDocuments.mimeType
  }).from(s.engineeringDocuments).orderBy(desc(s.engineeringDocuments.createdAt));

  const docIds = docs.map(d => d.id);
  const elements = docIds.length
    ? await db.select().from(s.extractedTechElements).where(inArray(s.extractedTechElements.documentId, docIds))
    : [];
  const elementCountByDoc = new Map<string, number>();
  for (const el of elements) {
    elementCountByDoc.set(el.documentId, (elementCountByDoc.get(el.documentId) ?? 0) + 1);
  }

  // アップロードフォーム用の現場選択肢（全件。デモ規模のため件数制限は設けない）。
  const allSites = canUpload
    ? await db.select({ id: s.sites.id, name: s.sites.name }).from(s.sites).orderBy(asc(s.sites.name))
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術文書インテリジェンス</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M48 / ENGINEERING DOCUMENT INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        PDF・写真・スケッチ等の技術文書から抽出された技術要素と、関連特許とのマッチングを
        管理します。CAD図・BIMはバイナリ形式をAIで直接解析できないため、本画面では
        アップロード対象外としています。
      </p>

      <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>技術文書をアップロード</div>
        {sp.uploadError && (
          <div className="notice notice-amber">{describeUploadError(sp.uploadError)}</div>
        )}
        {canUpload ? (
          <form action={uploadEngineeringDocumentAction} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              文書種別
              <select name="docType" required style={{ minWidth: 140 }}>
                <option value="">選択してください</option>
                <option value="pdf">PDF</option>
                <option value="photo">写真</option>
                <option value="sketch">スケッチ</option>
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              タイトル
              <input name="title" required placeholder="例: 施工計画書" style={{ width: 220 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              関連現場（任意）
              <select name="siteId" style={{ minWidth: 180 }}>
                <option value="">選択なし</option>
                {allSites.map(site => (
                  <option key={site.id} value={site.id}>{site.name}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
              ファイル（PDF、または PNG / JPEG / WebP、8MBまで）
              <input type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp" required />
            </label>
            <button type="submit" className="btn btn-primary" style={{ fontSize: 12.5 }}>
              アップロード
            </button>
          </form>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>アップロード権限がありません（技術管理者・R&D担当・知財担当のみ）。</div>
        )}
      </div>

      {docs.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          技術文書データがまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {docs.map(d => (
          <Link key={d.id} href={`/tech/bim-cim/documents/${d.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{DOC_TYPE_LABEL[d.docType] ?? d.docType}</span>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{d.title}</span>
              {d.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
              {d.mimeType && <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>ファイルあり</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              抽出技術要素数 <span className="mono">{elementCountByDoc.get(d.id) ?? 0}</span>件
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
