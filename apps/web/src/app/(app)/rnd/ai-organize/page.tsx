import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { stamp } from '@/lib/labels';

export const runtime = 'edge';

export default async function RndAiOrganizePage() {
  const db = getDb(getDatabaseUrl());
  const runs = await db.select().from(s.aiRuns).where(eq(s.aiRuns.kind, 'examine')).orderBy(desc(s.aiRuns.createdAt));

  const inventionIds = [...new Set(runs.filter(r => r.targetType === 'invention' && r.targetId).map(r => r.targetId!))];
  const inventions = inventionIds.length ? await db.select().from(s.inventions).where(inArray(s.inventions.id, inventionIds)) : [];
  const inventionById = new Map(inventions.map(i => [i.id, i]));

  const runIds = runs.map(r => r.id);
  const citations = runIds.length ? await db.select().from(s.aiCitations).where(inArray(s.aiCitations.aiRunId, runIds)) : [];
  const citationCountByRun = new Map<string, number>();
  for (const c of citations) citationCountByRun.set(c.aiRunId, (citationCountByRun.get(c.aiRunId) ?? 0) + 1);

  const rows = runs.map(run => ({
    id: run.id,
    inventionTitle: run.targetId ? inventionById.get(run.targetId)?.title : undefined,
    inventionId: run.targetId ?? undefined,
    status: run.status,
    model: run.model,
    citationCount: citationCountByRun.get(run.id) ?? 0,
    createdAt: run.createdAt
  }));

  return (
    <ListView
      title="AI発明整理"
      moduleCode="S-10 / AI INVENTION TRIAGE"
      description="発明届に対するAI一次整理（examine）の実行履歴です。根拠となった特許・技術データを付けて記録しています。"
      rows={rows}
      emptyMessage="AI発明整理の実行履歴はまだありません。"
      rowHref={row => row.inventionId ? `/inventions/${row.inventionId}` : ''}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.inventionTitle ?? '対象発明届（削除済み）'}</span> },
        { key: 'model', mono: true, render: row => row.model },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)', border: `1px solid ${row.status === 'succeeded' ? 'var(--green)' : 'var(--amber)'}` }}>{row.status}</span>
        ) },
        { key: 'citations', render: row => `根拠 ${row.citationCount}件` },
        { key: 'createdAt', mono: true, render: row => stamp(row.createdAt) }
      ]}
    />
  );
}
