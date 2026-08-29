import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const STATUS_LABEL: Record<string, string> = { open: '調査中', closed: '完了' };

export default async function PatentSearchAgentPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.investigations).orderBy(desc(s.investigations.createdAt));

  return (
    <ListView
      title="Patent Search Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="検索式（investigations.query）に基づいて先行特許を探索するAgentです。investigations台帳の調査案件を出典として一覧表示します。"
      rows={rows}
      emptyMessage="Patent Search Agentによる調査案件はまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'query', mono: true, render: row => <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>検索式：{row.query}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status === 'open' ? 'var(--amber)' : 'var(--green)', border: `1px solid ${row.status === 'open' ? 'var(--amber)' : 'var(--green)'}` }}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) }
      ]}
    />
  );
}
