export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';


type Row = {
  analysis_id: string; tech_id: string; tech_name: string;
  patent_id: string; patent_title: string; applicant_name: string;
  match_n: number; total_n: number;
};

export default async function MultiComparePage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select a.id as analysis_id, t.id as tech_id, t.name as tech_name,
      p.id as patent_id, p.title as patent_title, p.applicant_name,
      count(r.id) filter (where r.kind='match') as match_n, count(r.id) as total_n
    from claim_analyses a
    join technologies t on t.id = a.technology_id
    join patents p on p.id = a.patent_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, t.id, t.name, p.id, p.title, p.applicant_name
    order by t.name, p.title
  `);
  const rows = result.rows as unknown as Row[];

  const byTech = new Map<string, { name: string; items: Row[] }>();
  for (const r of rows) {
    const g = byTech.get(r.tech_id) ?? { name: r.tech_name, items: [] };
    g.items.push(r);
    byTech.set(r.tech_id, g);
  }
  const groups = [...byTech.entries()].sort((a, b) => b[1].items.length - a[1].items.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>複数特許比較</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-13 / CLAIM INTELLIGENCE</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        自社技術ごとに、比較対象となった複数の他社特許を並べて一致率を比較します。
      </p>

      {groups.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>比較データがまだありません。</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {groups.map(([techId, g]) => (
          <div key={techId} className="card" style={{ padding: 0 }}>
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</span>
              <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>比較特許 {g.items.length} 件</span>
            </div>
            <div>
              {g.items.map(item => (
                <Link key={item.analysis_id} href={`/claims/${item.analysis_id}`} className="card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--line-2)', color: 'var(--ink)' }}>
                  <span style={{ flexGrow: 1 }}>{item.patent_title}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{item.applicant_name}</span>
                  <span className="mono">{item.total_n > 0 ? Math.round((item.match_n / item.total_n) * 100) : 0}%</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
