import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

export default async function InventionsPage() {
  const db = getDb(getDatabaseUrl());
  const inventions = await db.select().from(s.inventions).orderBy(desc(s.inventions.createdAt));

  const userIds = [...new Set(inventions.map(i => i.submittedBy))];
  const users = userIds.length
    ? await db.select().from(s.users).where(inArray(s.users.id, userIds))
    : [];
  const userById = new Map(users.map(u => [u.id, u]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>発明管理</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-16 / INVENTION MANAGEMENT</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        現場や技術者から届け出られた発明届の一覧です。各件からAI一次レビューと審査ワークフローの状況を確認できます。
      </p>

      {inventions.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          発明届はまだありません。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {inventions.map(inv => (
          <Link key={inv.id} href={`/inventions/${inv.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)' }}>
            <span style={{ fontWeight: 700 }}>{inv.title}</span>
            <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{inv.classification}</span>
            <span style={{ flexGrow: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案 {userById.get(inv.submittedBy)?.displayName ?? '—'}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
