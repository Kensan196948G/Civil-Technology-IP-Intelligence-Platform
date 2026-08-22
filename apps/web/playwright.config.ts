import { defineConfig } from '@playwright/test';

// このサンドボックス環境ではPlaywright付属Chromiumのバージョンが
// 実行環境と噛み合わずシステムのGoogle Chromeを使う必要があった。
// CI（GitHub Actions）ではこの固定パスは存在しないため、
// CI環境変数がある場合はPlaywright標準のブラウザ解決に任せる。
const localChromePath = process.env.CI ? undefined : '/usr/bin/google-chrome';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3311',
    headless: true,
    launchOptions: {
      executablePath: localChromePath,
      args: ['--no-sandbox']
    }
  },
  // CodeRabbit指摘の副作用として発覚: CIジョブは playwright test を実行するだけで
  // サーバー自体を起動していなかった（このサンドボックスでは手動でnext startしていたため
  // 見えていなかった）。webServerでサーバーのビルド・起動・準備完了待ちを一体化する。
  webServer: {
    command: 'npx next build && npx next start -p 3311',
    url: 'http://localhost:3311/api/health',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  },
  reporter: [['list']]
});
