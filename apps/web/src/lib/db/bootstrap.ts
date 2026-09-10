// 拡張機能のブートストラップ（extensions.sql を適用する）。
//
// ddl.sql 本体の適用（db:migrate）とは分離してある。理由は extensions.sql のコメント参照:
// `vector`(pgvector) は trusted extension ではないためスーパーユーザー権限が必要で、
// アプリの接続ロールでは実行できない。DB作成直後に一度だけ、権限のある利用者が実行する。
//
// 実行: pnpm --filter @ctiip/web db:bootstrap
//   （DATABASE_URL にスーパーユーザーの接続文字列を指定する）
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL が設定されていません');

  const sql = postgres(url, { max: 1 });
  try {
    // スーパーユーザーかどうかを先に確認し、否なら「なぜ失敗するか」を明示して止める。
    // （CREATE EXTENSION の 42501 だけでは原因が分かりにくいため）
    const roleRows = await sql<{ rolsuper: boolean }[]>`
      select rolsuper from pg_roles where rolname = current_user
    `;
    if (roleRows[0]?.rolsuper !== true) {
      throw new Error(
        'このスクリプトはスーパーユーザー権限が必要です（現在のロールはスーパーユーザーではありません）。\n' +
          '`vector`(pgvector) は trusted extension ではないため、アプリの接続ロールでは導入できません。\n' +
          'DATABASE_URL にスーパーユーザーの接続文字列を設定して再実行してください。'
      );
    }

    const bootstrapSql = readFileSync(join(__dirname, 'extensions.sql'), 'utf8');
    await sql.unsafe(bootstrapSql);

    const rows = await sql<{ extname: string }[]>`
      select extname from pg_extension order by extname
    `;
    console.log('✅ 拡張のブートストラップ完了: ' + rows.map(r => r.extname).join(', '));
  } finally {
    await sql.end();
  }
}

main().catch((e: unknown) => {
  console.error('❌ 拡張のブートストラップ失敗:', e instanceof Error ? e.message : e);
  process.exit(1);
});
