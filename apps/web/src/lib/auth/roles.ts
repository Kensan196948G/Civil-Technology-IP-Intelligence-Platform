// 権限（ロール）の判定に使う共有定義。
//
// Deep Debug (2026-09-10) で発見した設計乖離への対応:
//   サイドナビが権限で絞られておらず、一般技術者(engineer)にも「システム管理」(/admin)が
//   表示されていた。middleware は /admin を executive/sysadmin 以外に 404 で拒否しており
//   **アクセスは正しく拒否されていた**が、ナビゲーション上は存在が見えていた。
//   docs/30-design/04-screen-design.md §3 は「サイドナビ: 権限のないモジュールは
//   項目自体を表示しない（存在を示さない）」、§7-4 も同旨を MUST 相当で要求している。
//   docs/10-requirements/05-rbac-matrix.md §3 でも M25 Administration は
//   engineer / tech_manager / rnd / ip / legal が「-」。
//
// アクセス強制（middleware）と表示制御（ナビゲーション）が同じ定義を参照するよう、
// 許可ロールをここに一元化する（乖離による「押せるのに開けない」状態を防ぐ）。
import type { DemoRole } from './demo';

/** 管理操作（/admin/*）を許可するロール。middleware の強制とナビの表示制御の共通定義。 */
export const ADMIN_ALLOWED_ROLES: readonly DemoRole[] = ['executive', 'sysadmin'];
