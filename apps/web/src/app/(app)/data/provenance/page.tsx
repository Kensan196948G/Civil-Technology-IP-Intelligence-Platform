export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { resolveCitationLabels } from '@/lib/citations';
import { stampSec } from '@/lib/labels';


const KIND_LABEL: Record<string, string> = {
  examine: 'AI調査', claim_compare: 'Claim比較', field_score: '現場適用性スコアリング'
};

export default async function ProvenancePage() {
  const db = getDb(getDatabaseUrl());
  const citations = await db.select().from(s.aiCitations).orderBy(desc(s.aiCitations.retrievedAt)).limit(200);

  const runIds = [...new Set(citations.map(c => c.aiRunId))];
  const runs = runIds.length ? await db.select().from(s.aiRuns).where(inArray(s.aiRuns.id, runIds)) : [];
  const runById = new Map(runs.map(r => [r.id, r]));
  const labels = await resolveCitationLabels(db, citations);

  return (
    <ListView
      title="Provenance / 出典"
      moduleCode="S-18l / PROVENANCE"
      description="AIが生成した分析結果が、どの一次情報（特許・NETIS・自社技術）のどの記述を根拠として引用したかの出典トレーサビリティ一覧です。AIの回答根拠の監査・検証に使用します。"
      badge="MVP"
      rows={citations}
      emptyMessage="出典（引用）データがまだありません。"
      fields={[
        { key: 'source', grow: true, render: row => <span style={{ fontWeight: 700 }}>{labels.get(row.id) ?? `${row.sourceType}：${row.sourceId}`}</span> },
        { key: 'quoted', render: row => <span style={{ color: 'var(--ink-2)' }}>「{row.quotedText.length > 60 ? row.quotedText.slice(0, 60) + '…' : row.quotedText}」</span> },
        { key: 'runKind', render: row => {
          const run = runById.get(row.aiRunId);
          return run ? (
            <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{KIND_LABEL[run.kind] ?? run.kind}</span>
          ) : '—';
        } },
        { key: 'retrievedAt', mono: true, render: row => stampSec(row.retrievedAt) }
      ]}
    />
  );
}
