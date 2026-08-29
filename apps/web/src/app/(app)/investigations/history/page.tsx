export const runtime = 'edge';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { desc, eq, inArray, or } from 'drizzle-orm';
import { ListView } from '@/components/ListView';
import { stampSec } from '@/lib/labels';


const ACTION_LABEL: Record<string, string> = { search: '検索実行', ai_run: 'AI実行', view: '閲覧' };

export default async function InvestigationHistoryPage() {
  const db = getDb(getDatabaseUrl());
  // 監査ログ（audit_logs）のうち、調査業務に関わる操作（検索・AI実行・閲覧）を
  // 抽出して「調査履歴」として表示する。
  const rows = await db.select().from(s.auditLogs)
    .where(or(eq(s.auditLogs.action, 'search'), eq(s.auditLogs.action, 'ai_run'), eq(s.auditLogs.action, 'view')))
    .orderBy(desc(s.auditLogs.occurredAt));

  const actorIds = [...new Set(rows.map(r => r.actorUserId).filter((v): v is string => !!v))];
  const actors = actorIds.length ? await db.select().from(s.users).where(inArray(s.users.id, actorIds)) : [];
  const actorById = new Map(actors.map(a => [a.id, a]));

  return (
    <ListView
      title="調査履歴"
      moduleCode="S-04h / INVESTIGATION HISTORY"
      description="調査業務に関わる操作（検索・AI実行・閲覧）の履歴です。監査ログから調査関連の操作のみを抽出しています。"
      rows={rows}
      emptyMessage="調査に関連する履歴はまだありません。"
      fields={[
        { key: 'occurredAt', mono: true, render: row => stampSec(row.occurredAt) },
        { key: 'action', render: row => ACTION_LABEL[row.action] ?? row.action },
        { key: 'actor', grow: true, render: row => row.actorUserId ? actorById.get(row.actorUserId)?.displayName ?? '—' : '—' },
        { key: 'target', render: row => row.targetType ?? '—' }
      ]}
    />
  );
}
