import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, sql } from 'drizzle-orm';
import Link from 'next/link';
import { InfoPage } from '@/components/InfoPage';

export const runtime = 'edge';

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
  { label: 'Report Agent', href: '/ai-assistant/agents/report', desc: '各種レポートの出力履歴' },
  { label: '自律調査ジョブ', href: '/ai-assistant/jobs', desc: 'AI実行ジョブの一覧（根拠付き）' }
];

export default async function AiAssistantHubPage() {
  const db = getDb(getDatabaseUrl());
  const [runsTotal] = await db.select({ n: count() }).from(s.aiRuns);
  const [citationsTotal] = await db.select({ n: count() }).from(s.aiCitations);
  const [investigationsOpen] = await db.select({ n: count() }).from(s.investigations).where(sql`${s.investigations.status} = 'open'`);
  const kindRows = await db.execute(sql`select kind, count(*)::int as n from ai_runs group by kind order by n desc`);
  const kinds = kindRows.rows as Array<{ kind: string; n: number }>;

  return (
    <InfoPage
      title="Civil IP Copilot"
      moduleCode="S-14 / AI ASSISTANT"
      description="土木技術・知財に関する13種のAI Agentへの入口です。各Agentは自身の担当領域のデータのみを参照し、回答には必ず根拠（出典）が付きます。"
      badge="MVP"
      blocks={[
        { label: 'AI実行件数（累計）', value: `${runsTotal?.n ?? 0} 件` },
        { label: '根拠（引用）件数', value: `${citationsTotal?.n ?? 0} 件` },
        { label: '進行中の調査案件', value: `${investigationsOpen?.n ?? 0} 件` },
        { label: '実行種別の内訳', value: kinds.length
          ? kinds.map(k => `${k.kind}(${k.n})`).join(' ／ ')
          : 'まだAI実行の記録がありません' }
      ]}
      note="AIは決めません。各Agentの出力は必ず特許・NETIS・自社技術・論文などの一次データに紐づき、実行履歴は「自律調査ジョブ」および「AI実行履歴・根拠」画面から追跡できます。"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 8 }}>
        {AGENTS.map(a => (
          <Link key={a.href} href={a.href} className="card" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--ink)' }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</span>
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{a.desc}</span>
          </Link>
        ))}
      </div>
    </InfoPage>
  );
}
