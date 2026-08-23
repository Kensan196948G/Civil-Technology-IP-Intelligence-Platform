'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { RECENT_CONVERSATIONS } from '@/lib/copilot-demo';
import type { NavCounts } from '@/lib/nav-counts';

// 設計案（design-B-copilot）のサイドバー。全ライトモード（白背景・濃紺テキスト・
// アクティブはオレンジの縦バー）。旧サイドバーは20セクションのアコーディオンだったが、
// 「左側サイドメニュー項目が見づらい」という指摘を受け、日々使う導線だけを平置きにし、
// 20分類の全項目は「全モジュール」画面に移した。

type Item = { icon: string; label: string; href: string; count?: number | null };

const MAIN: Item[] = [
  { icon: '🧠', label: 'Copilot に聞く', href: '/ai-assistant' },
  { icon: '📊', label: 'ダッシュボード', href: '/dashboard' },
  { icon: '🔎', label: '横断検索', href: '/search' }
];

function tasksFor(counts: NavCounts): Item[] {
  return [
    { icon: '🏗️', label: '現場の困りごと', href: '/field', count: counts.field },
    { icon: '🔬', label: '調査案件', href: '/investigations', count: counts.investigations },
    { icon: '🚀', label: '発明・出願', href: '/inventions', count: counts.inventions },
    { icon: '✅', label: '承認・レビュー', href: '/approvals', count: counts.approvals },
    { icon: '👁️', label: 'ウォッチ・アラート', href: '/watch', count: counts.watches },
    { icon: '📊', label: 'レポート', href: '/reports' },
    { icon: '🛡️', label: 'セキュリティ・監査', href: '/audit' },
    { icon: '⚙️', label: 'システム管理', href: '/admin' }
  ];
}

/** 配下の詳細ページ（/field/<id> など）でも親項目をアクティブにする。 */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/');
}

export function Sidebar({
  counts, userName, roleLabel, dept
}: { counts: NavCounts; userName: string; roleLabel: string; dept: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentConvo = searchParams.get('c') ?? '0';
  const onCopilot = pathname === '/ai-assistant';

  return (
    <nav className="sidebar" aria-label="メインナビゲーション">
      <div className="sidebar-head">
        <span className="sidebar-mark" aria-hidden="true">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" />
          </svg>
        </span>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ color: 'var(--ink)', fontWeight: 600, fontSize: 14.5, letterSpacing: '.2px' }}>CTIIP</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>土木技術・知財インテリジェンス</div>
        </div>
      </div>

      <div className="sidebar-nav">
        {MAIN.map(item => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <div className="sidebar-group">会話から始まる仕事</div>
        {tasksFor(counts).map(item => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}

        <div className="sidebar-group">最近の会話</div>
        {RECENT_CONVERSATIONS.map(c => (
          <Link
            key={c.index}
            href={`/ai-assistant?c=${c.index}`}
            className={`nav-item nav-sub${onCopilot && currentConvo === String(c.index) ? ' active' : ''}`}
          >
            <span className="nav-label">{c.label}</span>
          </Link>
        ))}

        <div className="sidebar-group">従来メニュー</div>
        <Link href="/modules" className={`nav-item${isActive(pathname, '/modules') ? ' active' : ''}`}>
          <span className="nav-icon" aria-hidden="true">☰</span>
          <span className="nav-label">全モジュール（20分類）</span>
          <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>›</span>
        </Link>
      </div>

      {/* ログイン中の利用者。ロールの切替（デモログイン）もここから。 */}
      <div className="sidebar-foot">
        <span
          aria-hidden="true"
          style={{
            width: 34, height: 34, borderRadius: '50%', background: 'var(--blue-soft)', color: 'var(--blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flex: 'none'
          }}
        >
          {userName.slice(0, 1)}
        </span>
        <div style={{ flex: 1, lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ color: 'var(--ink)', fontSize: 13, fontWeight: 500 }}>{userName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dept}
          </div>
        </div>
        <Link
          href="/login"
          title={`${roleLabel}（クリックで切替）`}
          style={{
            fontSize: 10, fontWeight: 600, color: 'var(--accent)', border: '1px solid var(--accent-bd)',
            padding: '1px 6px', borderRadius: 5, flex: 'none', textDecoration: 'none'
          }}
        >
          {roleLabel}
        </Link>
      </div>
    </nav>
  );
}

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link href={item.href} className={`nav-item${active ? ' active' : ''}`}>
      <span className="nav-icon" aria-hidden="true">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
      {item.count != null && item.count > 0 && <span className="nav-count">{item.count}</span>}
    </Link>
  );
}
