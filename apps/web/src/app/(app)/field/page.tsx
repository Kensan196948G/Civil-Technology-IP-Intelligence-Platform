import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { Meter, Notice, Panel, Tag } from '@/components/ui';
import { DetailRow } from '@/components/detail/DetailOpener';

export const runtime = 'edge';

// 設計案（design-B-copilot）の「現場の困りごと」入口。
// 現場から届いた困りごとと、それに対してAIが出した候補技術・適用スコアを並べる。
// スコアの詳細（8軸の内訳）は /field/<id> で見る。

function scoreTone(score: number): 'green' | 'amber' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'amber';
  return 'red';
}

const TONE_COLOR = { green: 'var(--green)', amber: 'var(--amber)', red: 'var(--brick)' } as const;

export default async function FieldApplicationsPage() {
  const db = getDb(getDatabaseUrl());
  const applications = await db.select().from(s.fieldApplications).orderBy(desc(s.fieldApplications.createdAt));

  const siteIssueIds = [...new Set(applications.map(a => a.siteIssueId))];
  const issues = siteIssueIds.length
    ? await db.select().from(s.siteIssues).where(inArray(s.siteIssues.id, siteIssueIds))
    : [];
  const siteIds = [...new Set(issues.map(i => i.siteId))];
  const sites = siteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, siteIds)) : [];

  const techCandidateIds = [...new Set(applications.filter(a => a.candidateType === 'technology').map(a => a.candidateId))];
  const technologies = techCandidateIds.length
    ? await db.select().from(s.technologies).where(inArray(s.technologies.id, techCandidateIds))
    : [];
  const netisCandidateIds = [...new Set(applications.filter(a => a.candidateType === 'netis').map(a => a.candidateId))];
  const netisTechs = netisCandidateIds.length
    ? await db.select().from(s.netisTechnologies).where(inArray(s.netisTechnologies.id, netisCandidateIds))
    : [];

  // 未対応の困りごと（まだ候補技術が出ていないもの）も同じ画面から見えるようにする。
  const openIssues = await db.select().from(s.siteIssues).where(eq(s.siteIssues.status, 'open')).orderBy(desc(s.siteIssues.createdAt));

  const issueById = new Map(issues.map(i => [i.id, i]));
  const siteById = new Map(sites.map(sv => [sv.id, sv]));
  const techById = new Map(technologies.map(t => [t.id, t]));
  const netisById = new Map(netisTechs.map(n => [n.id, n]));
  const allSiteIds = [...new Set(openIssues.map(i => i.siteId))];
  const allSites = allSiteIds.length ? await db.select().from(s.sites).where(inArray(s.sites.id, allSiteIds)) : [];
  const allSiteById = new Map(allSites.map(sv => [sv.id, sv]));

  return (
    <div className="measure" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>
          現場の困りごとに対してAIが提案した候補技術と、現場適用性スコアの一覧です。
        </span>
        <Link href="/sites" className="btn btn-primary">＋ 現場の困りごとを登録</Link>
      </div>

      <Panel title="候補技術と現場適用スコア" note="スコアは単独では表示しません。必ず軸別内訳と併記します" bodyPadding={false}>
        <div className="row-list">
          {applications.length === 0 && (
            <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>
              現場適用性評価はまだありません。現場・課題ページから困りごとを登録すると、AIが候補技術を提案します。
            </div>
          )}
          {applications.map(app => {
            const issue = issueById.get(app.siteIssueId);
            const site = issue ? siteById.get(issue.siteId) : undefined;
            const isNetis = app.candidateType === 'netis';
            const candidateName = (isNetis ? netisById.get(app.candidateId)?.name : techById.get(app.candidateId)?.name)
              ?? '候補技術不明';
            const score = Number(app.score);
            const tone = scoreTone(score);
            const axes = (app.axes as unknown as Array<{ axis: string; value: number }> | null) ?? [];

            return (
              <DetailRow
                key={app.id}
                className="row row-top"
                detail={{
                  title: candidateName,
                  tag: isNetis ? 'NETIS' : '自社技術',
                  tone: isNetis ? 'green' : 'blue',
                  meta: [
                    { k: '現場', v: site?.name ?? '—' },
                    { k: '適用スコア', v: `${score.toFixed(0)} / 100（8軸の重み付き合成）` },
                    { k: '軸数', v: `${axes.length} 軸` },
                    { k: '困りごと', v: issue?.body ?? '—' }
                  ],
                  body: 'このスコアはAIが現場条件と技術情報を突き合わせた目安です。導入可否の判断は代替しません。軸別の内訳と根拠は詳細画面で確認できます。',
                  note: 'スコア単独では表示しません。導入には安全・品質・環境部門の承認が必要です。',
                  actions: [
                    { label: '軸別の内訳を見る', href: `/field/${app.id}`, primary: true },
                    { label: '導入検討を起票', href: '/approvals' }
                  ]
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 20, fontWeight: 600, color: TONE_COLOR[tone], width: 44, textAlign: 'right', flex: 'none' }}
                >
                  {score.toFixed(0)}
                </span>
                <div className="row-main">
                  <div className="row-title">{candidateName}</div>
                  <div className="row-sub">{site?.name ?? '—'}{issue ? ` ・ ${issue.body}` : ''}</div>
                  <div style={{ maxWidth: 320, marginTop: 8 }}>
                    <Meter value={score} color={TONE_COLOR[tone]} height={5} />
                  </div>
                </div>
                <Tag tone={isNetis ? 'green' : 'blue'} style={{ flex: 'none', marginTop: 2 }}>
                  {isNetis ? 'NETIS' : '自社技術'}
                </Tag>
              </DetailRow>
            );
          })}
        </div>
      </Panel>

      <Panel title="未対応の現場課題" note="登録された困りごと。AIの候補提案はこの後の工程です" bodyPadding={false}>
        <div className="row-list">
          {openIssues.length === 0 && (
            <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>未対応の現場課題はありません。</div>
          )}
          {openIssues.map(issue => {
            const site = allSiteById.get(issue.siteId);
            return (
              <DetailRow
                key={issue.id}
                detail={{
                  title: issue.body,
                  tag: '現場課題',
                  tone: 'amber',
                  meta: [
                    { k: '現場', v: site?.name ?? '—' },
                    { k: '状態', v: issue.status === 'open' ? '未対応' : issue.status },
                    { k: '写真', v: `${issue.photos.length} 枚` }
                  ],
                  body: '必須入力は「現場」と「困りごと（普通の文章）」だけです。分類・整理と候補技術の提案はAIが行い、導入を決めるのは人です。',
                  actions: [
                    { label: '現場を開く', href: `/sites/${issue.siteId}`, primary: true },
                    { label: '候補技術を見る', href: '/field' }
                  ]
                }}
              >
                <Tag tone="amber" style={{ flex: 'none' }}>未対応</Tag>
                <div className="row-main">
                  <div className="row-title">{issue.body}</div>
                  <div className="row-sub">{site?.name ?? '—'}</div>
                </div>
              </DetailRow>
            );
          })}
        </div>
      </Panel>

      <Notice>
        現場適用スコアは<strong>専門家が見る場所を絞るための目印</strong>です。権利侵害や導入可否の判断ではありません（この注記は消せません）。
      </Notice>
    </div>
  );
}
