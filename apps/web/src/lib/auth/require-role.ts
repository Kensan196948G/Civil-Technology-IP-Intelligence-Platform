import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getCurrentUser, type CurrentUser } from './current-user';
import type { DemoRole } from './demo';
import { getDb } from '@/lib/db/client';
import { getDatabaseUrl } from '@/lib/env';
import * as s from '@/lib/db/schema';
import { logAuditDenied } from '@/lib/audit/log';

// Deep Debug Round2 で発見: docs/10-requirements/05-rbac-matrix.md と README §14
// (「行レベル権限がない場合は404」) が要求する認可制御が未実装で、認証済みなら
// 任意ロールが管理者専用画面・機密ワークフローへ到達できていた。
//
// Deep Debug Round2 再調査で発見（重要）: 当初この関数だけで /admin/* を保護する
// 設計だったが、本番ビルド（next build + next start、および実際のCloudflare
// Pages/Edge Runtime配信）では、crypto.subtle を使った署名検証
// （await getCurrentUser() 内の await verifySignedValue）を経由した後に
// next/navigation の notFound()/redirect() を呼んでも、実際に呼び出されている
// にも関わらず（デバッグログで確認済み）レスポンスがそのまま200で子要素が
// レンダリングされてしまう不具合を確認した（`next dev`では正常に動作するため
// 開発時のテストでは気づけなかった）。crypto.subtle の完了がNext.jsの
// リクエストスコープ（AsyncLocalStorage）を経由しない形でマイクロタスクへ
// 戻ることが原因とみられる、ネストされたasyncレイアウトからの notFound()/
// redirect() の信頼性問題（Next.js 14.2.35）。
//
// そのため /admin/* の実効的なアクセス制御は middleware.ts
// （NextResponse.redirect() を使う、Server Componentのレンダリングパイプラインを
// 経由しない単純なレスポンス構築のためこの問題の影響を受けない、実機で動作確認済み）
// に移した。この requireRole() はページ内でログイン状態に応じた表示分岐等に使う
// 汎用ヘルパーとして残すが、/admin/* の権限境界としては middleware.ts を正とする。
export async function requireRole(allowedRoles: DemoRole[]) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!allowedRoles.includes(user.role)) {
    // 監査ログ NFR-L-001: 認可拒否も記録する（README §16 既知バックログ対応）。
    // 記録の失敗が本来の拒否（redirect）を妨げてはならないため best-effort。
    await recordRoleDenied(user, allowedRoles);
    redirect('/not-found');
  }
  return user;
}

async function recordRoleDenied(user: CurrentUser, allowedRoles: DemoRole[]): Promise<void> {
  try {
    const db = getDb(getDatabaseUrl());
    const [dbUser] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, user.email)).limit(1);
    await logAuditDenied(db, {
      actorUserId: dbUser?.id ?? null,
      action: 'access',
      targetType: 'role_gate',
      targetId: null,
      reason: 'role_not_allowed',
      meta: { role: user.role, allowedRoles }
    });
  } catch (err) {
    console.error('[audit] requireRole denial logging failed', err);
  }
}
