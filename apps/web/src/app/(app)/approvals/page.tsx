import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth/current-user';

export const runtime = 'edge';

export default async function ApprovalsPage() {
  const db = getDb(getDatabaseUrl());
  const user = (await getCurrentUser())!;
  const rows = await db.execute(sql`
    select wi.id, wi.kind, wi.title, wi.status, wi.classification, wi.due_on, u.display_name as author, wi.author_id
    from workflow_instances wi join users u on u.id = wi.author_id
    order by wi.created_at desc
  `);
  const list = rows.rows as any[];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>承認・案件一覧</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-29 / WORKFLOW</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map(w => (
          <Link key={w.id} href={`/approvals/${w.id}`} className="card" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
            <span className="pill" style={{ color: 'var(--blue)' }}>{w.kind}</span>
            <span style={{ fontWeight: 700 }}>{w.title}</span>
            <span className="pill" style={{ color: w.classification === 'C3' ? 'var(--amber)' : 'var(--green)' }}>{w.classification}</span>
            <span style={{ flexGrow: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{w.status}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案 {w.author}</span>
            
          </Link>
        ))}
      </div>
    </div>
  );
}
