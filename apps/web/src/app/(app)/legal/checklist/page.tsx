import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { WORKFLOW_KIND_LABEL, type AiRiskSummary } from '@/lib/legal-workflow-labels';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

function checkState(row: { humanCheckRequired: boolean; humanCheckCompletedAt: Date | string | null }) {
  if (!row.humanCheckRequired) return { label: '確認不要', color: 'var(--ink-2)' };
  if (row.humanCheckCompletedAt) return { label: '確認済み', color: 'var(--green)' };
  return { label: '要確認', color: 'var(--brick)' };
}

export default async function LegalChecklistPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.workflowInstances)
    .where(visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id }))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="法務確認事項"
      moduleCode="S-12 / LEGAL CONFIRMATION CHECKLIST"
      description="workflow_instances.human_check_required / human_check_completed_at をもとに、AI審査結果に対して人間（法務・知財担当）の確認が必要な事項の状況を一覧化します。"
      rows={rows}
      emptyMessage="確認事項の対象案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'kind', render: row => (
          <span className="badge" style={{ color: 'var(--ink-2)', border: '1px solid var(--line-2)' }}>{WORKFLOW_KIND_LABEL[row.kind] ?? row.kind}</span>
        ) },
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'note', render: row => {
          const risk = row.aiRiskSummary as AiRiskSummary | null;
          return risk?.note ? <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{risk.note}</span> : null;
        } },
        { key: 'check', render: row => {
          const state = checkState(row);
          return <span className="badge" style={{ color: state.color, border: `1px solid ${state.color}` }}>{state.label}</span>;
        } }
      ]}
    />
  );
}
