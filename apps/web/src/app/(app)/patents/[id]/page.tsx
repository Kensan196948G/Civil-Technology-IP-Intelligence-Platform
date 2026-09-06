import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, asc, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';
import { decomposeClaim } from './actions';

// FR-M06-002: AI Claim分解の書込権限（docs/10-requirements/05-rbac-matrix.md M06 Claim W）。
// UI側の表示制御のみ（実効的な認可は actions.ts の decomposeClaim 側で必ず再検証する）。
const CLAIM_DECOMPOSE_ROLES = new Set(['tech_manager', 'ip']);

export default async function PatentDetailPage({ params }: { params: Promise<{ id: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [patent] = await db.select().from(s.patents).where(eq(s.patents.id, p.id)).limit(1);
  if (!patent) notFound();
  const user = await getCurrentUser();
  const canDecompose = !!user && CLAIM_DECOMPOSE_ROLES.has(user.role);

  const claims = await db.select().from(s.patentClaims).where(eq(s.patentClaims.patentId, patent.id)).orderBy(asc(s.patentClaims.claimNo));
  const claimIds = claims.map(c => c.id);
  const elements = claimIds.length
    ? await db.select().from(s.claimElements).where(inArray(s.claimElements.claimId, claimIds)).orderBy(asc(s.claimElements.seq))
    : [];
  const elementsByClaim = new Map<string, typeof elements>();
  for (const e of elements) {
    const arr = elementsByClaim.get(e.claimId) ?? [];
    arr.push(e);
    elementsByClaim.set(e.claimId, arr);
  }
  const [analysis] = await db.select().from(s.claimAnalyses).where(eq(s.claimAnalyses.patentId, patent.id)).limit(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{patent.title}</h1>
        <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{patent.classification}</span>
        {patent.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>出願人：{patent.applicantName} ｜ 国：{patent.country} ｜ 公開番号：{patent.publicationNo ?? '—'}</div>
        <div>出願日：<span className="mono">{patent.applicationDate ?? '—'}</span> ｜ 公開日：<span className="mono">{patent.publicationDate ?? '—'}</span> ｜ 出典：{patent.source}</div>
        {patent.abstract && <div style={{ color: 'var(--ink-2)' }}>{patent.abstract}</div>}
        {patent.ipcCodes.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {patent.ipcCodes.map(ipc => (
              <span key={ipc} className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 6px' }}>{ipc}</span>
            ))}
          </div>
        )}
      </div>

      {analysis && (
        <Link href={`/claims/${analysis.id}`} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>
          自社案とのClaim比較を見る →
        </Link>
      )}

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          請求項・構成要件分解
        </div>
        <div>
          {claims.length === 0 && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
              請求項データは登録されていません。
            </div>
          )}
          {claims.map(c => (
            <div key={c.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>請求項{c.claimNo}</span>
                {c.isIndependent && <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>独立項</span>}
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>{c.text}</div>
              {(elementsByClaim.get(c.id) ?? []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 12, borderLeft: '2px solid var(--line)' }}>
                  <span className="badge" style={{ alignSelf: 'flex-start', color: 'var(--green)', border: '1px solid var(--green)' }}>
                    AIで分解済み（構成要件 {(elementsByClaim.get(c.id) ?? []).length} 件・根拠は原文から機械抽出）
                  </span>
                  {(elementsByClaim.get(c.id) ?? []).map(el => (
                    <div key={el.id} style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                      <span className="mono" style={{ fontWeight: 700, color: 'var(--ink)' }}>{el.label}</span>：{el.text}
                    </div>
                  ))}
                </div>
              ) : canDecompose ? (
                <form action={decomposeClaim} style={{ alignSelf: 'flex-start' }}>
                  <input type="hidden" name="claimId" value={c.id} />
                  <input type="hidden" name="patentId" value={patent.id} />
                  <button type="submit" className="btn btn-secondary" style={{ fontSize: 12.5 }}>
                    AIで構成要件に分解
                  </button>
                </form>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>構成要件は未分解です（分解権限：技術管理者・知財担当）。</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
