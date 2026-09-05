import { notFound } from 'next/navigation';

// HTTP 404 を確実に返すための専用ルート。
// (app)/ 配下のページでは notFound() が (app)/error.tsx（error boundary）に捕まり
// HTTP 200 になる既知事象があるため、権限のない C3/C4 アクセスはこのルートへ
// redirect し、ここで notFound() を呼ぶ（レイアウト外のため error boundary の影響を受けない）。
export const dynamic = 'force-dynamic';

export default function NotFoundTrigger() {
  notFound();
}
