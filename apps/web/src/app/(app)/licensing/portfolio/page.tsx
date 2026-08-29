import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';


const STATUS_LABEL: Record<string, string> = {
  draft: '起案', researching: '調査中', ai_reviewed: 'AI一次レビュー済み',
  technical_review: '技術審査中', ip_review: '知財審査中', legal_review: '法務審査中',
  approved: '登録', rejected: '却下', hold: '保留', archived: '放棄'
};
const STATUS_COLOR: Record<string, string> = {
  approved: 'var(--green)', rejected: 'var(--brick)', archived: 'var(--brick)', hold: 'var(--amber)'
};

// MVPでは自社の登録特許そのものを保持する専用テーブルがないため、
// 発明届→審査ワークフロー（workflow_instances.kind='invention'）を
// 自社IP資産ポートフォリオの実データとして用いる（起案〜登録・放棄までの進捗を保持）。
export default async function PortfolioPage() {
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances)
    .where(eq(s.workflowInstances.kind, 'invention'))
    .orderBy(desc(s.workflowInstances.createdAt));

  const authorIds = [...new Set(rows.map(r => r.authorId))];
  const authors = authorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, authorIds)) : [];
  const authorById = new Map(authors.map(a => [a.id, a]));

  return (
    <ListView
      title="自社特許一覧"
      moduleCode="S-11j / LICENSING & IP PORTFOLIO"
      description="自社の発明届〜審査ワークフローを、自社IP資産ポートフォリオとして一覧します（正式な特許登録原簿はMVP未接続のため、社内審査進捗で代用）。"
      badge="MVP"
      rows={rows}
      emptyMessage="自社IP資産の登録はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--blue)', border: '1px solid var(--blue)' }}>{row.classification}</span>
        ) },
        { key: 'author', render: row => <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>起案：{authorById.get(row.authorId)?.displayName ?? '—'}</span> },
        { key: 'status', render: row => (
          <span className="badge" style={{ color: STATUS_COLOR[row.status] ?? 'var(--ink-2)', border: `1px solid ${STATUS_COLOR[row.status] ?? 'var(--line)'}` }}>
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
        ) }
      ]}
    />
  );
}
