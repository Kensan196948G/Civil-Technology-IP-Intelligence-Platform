import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySignedValueWeb } from '@/lib/auth/sign-web';
import { DEMO_USERS, COOKIE_NAME, type DemoRole } from '@/lib/auth/demo';

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
const ADMIN_ALLOWED_ROLES: DemoRole[] = ['executive', 'sysadmin'];

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/admin')) {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    const email = raw ? await verifySignedValueWeb(raw) : null;
    const user = email ? DEMO_USERS.find(u => u.email === email) : null;

    if (!user) {
      return withSecurityHeaders(NextResponse.redirect(new URL('/login', req.url)));
    }
    if (!ADMIN_ALLOWED_ROLES.includes(user.role)) {
      // 権限外であることをURLから読み取れないよう、実在しない汎用パスへ
      // リダイレクトし、Next.js標準の「未マッチルートは404」に載せる。
      return withSecurityHeaders(NextResponse.redirect(new URL('/not-found', req.url)));
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
