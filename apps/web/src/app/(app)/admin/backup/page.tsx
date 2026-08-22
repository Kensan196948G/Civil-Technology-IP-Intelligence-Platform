import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { count, desc } from 'drizzle-orm';
import { InfoPage } from '@/components/InfoPage';

export const runtime = 'edge';

export default async function AdminBackupPage() {
  const db = getDb(getDatabaseUrl());
  const [patents] = await db.select({ n: count() }).from(s.patents);
  const [technologies] = await db.select({ n: count() }).from(s.technologies);
  const [workflowInstances] = await db.select({ n: count() }).from(s.workflowInstances);
  const [users] = await db.select({ n: count() }).from(s.users);
  const [auditLogs] = await db.select({ n: count() }).from(s.auditLogs);
  const [latestLog] = await db.select().from(s.auditLogs).orderBy(desc(s.auditLogs.occurredAt)).limit(1);

  const totalRows = (patents?.n ?? 0) + (technologies?.n ?? 0) + (workflowInstances?.n ?? 0) + (users?.n ?? 0) + (auditLogs?.n ?? 0);

  return (
    <InfoPage
      title="バックアップ"
      moduleCode="S-19 / SYSTEM ADMIN"
      description="MVP環境における保護対象データの規模と、直近のデータベース更新状況です。"
      badge="MVP"
      blocks={[
        { label: '基盤データベース', value: <span className="mono">Neon Postgres（Point-in-Time Restore 機能あり）</span> },
        { label: '特許データ件数', value: `${patents?.n ?? 0} 件` },
        { label: '技術データ件数', value: `${technologies?.n ?? 0} 件` },
        { label: 'ワークフロー案件件数', value: `${workflowInstances?.n ?? 0} 件` },
        { label: '利用者件数', value: `${users?.n ?? 0} 名` },
        { label: '監査ログ件数', value: `${auditLogs?.n ?? 0} 件` },
        { label: '保護対象データ合計', value: `${totalRows} 件` },
        { label: '直近のDB更新（監査ログ基準）', value: latestLog ? <span className="mono">{String(latestLog.occurredAt).slice(0, 19).replace('T', ' ')}</span> : '—' }
      ]}
      note="Neonのポイントインタイムリストア機能に依存した参照表示です。定期バックアップジョブ・世代管理・復旧手順の自動化は本番設計フェーズのバックログとして扱います。"
    />
  );
}
