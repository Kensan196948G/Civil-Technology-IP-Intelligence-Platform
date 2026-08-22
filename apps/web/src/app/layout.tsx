import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'CTIIP MVP — 土木技術・知財インテリジェンス',
  description: 'MVP/プロトタイプ環境。表示データはすべてデモ用のダミーデータです。'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
