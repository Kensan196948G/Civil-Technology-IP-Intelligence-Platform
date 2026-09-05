// Edge Runtime（middleware）用の署名検証。Web Crypto API（async）を使用する。
// 署名アルゴリズムは sign.ts（Node crypto・同期）と同一（HMAC-SHA256 + base64url）。
// middleware では notFound()/redirect() の問題が発生しないため、async で問題ない。
import { getDemoCookieSecret } from '@/lib/env';

async function hmac(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(getDemoCookieSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function verifySignedValueWeb(cookieValue: string): Promise<string | null> {
  const idx = cookieValue.lastIndexOf('.');
  if (idx <= 0) return null;
  const email = cookieValue.slice(0, idx);
  const sig = cookieValue.slice(idx + 1);
  const expected = await hmac(email);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? email : null;
}
