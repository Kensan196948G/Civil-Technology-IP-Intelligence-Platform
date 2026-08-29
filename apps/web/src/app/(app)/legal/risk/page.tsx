import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, isNotNull } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { WORKFLOW_KIND_LABEL, type AiRiskSummary } from '@/lib/legal-workflow-labels';


const RISK_AXES: { key: keyof AiRiskSummary; label: string }[] = [
  { key: 'novelty', label: '新規性' },
  { key: 'inventive', label: '進歩性' },
  { key: 'description', label: '記載要件' },
  { key: 'overlap', label: '先行技術との重複' }
];

export default async function LegalRiskPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(isNotNull(s.workflowInstances.aiRiskSummary))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="契約リスク"
      moduleCode="S-12 / CONTRACT & IP RISK"
      description="workflow_instances.ai_risk_summary が付与された案件のAIリスク評価です。契約・権利化を進める前に確認すべき法務・知財観点のリスクとして表示します（最終判断は人間が行います）。"
      rows={rows}
      emptyMessage="AIリスク評価が付与された案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{WORKFLOW_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'risk', render: row => {
          const risk = row.aiRiskSummary as AiRiskSummary | null;
          if (!risk) return null;
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {RISK_AXES.map(axis => {
                const level = risk[axis.key];
                if (!level) return null;
                const color = level === 'low' ? 'var(--green)' : level === 'high' ? 'var(--brick)' : 'var(--amber)';
                return (
                  <span key={axis.key} className="badge" style={{ color, border: `1px solid ${color}` }}>
                    {axis.label}：{level}
                  </span>
                );
              })}
            </div>
          );
        } },
        { key: 'humanCheck', render: row => row.humanCheckRequired && !row.humanCheckCompletedAt
          ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>人間確認待ち</span>
          : null }
      ]}
    />
  );
}
