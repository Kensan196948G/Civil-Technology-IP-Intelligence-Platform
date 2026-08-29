import Link from 'next/link';
import { NAV_SECTIONS, flattenLeaves } from '@/lib/nav';
import { MODULES } from '@/components/modules-data';

const SCREEN_MAP: Record<string, string> = {
  copilot: '/ai-assistant', dashboard: '/dashboard', search: '/search', field: '/field',
  invest: '/investigations', invent: '/inventions', approve: '/approvals', watchs: '/watch',
  report: '/reports', audit: '/audit', admin: '/admin'
};

/** ラベル一致で実装済みルートを引く（NAV_SECTIONSが単一の真実） */
function labelToHref(label: string): string | null {
  for (const section of NAV_SECTIONS) {
    for (const leaf of flattenLeaves(section.items)) {
      if (leaf.label === label) return leaf.href;
    }
  }
  return null;
}

/** 全モジュール20分類のグリッド（/modulesページとサイドバードロワーで共用） */
export function ModulesGrid({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
      {MODULES.map((m, idx) => (
        <div key={m.label} className="panel">
          <div style={{ padding: '13px 16px', borderBottom: '1px solid #EEF1F5', display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 18, textAlign: 'center' }}>{m.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{m.label}</span>
            <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>
              {String(idx + 1).padStart(2, '0')}
            </span>
          </div>
          <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {m.items.map(it => {
              const href = labelToHref(it.l) ?? (it.go ? SCREEN_MAP[it.go] : null);
              if (href) {
                return (
                  <Link key={it.l} href={href} style={{ fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid #C9D7EC', background: '#E9F0FB', color: '#2E5AAC', textDecoration: 'none' }}>
                    {it.l}
                  </Link>
                );
              }
              return (
                <span key={it.l} style={{ fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, border: '1px solid #EEF1F5', background: '#F8FAFB', color: '#8A97A8' }}>
                  {it.l}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
