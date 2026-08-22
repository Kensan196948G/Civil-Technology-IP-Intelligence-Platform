import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export const runtime = 'edge';

type ApplicantRow = { name: string; patent_n: number; countries: string[]; latest_publication: string | null };

export default async function ApplicantSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb(getDatabaseUrl());
  const q = (searchParams.q ?? '').trim();
  const like = `%${q}%`;

  const result = await db.execute(sql`
    select applicant_name as name, count(*) as patent_n,
      array_agg(distinct country) as countries,
      max(publication_date) as latest_publication
    from patents
    where ${q}::text = '' or applicant_name ilike ${like}
    group by applicant_name
    order by patent_n desc, applicant_name asc
    limit 100
  `);
  const applicants = result.rows as unknown as ApplicantRow[];

  const competitors = await db.select().from(s.competitors);
  const competitorNames = new Set(competitors.map(c => c.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>出願人・企業検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / APPLICANT SEARCH</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        取り込み済み特許を出願人（企業）単位で集計します。登録済みの競合企業と一致する場合は目印を表示します。
      </p>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：北浜重工"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      {applicants.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          該当する出願人がいません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {applicants.map(a => (
          <div key={a.name} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, flexGrow: 1 }}>{a.name}</span>
            {competitorNames.has(a.name) && (
              <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>競合登録済み</span>
            )}
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{a.countries.join(' / ')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>最新公開 <span className="mono">{a.latest_publication ?? '—'}</span></span>
            <span className="mono" style={{ fontSize: 15, color: 'var(--blue)' }}>{Number(a.patent_n)}件</span>
          </div>
        ))}
      </div>
    </div>
  );
}
