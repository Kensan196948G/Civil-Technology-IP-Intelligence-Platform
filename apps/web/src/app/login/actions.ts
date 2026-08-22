'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE_NAME, DEMO_USERS } from '@/lib/auth/demo';

export async function loginAsAction(formData: FormData) {
  const email = String(formData.get('email') ?? '');
  const user = DEMO_USERS.find(u => u.email === email);
  if (!user) throw new Error('不正な選択です');
  cookies().set(COOKIE_NAME, email, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/dashboard');
}
