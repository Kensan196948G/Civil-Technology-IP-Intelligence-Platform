import { getDemoCookieSecret } from '@/lib/env';
import { createHmac, timingSafeEqual } from 'node:crypto';

// デモ用Cookieの改ざん検知（HMAC署名）。
// CodeRabbit指摘: Cookieの値（メールアドレス）を無署名で信用すると、
// 利用者がブラウザの開発者ツールでCookieを直接書き換えるだけで、
// ログイン画面を経由せず任意のデモ利用者へなりすませてしまう。
// 本番はCloudflare Access（SSO+MFA、署名済みJWT）に置き換える前提のため、
// ここでは「MVPの範囲で偽装を防ぐ最小限の署名」を実装する。

// 【Next.js 15 移行に伴う実装変更（2026-09-05）】
// 旧実装は Web Crypto API（crypto.subtle）の async HMAC を使用していた。
// しかしこのアプリでは、Server Component 内で crypto.subtle を await した後に
// next/navigation の notFound()/redirect() を呼ぶと、例外が AsyncLocalStorage の
// リクエストスコープ外で throw され、(app)/error.tsx や not-found に正しく到達せず
// HTTP 200 が返る既知事象があった（require-role.ts / middleware.ts 冒頭コメントに
// 記録済み。Next.js 14.2.35 で発見、15.5.25 でも同様に再現）。
// 実行基盤を Node.js ランタイム（ローカルPostgreSQL＋Cloudflare Tunnel、ADR-0007）へ
// 移行済みのため、HMAC を Node crypto の同期 API に置き換えることで await を排除し、
// notFound()/redirect() が確実に機能するようにした（#10 の副次解消）。

function getSecret(): string {
  // 公開済みの固定フォールバック値は置かない（未設定なら明確に失敗させる）。
  return getDemoCookieSecret();
}

function hmac(value: string): string {
  const digest = createHmac('sha256', getSecret()).update(value).digest('base64');
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function signValue(email: string): string {
  return `${email}.${hmac(email)}`;
}

export function verifySignedValue(cookieValue: string): string | null {
  const idx = cookieValue.lastIndexOf('.');
  if (idx <= 0) return null;
  const email = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const expected = hmac(email);
  if (sig.length !== expected.length) return null;
  // タイミング攻撃を避けるため定数時間比較する
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return timingSafeEqual(a, b) ? email : null;
  } catch {
    return null;
  }
}
