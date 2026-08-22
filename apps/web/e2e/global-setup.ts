// 各回のE2E実行前にダミーデータを再投入し、テストを再実行可能にする。
import { execSync } from 'node:child_process';
import path from 'node:path';

// E2E は毎回ダミーデータを洗い替える前提のため、ここで明示的に opt-in する。
// （誤って共有/本番DBに向けて実行されることを防ぐ安全確認は seed.ts 側にもある）

export default async function globalSetup() {
  execSync('npx tsx src/lib/db/seed.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: {
      ...process.env,
      CTIIP_ALLOW_SEED_TRUNCATE: 'true',
      // 許可リスト（完全一致）。E2E専用のMVP用Neonプロジェクトのみを対象にする
      CTIIP_SEED_ALLOWED_HOST: process.env.CTIIP_SEED_ALLOWED_HOST,
      CTIIP_SEED_ALLOWED_DB: process.env.CTIIP_SEED_ALLOWED_DB
    }
  });
}
