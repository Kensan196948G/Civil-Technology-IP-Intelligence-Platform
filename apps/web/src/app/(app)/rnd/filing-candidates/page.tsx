import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { getCurrentUser } from '@/lib/auth/current-user';
import { redirect } from 'next/navigation';
import { visibleWhere } from '@/lib/authz/row-visibility';

// #11 C3/C4 行レベル制御: 発明 workflow（C3）は R ロールまたは起案者本人のみ一覧に出す。

const STATUS_LABEL: Record<string, string> = {
  ip_review: '知財レビュー中', legal_review: '法務レビュー中', approved: '承認済み'
};

export default async function RndFilingCandidatesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  const workflows = await db.select().from(s.workflowInstances).where(
    and(
      eq(s.workflowInstances.kind, 'invention'),
      inArray(s.workflowInstances.status, ['ip_review', 'legal_review', 'approved']),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    )
  ).orderBy(desc(s.workflowInstances.createdAt));

  const inventionIds = [...new Set(workflows.filter(w => w.subjectType === 'invention').map(w => w.subjectId))];
  const inventions = inventionIds.length ? await db.select().from(s.inventions).where(inArray(s.inventions.id, inventionIds)) : [];
  const inventionById = new Map(inventions.map(i => [i.id, i]));

  const rows = workflows.map(w => ({
    id: w.id,
    title: inventionById.get(w.subjectId)?.title ?? w.title,
    status: w.status,
    classification: w.classification,
    dueOn: w.dueOn,
    humanCheckRequired: w.humanCheckRequired,
    humanCheckCompletedAt: w.humanCheckCompletedAt
  }));

  return (
    <ListView
      title="出願候補"
      moduleCode="S-10 / FILING CANDIDATES"
      description="知財・法務レビュー段階まで進み、特許出願に向けた検討対象となっている発明届の一覧です。"
      rows={rows}
      emptyMessage="出願候補段階まで進んだ発明届はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{STATUS_LABEL[row.status] ?? row.status}</span>
        ) },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{row.classification}</span>
        ) },
        { key: 'humanCheck', render: row => row.humanCheckRequired
          ? (row.humanCheckCompletedAt ? '人間確認 済' : '人間確認 未完了')
          : '人間確認 不要' },
        { key: 'dueOn', mono: true, render: row => row.dueOn ?? '—' }
      ]}
    />
  );
}
