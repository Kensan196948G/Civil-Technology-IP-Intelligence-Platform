import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Panel, Tag } from '@/components/ui';
import { DetailChip, DetailRow } from '@/components/detail/DetailOpener';
import { citationDetail, type DetailSpec } from '@/components/detail/types';
import { CONVERSATIONS, PROMPT_CHIPS, getConversation } from '@/lib/copilot-demo';
import { AI_RUN_KIND, stamp } from '@/lib/labels';

export const runtime = 'edge';

// 設計案（design-B-copilot）の「Copilotホーム」。
// 会話そのものはMVPスキーマに対応テーブルが無いためデモ定数（lib/copilot-demo.ts）だが、
// 右側の「専門Agent」「自律調査ジョブ」「最近のAI実行」は実DBから引いている。

const AGENTS: Array<{ label: string; href: string; desc: string }> = [
  { label: '技術調査Agent', href: '/ai-assistant/agents/tech-research', desc: '自社技術・NETIS登録技術を横断調査' },
  { label: 'Patent Search Agent', href: '/ai-assistant/agents/patent-search', desc: '先行技術調査案件の検索式・状況' },
  { label: 'Research Agent', href: '/ai-assistant/agents/research', desc: '学術論文の調査結果' },
  { label: 'Claim Agent', href: '/ai-assistant/agents/claim', desc: '他社特許 vs 自社案の構成要件比較' },
  { label: 'Examiner Agent', href: '/ai-assistant/agents/examiner', desc: 'AI模擬審査（新規性・進歩性リスク）' },
  { label: 'Competitor Agent', href: '/ai-assistant/agents/competitor', desc: '競合企業の動向モニタリング' },
  { label: 'Landscape Agent', href: '/ai-assistant/agents/landscape', desc: '特許ランドスケープ（国別・出願人別）' },
  { label: 'Civil Engineer Agent', href: '/ai-assistant/agents/civil-engineer', desc: '現場適用性スコアリング' },
  { label: 'R&D Agent', href: '/ai-assistant/agents/rnd', desc: '社内研究者・発明者の知見' },
  { label: 'Licensing Agent', href: '/ai-assistant/agents/licensing', desc: 'ライセンスIN/OUT案件の評価' },
  { label: 'Legal Agent', href: '/ai-assistant/agents/legal', desc: '人間確認必須案件の法務・コンプライアンス確認' },
  { label: 'Report Agent', href: '/ai-assistant/agents/report', desc: '各種レポートの出力履歴' }
];

const SCORE_COLOR = {
  green: 'var(--green)', amber: 'var(--amber)', red: 'var(--brick)', gray: 'var(--ink-2)'
} as const;

async function loadSidePanels() {
  const db = getDb(getDatabaseUrl());
  const [jobs, runs, citationCounts] = await Promise.all([
    // 自律調査ジョブ = 進行中の調査案件
    db.select().from(s.investigations).where(eq(s.investigations.status, 'open'))
      .orderBy(desc(s.investigations.createdAt)).limit(3),
    db.select().from(s.aiRuns).orderBy(desc(s.aiRuns.createdAt)).limit(3),
    db.select({ aiRunId: s.aiCitations.aiRunId, n: count() }).from(s.aiCitations).groupBy(s.aiCitations.aiRunId)
  ]);
  return {
    jobs,
    runs,
    citationsByRun: new Map(citationCounts.map(c => [c.aiRunId, Number(c.n)]))
  };
}

