import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const runtime = 'edge';

type Axis = { axis: string; value: number; weight: number; basis: string; is_estimated: boolean };

export default async function FieldScorePage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const [fa] = await db.select().from(s.fieldApplications).where(eq(s.fieldApplications.id, params.id)).limit(1);
  if (!fa) notFound();
  const [issue] = await db.select().from(s.siteIssues).where(eq(s.siteIssues.id, fa.siteIssueId)).limit(1);
  const [site] = issue ? await db.select().from(s.sites).where(eq(s.sites.id, issue.siteId)).limit(1) : [null];
  const [tech] = await db.select().from(s.technologies).where(eq(s.technologies.id, fa.candidateId)).limit(1);
  const axes = fa.axes as unknown as Axis[];
  const score = Number(fa.score);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>現場適用性評価</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-19 / FIELD APPLICATION</span>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{site?.name} ｜ 候補技術：{tech?.name}</div>

      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
        <div className="card" style={{ width: 320, flex: 'none', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '.18em', color: 'var(--ink-2)' }}>FIELD APPLICABILITY SCORE</div>
          <div className="mono" style={{ fontSize: 48, color: 'var(--blue)' }}>{score.toFixed(0)}<span style={{ fontSize: 15, color: 'var(--ink-2)' }}> / 100</span></div>
          <div style={{ height: 8, background: 'var(--sunk)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${score}%`, background: 'var(--blue)' }} />
          </div>
          <div className="notice notice-amber" style={{ fontSize: 12 }}>
            <strong>このスコアは導入可否の判断を代替しません。</strong> 安全・品質・環境部門の承認を経てはじめて導入できます。
          </div>
          <Link href="/approvals" className="btn btn-primary" style={{ justifyContent: 'center' }}>
            導入検討を起票する →
          </Link>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', textAlign: 'center' }}>
            起票であって決定ではありません（承認一覧のデモ案件をご覧ください）
          </div>
        </div>

        <div className="card" style={{ flexGrow: 1, padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
            軸別の内訳（スコア単独では表示しません）
          </div>
          <div>
            {axes.map((a, i) => (
              <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid #E8EDED', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 110, fontSize: 12.5 }}>{a.axis}</span>
                  <span className="badge" style={{
                    color: a.is_estimated ? 'var(--amber)' : 'var(--blue)',
                    border: `1px solid ${a.is_estimated ? 'var(--amber)' : 'var(--blue)'}`
                  }}>{a.is_estimated ? 'AI推定' : '規則'}</span>
                  <span style={{ flexGrow: 1, height: 6, background: '#E4E9EA', borderRadius: 999, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${a.value * 100}%`, background: a.is_estimated ? 'var(--amber)' : 'var(--blue)' }} />
                  </span>
                  <span className="mono" style={{ width: 34, textAlign: 'right' }}>{a.value.toFixed(2)}</span>
                  <span style={{ width: 50, textAlign: 'right', fontSize: 11, color: 'var(--ink-2)' }}>重み{a.weight}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', paddingLeft: 122 }}>{a.basis}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
