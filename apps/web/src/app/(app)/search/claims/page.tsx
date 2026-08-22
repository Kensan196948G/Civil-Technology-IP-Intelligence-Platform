import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

type ClaimRow = {
  id: string; claim_no: number; is_independent: boolean; text: string;
  patent_id: string; patent_title: string; applicant_name: string;
};

export default async function ClaimSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb(getDatabaseUrl());
  const q = (searchParams.q ?? '').trim();
  const like = `%${q}%`;

  const result = await db.execute(sql`
    select pc.id, pc.claim_no, pc.is_independent, pc.text,
      p.id as patent_id, p.title as patent_title, p.applicant_name
    from patent_claims pc
    join patents p on p.id = pc.patent_id
    where ${q} = '' or pc.text ilike ${like}
    order by p.retrieved_at desc, pc.claim_no asc
    limit 50
  `);
  const rows = result.rows as unknown as ClaimRow[];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>Claim検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / CLAIM SEARCH</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        他社特許の請求項本文をキーワードで検索します。該当特許の詳細から構成要件分解を確認できます。
      </p>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：動揺補償機構"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      {rows.length === 0 && (
        <div className="notice notice-blue">{q ? `「${q}」に一致する請求項がありません。` : '請求項データがまだありません。'}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <Link key={r.id} href={`/patents/${r.patent_id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>請求項{r.claim_no}</span>
              {r.is_independent && <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>独立項</span>}
              <span style={{ flexGrow: 1 }} />
              <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{r.applicant_name}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{r.patent_title}</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>{r.text}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
