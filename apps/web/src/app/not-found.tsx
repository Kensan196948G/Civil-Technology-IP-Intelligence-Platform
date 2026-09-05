import Link from 'next/link';

// カスタム404ページ。notFound() が投げられた場合に HTTP 404 を確実に返すため
// ルート直下に明示的に置く（存在しないルート・権限のないC3/C4詳細の双方で使用される）。
export default function NotFound() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="card" style={{ maxWidth: 480, padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h1 style={{ fontSize: 20 }}>ページが見つかりません</h1>
        <p style={{ fontSize: 12.5, color: 'var(--ink-2)', margin: 0 }}>
          お探しのページは存在しないか、アクセス権限がありません。
        </p>
        <Link href="/dashboard" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>ダッシュボードへ戻る</Link>
      </div>
    </div>
  );
}
