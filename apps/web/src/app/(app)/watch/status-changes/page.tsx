import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

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
  const db = getDb(getDatabaseUrl());
  const rows = await db.select().from(s.workflowInstances).orderBy(desc(s.workflowInstances.createdAt));

  return (
    <ListView
      title="権利状態変更 — 登録・拒絶・失効"
      moduleCode="S-19 / WATCH — STATUS CHANGES"
      description="発明届・現場導入等の案件について、審査ステータスの変化を監視します。登録（承認）・拒絶（差戻し）・失効（アーカイブ）への遷移を優先的に確認してください。"
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
