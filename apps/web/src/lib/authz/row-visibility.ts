// #11 C3/C4 機密区分の行レベル制御（Issue #11・D-6 対応）
//
// 正とする文書: docs/10-requirements/05-rbac-matrix.md §4（MUST）／
// docs/30-design/01-detailed-design.md §3.1（認可は WHERE 句に含め、取得後フィルタ禁止・失敗は 404）／
// README §14 ルール1・2。
//
// 実装ルール（README §16 に読替えとして明記）:
//   - C1（公開）/ C2（社内）: 全ロール可視
//   - C3（機密: 出願前発明・Claim候補・競合評価）: 「当該データの参照(R)権限を持つロール」
//     または「起案者本人（owner 特例）」、または「個別付与（grant）」があれば可視。
//     存在も件数にも出さない
//   - C4（最高機密）: 個別付与（grant, access_grants テーブル）がある利用者のみ可視。
//     grant が無い場合は sysadmin を含むいずれのロールにも不可視（RBAC §4 MUST）
//
// grant（access_grants）: FR-RBAC-05 個別付与モデル。付与操作は sysadmin のみが行い
// （app/(app)/admin/project-permissions/actions.ts）、監査ログに記録する。
import { sql, type SQL } from 'drizzle-orm';
import type { DemoRole } from '@/lib/auth/demo';
import type { getDb } from '@/lib/db/client';
import { logAuditDenied } from '@/lib/audit/log';

export type Classification = 'C1' | 'C2' | 'C3' | 'C4';
export const CLASSIFICATIONS: Classification[] = ['C1', 'C2', 'C3', 'C4'];

/** grant（access_grants）の対象種別。将来拡張しやすいよう文字列で汎用化する。 */
export type GrantTargetType = 'invention' | 'workflow_instance';

/** C3 を「既定で」閲覧できるロール（RBAC §3 で M15 Invention 等に R を持つロール）。 */
const C3_READER_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>([
  'tech_manager', 'rnd', 'ip', 'legal', 'executive', 'sysadmin'
]);

export function isC3ReaderRole(role: DemoRole): boolean {
  return C3_READER_ROLES.has(role);
}

/** ロールが既定で閲覧できる classification 一覧（owner 特例・grant は含まない）。 */
export function defaultVisibleClassifications(role: DemoRole): Classification[] {
  const base: Classification[] = ['C1', 'C2'];
  if (C3_READER_ROLES.has(role)) base.push('C3');
  // C4 は個別付与（grant）がある場合のみ。ロール単位の既定可視には含めない。
  return base;
}

/**
 * ある行（classification）をロールの利用者が閲覧できるか。
 * @param isOwner その行の起案者本人（inventions.submitted_by / workflow.author_id = 自分）か。
 *                owner 特例により engineer/viewer も自分の C3 は閲覧できる。
 * @param hasGrant その行（対象）への個別付与（access_grants）があるか。既定は false のため、
 *                 呼び出し側で明示しない限り従来通りの挙動（後方互換）になる。
 */
export function canViewRow(
  role: DemoRole,
  classification: Classification,
  isOwner: boolean,
  hasGrant = false
): boolean {
  if (classification === 'C1' || classification === 'C2') return true;
  if (classification === 'C4') return hasGrant; // 個別付与（grant）がある場合のみ可視
  // C3: R ロール、起案者本人、または個別付与
  return C3_READER_ROLES.has(role) || isOwner || hasGrant;
}

/**
 * canViewRow() の監査ログ付きラッパー。行レベル秘匿の404（README §14 ルール2）を
 * 返す直前に呼び、拒否された場合のみ監査ログ（result: 'denied'）を記録する
 * （NFR-L-001「拒否操作を残す」対応）。canViewRow 自体は同期・純粋関数のまま
 * 変更しない（既存の単体テスト・呼び出し箇所への影響を避けるため）。
 * 監査ログの書き込み失敗はここでの可視性判定結果に一切影響しない（best-effort）。
 */
export async function canViewRowAudited(
  db: ReturnType<typeof getDb>,
  params: {
    role: DemoRole;
    classification: Classification;
    isOwner: boolean;
    actorUserId: string | null;
    targetType: string;
    targetId: string;
    /** 対象への個別付与（access_grants）があるか。省略時は false（従来通り）。 */
    hasGrant?: boolean;
  }
): Promise<boolean> {
  const allowed = canViewRow(params.role, params.classification, params.isOwner, params.hasGrant ?? false);
  if (!allowed) {
    await logAuditDenied(db, {
      actorUserId: params.actorUserId,
      action: 'view',
      targetType: params.targetType,
      targetId: params.targetId,
      reason: 'row_visibility_denied',
      meta: { classification: params.classification, role: params.role }
    });
  }
  return allowed;
}

/**
 * access_grants への EXISTS 条件（SQL フラグメント）。grant が無ければマッチしない。
 * target_type は固定文字列（呼び出し側の定数）なので SQL インジェクションの懸念はない。
 */
function grantExistsCondition(
  idCol: SQL | { name: string },
  targetType: GrantTargetType,
  userId: string
): SQL {
  return sql`EXISTS (
    SELECT 1 FROM access_grants
    WHERE access_grants.target_type = ${targetType}
      AND access_grants.target_id = ${idCol}
      AND access_grants.user_id = ${userId}
  )`;
}

/**
 * drizzle の WHERE 条件を組み立てる（一覧・件数・詳細クエリに共通注入）。
 * 「取得後にアプリでフィルタ」を禁止し、必ず SQL 側で絞る（README §14 ルール1）。
 *
 * @param classificationCol classification カラム（例: s.inventions.classification）
 * @param ownerCol 起案者カラム（例: s.inventions.submittedBy / s.workflowInstances.authorId）
 * @param opts viewerUserId は現在ログイン利用者の users.id（未取得時 undefined＝owner特例・grant特例なし）。
 *             grant を渡すと、その対象（idCol・targetType）への個別付与がある行を追加で可視にする
 *             （C4 を含む）。grant を渡さない既存呼び出し箇所は挙動が変わらない（後方互換）。
 */
export function visibleWhere(
  classificationCol: SQL | { name: string },
  ownerCol: SQL | { name: string },
  opts: {
    role: DemoRole;
    viewerUserId?: string;
    grant?: { idCol: SQL | { name: string }; targetType: GrantTargetType };
  }
): SQL {
  const c3Reader = C3_READER_ROLES.has(opts.role);
  const userId = opts.viewerUserId;
  const grantCond = opts.grant && userId
    ? grantExistsCondition(opts.grant.idCol, opts.grant.targetType, userId)
    : null;

  if (c3Reader) {
    // C1〜C3 可視。C4 は個別付与（grant）がある行のみ追加で可視にする。
    return grantCond
      ? sql`(${classificationCol} IN ('C1','C2','C3') OR ${grantCond})`
      : sql`${classificationCol} IN ('C1','C2','C3')`;
  }
  if (!userId) {
    // ログイン利用者のDBレコードが無い場合（通常起きない）は C1/C2 のみ
    return sql`${classificationCol} IN ('C1','C2')`;
  }
  // engineer/viewer: C1/C2 ＋ 自分が起案した C3（owner 特例）＋ 個別付与（grant）があれば C3/C4 も可視
  return grantCond
    ? sql`(${classificationCol} IN ('C1','C2') OR (${classificationCol} = 'C3' AND ${ownerCol} = ${userId}) OR ${grantCond})`
    : sql`(${classificationCol} IN ('C1','C2') OR (${classificationCol} = 'C3' AND ${ownerCol} = ${userId}))`;
}
