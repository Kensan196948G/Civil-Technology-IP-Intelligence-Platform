// MVP用の簡易マイグレーション。ddl.sql をそのまま1回のクエリとして流す
// （postgres.js の simple query protocol は複数文・ドル引用符付きブロックを正しく解釈する）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');
  const sql = postgres(url);
  const ddl = readFileSync(join(__dirname, 'ddl.sql'), 'utf8');
  await sql.unsafe(ddl);
  await sql.end();
  console.log('✅ マイグレーション完了');
}

main().catch(e => { console.error('❌ マイグレーション失敗:', e); process.exit(1); });
