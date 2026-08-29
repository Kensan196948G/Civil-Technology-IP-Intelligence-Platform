export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import Link from 'next/link';


export default async function SitesPage() {
  const db = getDb(getDatabaseUrl());
  const list = await db.select().from(s.sites);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>現場・課題</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-17 / SITES</span>
      </div>
      {list.length === 0 ? (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          登録されている現場はありません。
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(site => (
            <div key={site.id} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontWeight: 700 }}>{site.name}</span>
              <span className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>{site.code}</span>
              <span style={{ flexGrow: 1 }} />
              <Link href={`/sites/${site.id}/issue`} className="btn btn-secondary">困りごとを登録（モバイル画面）→</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
