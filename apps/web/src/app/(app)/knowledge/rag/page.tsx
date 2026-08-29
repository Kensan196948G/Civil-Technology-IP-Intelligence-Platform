import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';


async function ragSearch(q: string) {
  if (!q) return [];
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;
  // CodeRabbit指摘: UNION ALL全体へのlimitは種別間で偏る（search/nlと同じ問題）。
  // 種別ごとに独立してlimitする。
  const r = await db.execute(sql`
    (select 'patent' as kind, id, title, abstract as snippet from patents where title ilike ${like} or abstract ilike ${like} limit 3)
    union all
    (select 'tech' as kind, id, name as title, summary as snippet from technologies where name ilike ${like} or summary ilike ${like} limit 3)
    union all
    (select 'netis' as kind, id, name as title, summary as snippet from netis_technologies where name ilike ${like} or summary ilike ${like} limit 3)
    union all
    (select 'paper' as kind, id, title, abstract as snippet from papers where title ilike ${like} or abstract ilike ${like} limit 3)
  `);
  return r.rows as any[];
}

export default async function RagPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = searchParams.q ?? '';
  const results = await ragSearch(q);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>RAG検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-21 / KNOWLEDGE RAG</span>
      </div>
      <div className="notice notice-blue" style={{ fontSize: 12 }}>
        MVPではキーワード一致による簡易検索です（本番設計ではpgvectorによる意味検索を実装予定）。
        結果には必ず出典（種別・タイトル）が付きます。
      </div>
      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：ケーソン据付の自動化について教えて"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">質問する</button>
      </form>

      {q && results.length === 0 && (
        <div className="notice notice-amber">該当するナレッジが見つかりませんでした。</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(r => (
          <div key={`${r.kind}-${r.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
              <span className="pill" style={{ color: 'var(--blue)' }}>{r.kind}</span>
              <span style={{ fontWeight: 700 }}>{r.title}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>出典：{r.snippet}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
