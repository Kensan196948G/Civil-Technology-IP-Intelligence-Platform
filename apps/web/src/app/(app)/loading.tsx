// Deep Debug Round2 で発見: (app)/ 配下215ページのいずれにも loading.tsx が無く、
// DB応答待ちの間、streaming placeholderが一切出ない状態だった。
// このファイルを (app)/ 直下に置くことで配下の全ルートに自動適用される。
export default function AppLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '40px 0', color: 'var(--ink-2)', fontSize: 13 }}>
      <span className="mono">読み込み中…</span>
    </div>
  );
}
