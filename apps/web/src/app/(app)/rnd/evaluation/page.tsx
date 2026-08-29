export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and, isNotNull, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


type RiskSummary = { novelty?: string; inventive?: string; description?: string; overlap?: string; note?: string };

const RISK_LABEL: Record<string, string> = { low: '低', medium: '中', high: '高' };

export default async function RndEvaluationPage() {
  const db = getDb(getDatabaseUrl());
  const workflows = await db.select().from(s.workflowInstances).where(
    and(eq(s.workflowInstances.kind, 'invention'), isNotNull(s.workflowInstances.aiRiskSummary))
  ).orderBy(desc(s.workflowInstances.createdAt));

  const inventionIds = [...new Set(workflows.filter(w => w.subjectType === 'invention').map(w => w.subjectId))];
  const inventions = inventionIds.length ? await db.select().from(s.inventions).where(inArray(s.inventions.id, inventionIds)) : [];
  const inventionById = new Map(inventions.map(i => [i.id, i]));

  const rows = workflows.map(w => {
    const risk = (w.aiRiskSummary ?? {}) as RiskSummary;
    return {
      id: w.id,
      title: inventionById.get(w.subjectId)?.title ?? w.title,
      status: w.status,
      novelty: risk.novelty,
      inventive: risk.inventive,
      overlap: risk.overlap
    };
  });

  return (
    <ListView
      title="発明評価"
      moduleCode="S-10 / INVENTION EVALUATION"
      description="AI模擬審査（新規性・進歩性・記載要件・重複リスク）が実施された発明届の一覧です。判断は行わず、専門家確認の参考情報として提示します。"
      rows={rows}
      emptyMessage="AI模擬審査が実施された発明届はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'status', mono: true, render: row => row.status },
        { key: 'novelty', render: row => `新規性：${row.novelty ? RISK_LABEL[row.novelty] ?? row.novelty : '—'}` },
        { key: 'inventive', render: row => `進歩性：${row.inventive ? RISK_LABEL[row.inventive] ?? row.inventive : '—'}` },
        { key: 'overlap', render: row => (
          <span className="badge" style={{
            color: row.overlap === 'low' ? 'var(--green)' : 'var(--amber)',
            border: `1px solid ${row.overlap === 'low' ? 'var(--green)' : 'var(--amber)'}`
          }}>重複{row.overlap ? RISK_LABEL[row.overlap] ?? row.overlap : '—'}</span>
        ) }
      ]}
    />
  );
}
