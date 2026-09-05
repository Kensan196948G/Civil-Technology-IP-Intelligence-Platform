import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

export default async function LegalAgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const rows = await db.select().from(s.workflowInstances)
    .where(and(
      eq(s.workflowInstances.humanCheckRequired, true),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    ))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="Legal Agent"
      moduleCode="S-14 / AI ASSISTANT"
      description="法務・コンプライアンス上、人間による確認が必須と判定された案件を抽出するAgentです。workflow_instancesのうちhuman_check_required=trueの案件を一覧表示します。"
      rows={rows}
      emptyMessage="人間確認が必須の案件は現在ありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'checkStatus', render: row => row.humanCheckCompletedAt
          ? <span className="badge" style={{ color: 'var(--green)', border: '1px solid var(--green)' }}>確認済み</span>
          : <span className="badge" style={{ color: 'var(--brick)', border: '1px solid var(--brick)' }}>確認待ち</span> }
      ]}
    />
  );
}
