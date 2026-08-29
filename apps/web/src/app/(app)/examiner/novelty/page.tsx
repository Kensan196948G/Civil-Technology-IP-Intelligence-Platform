import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// CodeRabbit指摘: 構成要件単位の一致・類似・相違（claim_chart_rows.kind）は
// 比較上の事実であり、新規性（特許法29条1項）の確定判断ではない
// （新規性は請求項全体・先行技術全体との関係で専門家が判断する）。
// 確定ラベルではなく、比較事実そのものをラベルにする。
const NOVELTY_LABEL: Record<string, string> = { match: '構成一致（要確認）', similar: '構成類似（要確認）', differ: '構成相違' };
const NOVELTY_COLOR: Record<string, string> = { match: 'var(--brick)', similar: 'var(--amber)', differ: 'var(--green)' };

function trunc(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

export default async function NoveltyReviewPage() {
  const db = getDb(getDatabaseUrl());

  const rows = await db.select().from(s.claimChartRows).orderBy(asc(s.claimChartRows.seq));

  const analysisIds = [...new Set(rows.map(r => r.analysisId))];
  const analyses = analysisIds.length
    ? await db.select().from(s.claimAnalyses).where(inArray(s.claimAnalyses.id, analysisIds))
    : [];
  const analysisById = new Map(analyses.map(a => [a.id, a]));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const patents = patentIds.length
    ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds))
    : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  const elementIds = [...new Set(rows.map(r => r.elementId))];
  const elements = elementIds.length
    ? await db.select().from(s.claimElements).where(inArray(s.claimElements.id, elementIds))
    : [];
  const elementById = new Map(elements.map(e => [e.id, e]));

  return (
    <ListView
      title="新規性レビュー"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="他社特許の構成要件と自社案の記載をAIが要件単位で突き合わせた比較結果です。新規性（特許法29条1項）の確定判断ではなく、専門家が確認すべき箇所を絞るための一次スクリーニングです。"
      badge="AIスクリーニング"
      rows={rows}
      emptyMessage="新規性レビュー対象のClaim比較データがまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', grow: true, render: row => {
          const analysis = analysisById.get(row.analysisId);
          const patent = analysis ? patentById.get(analysis.patentId) : undefined;
          return patent?.title ?? '（対象特許不明）';
        } },
        { key: 'element', render: row => {
          const el = elementById.get(row.elementId);
          return <span className="mono">{el?.label ?? '?'}</span>;
        } },
        { key: 'ourText', render: row => trunc(row.ourText, 34) },
        { key: 'verdict', render: row => (
          <span className="badge" style={{ color: NOVELTY_COLOR[row.kind], border: `1px solid ${NOVELTY_COLOR[row.kind]}` }}>
            {NOVELTY_LABEL[row.kind] ?? row.kind}
          </span>
        ) }
      ]}
    />
  );
}
