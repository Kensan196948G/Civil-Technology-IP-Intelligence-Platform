import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function ResearchAgentPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.papers).orderBy(desc(s.papers.publishedOn));

  return (
    <ListView
      title="Research Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="学術論文を横断調査し、要旨を要約するAgentです。papers台帳を出典として一覧表示します。"
      rows={rows}
      emptyMessage="調査対象となる論文データがまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'venue', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.venue ?? '—'}</span> },
        { key: 'publishedOn', mono: true, render: row => row.publishedOn ?? '—' },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}
