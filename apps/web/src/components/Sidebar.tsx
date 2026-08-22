'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { NAV_SECTIONS, flattenLeaves, type NavLeaf } from '@/lib/nav';

function normalizeHref(href: string) {
  return href.split('?')[0]!;
}

// CodeRabbit指摘: usePathname()はクエリ文字列を含まないため、`/watch`のような
// 複数セクションから異なるクエリで参照されるパスで、意図しないセクション・
// リンクがアクティブ表示されていた。クエリを含めた完全一致を優先し、
// 完全一致が無い場合のみクエリなしパスの一致にフォールバックする。
function canonical(path: string, query: string) {
  // CodeRabbit指摘: entries()はデコード済みの値を返すため、手動連結すると
  // 値に&や=を含む場合に異なるクエリが同じcanonical値になり得る。
  // ソート後にURLSearchParams.toString()へ戻し、正しく再エンコードする。
  const params = new URLSearchParams(query);
  const sorted = new URLSearchParams([...params.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const qs = sorted.toString();
  return path + (qs ? '?' + qs : '');
}

function isLeafActive(leaf: NavLeaf, pathname: string, currentSearch: string): boolean {
  const [leafPath, leafQuery] = leaf.href.split('?');
  if (leafPath !== pathname) return false;
  return canonical(leafPath!, leafQuery ?? '') === canonical(pathname, currentSearch);
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
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const [query, setQuery] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

  const activeSectionKey = useMemo(() => {
    // 1) クエリまで含めた完全一致を優先
    for (const section of NAV_SECTIONS) {
      const leaves = flattenLeaves(section.items);
      if (leaves.some(l => isLeafActive(l, pathname, currentSearch))) return section.key;
    }
    // 2) 完全一致が無ければ、クエリなしパスの一致にフォールバック
    for (const section of NAV_SECTIONS) {
      const leaves = flattenLeaves(section.items);
      if (leaves.some(l => normalizeHref(l.href) === pathname || pathname.startsWith(normalizeHref(l.href) + '/'))) {
        return section.key;
      }
    }
    return null;
  }, [pathname, currentSearch]);

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
                              <LeafLink leaf={leaf} active={isLeafActive(leaf, pathname, currentSearch)} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    if (isSearching && !matched.includes(item)) return null;
                    return <LeafLink key={item.href} leaf={item} active={isLeafActive(item, pathname, currentSearch)} />;
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
