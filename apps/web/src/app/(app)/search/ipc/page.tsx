import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

type CodeRow = { code: string; patent_n: number };
type PatentRow = { id: string; title: string; applicant_name: string; country: string; ipc_codes: string[] };

export default async function IpcSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb(getDatabaseUrl());
  const q = (searchParams.q ?? '').trim();
  const like = `${q}%`;

  const codesResult = await db.execute(sql`
    select code, count(*) as patent_n
    from (select unnest(ipc_codes) as code from patents) t
    where ${q} = '' or code ilike ${like}
    group by code
    order by patent_n desc, code asc
    limit 50
  `);
  const codes = codesResult.rows as unknown as CodeRow[];

  let matchedPatents: PatentRow[] = [];
  if (q) {
    const patentsResult = await db.execute(sql`
      select id, title, applicant_name, country, ipc_codes
      from patents
      where exists (select 1 from unnest(ipc_codes) as c where c ilike ${like})
      order by publication_date desc nulls last
      limit 30
    `);
    matchedPatents = patentsResult.rows as unknown as PatentRow[];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>IPC / CPC検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / IPC SEARCH</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        国際特許分類（IPC）コードの前方一致検索です。コードを指定すると該当する特許一覧を表示します。
      </p>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：E02D"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          {q ? `「${q}」に前方一致するIPCコード` : '登録済み特許のIPCコード集計（上位50件）'}
        </div>
        {codes.length === 0 && (
          <div style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>該当するIPCコードがありません。</div>
        )}
        {codes.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '12px 16px' }}>
            {codes.map(c => (
              <Link key={c.code} href={`/search/ipc?q=${encodeURIComponent(c.code)}`} className="mono"
                style={{ fontSize: 11.5, color: 'var(--ink)', border: '1px solid var(--line)', borderRadius: 3, padding: '4px 8px' }}>
                {c.code} <span style={{ color: 'var(--ink-2)' }}>×{Number(c.patent_n)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {q && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {matchedPatents.length === 0 && (
            <div className="notice notice-blue">「{q}」に一致する特許がありません。</div>
          )}
          {matchedPatents.map(p => (
            <Link key={p.id} href={`/patents/${p.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{p.applicant_name} ｜ {p.country}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.ipc_codes.map(ipc => (
                  <span key={ipc} className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 6px' }}>{ipc}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
