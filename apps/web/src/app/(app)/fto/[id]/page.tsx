import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ymd } from '@/lib/labels';

// M28 FTO / Clearance Intelligence — 案件詳細（構成要素 × Claim 照合表）
// 原則（FR-M28-004）: AI類似度は侵害判断ではない。最終判断は人間レビュー → LegalOps。

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: '下書き', color: 'var(--ink-3)' },
  in_review: { label: '調査・照合中', color: 'var(--blue)' },
  completed: { label: '照合完了', color: '#1e7d46' },
  closed: { label: 'クローズ', color: 'var(--ink-3)' }
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  must_review: { label: '🔴 専門確認', color: '#c0392b' },
  confirm: { label: '🟠 要確認', color: '#b7791f' },
  reference: { label: '🟢 参考', color: '#1e7d46' },
  none: { label: '—', color: 'var(--ink-3)' }
};

export default async function FtoDetailPage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const [ftoCase] = await db.select().from(s.ftoCases).where(eq(s.ftoCases.id, params.id)).limit(1);
  if (!ftoCase) notFound();

  const components = await db
    .select()
    .from(s.ftoComponents)
    .where(eq(s.ftoComponents.ftoCaseId, params.id))
    .orderBy(asc(s.ftoComponents.seq));

  const patentIds = [...new Set(components.filter(c => c.relatedPatentId).map(c => c.relatedPatentId as string))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const statusMeta = STATUS_META[ftoCase.status] ?? { label: ftoCase.status, color: 'var(--ink-3)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22 }}>{ftoCase.title}</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M28 / FTO DETAIL</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: statusMeta.color }}>{statusMeta.label}</span>
      </div>

      {ftoCase.description && <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>{ftoCase.description}</p>}

      <div className="card" style={{ padding: '12px 15px', fontSize: 12, color: 'var(--ink-2)', borderLeft: '3px solid var(--amber)' }}>
        ⚠️ AI類似度は<b>侵害判断ではありません</b>（FR-M28-004）。本調査は<b>予備調査</b>であり、
        最終判断は人間レビュー → <code>Construction-LegalOps-DX</code> → 法務・弁理士 の順で行います。
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          技術構成要素 × 他社 Claim 照合（{components.length}）
        </div>
        {components.length === 0 && (
          <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
            構成要素が未登録です。技術構成要素の分解（FR-M28-001）を登録すると表示されます。
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {components.map(c => {
            const patent = c.relatedPatentId ? patentById.get(c.relatedPatentId) : undefined;
            const action = ACTION_META[c.actionLevel] ?? ACTION_META.none!;
            return (
              <div key={c.id} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid var(--line-2)' }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', width: 30, flexShrink: 0 }}>{c.label}</span>
                <span style={{ flex: 1.2, minWidth: 180, fontSize: 12.5 }}>{c.description ?? '—'}</span>
                <span style={{ flex: 1.4, minWidth: 180, fontSize: 12 }}>
                  {patent ? (
                    <Link href={`/patents/${patent.id}`} style={{ color: 'var(--blue)' }}>
                      {patent.publicationNo ?? '特許'}：{patent.title.slice(0, 24)}{patent.title.length > 24 ? '…' : ''}
                    </Link>
                  ) : <span style={{ color: 'var(--ink-3)' }}>—（関連特許なし）</span>}
                </span>
                <span className="mono" style={{ fontSize: 11.5, width: 56, color: 'var(--ink-2)' }}>{c.claimNo ? `Claim ${c.claimNo}` : '—'}</span>
                <span className="mono" style={{ width: 58, textAlign: 'right', fontWeight: 700, color: c.aiSimilarity != null && c.aiSimilarity >= 70 ? '#c0392b' : 'var(--ink)' }}>
                  {c.aiSimilarity != null ? `${c.aiSimilarity}%` : '—'}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: action.color, width: 86, textAlign: 'center' }}>{action.label}</span>
                <span style={{ flex: 1.2, minWidth: 160, fontSize: 11.5, color: 'var(--ink-2)' }}>{c.note ?? ''}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--ink-3)', margin: 0 }}>
        作成: {ymd(ftoCase.createdAt)} ／ 調査結果の再現性・検索式の保存（FR-M28-006）とLegalOpsへの引き渡し（I-01）は次フェーズで対応。
      </p>
    </div>
  );
}
