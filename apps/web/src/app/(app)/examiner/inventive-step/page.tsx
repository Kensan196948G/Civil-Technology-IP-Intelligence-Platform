import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const KIND_LABEL: Record<string, string> = { invention: '発明届', field_adoption: '現場導入' };
const RATING_LABEL: Record<string, string> = { low: '弱い（拒絶リスク高）', medium: '中程度', high: '強い（進歩性あり）' };
const RATING_COLOR: Record<string, string> = { low: 'var(--brick)', medium: 'var(--amber)', high: 'var(--green)' };

type RiskSummary = { inventive?: string };

export default async function InventiveStepReviewPage() {
  const db = getDb(getDatabaseUrl());
  // CodeRabbit指摘: 全workflowInstancesを取得するとlicense_in（ライセンス案件）も
  // 進歩性レビュー対象に混入する。画面の説明文（発明届・現場導入案件）と一致させる。
  const workflows = await db.select().from(s.workflowInstances)
    .where(inArray(s.workflowInstances.kind, ['invention', 'field_adoption']))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="進歩性レビュー"
      moduleCode="S-14 / AI PATENT REVIEW"
      description="発明届・現場導入案件について、AIが算出した進歩性（特許法29条2項）の評価サマリーです。ai_risk_summaryが未算出の案件は「未評価」と表示されます。"
      badge="MVP"
      rows={workflows}
      emptyMessage="進歩性レビュー対象のワークフロー案件がまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'status', render: row => row.status },
        { key: 'inventive', render: row => {
          const risk = row.aiRiskSummary as RiskSummary | null;
          const rating = risk?.inventive;
          if (!rating) return <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line)' }}>未評価</span>;
          return (
            <span className="badge" style={{ color: RATING_COLOR[rating] ?? 'var(--ink-2)', border: `1px solid ${RATING_COLOR[rating] ?? 'var(--line)'}` }}>
              {RATING_LABEL[rating] ?? rating}
            </span>
          );
        } }
      ]}
    />
  );
}
