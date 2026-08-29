import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { ymd } from '@/lib/labels';


// 特許同士の引用関係（親出願・優先権・審査官引用等）はMVPスキーマに存在しないため、
// AI実行が根拠として特許を引用した記録（ai_citations, source_type='patent'）を
// 「引用・被引用」の実データとして代用する（= 社内AIがどの特許を根拠に使ったか）。
export default async function PatentCitationsPage() {
  const db = getDb(getDatabaseUrl());
  const citations = await db.select().from(s.aiCitations)
    .where(eq(s.aiCitations.sourceType, 'patent'))
    .orderBy(desc(s.aiCitations.retrievedAt));

  const runIds = [...new Set(citations.map(c => c.aiRunId))];
  const runs = runIds.length ? await db.select().from(s.aiRuns).where(inArray(s.aiRuns.id, runIds)) : [];
  const runById = new Map(runs.map(r => [r.id, r]));

  const patentIds = [...new Set(citations.map(c => c.sourceId))];
  const patents = patentIds.length ? await db.select().from(s.patents).where(inArray(s.patents.id, patentIds)) : [];
  const patentById = new Map(patents.map(p => [p.id, p]));

  return (
    <ListView
      title="引用・被引用"
      moduleCode="S-03 / CITATIONS"
      description="AIレビュー・分析が根拠として引用した特許の一覧です（被引用元＝AI実行、引用先＝特許）。特許間の直接的な引用関係はMVPでは未取り込みです。"
      badge="MVP"
      rows={citations}
      emptyMessage="AI実行による特許引用の記録がまだありません。"
      rowHref={row => patentById.has(row.sourceId) ? `/patents/${row.sourceId}` : ''}
      fields={[
        { key: 'patent', grow: true, render: row => <span style={{ fontWeight: 700 }}>{patentById.get(row.sourceId)?.title ?? '特許（削除済み）'}</span> },
        { key: 'run', render: row => runById.get(row.aiRunId)?.kind ?? '—' },
        { key: 'model', mono: true, render: row => runById.get(row.aiRunId)?.model ?? '—' },
        { key: 'quoted', render: row => <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{row.quotedText.slice(0, 40)}{row.quotedText.length > 40 ? '…' : ''}</span> },
        { key: 'retrievedAt', mono: true, render: row => ymd(row.retrievedAt) }
      ]}
    />
  );
}
