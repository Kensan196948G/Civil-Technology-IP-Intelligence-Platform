'use client';

import { usePathname } from 'next/navigation';
import { resolveScreenTitle } from '@/lib/screen-title';

/**
 * 62pxのヘッダー。画面名と一行説明、右端にMVP表示。
 * 旧デザインの濃色トップバー＋黄色い帯を置き換えたもので、
 * 「MVP環境・ダミーデータ」であることは引き続き常時表示している。
 */
export function ScreenHeader() {
  const pathname = usePathname();
  const { title, subtitle } = resolveScreenTitle(pathname);

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar-title">{title}</h1>
        <div className="topbar-sub">{subtitle}</div>
      </div>
      <span style={{ flex: 1 }} />
      <div className="mvp-banner">
        <span className="mvp-dot" aria-hidden="true" />
        MVP環境・ダミーデータ
      </div>
    </header>
  );
}
