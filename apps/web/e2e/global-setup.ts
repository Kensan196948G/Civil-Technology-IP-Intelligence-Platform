// 各回のE2E実行前にダミーデータを再投入し、テストを再実行可能にする。
import { execSync } from 'node:child_process';
import path from 'node:path';

// E2E は毎回ダミーデータを洗い替える前提のため、ここで明示的に opt-in する。
// （誤って共有/本番DBに向けて実行されることを防ぐ安全確認は seed.ts 側にもある）

export default async function globalSetup() {
  execSync('npx tsx src/lib/db/seed.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env, CTIIP_ALLOW_SEED_TRUNCATE: 'true' }
  });
}
