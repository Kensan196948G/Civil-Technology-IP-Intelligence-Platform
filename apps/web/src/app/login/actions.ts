'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, DEMO_USERS } from '@/lib/auth/demo';
import { signValue } from '@/lib/auth/sign';
import { isCookieSecureEnabled } from '@/lib/env';

export async function loginAsAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const user = DEMO_USERS.find(u => u.email === email);
  if (!user) throw new Error('不正な選択です');
  const signed = await signValue(email);
  // Next.js 15: cookies() は Promise を返すようになったため await する
  (await cookies()).set(COOKIE_NAME, signed, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    // CodeRabbit指摘: 本番（HTTPS）ではCookieをHTTPS限定にする。
    // 注意: `next start` は環境を問わず NODE_ENV=production を設定するため、
    // NODE_ENV では「ローカル/CI(HTTP)」と「実デプロイ(HTTPS)」を区別できない。
    // 実際にCloudflare上のHTTPS環境でのみ true にする専用フラグを使う
    // （Cloudflareの環境変数で CTIIP_COOKIE_SECURE=true を設定する）。
    // process.env だけでなくCloudflareのバインディングも見る env.ts 経由にする
    // （sign.ts で見つかった同種の実バグの再発防止）。
    secure: isCookieSecureEnabled()
  });
  redirect('/dashboard');
}
