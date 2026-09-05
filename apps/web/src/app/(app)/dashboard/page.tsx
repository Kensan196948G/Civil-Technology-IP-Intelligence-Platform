import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Meter, Panel, Tag } from '@/components/ui';
import { DetailRow, DetailTr } from '@/components/detail/DetailOpener';
import { CLASSIFICATION, WATCH_KIND, WORKFLOW_KIND, WORKFLOW_STATUS, ymd } from '@/lib/labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { isC3ReaderRole } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: ダッシュボードの案件数・一覧にも権限外の C3 を含めない
// （件数から機密を推測させない。README §14 ルール1）。R ロール以外は自分の起案案件のみ。

// 設計案（design-B-copilot）の「ダッシュボード」。
// KPIカード → 該当画面、案件行・ウォッチ行 → 詳細ドロワー。数値はすべて実DB。

type PendingRow = {
  id: string; kind: string; title: string; status: string; classification: string;
  due_on: string | null; author: string;
};

type WatchRow = { id: string; kind: string; label: string; created_at: string };

async function loadDashboard() {
  const db = getDb(getDatabaseUrl());

  // #11: 現在の利用者に応じて可視範囲を決める（未ログインなら空表示へ）
  const user = await getCurrentUser();
  if (!user) return { redirectLogin: true as const };
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);

  const isC3Reader = isC3ReaderRole(user.role);
  // workflow 案件の可視条件（C3 は Rロール or 起案者本人）
  const wfScope = isC3Reader
    ? sql`(wi.classification IN ('C1','C2','C3'))`
    : me
      ? sql`(wi.classification IN ('C1','C2') OR (wi.classification = 'C3' AND wi.author_id = ${me.id}))`
      : sql`(wi.classification IN ('C1','C2'))`;
  const wfPending = sql`wi.status not in ('approved','rejected','archived')`;

  const [counts, pending, watches] = await Promise.all([
    db.execute(sql`
      select
        (select count(*) from site_issues where status = 'open') as open_issues,
        (select count(*) from investigations where status = 'open') as open_investigations,
        (select count(*) from field_applications) as candidates,
        (select count(*) from field_applications where score >= 80) as candidates_high,
        (select count(*) from workflow_instances wi where ${wfPending} and ${wfScope}) as pending_approvals,
        (select count(*) from workflow_instances wi
           where ${wfPending}
             and due_on is not null and due_on < current_date
             and ${wfScope}) as overdue_approvals,
        (select count(*) from watches) as watches,
        (select count(*) from ai_runs) as ai_runs,
        (select count(*) from ai_runs r
           where exists (select 1 from ai_citations c where c.ai_run_id = r.id)) as ai_runs_with_citations,
        (select count(*) from ai_citations) as ai_citations,
        (select count(*) from patents) as patents,
        (select count(*) from papers) as papers,
        (select count(*) from netis_technologies) as netis,
        (select count(*) from technologies) as technologies
    `),
    db.execute(sql`
      select wi.id::text as id, wi.kind, wi.title, wi.status, wi.classification,
             wi.due_on::text as due_on, u.display_name as author
      from workflow_instances wi join users u on u.id = wi.author_id
      where ${wfPending} and ${wfScope}
      order by wi.due_on nulls last, wi.created_at desc
      limit 4
    `),
    db.execute(sql`
      select id::text as id, kind, label, created_at::text as created_at
      from watches order by created_at desc limit 3
    `)
  ]);

  const c = (counts.rows[0] ?? {}) as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);
  const aiRuns = n(c.ai_runs);
  const withCitations = n(c.ai_runs_with_citations);

  return {
    openIssues: n(c.open_issues),
    openInvestigations: n(c.open_investigations),
    candidates: n(c.candidates),
    candidatesHigh: n(c.candidates_high),
    pendingApprovals: n(c.pending_approvals),
    overdueApprovals: n(c.overdue_approvals),
    watchCount: n(c.watches),
    aiRuns,
    aiCitations: n(c.ai_citations),
    // 「根拠付与率」＝ 根拠が1件以上付いたAI実行の割合。100%であることが運用上の前提。
    citationRate: aiRuns === 0 ? 100 : Math.round((withCitations / aiRuns) * 100),
    corpus: [
      { label: '特許', tab: 'patent', n: n(c.patents) },
      { label: '論文', tab: 'paper', n: n(c.papers) },
      { label: 'NETIS', tab: 'netis', n: n(c.netis) },
      { label: '自社技術', tab: 'tech', n: n(c.technologies) }
    ],
    pending: pending.rows as PendingRow[],
    watches: watches.rows as WatchRow[]
  };
}

