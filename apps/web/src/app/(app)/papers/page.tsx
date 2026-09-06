import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';


export default async function PapersPage() {
  const db = getDb(getDatabaseUrl());
  const list = await db.select().from(s.papers).orderBy(desc(s.papers.publishedOn));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>論文</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-07 / RESEARCH PAPERS</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        取り込み済みの論文・学術文献の一覧です。特許の非特許文献（NPL）引用元としても参照されます。
      </p>

      {list.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          論文データがまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(p => (
          <Link key={p.id} href={`/papers/${p.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
              {p.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {p.venue ?? '—'} ｜ 出典 {p.source} ｜ 発行 <span className="mono">{p.publishedOn ?? '—'}</span>
            </div>
            {p.abstract && <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{p.abstract}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
