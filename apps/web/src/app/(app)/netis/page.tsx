import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';


export default async function NetisPage() {
  const db = getDb(getDatabaseUrl());
  const list = await db.select().from(s.netisTechnologies).orderBy(desc(s.netisTechnologies.registeredOn));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>NETIS・公開技術</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-09 / NETIS / PUBLIC TECHNOLOGY</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        国交省NETIS等の公開技術情報の一覧です。現場適用性評価の候補技術としても利用されます。
      </p>

      {list.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          NETIS技術データがまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(n => (
          <Link key={n.id} href={`/netis/${n.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{n.name}</span>
              {n.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {n.netisNo} ｜ {n.category ?? '—'} ｜ 登録 <span className="mono">{n.registeredOn ?? '—'}</span>
            </div>
            {n.summary && <div style={{ fontSize: 12.5 }}>{n.summary}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
