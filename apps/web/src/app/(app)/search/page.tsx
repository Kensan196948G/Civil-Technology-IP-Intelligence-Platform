import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import { sql } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

const TABS = [
  { key: 'patent', label: '特許' }, { key: 'paper', label: '論文' },
  { key: 'netis', label: 'NETIS' }, { key: 'tech', label: '自社技術' }
] as const;

const PER_TAB_LIMIT = 30;

// CodeRabbit指摘: 以前は4種別をUNION ALLしたうえで全体にLIMITをかけていたため、
// 特許だけで上限に達すると他の種別が0件に見えてしまうバグがあった。
// 種別ごとに独立してクエリ・件数集計・上限適用を行うよう修正した。
async function runSearchByTab(q: string, tab: string) {
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;

  if (tab === 'patent') {
    const r = await db.execute(sql`
      select 'patent' as kind, id, title, applicant_name as sub, source, retrieved_at, classification, is_sample
      from patents where ${q} = '' or title ilike ${like} or abstract ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  if (tab === 'paper') {
    const r = await db.execute(sql`
      select 'paper' as kind, id, title, venue as sub, source, retrieved_at, 'C1' as classification, is_sample
      from papers where ${q} = '' or title ilike ${like} or abstract ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  if (tab === 'netis') {
    const r = await db.execute(sql`
      select 'netis' as kind, id, name as title, category as sub, source, retrieved_at, 'C1' as classification, is_sample
      from netis_technologies where ${q} = '' or name ilike ${like} or summary ilike ${like}
      order by retrieved_at desc limit ${PER_TAB_LIMIT}
    `);
    return r.rows as any[];
  }
  const r = await db.execute(sql`
    select 'tech' as kind, id, name as title, kind as sub, 'social:internal' as source, created_at as retrieved_at, classification, is_sample
    from technologies where ${q} = '' or name ilike ${like} or summary ilike ${like}
    order by created_at desc limit ${PER_TAB_LIMIT}
  `);
  return r.rows as any[];
}

async function countAllTabs(q: string) {
  const db = getDb(getDatabaseUrl());
  const like = `%${q}%`;
  const r = await db.execute(sql`
    select
      (select count(*) from patents where ${q} = '' or title ilike ${like} or abstract ilike ${like}) as patent,
      (select count(*) from papers where ${q} = '' or title ilike ${like} or abstract ilike ${like}) as paper,
      (select count(*) from netis_technologies where ${q} = '' or name ilike ${like} or summary ilike ${like}) as netis,
      (select count(*) from technologies where ${q} = '' or name ilike ${like} or summary ilike ${like}) as tech
  `);
  return r.rows[0] as any;
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string; tab?: string } }) {
  const q = searchParams.q ?? '';
  const tab = searchParams.tab ?? 'patent';
  const [shown, counts] = await Promise.all([runSearchByTab(q, tab), countAllTabs(q)]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>横断検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / UNIVERSAL SEARCH</span>
      </div>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input type="hidden" name="tab" value={tab} />
        <input name="q" defaultValue={q} placeholder="例：港湾 ケーソン 据付 自動化" style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)' }}>
        {TABS.map(t => (
          <Link key={t.key} href={`/search?q=${encodeURIComponent(q)}&tab=${t.key}`}
            style={{
              padding: '9px 16px', marginBottom: -1, borderBottom: `2px solid ${tab === t.key ? 'var(--blue)' : 'transparent'}`,
              color: tab === t.key ? 'var(--blue)' : 'var(--ink-2)', fontWeight: tab === t.key ? 700 : 400, fontSize: 13
            }}>
            {t.label} <span className="mono" style={{ fontSize: 11 }}>{Number(counts?.[t.key] ?? 0)}</span>
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {shown.length === 0 && (
          <div className="notice notice-blue">該当する結果がありません。検索語を短くするか、他のタブをお試しください。</div>
        )}
        {shown.map((r: any) => (
          <div key={r.id} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span className="pill" style={{ color: 'var(--blue)' }}>{r.kind}</span>
              <span style={{ fontSize: 15, fontWeight: 700 }}>{r.title}</span>
              {r.is_sample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {r.sub} ｜ 出典 {r.source} ｜ 取得 <span className="mono">{String(r.retrieved_at).slice(0, 10)}</span>
            </div>
            {r.kind === 'patent' && <Link href={`/patents/${r.id}`} style={{ fontSize: 12 }}>特許詳細を見る →</Link>}
            {r.kind === 'netis' && <Link href={`/netis/${r.id}`} style={{ fontSize: 12 }}>NETIS詳細を見る →</Link>}
            {r.kind === 'tech' && <Link href={`/field/by-tech/${r.id}`} style={{ fontSize: 12 }}>現場適用性を見る →</Link>}
          </div>
        ))}
      </div>

      {shown.length === PER_TAB_LIMIT && (
        <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>上位{PER_TAB_LIMIT}件のみ表示しています（MVP簡易実装。本番はページネーションに対応）。</div>
      )}
    </div>
  );
}
