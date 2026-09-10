/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // postgres.js (TCPドライバー) はNode.jsの組み込みモジュール(crypto/stream/perf_hooks)に
  // 依存している。バンドルから除外し、実行時にNode.jsランタイムでrequireされるようにする。
  // Next.js 15: experimental.serverComponentsExternalPackages は serverExternalPackages へ
  // 移行された（非推奨キーの警告解消。Edge Runtime では不要だが両対応を維持）。
  serverExternalPackages: ['postgres'],
  // Deep Debug (2026-09-10): デプロイ検証のため「動作中のコミット」を /api/health から
  // 確認できるようにする。next.config.js の `env` はビルド時に値をバンドルへ
  // インライン展開する（＝サーバーコードでも実行時の systemd 環境変数に依存せず参照できる）。
  // 当初は CTIIP_COMMIT_SHA をビルド時のシェル環境変数として渡していたが、
  // Next.js のサーバーコードは process.env を実行時に読むため値が反映されず、
  // /api/health の version が null になっていた（実測で確認）。
  // デプロイ手順は `CTIIP_COMMIT_SHA=<sha> pnpm build` のままでよく、
  // systemd unit 側に環境変数を追加しなくても版数が確認できる。
  env: {
    CTIIP_COMMIT_SHA: process.env.CTIIP_COMMIT_SHA ?? ''
  }
};
module.exports = nextConfig;
