export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';


export default async function NetisDetailPage({ params }: { params: { id: string } }) {
  const db = getDb(getDatabaseUrl());
  const [n] = await db.select().from(s.netisTechnologies).where(eq(s.netisTechnologies.id, params.id)).limit(1);
  if (!n) notFound();

  const applications = await db.select().from(s.fieldApplications).where(
    and(eq(s.fieldApplications.candidateType, 'netis'), eq(s.fieldApplications.candidateId, n.id))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{n.name}</h1>
        {n.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>登録番号：{n.netisNo} ｜ 分類：{n.category ?? '—'}</div>
        <div>登録日：<span className="mono">{n.registeredOn ?? '—'}</span> ｜ 出典：{n.source}</div>
        {n.summary && <div style={{ color: 'var(--ink-2)' }}>{n.summary}</div>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          現場適用性評価での利用実績
        </div>
        {applications.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            この技術を候補とした現場適用性評価はまだありません。
          </div>
        ) : (
          <div>
            {applications.map(a => (
              <Link key={a.id} href={`/field/${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}>
                <span className="mono" style={{ fontSize: 15, color: 'var(--blue)' }}>{Number(a.score).toFixed(0)}<span style={{ fontSize: 11, color: 'var(--ink-2)' }}> / 100</span></span>
                <span style={{ flexGrow: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>詳細を見る →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
