import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// MVP用の最小限セキュリティヘッダー。本番のCloudflare Access/WAF設定は
// docs/40-infrastructure/01-cloudflare-setup.md を正とする。
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'DENY');
  return res;
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' };
