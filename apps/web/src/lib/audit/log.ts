// 監査ログ（audit_logs）記録の一元化ユーティリティ。
//
// 正とする文書: docs/10-requirements/03-non-functional-requirements.md NFR-L-001
// （監査ログは改変不可・追記専用）／docs/30-design/01-detailed-design.md
// 「⑥ 監査ログ記録 → 成功・失敗・拒否のすべて」／README §16（既知バックログ）。
//
// 背景: 従来は claims/approvals/investigations/sites/sites/new の各 Server Action が
// それぞれ個別に db.insert(auditLogs) や raw SQL insert を直書きしており、書き方も
// バラバラだった。加えて認可拒否（403相当・行レベル秘匿の404）は一件も記録されて
// いなかった。本ユーティリティに書き込みを一元化し、authz の集約点
// （lib/auth/require-role.ts, lib/authz/row-visibility.ts）から拒否時に必ず
// 呼ばれるようにすることで、今後追加される機能でも記録漏れが構造的に起きにくい
// 設計とする。
import type { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import type { TaggedSql } from '@/lib/db/raw';

/** docs/30-design/02-database-design.md の result 列（success / failure / denied）。 */
export type AuditResult = 'success' | 'failure' | 'denied';

export interface AuditLogInput {
  /** 操作者の users.id。未ログイン・利用者レコード未検出の場合は null。 */
  actorUserId: string | null;
  /** login / search / view / ai_run / export / download / create / update / delete / approve / access 等。 */
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  result: AuditResult;
  /** result が denied/failure の場合の理由コード（例: self_approval_forbidden）。 */
  reason?: string | null;
  meta?: Record<string, unknown>;
}

type DbLike = ReturnType<typeof getDb>;

function buildRow(entry: AuditLogInput) {
  return {
    id: crypto.randomUUID(),
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.targetType ?? null,
    targetId: entry.targetId ?? null,
    result: entry.result,
    reason: entry.reason ?? null,
    meta: entry.meta ?? {}
  };
}

/**
 * 単独（非トランザクション）で監査ログを記録する。多くの Server Action・
 * 認可拒否箇所で使う既定の書き込み経路。
 */
export async function logAudit(db: DbLike, entry: AuditLogInput): Promise<void> {
  await db.insert(s.auditLogs).values(buildRow(entry));
}

/**
 * 業務データ書き込みと同一トランザクションで原子的に監査ログを記録する必要が
 * ある場合に使う raw SQL insert 文。
 * `sql.transaction(txn => [業務データのtxn`...`, auditLogTxnStatement(txn, {...})])`
 * の要素として渡す。neon-http は対話的トランザクションを提供しないための
 * 回避策（lib/db/raw.ts 参照）。
 */
export function auditLogTxnStatement(txn: TaggedSql, entry: AuditLogInput): Promise<unknown> {
  const row = buildRow(entry);
  return txn`insert into audit_logs (id, actor_user_id, action, target_type, target_id, result, reason, meta)
      values (${row.id}, ${row.actorUserId}, ${row.action}, ${row.targetType}, ${row.targetId}, ${row.result}, ${row.reason}, ${JSON.stringify(row.meta)}::jsonb)`;
}

/**
 * 認可拒否（403相当・行レベル秘匿の404を含む）の記録専用ヘルパー。
 * 監査ログの書き込み失敗によって本来の拒否レスポンス（redirect/404）自体が
 * 妨げられてはならないため、例外は握りつぶし console.error にのみ残す
 * （ベストエフォート。認可判定そのものには一切影響しない）。
 */
export async function logAuditDenied(
  db: DbLike | null | undefined,
  entry: Omit<AuditLogInput, 'result'> & { result?: 'denied' | 'failure' }
): Promise<void> {
  if (!db) return;
  try {
    await logAudit(db, { ...entry, result: entry.result ?? 'denied' });
  } catch (err) {
    console.error('[audit] failed to record denied/failure action', err);
  }
}
