import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

export default async function PatentsPage() {
  const db = getDb(getDatabaseUrl());
  const patents = await db.select().from(s.patents).orderBy(desc(s.patents.retrievedAt));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>特許</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-05 / PATENT INTELLIGENCE</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        取り込み済みの他社特許の一覧です。各件から請求項・構成要件の分解を確認できます。
      </p>

      {patents.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          特許データがまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {patents.map(p => (
          <Link key={p.id} href={`/patents/${p.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{p.title}</span>
              <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{p.classification}</span>
              {p.isSample && <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
              {p.applicantName} ｜ {p.country} {p.publicationNo} ｜ 公開 <span className="mono">{p.publicationDate ?? '—'}</span>
            </div>
            {p.ipcCodes.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {p.ipcCodes.map(ipc => (
                  <span key={ipc} className="mono" style={{ fontSize: 10.5, color: 'var(--ink-2)', border: '1px solid var(--line)', borderRadius: 3, padding: '1px 6px' }}>{ipc}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
