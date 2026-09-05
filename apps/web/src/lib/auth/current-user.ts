import { cookies } from 'next/headers';
import { DEMO_USERS, COOKIE_NAME, type DemoRole } from './demo';
import { verifySignedValue } from './sign';

export type CurrentUser = { email: string; name: string; role: DemoRole; dept: string };

// 署名検証（HMAC）を行う。Cookieの値を直接メールアドレスとして信用しない
// （CodeRabbit指摘: 署名なしCookieはブラウザから自由に書き換え可能なため）。
export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Next.js 15: cookies() は Promise を返すようになったため await する
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const email = await verifySignedValue(raw);
  if (!email) return null; // 署名不一致＝改ざんまたは不正な値
  return DEMO_USERS.find(u => u.email === email) ?? null;
}
