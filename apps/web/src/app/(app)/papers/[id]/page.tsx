import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';


export default async function PaperDetailPage({ params }: { params: Promise<{ id: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [paper] = await db.select().from(s.papers).where(eq(s.papers.id, p.id)).limit(1);
  if (!paper) notFound();

  const citations = await db.select().from(s.patentCitations).where(
    and(eq(s.patentCitations.kind, 'npl'), eq(s.patentCitations.citedPaperId, paper.id))
  );
  const sourcePatentIds = [...new Set(citations.map(c => c.sourcePatentId))];
  const sourcePatents = sourcePatentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, sourcePatentIds))
    : [];
  const patentById = new Map(sourcePatents.map(patent => [patent.id, patent]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{paper.title}</h1>
        {paper.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>
      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>掲載誌・学会：{paper.venue ?? '—'} ｜ 出典：{paper.source}</div>
        <div>
          発行日：<span className="mono">{paper.publishedOn ?? '—'}</span>
          {paper.sourceUrl && (
            <> ｜ <a href={paper.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>原文リンク →</a></>
          )}
        </div>
        {paper.abstract && <div style={{ color: 'var(--ink-2)' }}>{paper.abstract}</div>}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          この論文を非特許文献（NPL）として引用する特許
        </div>
        {citations.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            この論文を引用する特許はまだ記録されていません。
          </div>
        ) : (
          <div>
            {citations.map(c => {
              const source = patentById.get(c.sourcePatentId);
              return (
                <Link key={c.id} href={source ? `/patents/${source.id}` : '/patents'} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}>
                  <span style={{ flexGrow: 1, fontSize: 13 }}>{source?.title ?? '特許（削除済み）'}</span>
                  {c.note && <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{c.note}</span>}
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
