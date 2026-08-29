import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';


export default async function ClaimsIndex() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.execute(sql`
    select a.id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      count(r.id) filter (where r.kind='match') as match_n, count(r.id) as total_n
    from claim_analyses a
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, p.title, p.applicant_name, t.name
  `);
  const list = rows.rows as any[];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim解析</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-13 / CLAIM INTELLIGENCE</span>
      </div>
      {list.length === 0 ? (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          登録されているClaim解析はありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(r => (
            <Link key={r.id} href={`/claims/${r.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
              <span style={{ fontWeight: 700 }}>{r.patent_title}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.applicant_name} vs. {r.tech_name}</span>
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 13 }}>{r.total_n > 0 ? Math.round((r.match_n / r.total_n) * 100) : 0}%</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
