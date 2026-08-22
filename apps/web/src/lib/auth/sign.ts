import { getDemoCookieSecret } from '@/lib/env';

// デモ用Cookieの改ざん検知（HMAC署名）。
// CodeRabbit指摘: Cookieの値（メールアドレス）を無署名で信用すると、
// 利用者がブラウザの開発者ツールでCookieを直接書き換えるだけで、
// ログイン画面を経由せず任意のデモ利用者へなりすませてしまう。
// 本番はCloudflare Access（SSO+MFA、署名済みJWT）に置き換える前提のため、
// ここでは「MVPの範囲で偽装を防ぐ最小限の署名」を実装する。
function getSecret(): string {
  // CodeRabbit指摘: 公開済みの固定フォールバック値があると、本番デプロイで
  // 環境変数の設定漏れがあった場合に攻撃者がその固定値で有効なCookieを
  // 生成できてしまう。フォールバックを廃止し、未設定なら明確に失敗させる。
  // 実バグ修正: process.env のみを見ていたため、Cloudflare（next-on-pages）上では
  // Secrets が process.env に載らず、実デプロイでログインが常に失敗していた。
  // env.ts の Cloudflare env バインディング対応アクセサを使うよう修正。
  return getDemoCookieSecret();
}

// Edge Runtime には Buffer が無いため、Web標準APIのみで base64url を組み立てる。
function bufferToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(getSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return bufferToBase64Url(sig);
}

export async function signValue(email: string): Promise<string> {
  const sig = await hmac(email);
  return `${email}.${sig}`;
}

export async function verifySignedValue(cookieValue: string): Promise<string | null> {
  const idx = cookieValue.lastIndexOf('.');
  if (idx <= 0) return null;
  const email = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const expected = await hmac(email);
  if (sig.length !== expected.length) return null;
  // タイミング攻撃を避けるため定数時間比較する
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? email : null;
}
