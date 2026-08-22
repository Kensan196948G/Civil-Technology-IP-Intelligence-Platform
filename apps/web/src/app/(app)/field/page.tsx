import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';

export const runtime = 'edge';

export default async function FieldApplicationsPage() {
  const db = getDb(getDatabaseUrl());
  const applications = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt));

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ fontSize: 22 }}>現場適用</h1>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.16em', color: 'var(--ink-2)' }}>S-19 / FIELD APPLICATION</span>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        現場の困りごとに対してAIが提案した候補技術と、現場適用性スコアの一覧です。
      </p>

      {applications.length === 0 && (
        <div className="card" style={{ padding: '14px 16px', fontSize: 13, color: 'var(--ink-2)' }}>
          現場適用性評価はまだありません。現場・課題ページから困りごとを登録すると、AIが候補技術を提案します。
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {applications.map(app => {
          const issue = issueById.get(app.siteIssueId);
          const site = issue ? siteById.get(issue.siteId) : undefined;
          const candidateName = app.candidateType === 'technology'
            ? techById.get(app.candidateId)?.name
            : netisById.get(app.candidateId)?.name;
          const score = Number(app.score);
          return (
            <Link key={app.id} href={`/field/${app.id}`} className="card" style={{ padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
              <span style={{ fontWeight: 700 }}>{site?.name ?? '—'}</span>
              <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{candidateName ?? '候補技術不明'}</span>
              <span style={{ flexGrow: 1 }} />
              <span className="mono" style={{ fontSize: 15, color: 'var(--blue)' }}>{score.toFixed(0)}<span style={{ fontSize: 11, color: 'var(--ink-2)' }}> / 100</span></span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
