import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { ROLE_LABEL, type DemoRole } from '@/lib/auth/demo';
import Link from 'next/link';

export function AppShell({
  children, userName, role, dept
}: { children: ReactNode; userName: string; role: DemoRole; dept: string }) {
  return (
    <div className="shell">
      <div className="topbar">
        <span style={{ fontFamily: 'var(--f-disp)', fontWeight: 700, fontSize: 15 }}>
          土木技術・知財インテリジェンス
        </span>
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.18em', color: '#63C2E0' }}>CTIIP</span>
        <div style={{ flexGrow: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#93A8B0' }}>
          <span>{userName}</span><span>／</span><span>{ROLE_LABEL[role]}</span><span>／</span><span>{dept}</span>
          <Link href="/login" style={{ color: '#93A8B0', marginLeft: 8 }}>切替</Link>
        </div>
      </div>
      <div className="mvp-banner">
        <strong>MVP環境</strong> — 表示されているデータはすべてデモ用のダミーデータです。この画面の数値で業務判断をしないでください。
        <span style={{ flexGrow: 1 }} />
        <span className="mono" style={{ fontSize: 10, letterSpacing: '.1em' }}>ctiip-mvp.mirai-dx-platform.com</span>
      </div>
      <div className="body-row">
        <Sidebar />
        <div className="main">{children}</div>
      </div>
    </div>
  );
}
