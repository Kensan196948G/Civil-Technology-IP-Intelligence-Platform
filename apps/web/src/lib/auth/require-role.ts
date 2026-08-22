import { redirect } from 'next/navigation';
import { getCurrentUser } from './current-user';
import type { DemoRole } from './demo';

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
  if (!allowedRoles.includes(user.role)) redirect('/not-found');
  return user;
}
