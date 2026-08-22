'use client';

// Deep Debug Round2 で発見: (app)/ 配下215ページのいずれにも error.tsx が無く、
// DB接続断・クエリ失敗時にNext.js既定のフォールバックに委ねられていた。
// このファイルを (app)/ 直下に置くことで、配下の全ルートに自動適用される
// （Next.jsのerror boundaryはNext Componentの規約でClient Componentが必須）。
export default function AppError({
  error, reset
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="notice notice-brick">
        <strong>この画面の表示中にエラーが発生しました。</strong>
        <div style={{ marginTop: 6, fontSize: 12.5 }}>
          データベース接続やクエリの一時的な問題の可能性があります。しばらくしてから再試行してください。
          解消しない場合はシステム管理者へお問い合わせください
          {error.digest && <> （エラーID: <span className="mono">{error.digest}</span>）</>}。
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={() => reset()} className="btn btn-primary">再試行</button>
        <a href="/dashboard" className="btn btn-secondary">ダッシュボードへ戻る</a>
      </div>
    </div>
  );
}
