import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, eq, and, notInArray } from 'drizzle-orm';
import Link from 'next/link';
import { InfoPage } from '@/components/InfoPage';


async function loadCounts() {
  const db = getDb(getDatabaseUrl());
  const [ideas] = await db.select({ n: count() }).from(s.inventions);
  const [themes] = await db.select({ n: count() }).from(s.technologies);
  const [openChallenges] = await db.select({ n: count() }).from(s.siteIssues).where(eq(s.siteIssues.status, 'open'));
  const [pipeline] = await db.select({ n: count() }).from(s.workflowInstances).where(
    and(eq(s.workflowInstances.kind, 'invention'), notInArray(s.workflowInstances.status, ['approved', 'rejected', 'archived']))
  );
  const [aiOrganized] = await db.select({ n: count() }).from(s.aiRuns).where(eq(s.aiRuns.kind, 'examine'));
  const [openInvestigations] = await db.select({ n: count() }).from(s.investigations).where(eq(s.investigations.status, 'open'));
  return {
    ideas: ideas?.n ?? 0,
    themes: themes?.n ?? 0,
    openChallenges: openChallenges?.n ?? 0,
    pipeline: pipeline?.n ?? 0,
    aiOrganized: aiOrganized?.n ?? 0,
    openInvestigations: openInvestigations?.n ?? 0
  };
}

const LINKS: { label: string; href: string; sub: string }[] = [
  { label: '研究テーマ', href: '/rnd/themes', sub: '自社が取り組む技術テーマの一覧' },
  { label: '技術課題', href: '/rnd/challenges', sub: '現場から報告された困りごと' },
  { label: '技術ニーズ', href: '/rnd/needs', sub: '課題に対する候補技術の適用評価' },
  { label: '発明アイデア', href: '/rnd/ideas', sub: '発明届として整理された案件' },
  { label: 'AI発明整理', href: '/rnd/ai-organize', sub: 'AIによる発明届の一次整理履歴' },
  { label: 'Claim候補生成', href: '/rnd/claim-candidates', sub: 'AIによるClaim比較の実行履歴' },
  { label: '発明評価', href: '/rnd/evaluation', sub: 'AI模擬審査によるリスク評価' },
  { label: '改良発明', href: '/rnd/improvement-candidates', sub: '他社特許と近接する要件（改良余地）' },
  { label: '周辺発明候補', href: '/rnd/adjacent-candidates', sub: '他社特許と異なる要件（周辺出願余地）' },
  { label: '技術ロードマップ', href: '/rnd/roadmap', sub: '研究テーマの成熟度別分布' },
  { label: 'PoC実験管理', href: '/rnd/poc', sub: '仮説→実証→結果→採用/中止（M36）' },
  { label: '出願候補', href: '/rnd/filing-candidates', sub: '知財・法務審査段階まで進んだ発明' }
];

export default async function RndDashboardPage() {
  const c = await loadCounts();
  const cards = [
    { label: '研究テーマ', n: c.themes, href: '/rnd/themes' },
    { label: '未解決の技術課題', n: c.openChallenges, href: '/rnd/challenges' },
    { label: '発明届', n: c.ideas, href: '/rnd/ideas' },
    { label: '審査パイプライン中', n: c.pipeline, href: '/rnd/filing-candidates' },
    { label: 'AI発明整理 実行数', n: c.aiOrganized, href: '/rnd/ai-organize' },
    { label: '先行技術調査 進行中', n: c.openInvestigations, href: '/investigations' }
  ];

  return (
    <InfoPage
      title="R&Dダッシュボード"
      moduleCode="S-10 / R&D DASHBOARD"
      description="研究開発から発明届・審査パイプラインまでのR&D活動状況をまとめて確認します。"
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {cards.map(cd => (
          <Link key={cd.label} href={cd.href} className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--ink)' }}>
            <span className="mono" style={{ fontSize: 10, letterSpacing: '.14em', color: 'var(--ink-2)' }}>{cd.label}</span>
            <span className="mono" style={{ fontSize: 28, color: 'var(--blue)' }}>{cd.n}</span>
          </Link>
        ))}
      </div>

      <div className="card" style={{ padding: 0, marginTop: 16 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', background: 'var(--sunk)', fontWeight: 700, fontSize: 13 }}>
          R&D・発明管理メニュー
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {LINKS.map((l, i) => (
            <Link key={l.href} href={l.href} style={{ padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 12, color: 'var(--ink)', borderBottom: i < LINKS.length - 1 ? '1px solid var(--line-2)' : 'none' }}>
              <span style={{ fontWeight: 700, fontSize: 13, width: 160, flexShrink: 0 }}>{l.label}</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{l.sub}</span>
            </Link>
          ))}
        </div>
      </div>
    </InfoPage>
  );
}
