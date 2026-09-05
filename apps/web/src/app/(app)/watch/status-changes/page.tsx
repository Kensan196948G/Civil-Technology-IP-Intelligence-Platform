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
  draft: '起票', researching: '調査中', ai_reviewed: 'AI事前確認済み',
  technical_review: '技術レビュー中', ip_review: '知財レビュー中', legal_review: '法務レビュー中',
  approved: '登録・承認', rejected: '拒絶・差戻し', hold: '保留', archived: '失効・アーカイブ'
};

// 承認（登録）・差戻し（拒絶）・アーカイブ（失効）に該当する状態は強調表示する
const HIGHLIGHT_COLOR: Record<string, string> = {
  approved: 'var(--green)', rejected: 'var(--brick)', archived: 'var(--ink-2)'
};

const KIND_LABEL: Record<string, string> = {
  invention: '発明届', field_adoption: '現場導入', license_in: '導入ライセンス'
};

export default async function WatchStatusChangesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const db = getDb(getDatabaseUrl());
  const [me] = await db.select().from(s.users).where(eq(s.users.email, user.email)).limit(1);
  // CodeRabbit指摘: statusとcreatedAtだけでは「いつ遷移したか」を判定できず、
  // 遷移イベントの履歴も保持していない。状態遷移の監視ではなく、終端状態
  // （登録・拒絶・失効）に達した案件の一覧に対象を限定して過大表示を防ぐ
  // （遷移履歴モデルの追加は本番設計のバックログ）。
  const rows = await db.select().from(s.workflowInstances)
    .where(and(
      inArray(s.workflowInstances.status, ['approved', 'rejected', 'archived']),
      visibleWhere(s.workflowInstances.classification, s.workflowInstances.authorId, { role: user.role, viewerUserId: me?.id })
    ))
    .orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="登録・拒絶・失効 案件一覧"
      moduleCode="S-19 / WATCH — STATUS CHANGES"
      description="登録（承認）・拒絶（差戻し）・失効（アーカイブ）のいずれかに達している案件の一覧です。遷移した日時の履歴は保持していないため、現在の状態のみを表示します。"
      badge="現在の状態"
      rows={rows}
      emptyMessage="監視対象の案件はまだありません。"
      rowHref={row => `/approvals/${row.id}`}
      fields={[
        { key: 'title', grow: true, render: row => <span style={{ fontWeight: 700 }}>{row.title}</span> },
        { key: 'kind', mono: true, render: row => KIND_LABEL[row.kind] ?? row.kind },
        { key: 'status', render: row => {
          const color = HIGHLIGHT_COLOR[row.status] ?? 'var(--blue)';
          return <span className="badge" style={{ color, border: `1px solid ${color}` }}>{STATUS_LABEL[row.status] ?? row.status}</span>;
        } },
        { key: 'classification', render: row => (
          <span className="badge" style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}>{row.classification}</span>
        ) },
        { key: 'dueOn', mono: true, render: row => row.dueOn ? `期限 ${row.dueOn}` : '—' }
      ]}
    />
  );
}
