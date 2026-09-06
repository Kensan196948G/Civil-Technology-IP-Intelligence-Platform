import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';

// M48 Engineering Document Intelligence — 技術文書の一覧。
// PDF・CAD図・BIM・写真・スケッチから抽出した技術要素→特許マッチングを扱う。
// 依存: M02（sites）/ M03（users）/ M04（patents）/ M09（技術要素抽出）。
// ⚠️ Vision AI・文書解析AIの実呼び出しは未接続。本画面はデータモデルとデモデータの表示のみを提供する。

const DOC_TYPE_LABEL: Record<string, string> = {
  pdf: 'PDF', cad: 'CAD図', bim: 'BIM', photo: '写真', sketch: 'スケッチ'
};

export default async function EngineeringDocumentsPage() {
  const db = getDb(getDatabaseUrl());
  const docs = await db.select().from(s.engineeringDocuments).orderBy(desc(s.engineeringDocuments.createdAt));

  const docIds = docs.map(d => d.id);
  const elements = docIds.length
    ? await db.select().from(s.extractedTechElements).where(inArray(s.extractedTechElements.documentId, docIds))
    : [];
  const elementCountByDoc = new Map<string, number>();
  for (const el of elements) {
    elementCountByDoc.set(el.documentId, (elementCountByDoc.get(el.documentId) ?? 0) + 1);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>技術文書インテリジェンス</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M48 / ENGINEERING DOCUMENT INTELLIGENCE</span>
        <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>第二拡張群</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        PDF・CAD図・BIM・写真・スケッチ等の技術文書から抽出された技術要素と、関連特許とのマッチングを
        管理します。Vision AI・文書解析AIの実呼び出しは未接続で、本画面はデータモデルとデモデータの
        表示のみを提供します。
      </p>

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
