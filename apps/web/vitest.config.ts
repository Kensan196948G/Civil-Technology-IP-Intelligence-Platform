import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Deep Debug Round2 で発見: vitest.config.ts が存在せず、`pnpm run test`（vitest run）が
// デフォルトのglobパターンで e2e/*.spec.ts（Playwright用ファイル）まで拾い、
// Playwrightの test() を vitest ランナー内で呼び出そうとしてクラッシュしていた。
// e2e/ を明示的に除外し、vitest本来の対象（*.test.ts）だけを走らせる。
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    // MVP初期はUnitテストがまだ薄いため、テストファイルが1つも無い状態を
    // ビルド失敗として扱わない（今後テストを追加していく前提の暫定設定）。
    passWithNoTests: true
  }
});
