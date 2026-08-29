import Link from 'next/link';
import { NAV_SECTIONS, flattenLeaves } from '@/lib/nav';


// 設計案（design-B-copilot）の「全モジュール（20分類）」。
// 旧サイドバーが持っていた20セクション・全項目をここに移した（サイドバーは日々の導線だけに絞った）。
// 項目の一覧は nav.ts が単一の真実なので、この画面はそれを描画するだけにしている。

// 今回の刷新で作り込んだ画面。ここへのリンクは青、それ以外（既存のまま／簡易表示のページ）は
// 灰色で示し、どこまで手が入っているかを一覧で分かるようにする。
const REDESIGNED = new Set([
  '/ai-assistant', '/dashboard', '/search', '/field',
  '/investigations', '/inventions', '/approvals', '/watch',
  '/reports', '/audit', '/admin', '/modules'
]);

function isRedesigned(href: string) {
  const path = href.split('?')[0]!;
  return REDESIGNED.has(path);
}

export default function ModulesPage() {
  return (
    <div className="measure-wide" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink-2)' }}>
        <span style={{ flex: 1, minWidth: 280 }}>
          構想している20モジュールの全機能一覧です。すべての項目に画面があります。
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--blue-soft)', border: '1px solid var(--blue-bd)' }} aria-hidden="true" />
          新デザインで作り込み済み
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--sunk)', border: '1px solid var(--line-2)' }} aria-hidden="true" />
          共通スタイルのみ適用（本番実装フェーズで作り込み）
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 14 }}>
        {NAV_SECTIONS.map((section, i) => {
          const leaves = flattenLeaves(section.items);
          // nav.ts のラベルは「01. 統合検索」形式。番号と名前を分けて設計案の見た目に合わせる。
          const [, num = String(i + 1).padStart(2, '0'), name = section.label] =
            /^(\d+)\.\s*(.+)$/.exec(section.label) ?? [];

          return (
            <section key={section.key} className="panel">
              <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ width: 18, textAlign: 'center' }} aria-hidden="true">{section.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{name}</span>
                <span className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{num}</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {leaves.map(leaf => {
                  const done = isRedesigned(leaf.href);
                  return (
                    <Link
                      key={`${leaf.label}:${leaf.href}`}
                      href={leaf.href}
                      style={{
                        fontSize: 11.5, fontWeight: 500, padding: '4px 10px', borderRadius: 6, textDecoration: 'none',
                        border: `1px solid ${done ? 'var(--blue-bd)' : 'var(--line-2)'}`,
                        background: done ? 'var(--blue-soft)' : 'var(--sunk)',
                        color: done ? 'var(--blue)' : 'var(--ink-3)'
                      }}
                    >
                      {leaf.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
