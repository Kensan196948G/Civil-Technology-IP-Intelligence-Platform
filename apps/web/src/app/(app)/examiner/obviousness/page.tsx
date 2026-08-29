export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// CodeRabbit指摘: 構成要件単位の一致・類似は容易想到性（特許法29条2項）の
// 確定判断ではない（複数文献の組合せ・動機付け等、専門家による総合判断が必要）。
// 確定ラベルではなく、専門家確認が必要なスクリーニング結果として表示する。
const OBVIOUSNESS_LABEL: Record<string, string> = {
  match: '構成一致（要専門家確認）',
  similar: '構成類似（要専門家確認）'
};
const OBVIOUSNESS_COLOR: Record<string, string> = { match: 'var(--brick)', similar: 'var(--amber)' };

function trunc(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

export default async function ObviousnessReviewPage() {
  const db = getDb(getDatabaseUrl());

  const allRows = await db.select().from(s.claimChartRows).orderBy(asc(s.claimChartRows.seq));
  const rows = allRows.filter(r => r.kind === 'match' || r.kind === 'similar');

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
      title="容易想到性分析"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="先行文献に一致・類似する構成要件を抽出した一次スクリーニング結果です。容易想到性（特許法29条2項）の確定判断ではなく、専門家が確認すべき箇所を絞るためのものです。"
      badge="AIスクリーニング"
      rows={rows}
      emptyMessage="容易想到性の懸念がある構成要件は検出されていません。"
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
        { key: 'rationale', render: row => trunc(row.rationale ?? '—', 28) },
        { key: 'verdict', render: row => (
          <span className="badge" style={{ color: OBVIOUSNESS_COLOR[row.kind], border: `1px solid ${OBVIOUSNESS_COLOR[row.kind]}` }}>
            {OBVIOUSNESS_LABEL[row.kind] ?? row.kind}
          </span>
        ) }
      ]}
    />
  );
}
