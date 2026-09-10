import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySignedValueWeb } from '@/lib/auth/sign-web';
import { DEMO_USERS, COOKIE_NAME, type DemoRole } from '@/lib/auth/demo';
import { buildRedirectUrl } from '@/lib/http/redirect-url';
import { ADMIN_ALLOWED_ROLES as ADMIN_ALLOWED_ROLES_SHARED } from '@/lib/auth/roles';

// Deep Debug Round2 再調査（重要）: 当初 /admin/* のRBACは (app)/admin/layout.tsx から
// requireRole() 経由で notFound()/redirect() を呼ぶ方式で実装していたが、本番ビルド
// （next build + next start、および実際のCloudflare Pages/Edge Runtime配信）では、
// crypto.subtle を使った署名検証（await verifySignedValue）を経由した後に
// next/navigation の redirect()/notFound() を呼んでも、実際に呼び出されている
// にも関わらず（デバッグログで確認済み）レスポンスが200のまま子要素がレンダリング
// されてしまう不具合を確認した（`next dev`では正常に動作するため開発時は
// 気づけなかった）。crypto.subtle の完了がNext.jsのリクエストスコープ
// （AsyncLocalStorage）を経由しない形でマイクロタスクへ戻ることが原因とみられる、
// Next.js 14.2.35のnotFound()/redirect()のネストされたasyncレイアウトからの
// 信頼性問題を回避するため、RBAC制御をレンダリング前のmiddlewareへ移動した。
// middlewareのNextResponse.redirect()はReact Server Componentのレンダリング
// パイプラインを経由しない単純なレスポンス構築のため、この問題の影響を受けない
// （実機で動作確認済み）。
//
// 追記（Cloudflare Tunnel経由での追加不具合・本番実機で確認・2026-09-01頃）:
// NextResponse.redirect(new URL(path, req.url)) は、Tunnel背後で
// `next start -H 127.0.0.1 -p <port>` として動いている場合、req.url が
// Tunnelの接続先（http://127.0.0.1:<port>/...）を反映してしまい、Locationヘッダーが
// 公開ドメインではなく到達不能なURLになる不具合があった。また、Next.jsの
// NextResponseはLocationヘッダーに相対パスのみを渡すと `new URL()` の検証で
// 例外を投げるため、相対Locationも使えない。Cloudflare Tunnelは元のHostヘッダーを
// そのままoriginへ転送するため、req.headers の host（x-forwarded-hostがあれば優先）
// から実際の公開ホスト名を組み立てて絶対URLを生成する。
// 許可ロールはナビゲーションの表示制御（lib/nav.ts の isNavHrefVisible）と共有する。
// 強制（ここ）と表示（ナビ）で定義が分かれると「押せるのに開けない」状態を生むため、
// lib/auth/roles.ts を単一の真実とする。
const ADMIN_ALLOWED_ROLES: readonly DemoRole[] = ADMIN_ALLOWED_ROLES_SHARED;

function redirectTo(req: NextRequest, path: string): NextResponse {
  return withSecurityHeaders(NextResponse.redirect(buildRedirectUrl(req.headers, req.nextUrl.host, path)));
}

export async function middleware(req: NextRequest) {
  // ルート "/" の redirect('/dashboard')（Server Component, next/navigation）が
  // 本番ビルドでLocationヘッダーの無い307を返し、初回ロードが白画面になる不具合を
  // 本番実機で確認したため、/admin と同様にmiddleware側のリダイレクトへ切り出して回避する。
  if (req.nextUrl.pathname === '/') {
    return redirectTo(req, '/dashboard');
  }

  if (req.nextUrl.pathname.startsWith('/admin')) {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    const email = raw ? await verifySignedValueWeb(raw) : null;
    const user = email ? DEMO_USERS.find(u => u.email === email) : null;

    if (!user) {
      return redirectTo(req, '/login');
    }
    if (!ADMIN_ALLOWED_ROLES.includes(user.role)) {
      // 権限外であることをURLから読み取れないよう、実在しない汎用パスへ
      // リダイレクトし、Next.js標準の「未マッチルートは404」に載せる。
      return redirectTo(req, '/not-found');
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

// MVP用の最小限セキュリティヘッダー。本番のCloudflare Access/WAF設定は
// docs/40-infrastructure/01-cloudflare-setup.md を正とする。
function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' };
