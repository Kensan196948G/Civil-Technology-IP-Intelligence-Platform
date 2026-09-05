/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // postgres.js (TCPドライバー) はNode.jsの組み込みモジュール(crypto/stream/perf_hooks)に
  // 依存している。バンドルから除外し、実行時にNode.jsランタイムでrequireされるようにする。
  // Next.js 15: experimental.serverComponentsExternalPackages は serverExternalPackages へ
  // 移行された（非推奨キーの警告解消。Edge Runtime では不要だが両対応を維持）。
  serverExternalPackages: ['postgres']
};
module.exports = nextConfig;
