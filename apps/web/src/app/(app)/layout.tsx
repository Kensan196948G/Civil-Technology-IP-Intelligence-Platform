import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/current-user';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const user = getCurrentUser();
  if (!user) redirect('/login');
  return (
    <AppShell userName={user.name} role={user.role} dept={user.dept}>
      {children}
    </AppShell>
  );
}
