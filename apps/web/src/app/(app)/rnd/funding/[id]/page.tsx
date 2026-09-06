import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';

const KIND_LABEL: Record<string, string> = {
  technology: '技術', method: '工法', material: '材料', machine: '建設機械'
};

export default async function FundingProgramDetailPage({ params }: { params: Promise<{ id: string }> })
{
  // Next.js 15: params は Promise になったため await する
  const p = await params;
  const db = getDb(getDatabaseUrl());
  const [program] = await db.select().from(s.fundingPrograms).where(eq(s.fundingPrograms.id, p.id)).limit(1);
  if (!program) notFound();

  const matches = await db
    .select({
      matchId: s.fundingMatches.id,
      matchScore: s.fundingMatches.matchScore,
      rationale: s.fundingMatches.rationale,
      technologyId: s.technologies.id,
      technologyName: s.technologies.name,
      technologyKind: s.technologies.kind,
      technologyMaturity: s.technologies.maturity
    })
    .from(s.fundingMatches)
    .innerJoin(s.technologies, eq(s.fundingMatches.technologyId, s.technologies.id))
    .where(eq(s.fundingMatches.fundingProgramId, program.id))
    .orderBy(desc(s.fundingMatches.matchScore));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>{program.name}</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>M42 / R&D FUNDING INTELLIGENCE</span>
        {program.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
      </div>

      <div className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
        <div>
          制度：<span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{program.agency}</span>
          {' '}｜ 対象分野：{program.field ?? '—'}
        </div>
        <div>助成額目安：<span className="mono">{program.amountRange ?? '—'}</span> ｜ 応募締切：<span className="mono">{program.applicationDeadline ?? '—'}</span></div>
        {program.summary && <div style={{ color: 'var(--ink-2)' }}>{program.summary}</div>}
        {program.sourceUrl && (
          <div>
            出典：<a href={program.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>{program.sourceUrl}</a>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          マッチする研究テーマ（スコア降順）
        </div>
        {matches.length === 0 ? (
          <div style={{ padding: '13px 16px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            この助成制度にマッチする研究テーマはまだ登録されていません。
          </div>
        ) : (
          <div>
            {matches.map(m => (
              <Link key={m.matchId} href="/rnd/themes" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}>
                <span className="mono" style={{ fontSize: 15, color: 'var(--blue)' }}>{Number(m.matchScore).toFixed(0)}<span style={{ fontSize: 11, color: 'var(--ink-2)' }}> / 100</span></span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{m.technologyName}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
                    {KIND_LABEL[m.technologyKind] ?? m.technologyKind}
                    {m.technologyMaturity ? ` ｜ 成熟度 ${m.technologyMaturity}` : ''}
                    {m.rationale ? ` ｜ ${m.rationale}` : ''}
                  </span>
                </span>
                <span style={{ flexGrow: 1 }} />
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>研究テーマ一覧へ →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
