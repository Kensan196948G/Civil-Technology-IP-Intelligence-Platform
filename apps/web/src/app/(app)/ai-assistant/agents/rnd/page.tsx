import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function RndAgentPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.researchers).orderBy(desc(s.researchers.createdAt));

  return (
    <ListView
      title="R&D Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="社内外の研究者・発明者の知見を横断し、研究開発テーマの検討を支援するAgentです。researchers台帳を一覧表示します。"
      rows={rows}
      emptyMessage="登録されている研究者・発明者がまだいません。"
      fields={[
        { key: 'name', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.name}</span> },
        { key: 'affiliation', render: row => <span style={{ fontSize: 12.5 }}>{row.affiliation ?? '—'}</span> },
        { key: 'field', render: row => row.field ? (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.field}</span>
        ) : null },
        { key: 'sample', render: row => row.isSample ? <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>デモ</span> : null }
      ]}
    />
  );
}
