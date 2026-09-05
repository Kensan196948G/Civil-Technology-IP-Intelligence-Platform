import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

const KIND_LABEL: Record<string, string> = { invention: '発明届', field_adoption: '現場導入' };
// CodeRabbit指摘: 「強い（進歩性あり）」は進歩性の成立を確定的に断定する表現になる。
// AI評価値であることと専門家確認の必要性を明示する表現へ変更する。
const RATING_LABEL: Record<string, string> = { low: 'AI評価：低（要確認）', medium: 'AI評価：中（要確認）', high: 'AI評価：高（要専門家確認）' };
const RATING_COLOR: Record<string, string> = { low: 'var(--brick)', medium: 'var(--amber)', high: 'var(--green)' };

type RiskSummary = { inventive?: string };

export default async function InventiveStepReviewPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  // CodeRabbit指摘: 全workflowInstancesを取得するとlicense_in（ライセンス案件）も
  // 進歩性レビュー対象に混入する。画面の説明文（発明届・現場導入案件）と一致させる。
  const workflows = await db.select().from(s.workflowInstances)
    .where(and(
      inArray(s.workflowInstances.kind, ['invention', 'field_adoption']),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    ))
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
