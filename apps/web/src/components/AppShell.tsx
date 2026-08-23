import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ScreenHeader } from './ScreenHeader';
import { DetailProvider } from './detail/DetailDrawer';
import { ROLE_LABEL, type DemoRole } from '@/lib/auth/demo';
import type { NavCounts } from '@/lib/nav-counts';

// 設計案（design-B-copilot）のシェル。
// 左に250pxの全ライトモードのサイドバー、右は62pxのヘッダー＋スクロールする本文。
// 本文のどこからでも右側の詳細ドロワーを開けるよう、DetailProviderで全体を包む。
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
    <DetailProvider>
      <div className="shell">
        <Sidebar counts={counts} userName={userName} roleLabel={ROLE_LABEL[role]} dept={dept} />
        <div className="shell-body">
          <ScreenHeader />
          <div className="main">{children}</div>
        </div>
      </div>
    </DetailProvider>
  );
}
