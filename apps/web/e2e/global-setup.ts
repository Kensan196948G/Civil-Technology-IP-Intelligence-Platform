// 各回のE2E実行前にダミーデータを再投入し、テストを再実行可能にする。
import { execSync } from 'node:child_process';
import path from 'node:path';

export default async function globalSetup() {
  execSync('npx tsx src/lib/db/seed.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env
  });
}
