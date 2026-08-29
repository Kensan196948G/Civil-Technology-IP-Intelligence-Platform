'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { DetailProvider } from './detail/DetailDrawer';
import { resolveRouteMeta } from '@/lib/nav';
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
  const pathname = usePathname();
  const meta = resolveRouteMeta(pathname);

  return (
    <DetailProvider>
      <div className="shell">
        <Sidebar counts={counts} userName={userName} roleLabel={ROLE_LABEL[role]} dept={dept} />
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
    </DetailProvider>
  );
}
