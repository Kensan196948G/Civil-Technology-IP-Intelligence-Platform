/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  // postgres.js (TCPドライバー) はNode.jsの組み込みモジュール(crypto/stream/perf_hooks)に
  // 依存している。バンドルから除外し、実行時にNode.jsランタイムでrequireされるようにする。
  // Cloudflare Pages (Edge Runtime) では不要（Neon HTTPドライバのみ使用する）。
  experimental: {
    serverComponentsExternalPackages: ['postgres']
  }
};
module.exports = nextConfig;
