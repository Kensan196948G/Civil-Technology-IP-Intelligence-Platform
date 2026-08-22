import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

export default async function RndNeedsPage() {
  const db = getDb(getDatabaseUrl());
  const applications = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt));

  const siteIssueIds = [...new Set(applications.map(a => a.siteIssueId))];
  const issues = siteIssueIds.length ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, siteIssueIds)) : [];
  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];

  const techIds = [...new Set(applications.filter(a => a.candidateType === 'technology').map(a => a.candidateId))];
  const technologies = techIds.length ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techIds)) : [];
  const netisIds = [...new Set(applications.filter(a => a.candidateType === 'netis').map(a => a.candidateId))];
  const netisTechs = netisIds.length ? await db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisIds)) : [];

  const issueById = new Map(issues.map(i => [i.id, i]));
  const siteById = new Map(sites.map(sv => [sv.id, sv]));
  const techById = new Map(technologies.map(t => [t.id, t]));
  const netisById = new Map(netisTechs.map(n => [n.id, n]));

  const rows = applications.map(app => {
    const issue = issueById.get(app.siteIssueId);
    const site = issue ? siteById.get(issue.siteId) : undefined;
    const candidateName = app.candidateType === 'technology'
      ? techById.get(app.candidateId)?.name
      : netisById.get(app.candidateId)?.name;
    return {
      id: app.id,
      siteName: site?.name ?? '—',
      issueBody: issue?.body ?? '—',
      candidateName: candidateName ?? '候補技術不明',
      score: Number(app.score)
    };
  });

  return (
    <ListView
      title="技術ニーズ"
      moduleCode="S-10 / TECHNOLOGY NEEDS"
      description="現場の困りごと（ニーズ）に対して、AIが提案した候補技術の適用性評価スコアの一覧です。"
      rows={rows}
      emptyMessage="技術ニーズに対する評価はまだありません。"
      rowHref={row => `/field/${row.id}`}
      fields={[
        { key: 'site', render: row => <span style={{ fontWeight: 700 }}>{row.siteName}</span> },
        { key: 'issue', grow: true, render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{row.issueBody.length > 40 ? `${row.issueBody.slice(0, 40)}…` : row.issueBody}</span> },
        { key: 'candidate', render: row => row.candidateName },
        { key: 'score', mono: true, render: row => (
          <span style={{ color: 'var(--blue)' }}>{row.score.toFixed(0)}<span style={{ fontSize: 10, color: 'var(--ink-2)' }}> / 100</span></span>
        ) }
      ]}
    />
  );
}
