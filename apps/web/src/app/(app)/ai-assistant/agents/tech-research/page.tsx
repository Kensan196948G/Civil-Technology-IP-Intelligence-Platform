import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type Row = { id: string; title: string; sub: string; source: 'technology' | 'netis'; href: string | null };

export default async function TechResearchAgentPage() {
  const db = getDb(getDatabaseUrl());
  const [technologies, netisTechs] = await Promise.all([
    db.select().from(s.technologies).orderBy(desc(s.technologies.createdAt)),
    db.select().from(s.netisTechnologies).orderBy(desc(s.netisTechnologies.registeredOn))
  ]);

  const rows: Row[] = [
    ...technologies.map(t => ({ id: t.id, title: t.name, sub: `自社技術（${t.kind}）${t.maturity ? ' ／ ' + t.maturity : ''}`, source: 'technology' as const, href: null })),
    ...netisTechs.map(n => ({ id: n.id, title: n.name, sub: `NETIS登録技術${n.category ? '（' + n.category + '）' : ''}`, source: 'netis' as const, href: `/netis/${n.id}` }))
  ];

  return (
    <ListView
      title="技術調査Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="自社が保有する技術・工法・材料と、外部のNETIS登録技術を横断調査するAgentです。技術・NETIS台帳（technologies / netis_technologies）を出典として回答します。"
      rows={rows}
      emptyMessage="調査対象となる技術データがまだありません。"
      rowHref={row => row.href ?? ''}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'sub', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.sub}</span> },
        { key: 'source', render: row => (
          <span className="badge" style={{ color: row.source === 'netis' ? 'var(--green)' : 'var(--blue)', border: `1px solid ${row.source === 'netis' ? 'var(--green)' : 'var(--blue)'}` }}>
            {row.source === 'netis' ? 'NETIS' : '自社技術'}
          </span>
        ) }
      ]}
    />
  );
}
