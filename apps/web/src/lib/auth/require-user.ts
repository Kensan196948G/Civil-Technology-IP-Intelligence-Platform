import { eq } from 'drizzle-orm';
import type { getDb } from '@/lib/db/client';
import * as s from '@/lib/db/schema';
import { getCurrentUser } from './current-user';

// サーバーアクション専用。利用者の識別は「認証済みCookie」からのみ取得し、
// クライアントから送られたフォーム値（メールアドレス等）は一切信用しない。
// CodeRabbit指摘: client-controlled identity/role values の脆弱性への対応。
export async function requireCurrentDbUser(db: ReturnType<typeof getDb>) {
  const demoUser = getCurrentUser();
  if (!demoUser) throw new Error('認証されていません（セッション切れの可能性があります）');
  const [dbUser] = await db.select().from(s.users).where(eq(s.users.email, demoUser.email)).limit(1);
  if (!dbUser) throw new Error('利用者情報が見つかりません');
  return dbUser;
}
