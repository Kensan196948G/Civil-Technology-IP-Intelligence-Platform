import './globals.css';
import type { ReactNode } from 'react';

// DBアクセスを行うページ群がビルド時の静的プリレンダリング（SSG）対象になると、
// CI（DATABASE_URL 未設定）の next build / cf:build が env 解決の例外で失敗する
// （2bf88d1 の Edge Runtime宣言削除でページが静的化されたことが発端）。
// 本アプリは認証・RBAC・DB参照を前提とするため、全ルートを動的レンダリングに統一する
// （/login は従来から force-dynamic 指定済み）。
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'CTIIP MVP — 土木技術・知財インテリジェンス',
  description: 'MVP/プロトタイプ環境。表示データはすべてデモ用のダミーデータです。',
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="%23E08A2B"/><path d="M4 19h16" stroke="%23141C29" stroke-width="2.2" stroke-linecap="round"/><path d="M6 19V7l6-3v15" stroke="%23141C29" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 19V11l-6-3" stroke="%23E08A2B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
