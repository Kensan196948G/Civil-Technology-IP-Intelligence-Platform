import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveLicenseSubjects, LICENSE_STATUS_LABEL, LICENSE_STATUS_COLOR } from '@/lib/licensing-subjects';


type Row = { id: string; origin: 'build' | 'buy'; title: string; sub: string; status?: string };

export default async function BuildVsBuyPage() {
  const db = getDb(getDatabaseUrl());
  const technologies = await db.select().from(s.technologies).orderBy(desc(s.technologies.createdAt));
  const inbound = await db.select().from(s.licenses).where(eq(s.licenses.kind, 'license_in')).orderBy(desc(s.licenses.createdAt));
  const subjects = await resolveLicenseSubjects(db, inbound);

  const rows: Row[] = [
    ...technologies.map(t => ({ id: `build-${t.id}`, origin: 'build' as const, title: t.name, sub: `${t.kind} ｜ 成熟度：${t.maturity ?? '—'}` })),
    ...inbound.map(l => ({
      id: `buy-${l.id}`, origin: 'buy' as const, title: subjects.label(l.subjectType, l.subjectId),
      sub: `提供元：${l.counterpartName}`, status: l.status
    }))
  ];

  return (
    <ListView
      title="自社開発との比較（Build vs Buy）"
      moduleCode="S-11g / LICENSING & IP PORTFOLIO"
      description="自社保有技術（Build）と、社外からの技術導入候補（Buy）を並べて比較します。同等の技術領域を自社開発するか、ライセンス導入するかの判断材料です。"
      rows={rows}
      emptyMessage="比較対象となる技術・導入候補がまだありません。"
      fields={[
        { key: 'origin', render: row => (
          <span className="badge" style={{ color: row.origin === 'build' ? 'var(--green)' : 'var(--blue)', border: `1px solid ${row.origin === 'build' ? 'var(--green)' : 'var(--blue)'}` }}>
            {row.origin === 'build' ? '自社開発 (Build)' : '導入候補 (Buy)'}
          </span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'sub', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.sub}</span> },
        { key: 'status', render: row => row.status ? (
          <span className="badge" style={{ color: LICENSE_STATUS_COLOR[row.status] ?? 'var(--ink-2)', border: `1px solid ${LICENSE_STATUS_COLOR[row.status] ?? 'var(--line)'}` }}>
            {LICENSE_STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) : null }
      ]}
    />
  );
}
