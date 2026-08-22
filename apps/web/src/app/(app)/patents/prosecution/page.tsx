import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const STATUS_LABEL: Record<string, string> = {
  draft: '起案', researching: '調査中', ai_reviewed: 'AI一次レビュー済み',
  technical_review: '技術審査中', ip_review: '知財審査中', legal_review: '法務審査中',
  approved: '承認', rejected: '却下', hold: '保留', archived: 'アーカイブ'
};

// 各国特許庁の公式な審査経過（拒絶理由通知・意見書等）はMVPでは未取り込みのため、
// 社内の発明・案件審査ワークフロー（workflow_instances / approvals）を
// 「審査経過」の実データとして代用する（起案〜各段階レビュー〜承認の進捗）。
export default async function PatentProsecutionPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances).orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="審査経過"
      moduleCode="S-03 / PROSECUTION HISTORY"
      description="社内の発明・案件審査ワークフローの進捗一覧です。公式な特許庁審査経過（拒絶理由通知等）はMVPでは未取り込みのため、社内審査プロセスの進捗で代用しています。"
      badge="MVP"
      rows={rows}
      emptyMessage="審査中の案件がまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => row.kind },
        { key: 'author', render: row => authorById.get(row.authorId)?.displayName ?? '—' },
        { key: 'dueOn', mono: true, render: row => row.dueOn ?? '—' },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{STATUS_LABEL[row.status] ?? row.status}</span>
        ) }
      ]}
    />
  );
}
