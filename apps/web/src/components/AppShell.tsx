'use client';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ROLE_LABEL, type DemoRole } from '@/lib/auth/demo';
import type { NavCounts } from '@/lib/nav-counts';

export function AppShell({
  children, userName, role, dept, counts
}: {
  children: ReactNode;
  userName: string;
  role: DemoRole;
  dept: string;
  counts: NavCounts;
}) {
  return (
    <div className="shell">
      <Sidebar counts={counts} userName={userName} roleLabel={ROLE_LABEL[role]} dept={dept} />
      <div className="shell-main">
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