function Kpi({
  href, label, dotColor, value, foot, footColor
}: {
  href: string; label: string; dotColor: string; value: number; foot: string; footColor?: string;
}) {
  return (
    <Link
      href={href}
      className="panel"
      style={{ padding: '16px 17px', display: 'flex', flexDirection: 'column', gap: 7, color: 'var(--ink)', textDecoration: 'none' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>{label}</span>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: dotColor }} aria-hidden="true" />
      </div>
      <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 500, color: footColor ?? 'var(--ink-3)' }}>{foot}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const d = await loadDashboard();
  if ('redirectLogin' in d) redirect('/login');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14 }}>
        <Kpi
          href="/sites" label="未対応の現場課題" dotColor="var(--brick-dot)"
          value={d.openIssues} foot="現場から届いた困りごと" footColor={d.openIssues > 0 ? 'var(--brick)' : undefined}
        />
        <Kpi
          href="/investigations" label="AI調査 実行中" dotColor="var(--purple)"
          value={d.openInvestigations} foot={`根拠付与率 ${d.citationRate}%`}
        />
        <Kpi
          href="/field" label="候補技術" dotColor="var(--blue-bar)"
          value={d.candidates} foot={`スコア80以上 ${d.candidatesHigh}件`}
        />
        <Kpi
          href="/approvals" label="あなたの承認待ち" dotColor="var(--accent)"
          value={d.pendingApprovals}
          foot={d.overdueApprovals > 0 ? `期限超過 ${d.overdueApprovals}件` : '期限超過なし'}
          footColor={d.overdueApprovals > 0 ? 'var(--amber)' : undefined}
        />
        <Kpi
          href="/watch" label="ウォッチ登録" dotColor="var(--green-dot)"
          value={d.watchCount} foot="競合・特許・技術分野"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <Panel
          title="あなたの対応が必要な案件"
          action={<Link href="/approvals" style={{ fontSize: 12 }}>すべて見る →</Link>}
          bodyPadding={false}
        >
          {d.pending.length === 0 ? (
            <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>対応が必要な案件はありません。</div>
          ) : (
            <table className="plain">
              <thead>
                <tr><th>種別</th><th>件名</th><th>段階</th><th>期限</th></tr>
              </thead>
              <tbody>
                {d.pending.map(w => {
                  const kind = WORKFLOW_KIND[w.kind] ?? { label: w.kind, tone: 'gray' as const };
                  const status = WORKFLOW_STATUS[w.status] ?? { label: w.status, tone: 'gray' as const };
                  const overdue = !!w.due_on && w.due_on < new Date().toISOString().slice(0, 10);
                  return (
                    <DetailTr
                      key={w.id}
                      detail={{
                        title: w.title,
                        tag: status.label,
                        tone: status.tone,
                        meta: [
                          { k: '種別', v: kind.label },
                          { k: '起案', v: w.author },
                          { k: '段階', v: status.label },
                          { k: '機密区分', v: w.classification },
                          { k: '期限', v: w.due_on ? `${w.due_on}${overdue ? '（超過）' : ''}` : '—' }
                        ],
                        body: 'ワークフローのAIステップの直後には、必ず人の確認ステップが入ります。AIから直接「決定」へ進む道はありません。',
                        actions: [
                          { label: '案件を開く', href: `/approvals/${w.id}`, primary: true },
                          { label: '承認一覧へ', href: '/approvals' }
                        ]
                      }}
                    >
                      <td><Tag tone={kind.tone}>{kind.label}</Tag></td>
                      <td style={{ fontWeight: 500 }}>{w.title}</td>
                      <td style={{ color: 'var(--ink-2)' }}>{status.label}</td>
                      <td className="mono" style={{ color: overdue ? 'var(--brick)' : 'var(--ink-2)' }}>
                        {w.due_on ?? '—'}
                      </td>
                    </DetailTr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel title="AI実行と根拠">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>AI実行（累計）</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{d.aiRuns} 件</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>根拠（引用）件数</span>
                <span className="mono" style={{ fontSize: 12.5, fontWeight: 600 }}>{d.aiCitations} 件</span>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--ink-2)', flex: 1 }}>根拠（出典）付与率</span>
                  <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--green)' }}>{d.citationRate}%</span>
                </div>
                <Meter value={d.citationRate} color="var(--green-dot)" />
              </div>
              <div className="notice notice-amber">
                <strong>AIは決めません。</strong>類似度・スコアは専門家が見る場所を絞るための目印であり、権利侵害や導入可否の判断ではありません。
              </div>
            </div>
          </Panel>

          <Panel title="今週のウォッチ" bodyPadding={false}>
            <div className="row-list">
              {d.watches.length === 0 && (
                <div style={{ padding: '16px 18px', fontSize: 13, color: 'var(--ink-2)' }}>ウォッチ登録はまだありません。</div>
              )}
              {d.watches.map(w => {
                const kind = WATCH_KIND[w.kind] ?? { label: w.kind, tone: 'gray' as const };
                return (
                  <DetailRow
                    key={w.id}
                    style={{ padding: '11px 18px', gap: 12 }}
                    detail={{
                      title: w.label,
                      tag: kind.label,
                      tone: kind.tone,
                      meta: [
                        { k: '種別', v: kind.label },
                        { k: '登録日', v: ymd(w.created_at) }
                      ],
                      body: '重要度はAIの目安です。ウォッチ条件はいつでも直せます。',
                      actions: [
                        { label: 'ウォッチ一覧を見る', href: '/watch', primary: true },
                        { label: 'アラートを見る', href: '/watch/alerts' }
                      ]
                    }}
                  >
                    <Tag tone={kind.tone} style={{ flex: 'none' }}>{kind.label}</Tag>
                    <span style={{ fontSize: 12.5, flex: 1 }}>{w.label}</span>
                  </DetailRow>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* 横断検索が対象にしているデータの規模。各種別から検索画面へ入れる。 */}
      <Panel title="横断検索の対象データ" note="ひとつの検索窓から4種別を横断します" bodyPadding={false}>
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {d.corpus.map(c => (
            <Link
              key={c.tab}
              href={`/search?tab=${c.tab}`}
              style={{
                flex: '1 1 140px', padding: '14px 18px', color: 'var(--ink)', textDecoration: 'none',
                borderRight: '1px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 4
              }}
            >
              <span style={{ fontSize: 11.5, color: 'var(--ink-3)', fontWeight: 500 }}>{c.label}</span>
              <span className="mono" style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.3px' }}>{c.n}</span>
            </Link>
          ))}
        </div>
      </Panel>

      {/* FR-M45-004: 研究テーマ候補（M45）への導線 */}
      <Link href="/opportunities" className="panel" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)', textDecoration: 'none' }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>研究テーマ候補（Innovation Opportunity）</span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>White Space・現場ニーズ等からスコアリングした研究テーマ候補のランキング</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--blue)' }}>開く →</span>
      </Link>

      {/* 機密区分の凡例。C3/C4は権限がなければ存在自体を見せない運用であることを常に示す。 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
        <span>機密区分</span>
        {Object.entries(CLASSIFICATION).map(([code, tone]) => (
          <Tag key={code} tone={tone}>{code}</Tag>
        ))}
        <span>— C3・C4は権限がない利用者には存在自体を表示しません（404）。</span>
      </div>
    </div>
  );
}
