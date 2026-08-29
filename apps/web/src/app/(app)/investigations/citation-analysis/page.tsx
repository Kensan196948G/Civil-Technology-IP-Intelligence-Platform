export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveCitationLabels } from '@/lib/citations';


const RUN_KIND_LABEL: Record<string, string> = {
  examine: 'AI模擬審査', claim_compare: 'Claim比較', field_score: '現場適用性スコアリング'
};

export default async function CitationAnalysisPage() {
  const db = getDb(getDatabaseUrl());
  const citations = await db.select().from(s.aiCitations).orderBy(desc(s.aiCitations.retrievedAt));

  const runIds = [...new Set(citations.map(c => c.aiRunId))];
  const runs = runIds.length ? await db.select().from(s.aiRuns).where(inArray(s.aiRuns.id, runIds)) : [];
  const runById = new Map(runs.map(r => [r.id, r]));

  const labels = await resolveCitationLabels(db, citations);
  const rows = citations.map(c => ({
    ...c,
    sourceLabel: labels.get(c.id) ?? '—',
    runKind: runById.get(c.aiRunId)?.kind
  }));

  return (
    <ListView
      title="引用文献分析"
      moduleCode="S-04e / CITATION ANALYSIS"
      description="AI実行が根拠として引用した文献（特許・NETIS・自社技術）の一覧です。どの分析がどの文献を根拠としたかを確認できます。"
      rows={rows}
      emptyMessage="引用文献データがまだありません。"
      rowHref={row => row.sourceType === 'patent' ? `/patents/${row.sourceId}` : row.sourceType === 'netis' ? `/netis/${row.sourceId}` : ''}
      fields={[
        { key: 'source', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.sourceLabel}</span> },
        { key: 'run', render: row => row.runKind ? (RUN_KIND_LABEL[row.runKind] ?? row.runKind) : '—' },
        { key: 'quoted', render: row => (
          <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>
            {row.quotedText.length > 40 ? `${row.quotedText.slice(0, 40)}…` : row.quotedText}
          </span>
        ) }
      ]}
    />
  );
}
