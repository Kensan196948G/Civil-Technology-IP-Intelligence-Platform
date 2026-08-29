export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function ReportAgentPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.reports).orderBy(desc(s.reports.createdAt));

  const authorIds = [...new Set(rows.map(r => r.createdBy))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="Report Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="技術調査報告書・Claim比較レポート・経営サマリー等をAIが下書き生成するAgentです。reports台帳の出力履歴を一覧表示します。"
      rows={rows}
      emptyMessage="Report Agentによる出力履歴はまだありません。"
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'format', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.format.toUpperCase()}</span> },
        { key: 'author', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{authorById.get(row.createdBy)?.displayName ?? '—'}</span> }
      ]}
    />
  );
}
