import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { sql, count } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

async function loadCounts() {
  const db = getDb(getDatabaseUrl());
  const [patents] = await db.select({ n: count() }).from(s.patents);
  const [technologies] = await db.select({ n: count() }).from(s.technologies);
  const [netis] = await db.select({ n: count() }).from(s.netisTechnologies);
  const [papers] = await db.select({ n: count() }).from(s.papers);
  const [workflows] = await db.select({ n: count() }).from(s.workflowInstances);
  const pending = await db.execute(sql`
    select wi.id, wi.title, wi.status, wi.kind, wi.due_on, u.display_name as author
    from workflow_instances wi join users u on u.id = wi.author_id
    order by wi.created_at desc limit 5
  `);
  return {
    patents: patents?.n ?? 0, technologies: technologies?.n ?? 0, netis: netis?.n ?? 0,
    papers: papers?.n ?? 0, workflows: workflows?.n ?? 0,
    pending: pending.rows as any[]
  };
}

export default async function DashboardPage() {
  const c = await loadCounts();
  const cards = [
    { label: '特許', n: c.patents, href: '/search?tab=patent' },
    { label: '論文', n: c.papers, href: '/search?tab=paper' },
    { label: 'NETIS', n: c.netis, href: '/search?tab=netis' },
    { label: '自社技術', n: c.technologies, href: '/search?tab=tech' },
    { label: '承認・案件', n: c.workflows, href: '/approvals' }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>ダッシュボード</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-01 / EXECUTIVE DASHBOARD</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {cards.map(cd => (
          <Link key={cd.label} href={cd.href} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-2)' }}>{cd.label.toUpperCase()}</span>
            <span className="mono" style={{ fontSize: 30, color: 'var(--blue)' }}>{cd.n}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          要対応・最近の案件
        </div>
        <table className="plain">
          <thead><tr><th>種別</th><th>件名</th><th>ステータス</th><th>起案</th><th>期限</th></tr></thead>
          <tbody>
            {c.pending.map((w: any) => (
              <tr key={w.id}>
                <td className="mono" style={{ fontSize: 11 }}>{w.kind}</td>
                <td><Link href={`/approvals/${w.id}`}>{w.title}</Link></td>
                <td>{w.status}</td>
                <td>{w.author}</td>
                <td className="mono">{w.due_on ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
