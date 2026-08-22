import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveCitationLabels } from '@/lib/citations';

export const runtime = 'edge';

const RUN_KIND_LABEL: Record<string, string> = {
  examine: 'AI模擬審査',
  claim_compare: 'Claim比較',
  field_score: '現場適用性評価'
};

function trunc(text: string, n: number) {
  return text.length > n ? text.slice(0, n) + '…' : text;
}

export default async function ArgumentPointsPage() {
  const db = getDb(getDatabaseUrl());

  const citations = await db.select().from(s.aiCitations).orderBy(desc(s.aiCitations.retrievedAt));

  const runIds = [...new Set(citations.map(c => c.aiRunId))];
  const runs = runIds.length
    ? await db.select().from(s.aiRuns).where(inArray(s.aiRuns.id, runIds))
    : [];
  const runById = new Map(runs.map(r => [r.id, r]));

  const labels = await resolveCitationLabels(db, citations);

  return (
    <ListView
      title="意見書論点候補"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="AIが各レビューで引用した根拠原文の一覧です。拒絶理由通知への意見書・補正書を作成する際に、反論・主張の論点候補として活用できます。"
      badge="MVP"
      rows={citations}
      emptyMessage="論点候補として抽出された引用データはまだありません。"
      rowHref={row => {
        // ai_citations.source_type='patent' の場合のみ特許詳細へリンクする
        return row.sourceType === 'patent' ? `/patents/${row.sourceId}` : '';
      }}
      fields={[
        { key: 'runKind', render: row => {
          const run = runById.get(row.aiRunId);
          return <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{run ? (RUN_KIND_LABEL[run.kind] ?? run.kind) : '—'}</span>;
        } },
        { key: 'source', render: row => labels.get(row.id) ?? '—' },
        { key: 'quoted', grow: true, render: row => trunc(row.quotedText, 40) },
        { key: 'retrievedAt', mono: true, render: row => String(row.retrievedAt).slice(0, 19).replace('T', ' ') }
      ]}
    />
  );
}
