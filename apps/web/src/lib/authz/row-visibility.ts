// #11 C3/C4 機密区分の行レベル制御（Issue #11・D-6 対応）
//
// 正とする文書: docs/10-requirements/05-rbac-matrix.md §4（MUST）／
// docs/30-design/01-detailed-design.md §3.1（認可は WHERE 句に含め、取得後フィルタ禁止・失敗は 404）／
// README §14 ルール1・2。
//
// MVP の制約: 本番設計の「プロジェクト参加者」「個別付与（grant）」モデルは未導入のため、
// 以下の簡易ルールで近似する（README §16 に読替えとして明記）。
//   - C1（公開）/ C2（社内）: 全ロール可視
//   - C3（機密: 出願前発明・Claim候補・競合評価）: 「当該データの参照(R)権限を持つロール」
//     または「起案者本人（owner 特例）」のみ可視。存在も件数にも出さない
//   - C4（最高機密）: 個別付与（grant）導入まで、いずれのロールにも可視にしない
//     （現行シードに C4 データは存在しない。導入時は本ヘルパーの拡張点）
import { sql, type SQL } from 'drizzle-orm';
import type { DemoRole } from '@/lib/auth/demo';

export type Classification = 'C1' | 'C2' | 'C3' | 'C4';
export const CLASSIFICATIONS: Classification[] = ['C1', 'C2', 'C3', 'C4'];

/** C3 を「既定で」閲覧できるロール（RBAC §3 で M15 Invention 等に R を持つロール）。 */
const C3_READER_ROLES: ReadonlySet<DemoRole> = new Set<DemoRole>([
  'tech_manager', 'rnd', 'ip', 'legal', 'executive', 'sysadmin'
]);

export function isC3ReaderRole(role: DemoRole): boolean {
  return C3_READER_ROLES.has(role);
}

/** ロールが既定で閲覧できる classification 一覧（owner 特例は含まない）。 */
export function defaultVisibleClassifications(role: DemoRole): Classification[] {
  const base: Classification[] = ['C1', 'C2'];
  if (C3_READER_ROLES.has(role)) base.push('C3');
  // C4 は個別付与まで追加しない
  return base;
}

/**
 * ある行（classification）をロールの利用者が閲覧できるか。
 * @param isOwner その行の起案者本人（inventions.submitted_by / workflow.author_id = 自分）か。
 *                owner 特例により engineer/viewer も自分の C3 は閲覧できる。
 */
export function canViewRow(
  role: DemoRole,
  classification: Classification,
  isOwner: boolean
): boolean {
  if (classification === 'C1' || classification === 'C2') return true;
  if (classification === 'C4') return false; // 個別付与（grant）導入まで不可視
  // C3: R ロール、または起案者本人
  return C3_READER_ROLES.has(role) || isOwner;
}

/**
 * drizzle の WHERE 条件を組み立てる（一覧・件数・詳細クエリに共通注入）。
 * 「取得後にアプリでフィルタ」を禁止し、必ず SQL 側で絞る（README §14 ルール1）。
 *
 * @param classificationCol classification カラム（例: s.inventions.classification）
 * @param ownerCol 起案者カラム（例: s.inventions.submittedBy / s.workflowInstances.authorId）
 * @param opts viewerUserId は現在ログイン利用者の users.id（未取得時 undefined＝owner特例なし）
 */
export function visibleWhere(
  classificationCol: SQL | { name: string },
  ownerCol: SQL | { name: string },
  opts: { role: DemoRole; viewerUserId?: string }
): SQL {
  const c3Reader = C3_READER_ROLES.has(opts.role);
  const userId = opts.viewerUserId;
  if (c3Reader) {
    // C1〜C3 可視。C4 は個別付与モデル導入まで常に除外
    return sql`${classificationCol} IN ('C1','C2','C3')`;
  }
  if (!userId) {
    // ログイン利用者のDBレコードが無い場合（通常起きない）は C1/C2 のみ
    return sql`${classificationCol} IN ('C1','C2')`;
  }
  // engineer/viewer: C1/C2 ＋ 自分が起案した C3（owner 特例）
  return sql`(${classificationCol} IN ('C1','C2') OR (${classificationCol} = 'C3' AND ${ownerCol} = ${userId}))`;
}
