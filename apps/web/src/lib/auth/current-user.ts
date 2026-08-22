import { cookies } from 'next/headers';
import { DEMO_USERS, COOKIE_NAME, type DemoRole } from './demo';

export type CurrentUser = { email: string; name: string; role: DemoRole; dept: string };

export function getCurrentUser(): CurrentUser | null {
  const email = cookies().get(COOKIE_NAME)?.value;
  if (!email) return null;
  return DEMO_USERS.find(u => u.email === email) ?? null;
}
