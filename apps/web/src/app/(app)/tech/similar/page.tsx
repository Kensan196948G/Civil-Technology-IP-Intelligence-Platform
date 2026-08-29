export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


export default async function TechSimilarPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.claimChartRows).where(eq(s.claimChartRows.kind, 'similar'));

  const analysisIds = [...new Set(rows.map(r => r.analysisId))];
  const analyses = analysisIds.length
    ? await db.select().from(s.claimAnalyses).where(inArray(s.claimAnalyses.id, analysisIds))
    : [];
  const analysisById = new Map(analyses.map(a => [a.id, a]));

  const patentIds = [...new Set(analyses.map(a => a.patentId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  return (
    <ListView
      title="類似技術"
      moduleCode="S-06 / TECHNOLOGY INTELLIGENCE"
      description="Claim比較のうち、AIが「類似（similar）」と判定した構成要件の一覧です。一致でも相違でもなく、専門家の確認が必要な箇所を示します。"
      rows={rows}
      emptyMessage="「類似」と判定された構成要件はまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'ourText', grow: true, render: row => row.ourText },
        { key: 'patent', render: row => {
          const a = analysisById.get(row.analysisId);
          const patent = a ? patentById.get(a.patentId) : undefined;
          return patent ? `対象特許：${patent.title}` : '—';
        } },
        { key: 'kind', render: () => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>類似</span>
        ) }
      ]}
    />
  );
}
