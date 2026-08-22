import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { asc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

// claim_chart_rows.kind（一致/類似/相違）を新規性の観点で解釈し直す。
// match: 先行特許に同一構成が開示済み → 新規性なし
// similar: 部分的に開示 → 新規性に疑義
// differ: 開示なし → 新規性あり
const NOVELTY_LABEL: Record<string, string> = { match: '新規性なし', similar: '新規性に疑義', differ: '新規性あり' };
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
      description="他社特許の構成要件と自社案の記載を比較し、AIが新規性（特許法29条1項）への影響を要件単位で判定した一覧です。"
      badge="MVP"
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
