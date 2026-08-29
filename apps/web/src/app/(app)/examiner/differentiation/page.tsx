import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function DifferentiationPointsPage() {
  const db = getDb(getDatabaseUrl());

  // kind='differ'：先行特許に開示がなく、自社案が独自性を持つと判定された要件のみを対象とする。
  const rows = await db.select().from(s.claimChartRows).where(eq(s.claimChartRows.kind, 'differ')).orderBy(asc(s.claimChartRows.seq));

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
      title="差別化ポイント"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="先行特許に開示がなく、自社案が独自性を持つとAIが判定した構成要件（差別化ポイント）の一覧です。"
      badge="MVP"
      rows={rows}
      emptyMessage="差別化ポイントとして抽出された構成要件はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', render: row => {
          const analysis = analysisById.get(row.analysisId);
          const patent = analysis ? patentById.get(analysis.patentId) : undefined;
          return patent ? `対 ${patent.title}` : '（対象特許不明）';
        } },
        { key: 'element', render: row => {
          const el = elementById.get(row.elementId);
          return <span className="mono">{el?.label ?? '?'}</span>;
        } },
        { key: 'ourText', grow: true, render: row => row.ourText },
        { key: 'badge', render: () => <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>差別化ポイント</span> }
      ]}
    />
  );
}
