export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function ResearchCaseStudiesPage() {
  const db = getDb(getDatabaseUrl());
  const applications = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt)).limit(100);

  const siteIssueIds = [...new Set(applications.map(a => a.siteIssueId))];
  const issues = siteIssueIds.length
    ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, siteIssueIds))
    : [];
  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length
    ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds))
    : [];

  const techCandidateIds = [...new Set(applications.filter(a => a.candidateType === 'technology').map(a => a.candidateId))];
  const technologies = techCandidateIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techCandidateIds))
    : [];
  const netisCandidateIds = [...new Set(applications.filter(a => a.candidateType === 'netis').map(a => a.candidateId))];
  const netisTechs = netisCandidateIds.length
    ? await db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisCandidateIds))
    : [];

  const issueById = new Map(issues.map(i => [i.id, i]));
  const siteById = new Map(sites.map(sv => [sv.id, sv]));
  const techById = new Map(technologies.map(t => [t.id, t]));
  const netisById = new Map(netisTechs.map(n => [n.id, n]));

  return (
    <ListView
      title="施工事例"
      moduleCode="S-07f / CONSTRUCTION CASE STUDIES"
      description="現場の困りごとに対して技術・NETISが適用された施工事例（現場適用性評価）の一覧です。"
      rows={applications}
      emptyMessage="施工事例（現場適用性評価）はまだありません。"
      rowHref={row => `/field/${row.id}`}
      fields={[
        { key: 'site', grow: true, render: row => {
          const issue = issueById.get(row.siteIssueId);
          const site = issue ? siteById.get(issue.siteId) : undefined;
          return <span style={{ fontWeight: 700 }}>{site?.name ?? '—'}</span>;
        } },
        { key: 'candidate', render: row => {
          const name = row.candidateType === 'technology'
            ? techById.get(row.candidateId)?.name
            : netisById.get(row.candidateId)?.name;
          return name ?? '候補技術不明';
        } },
        { key: 'score', mono: true, render: row => `${Number(row.score).toFixed(0)} / 100` }
      ]}
    />
  );
}
