// MVP用の簡易マイグレーション。ddl.sql をそのまま1回のクエリとして流す
// （postgres.js の simple query protocol は複数文・ドル引用符付きブロックを正しく解釈する）。
//
// Deep Debug (2026-09-10) で特定した根本原因への対応:
//   ddl.sql は `CREATE EXTENSION IF NOT EXISTS vector` を含むが、pgvector は
//   PostgreSQL の "trusted extension" ではないためスーパーユーザー権限が必要で、
//   アプリの接続ロール（例 `ctip_app`）では実行できない。従来はこの権限エラーで
//   マイグレーション全体が失敗し、しかも postgres.js が ddl.sql 全体を1つの
//   simple query として送るため PostgreSQL 側で暗黙の単一トランザクションになり、
//   先行して成功した CREATE TABLE まで全てロールバックされていた
//   （＝「失敗したのにテーブル0件」という原因の分かりにくい状態）。
//
//   本対応では DDL 適用の**前**に必要拡張の有無を検査し、不足していて権限も無い場合は
//   「誰が何をすればよいか」を日本語で示して即座に失敗させる（DBの状態は変更しない）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

// ddl.sql が前提とする拡張。
// pgcrypto / pg_trgm は trusted extension（PG13+）のためアプリロールでも導入できる。
// vector(pgvector) は trusted ではないためスーパーユーザーが必要。
const REQUIRED_EXTENSIONS = ['pgcrypto', 'pg_trgm', 'vector'] as const;

const BOOTSTRAP_HINT =
  'DB作成直後に一度だけ、スーパーユーザーで次を実行してください:\n' +
  '  pnpm --filter @ctiip/web db:bootstrap\n' +
  '  （または psql "$SUPERUSER_DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/src/lib/db/extensions.sql）\n' +
  '`vector`(pgvector) は trusted extension ではないため、アプリの接続ロールでは導入できません。';

async function ensureExtensions(sql: postgres.Sql): Promise<void> {
  const installedRows = await sql<{ extname: string }[]>`select extname from pg_extension`;
  const installed = new Set(installedRows.map(r => r.extname));
  const missing = REQUIRED_EXTENSIONS.filter(e => !installed.has(e));
  if (missing.length === 0) return;

  console.log(`ℹ️ 未導入の拡張: ${missing.join(', ')} — 導入を試みます`);
  const failures: string[] = [];
  for (const ext of missing) {
    try {
      await sql.unsafe(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
      console.log(`✅ 拡張を導入: ${ext}`);
    } catch (e) {
      failures.push(`${ext}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      '必要な拡張を導入できませんでした（マイグレーションは何も適用していません）:\n' +
        failures.map(f => `  - ${f}`).join('\n') +
        '\n' +
        BOOTSTRAP_HINT
    );
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');
  const sql = postgres(url, {
    // ddl.sql は全体が `IF NOT EXISTS` のため、再実行時は「already exists, skipping」の
    // NOTICE が大量に出る。postgres.js の既定 onnotice は console.log でこれを出力し、
    // デプロイログのノイズになって本当のエラーが埋もれる。ここでは抑制する。
    onnotice: () => undefined
  });
  try {
    await ensureExtensions(sql);
    const ddl = readFileSync(join(__dirname, 'ddl.sql'), 'utf8');
    await sql.unsafe(ddl);
    console.log('✅ マイグレーション完了');
  } finally {
    await sql.end();
  }
}

main().catch((e: unknown) => {
  console.error('❌ マイグレーション失敗:', e instanceof Error ? e.message : e);
  process.exit(1);
});
