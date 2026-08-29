import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';


type Row = {
  id: string; patent_title: string; applicant_name: string; tech_name: string;
  match_n: number; similar_n: number; differ_n: number; total_n: number;
};

export default async function ClaimMatrixPage() {
  const db = getDb(getDatabaseUrl());
  const result = await db.execute(sql`
    select a.id, p.title as patent_title, p.applicant_name, t.name as tech_name,
      count(r.id) filter (where r.kind='match') as match_n,
      count(r.id) filter (where r.kind='similar') as similar_n,
      count(r.id) filter (where r.kind='differ') as differ_n,
      count(r.id) as total_n
    from claim_analyses a
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    left join claim_chart_rows r on r.analysis_id = a.id
    group by a.id, p.title, p.applicant_name, t.name
    order by p.title
  `);
  const rows = result.rows as unknown as Row[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim Matrix</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-13 / CLAIM INTELLIGENCE</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        他社特許 × 自社技術の組み合わせごとに、構成要件の判定内訳（一致／類似／相違）をマトリクス表示します。
      </p>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>Claim Matrix データがまだありません。</div>
      )}

      {rows.length > 0 && (
        <div className="card" style={{ overflow: 'auto' }}>
          <table className="plain">
            <thead>
              <tr>
                <th>他社特許</th>
                <th>自社技術</th>
                <th style={{ width: 70 }}>一致</th>
                <th style={{ width: 70 }}>類似</th>
                <th style={{ width: 70 }}>相違</th>
                <th style={{ width: 70 }}>合計</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{r.patent_title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-2)' }}>{r.applicant_name}</div>
                  </td>
                  <td>{r.tech_name}</td>
                  <td className="mono" style={{ color: 'var(--green)' }}>{r.match_n}</td>
                  <td className="mono" style={{ color: 'var(--amber)' }}>{r.similar_n}</td>
                  <td className="mono" style={{ color: 'var(--brick)' }}>{r.differ_n}</td>
                  <td className="mono">{r.total_n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
