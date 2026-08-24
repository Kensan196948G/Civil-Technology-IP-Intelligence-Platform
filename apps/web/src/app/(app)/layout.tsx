import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { AppShell } from '@/components/AppShell';
import { loadNavCounts } from '@/lib/nav-counts';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  // 件数バッジ用。DBに繋がらない場合もシェルは描画できるよう loadNavCounts 側で握りつぶしている。
  const counts = await loadNavCounts();
  return (
    <AppShell userName={user.name} role={user.role} dept={user.dept} counts={counts}>
      {children}
    </AppShell>
  );
}
