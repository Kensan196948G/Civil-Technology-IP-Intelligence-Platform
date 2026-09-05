import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and, isNotNull } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

type RiskSummary = { novelty?: string; inventive?: string; note?: string };

export default async function ExaminerAgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.workflowInstances)
    .where(and(
      isNotNull(s.workflowInstances.aiRiskSummary),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    ))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="Examiner Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="発明届・現場導入案件についてAIが新規性・進歩性の観点で模擬審査を行うAgentです。workflow_instancesのうちAIリスクサマリーが付与された案件を一覧表示します（最終判断は人間が行います）。"
      rows={rows}
      emptyMessage="AI模擬審査の結果はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'risk', render: row => {
          const risk = row.aiRiskSummary as RiskSummary | null;
          return risk ? (
            <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>
              新規性：{risk.novelty ?? '—'} ／ 進歩性：{risk.inventive ?? '—'}
            </span>
          ) : null;
        } },
        { key: 'status', render: row => <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.status}</span> },
        { key: 'humanCheck', render: row => row.humanCheckRequired && !row.humanCheckCompletedAt
          ? <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>人間確認待ち</span>
          : null }
      ]}
    />
  );
}
