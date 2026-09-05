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
      <a href="#main-content" style={{ position: 'absolute', left: '-9999px', top: 0 }} onFocus={e => { e.currentTarget.style.left = '0'; e.currentTarget.style.zIndex = '9999'; e.currentTarget.style.background = 'var(--paper)'; e.currentTarget.style.padding = '8px'; }} onBlur={e => { e.currentTarget.style.left = '-9999px'; }}>本文へスキップ</a>
      <div className="shell">
        <Sidebar counts={counts} userName={userName} roleLabel={ROLE_LABEL[role]} dept={dept} />
        <div className="shell-main">
          <header className="topbar" role="banner">
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
          <main id="main-content" className="main">{children}</main>
        </div>
      </div>
    </DetailProvider>
  );
}
