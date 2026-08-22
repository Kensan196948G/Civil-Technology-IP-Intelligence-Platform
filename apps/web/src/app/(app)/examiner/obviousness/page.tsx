import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

// 一致(match)・類似(similar)の要件は、先行技術から容易に想到し得たと
// AIが疑義を示す対象として抽出する（相違(differ)は対象外）。
const OBVIOUSNESS_LABEL: Record<string, string> = {
  match: '容易想到（先行技術と同一）',
  similar: '容易想到の疑いあり（先行技術から想到可能）'
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
      description="先行文献に一致・類似する構成要件を抽出し、当業者が容易に想到し得たか（特許法29条2項）をAIが分析した一覧です。"
      badge="MVP"
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
