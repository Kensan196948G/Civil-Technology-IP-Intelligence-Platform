import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, or, ilike } from 'drizzle-orm';

export const runtime = 'edge';

export default async function ResearcherSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const db = getDb(getDatabaseUrl());
  const q = (searchParams.q ?? '').trim();
  const like = `%${q}%`;

  const rows = q
    ? await db.select().from(s.researchers)
        .where(or(ilike(s.researchers.name, like), ilike(s.researchers.affiliation, like), ilike(s.researchers.field, like)))
        .orderBy(asc(s.researchers.name))
    : await db.select().from(s.researchers).orderBy(asc(s.researchers.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>発明者・研究者検索</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-02 / RESEARCHER SEARCH</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        社内外の発明者・研究者を氏名・所属・専門分野で検索します。
      </p>

      <form className="card" style={{ display: 'flex', gap: 10, padding: 12 }}>
        <input name="q" defaultValue={q} placeholder="例：吉田 淳 / 港湾・海洋工学"
          style={{ flexGrow: 1, height: 36, padding: '0 12px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 14 }} />
        <button className="btn btn-primary" type="submit">検索</button>
      </form>

      {rows.length === 0 && (
        <div className="notice notice-blue">該当する発明者・研究者が見つかりませんでした。</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <div key={r.id} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, flexGrow: 1 }}>{r.name}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{r.affiliation ?? '—'}</span>
            <span className="pill" style={{ color: 'var(--blue)' }}>{r.field ?? '—'}</span>
            {r.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
