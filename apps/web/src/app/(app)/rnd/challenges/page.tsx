import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';


export default async function RndChallengesPage() {
  const db = getDb(getDatabaseUrl());
  const issues = await db.select().from(s.siteIssues).orderBy(desc(s.siteIssues.createdAt));

  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
  const siteById = new Map(sites.map(sv => [sv.id, sv]));

  const rows = issues.map(issue => ({
    id: issue.id,
    body: issue.body,
    status: issue.status,
    siteName: siteById.get(issue.siteId)?.name ?? '—',
    createdAt: issue.createdAt
  }));

  return (
    <ListView
      title="技術課題"
      moduleCode="S-10 / TECHNICAL CHALLENGES"
      description="現場から報告された困りごとを、R&Dが解決すべき技術課題として一覧化しています。"
      rows={rows}
      emptyMessage="技術課題として報告された案件はまだありません。"
      fields={[
        { key: 'body', grow: true, render: row => <span>{row.body.length > 60 ? `${row.body.slice(0, 60)}…` : row.body}</span> },
        { key: 'site', mono: true, render: row => row.siteName },
        { key: 'status', render: row => (
          <span className="badge" style={{
            color: row.status === 'open' ? 'var(--amber)' : 'var(--green)',
            border: `1px solid ${row.status === 'open' ? 'var(--amber)' : 'var(--green)'}`
          }}>{row.status === 'open' ? '未解決' : row.status}</span>
        ) },
        { key: 'createdAt', mono: true, render: row => ymd(row.createdAt) }
      ]}
    />
  );
}
