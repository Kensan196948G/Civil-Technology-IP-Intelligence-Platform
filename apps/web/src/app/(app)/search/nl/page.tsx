import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';


type NlRow = { kind: string; id: string; title: string; sub: string | null; snippet: string | null };

async function nlSearch(q: string): Promise<NlRow[]> {
  if (!q) return [];
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;
  // CodeRabbit指摘: UNION ALL全体にlimitをかけると、特許だけで上限に達した場合に
  // 自社技術・NETIS・論文の候補が一切表示されなくなる（横断検索の説明と不整合）。
  // 種別ごとに独立してlimitし、常に各種別の候補が出る余地を残す。
  const r = await db.execute(sql`
    (select 'patent' as kind, id, title, applicant_name as sub, abstract as snippet from patents
      where title ilike ${like} or abstract ilike ${like} limit 5)
    union all
    (select 'tech' as kind, id, name as title, kind as sub, summary as snippet from technologies
      where name ilike ${like} or summary ilike ${like} limit 5)
    union all
    (select 'netis' as kind, id, name as title, category as sub, summary as snippet from netis_technologies
      where name ilike ${like} or summary ilike ${like} limit 5)
    union all
    (select 'paper' as kind, id, title, venue as sub, abstract as snippet from papers
      where title ilike ${like} or abstract ilike ${like} limit 5)
  `);
  return r.rows as unknown as NlRow[];
}

const KIND_LABEL: Record<string, string> = { patent: '特許', tech: '自社技術', netis: 'NETIS', paper: '論文' };
const KIND_HREF: Record<string, (id: string) => string | null> = {
  patent: id => `/patents/${id}`, netis: id => `/netis/${id}`, tech: () => null, paper: () => null
};

export default async function NlSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> })
{
  // Next.js 15: searchParams は Promise になったため await する
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const results = await nlSearch(q);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>AI自然言語検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / AI NL SEARCH</span>
      </div>
      <div className="notice notice-blue" style={{ fontSize: 12 }}>
        自然文で質問すると、特許・自社技術・NETIS・論文を横断して関連する候補を提示します
        （MVPではキーワード一致による簡易実装。本番設計では意味検索モデルへ置き換え予定）。結果には必ず種別と出典タイトルが付きます。
      </div>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：港湾工事でケーソンの据付精度を自動で補正する技術はある？"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">質問する</button>
      </form>

      {q && results.length === 0 && (
        <div className="notice notice-amber">該当する候補が見つかりませんでした。表現を変えてお試しください。</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {results.map(r => {
          const href = KIND_HREF[r.kind]?.(r.id) ?? null;
          const content = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <span className="pill" style={{ color: 'var(--blue)' }}>{KIND_LABEL[r.kind] ?? r.kind}</span>
                <span style={{ fontWeight: 700 }}>{r.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.sub ?? '—'}</div>
              {r.snippet && <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.snippet}</div>}
            </div>
          );
          return href ? (
            <Link key={`${r.kind}-${r.id}`} href={href} className="card" style={{ padding: '13px 15px', color: 'var(--ink)' }}>{content}</Link>
          ) : (
            <div key={`${r.kind}-${r.id}`} className="card" style={{ padding: '13px 15px' }}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
