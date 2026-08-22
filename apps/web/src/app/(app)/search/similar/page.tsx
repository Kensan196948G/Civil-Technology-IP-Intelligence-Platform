import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

type SimilarRow = {
  id: string; our_text: string; quoted_text: string; rationale: string | null;
  analysis_id: string; patent_title: string; applicant_name: string; tech_name: string;
};

export default async function SimilarSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb(getDatabaseUrl());
  const q = (searchParams.q ?? '').trim();
  const like = `%${q}%`;

  const result = await db.execute(sql`
    select r.id, r.our_text, r.quoted_text, r.rationale,
      a.id as analysis_id, p.title as patent_title, p.applicant_name, t.name as tech_name
    from claim_chart_rows r
    join claim_analyses a on a.id = r.analysis_id
    join patents p on p.id = a.patent_id
    join technologies t on t.id = a.technology_id
    where r.kind = 'similar'
      and (${q} = '' or r.our_text ilike ${like} or r.quoted_text ilike ${like} or t.name ilike ${like} or p.title ilike ${like})
    order by a.created_at desc, r.seq asc
    limit 50
  `);
  const rows = result.rows as unknown as SimilarRow[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>類似技術検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / SIMILAR TECH SEARCH</span>
      </div>
      <div className="notice notice-brick" style={{ fontSize: 12 }}>
        <strong>類似度は権利侵害の判断ではありません。</strong>
        Claim比較でAIが「類似」と判定した要件を横断的に一覧化したものです。専門家が確認すべき箇所を絞るための目印として利用してください。
      </div>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：吊具 / ケーソン据付装置"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      {rows.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          該当する類似判定はまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <Link key={r.id} href={`/claims/${r.analysis_id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>類似</span>
              <span style={{ fontWeight: 700 }}>{r.patent_title}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>（{r.applicant_name}） vs. {r.tech_name}</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>他社特許：{r.quoted_text}</div>
            <div style={{ fontSize: 12.5 }}>自社案：{r.our_text}</div>
            {r.rationale && <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>根拠：{r.rationale}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
