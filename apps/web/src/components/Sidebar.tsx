'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS, flattenLeaves, type NavLeaf } from '@/lib/nav';

function normalizeHref(href: string) {
  return href.split('?')[0]!;
}

function LeafLink({ leaf, active }: { leaf: NavLeaf; active: boolean }) {
  return (
    <Link href={leaf.href} className={`nav-item${active ? ' active' : ''}`} style={{ paddingLeft: 30, fontSize: 12.5 }}>
      {leaf.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

  const activeSectionKey = useMemo(() => {
    for (const section of NAV_SECTIONS) {
      const leaves = flattenLeaves(section.items);
      if (leaves.some(l => normalizeHref(l.href) === pathname || pathname.startsWith(normalizeHref(l.href) + '/'))) {
        return section.key;
      }
    }
    return null;
  }, [pathname]);

  const q = query.trim();
  const isSearching = q.length > 0;

  function toggle(key: string) {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="sidebar" style={{ display: 'flex', flexDirection: 'column' }}>
      <Link href="/dashboard" className={`nav-item${pathname === '/dashboard' ? ' active' : ''}`} style={{ fontWeight: 700 }}>
        🏠 ダッシュボード
      </Link>

      <div style={{ padding: '8px 14px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="メニューを検索..."
          style={{ width: '100%', height: 30, padding: '0 10px', border: '1px solid var(--line)', borderRadius: 3, fontSize: 12.5 }}
        />
      </div>

      <div style={{ overflowY: 'auto', flexGrow: 1 }}>
        {NAV_SECTIONS.map(section => {
          const leaves = flattenLeaves(section.items);
          const matched = isSearching
            ? leaves.filter(l => l.label.toLowerCase().includes(q.toLowerCase()) || section.label.toLowerCase().includes(q.toLowerCase()))
            : leaves;
          if (isSearching && matched.length === 0) return null;

          const isOpen = isSearching ? true : (openSections.has(section.key) || activeSectionKey === section.key);

          return (
            <div key={section.key}>
              <button
                type="button"
                onClick={() => toggle(section.key)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                  fontSize: 12.5, fontWeight: activeSectionKey === section.key ? 700 : 400,
                  color: activeSectionKey === section.key ? 'var(--blue)' : 'var(--ink)'
                }}
              >
                <span>{section.icon}</span>
                <span style={{ flexGrow: 1 }}>{section.label}</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--ink-2)' }}>{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {section.items.map((item, i) => {
                    if ('children' in item) {
                      const visibleChildren = isSearching
                        ? item.children.filter(c => matched.includes(c))
                        : item.children;
                      if (visibleChildren.length === 0) return null;
                      return (
                        <div key={i}>
                          <div style={{ padding: '6px 14px 6px 30px', fontSize: 11, color: 'var(--ink-2)', fontWeight: 700 }}>{item.label}</div>
                          {visibleChildren.map(leaf => (
                            <div key={leaf.href} style={{ paddingLeft: 14 }}>
                              <LeafLink leaf={leaf} active={normalizeHref(leaf.href) === pathname} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (isSearching && !matched.includes(item)) return null;
                    return <LeafLink key={item.href} leaf={item} active={normalizeHref(item.href) === pathname} />;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ margin: '10px 14px', padding: 10, border: '1px dashed var(--line-2)', borderRadius: 3, color: 'var(--ink-2)', fontSize: 11, lineHeight: 1.6 }}>
        権限のないモジュールは項目自体を表示しません（MVPでは全ロールに全項目を表示しています）。
      </div>
    </div>
  );
}
