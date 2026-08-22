import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray } from 'drizzle-orm';
import { ListView } from '@/components/ListView';

export const runtime = 'edge';

const ACTION_LABEL: Record<string, string> = {
  login: 'ログイン', search: '検索', ai_run: 'AI実行', view: '閲覧', export: 'Export',
  update: '更新', role_change: '権限変更', security_event: 'セキュリティイベント', seed: 'シード投入'
};

export default async function AuditPage({ searchParams }: { searchParams: { action?: string } }) {
  const db = getDb(getDatabaseUrl());
  const action = searchParams.action;
  const base = db.select().from(s.auditLogs);
  const rows = await (action ? base.where(eq(s.auditLogs.action, action)) : base)
    .orderBy(desc(s.auditLogs.occurredAt))
    .limit(200);

  const actorIds = [...new Set(rows.map(r => r.actorUserId).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, actorIds)) : [];
  const actorById = new Map(actors.map(a => [a.id, a]));

  return (
    <ListView
      title={action ? `監査ログ — ${ACTION_LABEL[action] ?? action}` : '監査ログ'}
      moduleCode="S-25 / SECURITY & AUDIT"
      description="主要な操作の監査ログです。MVPでは主要操作のみを記録しています（本番設計では全操作・拒否操作を含む完全な監査を実装予定）。"
      rows={rows}
      emptyMessage="該当する監査ログはありません。"
      fields={[
        { key: 'occurredAt', mono: true, render: row => String(row.occurredAt).slice(0, 19).replace('T', ' ') },
        { key: 'action', render: row => ACTION_LABEL[row.action] ?? row.action },
        { key: 'actor', grow: true, render: row => row.actorUserId ? actorById.get(row.actorUserId)?.displayName ?? '—' : '—' },
        { key: 'result', render: row => (
          <span className="badge" style={{ color: row.result === 'success' ? 'var(--green)' : 'var(--brick)', border: `1px solid ${row.result === 'success' ? 'var(--green)' : 'var(--brick)'}` }}>{row.result}</span>
        ) }
      ]}
    />
  );
}
