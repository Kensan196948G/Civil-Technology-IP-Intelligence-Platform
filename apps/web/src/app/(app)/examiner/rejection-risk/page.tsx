import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = { invention: '発明届', field_adoption: '現場導入', license_in: 'ライセンスIN' };

type RiskSummary = { novelty?: string; inventive?: string; description?: string; overlap?: string };

function overallRisk(risk: RiskSummary | null): { label: string; color: string } {
  if (!risk) return { label: '未評価', color: 'var(--ink-2)' };
  let factors = 0;
  if (risk.novelty === 'low') factors++;
  if (risk.inventive === 'low') factors++;
  if (risk.description === 'low') factors++;
  if (risk.overlap === 'high') factors++;
  if (factors >= 2) return { label: '高', color: 'var(--brick)' };
  if (factors === 1) return { label: '中', color: 'var(--amber)' };
  return { label: '低', color: 'var(--green)' };
}

function summarize(risk: RiskSummary | null): string {
  if (!risk) return '—';
  const parts: string[] = [];
  if (risk.novelty) parts.push(`新規性:${risk.novelty}`);
  if (risk.inventive) parts.push(`進歩性:${risk.inventive}`);
  if (risk.description) parts.push(`記載:${risk.description}`);
  if (risk.overlap) parts.push(`重複:${risk.overlap}`);
  return parts.length ? parts.join(' / ') : '—';
}

export default async function RejectionRiskPage() {
  const db = getDb(getDatabaseUrl());
  const workflows = await db.select().from(s.workflowInstances).orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="拒絶リスク評価"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="ワークフロー案件ごとに、AIリスクサマリー（新規性・進歩性・記載要件・重複）を集計し、総合的な拒絶リスクを評価した一覧です。"
      badge="MVP"
      rows={workflows}
      emptyMessage="拒絶リスク評価の対象となるワークフロー案件がまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'detail', render: row => summarize(row.aiRiskSummary as RiskSummary | null) },
        { key: 'risk', render: row => {
          const r = overallRisk(row.aiRiskSummary as RiskSummary | null);
          return <span className="badge" style={{ color: r.color, border: `1px solid ${r.color}` }}>拒絶リスク：{r.label}</span>;
        } }
      ]}
    />
  );
}
