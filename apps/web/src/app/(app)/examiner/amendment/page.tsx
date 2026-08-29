export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


// kind='match'/'similar' の要件は先行技術と重複するため、補正の方向性をAIが提案する。
const AMENDMENT_SUGGESTION: Record<string, string> = {
  match: '先行技術と同一のため、上位概念のままとせず、より限定的な下位概念へ補正することを検討（AI提案）',
  similar: '先行技術との相違点（本件独自の構成・効果）を明確化する限定要件の追加を検討（AI提案）'
};
const AMENDMENT_COLOR: Record<string, string> = { match: 'var(--brick)', similar: 'var(--amber)' };
const KIND_LABEL: Record<string, string> = { match: '一致', similar: '類似' };

export default async function AmendmentDirectionPage() {
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
      title="補正方向候補"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="先行技術と重複が疑われる構成要件について、AIが補正の方向性を提案した一覧です。実際の補正案は必ず知財担当者・弁理士が検討してください。"
      badge="MVP"
      rows={rows}
      emptyMessage="補正方向の提案対象となる構成要件はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', render: row => {
          const analysis = analysisById.get(row.analysisId);
          const patent = analysis ? patentById.get(analysis.patentId) : undefined;
          return patent?.title ?? '（対象特許不明）';
        } },
        { key: 'element', render: row => {
          const el = elementById.get(row.elementId);
          return <span className="mono">{el?.label ?? '?'}</span>;
        } },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: AMENDMENT_COLOR[row.kind], border: `1px solid ${AMENDMENT_COLOR[row.kind]}` }}>
            {KIND_LABEL[row.kind] ?? row.kind}
          </span>
        ) },
        { key: 'suggestion', grow: true, render: row => AMENDMENT_SUGGESTION[row.kind] ?? '—' }
      ]}
    />
  );
}
