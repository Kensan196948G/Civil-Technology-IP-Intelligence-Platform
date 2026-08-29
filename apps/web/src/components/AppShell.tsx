'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { resolveRouteMeta } from '@/lib/nav';
import type { DemoRole } from '@/lib/auth/demo';

export function AppShell({
  children, userName, role, dept
}: { children: ReactNode; userName: string; role: DemoRole; dept: string }) {
  const pathname = usePathname();
  const meta = resolveRouteMeta(pathname);

  return (
    <div className="shell">
      <Sidebar userName={userName} role={role} dept={dept} />
      <div className="shell-main">
        <header className="topbar">
          <div style={{ minWidth: 0 }}>
            <div className="topbar-title">{meta.title}</div>
            <div className="topbar-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70vw' }}>
              {meta.subtitle}
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <div className="mvp-badge">
            <span className="dot" />
            MVP環境・ダミーデータ
          </div>
        </header>
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
