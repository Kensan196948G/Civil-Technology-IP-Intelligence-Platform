import './globals.css';
import type { ReactNode } from 'react';

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
