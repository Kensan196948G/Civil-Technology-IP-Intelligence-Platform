import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function TechEvaluationPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt));

  const issueIds = [...new Set(rows.map(r => r.siteIssueId))];
  const issues = issueIds.length ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, issueIds)) : [];
  const issueById = new Map(issues.map(i => [i.id, i]));

  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];
  const siteById = new Map(sites.map(st => [st.id, st]));

  const techCandidateIds = [...new Set(rows.filter(r => r.candidateType === 'technology').map(r => r.candidateId))];
  const netisCandidateIds = [...new Set(rows.filter(r => r.candidateType === 'netis').map(r => r.candidateId))];
  const [techCandidates, netisCandidates] = await Promise.all([
    techCandidateIds.length ? db.select().from(s.technologies).where(inArray(s.technologies.id, techCandidateIds)) : Promise.resolve([]),
    netisCandidateIds.length ? db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisCandidateIds)) : Promise.resolve([])
  ]);
  const techCandidateById = new Map(techCandidates.map(t => [t.id, t]));
  const netisCandidateById = new Map(netisCandidates.map(n => [n.id, n]));

  const candidateName = (row: typeof rows[number]) =>
    row.candidateType === 'netis'
      ? netisCandidateById.get(row.candidateId)?.name ?? '（削除済みNETIS技術）'
      : techCandidateById.get(row.candidateId)?.name ?? '（削除済み技術）';

  const siteName = (row: typeof rows[number]) => {
    const issue = issueById.get(row.siteIssueId);
    return issue ? siteById.get(issue.siteId)?.name ?? '—' : '—';
  };

  return (
    <ListView
      title="技術評価"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="現場条件に基づく候補技術の適用性評価（現場適用性スコア）の一覧です。"
      rows={rows}
      emptyMessage="技術評価データがまだありません。"
      rowHref={row => `/field/${row.id}`}
      fields={[
        { key: 'candidate', grow: true, render: row => <span style={{ fontWeight: 700 }}>{candidateName(row)}</span> },
        { key: 'site', render: row => siteName(row) },
        { key: 'candidateType', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>
            {row.candidateType === 'netis' ? 'NETIS' : '自社技術'}
          </span>
        ) },
        { key: 'score', mono: true, render: row => `${Number(row.score).toFixed(0)} / 100` }
      ]}
    />
  );
}
