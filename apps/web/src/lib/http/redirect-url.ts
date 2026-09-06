// 'next/server' に一切依存しない純粋関数。
// Cloudflare Tunnel経由（`next start -H 127.0.0.1 -p <port>`）だと req.url が
// トンネルの接続先（127.0.0.1:<port>）を反映してしまい、素の
// `new URL(path, req.url)` では到達不能なLocationヘッダーになる不具合があった
// （本番実機で確認・2026-09-01頃）。Cloudflare Tunnelは元のHostヘッダーを
// そのままoriginへ転送するため、req.headers の host（x-forwarded-hostがあれば優先）
// から実際の公開ホスト名を組み立てて絶対URLを生成する。
//
// 'next/server' を値としてimportするコードをテストで読み込むと
// @cloudflare/next-on-pages 経由で 'server-only' の解決に失敗しVitest(Node環境)では
// 実行できないため、このロジックだけを独立ファイルに切り出しテスト可能にしている。
export function buildRedirectUrl(
  headers: { get(name: string): string | null },
  nextUrlHost: string,
  path: string
): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? nextUrlHost;
  const proto = headers.get('x-forwarded-proto') ?? (host.includes('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return new URL(path, `${proto}://${host}`).toString();
}
