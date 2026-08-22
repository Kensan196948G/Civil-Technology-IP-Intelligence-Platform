import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, isNotNull } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

type RiskSummary = {
  novelty?: string;
  inventive?: string;
  description?: string;
  overlap?: string;
  note?: string;
};

const LEVEL_COLOR: Record<string, string> = { high: 'var(--brick)', medium: 'var(--amber)', low: 'var(--green)' };

function levelBadge(label: string, value: string | undefined) {
  if (!value) return null;
  const color = LEVEL_COLOR[value] ?? 'var(--ink-2)';
  return <span className="mono" style={{ fontSize: 10.5, color, border: `1px solid ${color}`, borderRadius: 3, padding: '1px 6px' }}>{label}:{value}</span>;
}

export default async function WatchAiPriorityPage() {
  const db = getDb(getDatabaseUrl());
  // AI模擬審査が重要度・リスクを判定した案件（ai_risk_summary が付与された workflow_instances）を監視する。
  const rows = await db.select().from(s.workflowInstances)
    .where(isNotNull(s.workflowInstances.aiRiskSummary))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="AI重要度判定ウォッチ"
      moduleCode="S-19 / WATCH — AI PRIORITY"
      description="AI模擬審査（新規性・進歩性・先行文献との重複度）による重要度判定が付与された案件です。専門家確認が推奨された案件を優先的に確認してください。"
      rows={rows}
      emptyMessage="AI重要度判定が付与された案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'levels', render: row => {
          const risk = (row.aiRiskSummary ?? null) as RiskSummary | null;
          if (!risk) return '—';
          return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {levelBadge('新規性', risk.novelty)}
              {levelBadge('進歩性', risk.inventive)}
              {levelBadge('重複度', risk.overlap)}
            </div>
          );
        } },
        { key: 'note', grow: true, render: row => {
          const risk = (row.aiRiskSummary ?? null) as RiskSummary | null;
          return <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{risk?.note ?? '—'}</span>;
        } }
      ]}
    />
  );
}
