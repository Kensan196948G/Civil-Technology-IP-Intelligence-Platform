import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from './current-user';
import type { DemoRole } from './demo';

// Deep Debug Round2 で発見: docs/10-requirements/05-rbac-matrix.md と README §14
// (「行レベル権限がない場合は404」) が要求する認可制御が未実装で、認証済みなら
// 任意ロールが管理者専用画面・機密ワークフローへ到達できていた。
// ロール別のページアクセス制御を行うサーバー専用ヘルパー。
// 未ログイン→/login、ログイン済みだが権限外→404（存在を明かさない）。
export async function requireRole(allowedRoles: DemoRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!allowedRoles.includes(user.role)) notFound();
  return user;
}
