import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function CivilEngineerAgentPage() {
  const db = getDb(getDatabaseUrl());
  const applications = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt));

  const siteIssueIds = [...new Set(applications.map(a => a.siteIssueId))];
  const issues = siteIssueIds.length ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, siteIssueIds)) : [];
  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
  const issueById = new Map(issues.map(i => [i.id, i]));
  const siteById = new Map(sites.map(sv => [sv.id, sv]));

  return (
    <ListView
      title="Civil Engineer Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="現場の困りごと（site_issues）に対して候補技術を提案し、工種・海象・地盤等の観点で適用性スコアを算出するAgentです。field_applications台帳を一覧表示します。"
      rows={applications}
      emptyMessage="現場適用性評価の結果はまだありません。"
      rowHref={row => `/field/${row.id}`}
      fields={[
        { key: 'site', grow: true, render: row => {
          const issue = issueById.get(row.siteIssueId);
          const site = issue ? siteById.get(issue.siteId) : undefined;
          return <span style={{ fontWeight: 700 }}>{site?.name ?? '—'}</span>;
        } },
        { key: 'candidateType', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>候補：{row.candidateType === 'technology' ? '自社技術' : 'NETIS'}</span> },
        { key: 'score', mono: true, render: row => (
          <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{Number(row.score).toFixed(0)}<span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 400 }}> / 100</span></span>
        ) }
      ]}
    />
  );
}
