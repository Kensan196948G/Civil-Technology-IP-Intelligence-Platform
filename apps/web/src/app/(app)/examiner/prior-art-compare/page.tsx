import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = { match: '一致', similar: '類似', differ: '相違' };
const KIND_COLOR: Record<string, string> = { match: 'var(--green)', similar: 'var(--amber)', differ: 'var(--brick)' };

function trunc(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

export default async function PriorArtComparePage() {
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

  return (
    <ListView
      title="先行文献比較"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="他社特許（先行文献）から引用された原文と、自社案の記載をAIが要件単位で並べて比較した一覧です。"
      badge="MVP"
      rows={rows}
      emptyMessage="先行文献比較の対象データがまだありません。"
      rowHref={row => `/claims/${row.analysisId}`}
      fields={[
        { key: 'patent', grow: true, render: row => {
          const analysis = analysisById.get(row.analysisId);
          const patent = analysis ? patentById.get(analysis.patentId) : undefined;
          return patent?.title ?? '（対象特許不明）';
        } },
        { key: 'quoted', render: row => <span className="mono">{trunc(row.quotedText, 26)}</span> },
        { key: 'ourText', render: row => trunc(row.ourText, 26) },
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: KIND_COLOR[row.kind], border: `1px solid ${KIND_COLOR[row.kind]}` }}>
            {KIND_LABEL[row.kind] ?? row.kind}
          </span>
        ) }
      ]}
    />
  );
}
