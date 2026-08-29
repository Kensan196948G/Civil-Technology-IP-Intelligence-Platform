import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type RiskSummary = { novelty?: string; inventive?: string; description?: string; note?: string };

type GroundRow = { id: string; title: string; ground: string; basis: string; href: string };

// CodeRabbit指摘: 構成要件単位の一致・類似は新規性・進歩性欠如の確定判断ではない。
// 比較事実＋懸念の観点として表示し、専門家確認を促す。
const CLAIM_GROUND: Record<string, { ground: string; basis: string }> = {
  match: { ground: '新規性の懸念（構成要件が一致）', basis: '先行特許に同一の構成要件が記載されている（AI比較）' },
  similar: { ground: '進歩性の懸念（構成要件が類似）', basis: '先行特許の構成に類似する記載がある（AI比較）' }
};

export default async function RejectionGroundsPage() {
  const db = getDb(getDatabaseUrl());

  // (1) ワークフローのAIリスクサマリーから、案件単位の想定拒絶理由を抽出
  // CodeRabbit指摘: note の有無だけで「新規性・進歩性」の拒絶理由に一律分類すると、
  // description（記載要件）のみがリスク要因の案件も同じ分類で表示されてしまう。
  // novelty/inventive の評価値から該当する拒絶理由だけを生成する。
  const workflows = await db.select().from(s.workflowInstances).orderBy(desc(s.workflowInstances.createdAt));
  const workflowGrounds: GroundRow[] = workflows
    .filter(w => (w.aiRiskSummary as RiskSummary | null)?.note)
    .map(w => {
      const risk = w.aiRiskSummary as RiskSummary;
      // CodeRabbit指摘: novelty/inventiveは値が低いほど「弱い＝拒絶リスク高」という
      // 強度スケール（examiner/inventive-step の RATING_LABEL と同じ解釈）。
      // low の場合にのみ拒絶理由の懸念として計上する（!== 'low' は判定が逆だった）。
      const grounds: string[] = [];
      if (risk.novelty === 'low') grounds.push('新規性');
      if (risk.inventive === 'low') grounds.push('進歩性');
      const ground = grounds.length > 0
        ? `想定拒絶理由の懸念（${grounds.join('・')}）`
        : 'AI総合所見（新規性・進歩性以外の要確認事項）';
      return {
        id: `wf-${w.id}`,
        title: w.title,
        ground,
        basis: risk.note ?? '—',
        href: `/approvals/${w.id}`
      };
    });

  // (2) Claim比較で先行特許と重複が疑われる構成要件から、要件単位の想定拒絶理由を抽出
  const chartRows = await db.select().from(s.claimChartRows).orderBy(asc(s.claimChartRows.seq));
  const targetRows = chartRows.filter(r => r.kind === 'match' || r.kind === 'similar');
  const analysisIds = [...new Set(targetRows.map(r => r.analysisId))];
  const analyses = analysisIds.length
    ? await db.select().from(s.claimAnalyses).where(inArray(s.claimAnalyses.id, analysisIds))
    : [];
  const analysisById = new Map(analyses.map(a => [a.id, a]));
  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const claimGrounds: GroundRow[] = targetRows.map(r => {
    const analysis = analysisById.get(r.analysisId);
    const patent = analysis ? patentById.get(analysis.patentId) : undefined;
    const g = CLAIM_GROUND[r.kind];
    return {
      id: `cc-${r.id}`,
      title: patent?.title ?? '（対象特許不明）',
      ground: g?.ground ?? '要確認',
      basis: r.rationale ?? g?.basis ?? '—',
      href: `/claims/${r.analysisId}`
    };
  });

  const rows: GroundRow[] = [...workflowGrounds, ...claimGrounds];

  return (
    <ListView
      title="想定拒絶理由"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="AIリスクサマリーおよびClaim比較結果から、想定される拒絶理由（新規性・進歩性）をAIが抽出した一覧です。実際の拒絶理由通知への対応は必ず知財担当者・弁理士が確認してください。"
      badge="MVP"
      rows={rows}
      emptyMessage="想定拒絶理由として抽出された項目はまだありません。"
      rowHref={row => row.href}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'ground', render: row => (
          <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>{row.ground}</span>
        ) },
        { key: 'basis', render: row => row.basis.length > 34 ? row.basis.slice(0, 34) + '…' : row.basis }
      ]}
    />
  );
}
