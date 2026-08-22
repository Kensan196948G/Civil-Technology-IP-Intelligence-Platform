'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: 'ダッシュボード' },
  { href: '/search', label: '横断検索' },
  { href: '/patents', label: '特許' },
  { href: '/netis', label: 'NETIS・公開技術' },
  { href: '/claims', label: 'Claim解析' },
  { href: '/field', label: '現場適用' },
  { href: '/sites', label: '現場・課題' },
  { href: '/inventions', label: '発明管理' },
  { href: '/ai-runs', label: 'AI実行履歴・根拠' },
  { href: '/approvals', label: '承認・案件' }
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <div className="sidebar">
      {NAV.map(n => {
        const active = pathname === n.href || pathname.startsWith(n.href + '/');
        return (
          <Link key={n.href} href={n.href} className={`nav-item${active ? ' active' : ''}`}>
            {n.label}
          </Link>
        );
      })}
      <div style={{ margin: '16px 14px 0', padding: 10, border: '1px dashed var(--line-2)', borderRadius: 3, color: 'var(--ink-2)', fontSize: 11, lineHeight: 1.6 }}>
        権限のないモジュールは項目自体を表示しません（MVPでは全ロールに全項目を表示しています）。
      </div>
    </div>
  );
}