export default async function CopilotHomePage({ searchParams }: { searchParams: { c?: string } }) {
  const { index, convo } = getConversation(searchParams.c);
  const { jobs, runs, citationsByRun } = await loadSidePanels();

  const candidateDetail = (c: (typeof convo.candidates)[number]): DetailSpec => ({
    title: c.name,
    tag: c.tag,
    tone: c.tone,
    meta: [
      { k: '適用スコア', v: `${c.score}（目印であり判断ではありません）` },
      { k: '概要', v: c.meta }
    ],
    body: 'このスコアはAIが現場条件と技術情報を突き合わせた目安です。導入には安全・品質・環境部門の承認が必要です。',
    citations: convo.citations.slice(0, 2),
    actions: [
      { label: '現場スコアの内訳を見る', href: '/field', primary: true },
      { label: '調査案件に追加', href: '/investigations' }
    ]
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0, maxWidth: 840, margin: '0 auto', width: '100%' }}>
        {/* 質問の入口 */}
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-.2px' }}>
            現場のこまりごとに、世界の技術で答えます。
          </div>
          {/* 自然文の質問はまず横断検索に渡す（AI応答そのものの実装は本番フェーズ）。 */}
          <form action="/search" style={{ display: 'flex', gap: 10 }}>
            <input
              name="q"
              className="input"
              style={{ flex: 1, fontSize: 13.5, padding: '12px 14px' }}
              placeholder="例：港湾のケーソン据付を自動化したい。水深12m、波高1.5m超の日が多い現場です"
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: 13, flex: 'none' }}>
              調べる
            </button>
          </form>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PROMPT_CHIPS.map(p => (
              <Link key={p.index} href={`/ai-assistant?c=${p.index}`} className="chip">{p.label}</Link>
            ))}
          </div>
        </div>

        {/* 質問 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: 'var(--blue-soft)', borderRadius: 10, padding: '12px 16px', fontSize: 13.5, maxWidth: '80%', lineHeight: 1.8 }}>
            {convo.q}
          </div>
        </div>

        {/* 回答 */}
        <div className="panel" style={{ overflow: 'hidden' }}>
          <div className="panel-head">
            <span
              aria-hidden="true"
              style={{
                width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600, flex: 'none'
              }}
            >
              AI
            </span>
            <span className="panel-title">{convo.agent}</span>
            <span className="panel-note">{convo.scope}</span>
            <span style={{ flex: 1 }} />
            <span className="badge tag-green mono">根拠 {convo.evidence}件</span>
          </div>

          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.9 }}>{convo.answer}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {convo.candidates.map((c, i) => (
                <DetailRow
                  key={i}
                  detail={candidateDetail(c)}
                  style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '11px 14px', gap: 12 }}
                >
                  <span className="mono" style={{ fontSize: 17, fontWeight: 600, color: SCORE_COLOR[c.scoreTone], flex: 'none', width: 34, textAlign: 'right' }}>
                    {c.score}
                  </span>
                  <div className="row-main">
                    <div className="row-title">{c.name}</div>
                    <div className="row-sub">{c.meta}</div>
                  </div>
                  <Tag tone={c.tone} style={{ flex: 'none' }}>{c.tag}</Tag>
                </DetailRow>
              ))}
            </div>

            <div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
                出どころ（クリックで原文の該当箇所を開きます）
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {convo.citations.map(cit => (
                  <DetailChip
                    key={cit}
                    detail={citationDetail(cit)}
                    className="mono"
                    style={{ background: 'var(--chip)', color: 'var(--ink-2)', borderRadius: 5, padding: '3px 8px', fontSize: 11 }}
                  >
                    {cit}
                  </DetailChip>
                ))}
              </div>
            </div>

            <div className="notice notice-amber">
              スコア・類似度は<strong>専門家が見る場所を絞るための目印</strong>です。権利侵害や導入可否の判断ではありません（この注記は消せません）。
            </div>
          </div>

          <div style={{ padding: '13px 18px', borderTop: '1px solid var(--line-2)', display: 'flex', gap: 9, flexWrap: 'wrap' }}>
            <Link href="/field" className="btn btn-primary">現場スコアの内訳を見る</Link>
            <Link href="/search" className="btn btn-secondary">検索結果として開く</Link>
            <Link href="/investigations" className="btn btn-ghost">調査案件として保存</Link>
            <span style={{ flex: 1 }} />
            <Link href="/approvals" className="btn btn-ghost">導入検討を起票 →</Link>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          表示中の会話 {index + 1} / {CONVERSATIONS.length}　—　左の「最近の会話」から切り替えられます。
          会話ログはMVPではデモデータです（一覧・件数・履歴は実データです）。
        </div>
      </div>

      {/* 右レール */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <Panel title="専門Agent" note="担当領域のデータだけを参照" bodyPadding={false}>
          <div style={{ padding: '6px 0', maxHeight: 300, overflowY: 'auto' }}>
            {AGENTS.map(a => (
              <Link
                key={a.href}
                href={a.href}
                title={a.desc}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 18px', color: 'var(--ink)', textDecoration: 'none' }}
              >
                <span className="dot" style={{ background: 'var(--green-dot)' }} aria-hidden="true" />
                <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{a.label}</span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>待機</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="自律調査ジョブ">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {jobs.length === 0 && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>進行中のジョブはありません。</div>}
            {jobs.map(j => (
              <Link key={j.id} href="/investigations" style={{ color: 'var(--ink)', textDecoration: 'none', display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 500, flex: 1 }}>{j.title}</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--purple)' }}>実行中</span>
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{j.query}</span>
              </Link>
            ))}
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              完了すると通知します。結果はすべて根拠付きで保存されます。
            </div>
          </div>
        </Panel>

        <Panel title="最近のAI実行" bodyPadding={false}>
          <div style={{ padding: '6px 0' }}>
            {runs.length === 0 && (
              <div style={{ padding: '9px 18px', fontSize: 12, color: 'var(--ink-3)' }}>AI実行の記録はまだありません。</div>
            )}
            {runs.map(r => {
              const evidence = citationsByRun.get(r.id) ?? 0;
              return (
                <DetailRow
                  key={r.id}
                  style={{ padding: '9px 18px', gap: 10 }}
                  detail={{
                    title: `${AI_RUN_KIND[r.kind] ?? r.kind}（${r.targetType ?? '—'}）`,
                    tag: 'ai_run',
                    tone: 'purple',
                    meta: [
                      { k: '実行ID', v: r.id.slice(0, 8) },
                      { k: '種別', v: AI_RUN_KIND[r.kind] ?? r.kind },
                      { k: 'モデル', v: r.model },
                      { k: '根拠', v: `${evidence}件（ai_citations）` },
                      { k: '実行日時', v: stamp(r.createdAt) }
                    ],
                    body: 'AI実行は必ず ai_runs と ai_citations に記録されます。根拠が0件の成功実行は保存されません（invalid扱い）。',
                    actions: [{ label: 'AI実行履歴を見る', href: '/ai-runs', primary: true }]
                  }}
                >
                  <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', flex: 'none' }}>{r.id.slice(0, 8)}</span>
                  <span style={{ fontSize: 12, flex: 1 }}>{AI_RUN_KIND[r.kind] ?? r.kind}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--green)' }}>根拠{evidence}</span>
                </DetailRow>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
