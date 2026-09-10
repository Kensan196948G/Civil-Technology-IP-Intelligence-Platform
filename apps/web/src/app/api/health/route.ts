// ヘルスチェック / デプロイ検証エンドポイント。
//
// Deep Debug (2026-09-10) で特定した根本原因への対応:
//   従来の実装は `{ status:'ok', env:'mvp', time }` と **env を 'mvp' にハードコード** しており、
//   本番（ctip-web.service, port 18940）でも MVP でも同じ "mvp" を返していた。そのため
//   ①どちらの環境に問い合わせているのか外部から判別できない
//   ②どのコミットが動作しているのか確認できない
//   という状態になり、実際に「本番が47コミット古い別チェックアウトで稼働していた」ことを
//   誰も検知できなかった。docs/70-operations/01-deployment-procedure.md §3 は
//   スモークテストで「デプロイした commit hash と一致すること」を要求しているが、
//   それを返す実装が存在しなかった。
//
//   本対応で env / version(commit) / db を実測値として返す。
//   env は CTIIP_ENV、version は CTIIP_COMMIT_SHA（ビルド時に埋め込む）から取得し、
//   未設定の場合は環境を推測せず 'unknown' / null を返す（嘘の値を返さない）。
import postgres from 'postgres';

// env / version はビルド時・起動時の環境変数に依存するため、静的化させず毎回評価する。
export const dynamic = 'force-dynamic';

// DB 疎通確認の上限。ヘルスチェックがDB障害時にぶら下がらないようにする。
const DB_CHECK_TIMEOUT_MS = 1500;

type DbStatus = 'ok' | 'error' | 'unconfigured';

/**
 * DBへ `select 1` を投げて疎通を確認する。例外は投げず、状態のみを返す。
 * 拡張機能（pgvector等）には依存しない最小のクエリにすることで、
 * 「DBプロセスには繋がるがスキーマが古い」ケースと「DBに繋がらない」ケースを
 * 切り分けられるようにしている（スキーマの新旧は /api/search 等の機能で検出する）。
 */
async function checkDatabase(): Promise<DbStatus> {
  const url = process.env.DATABASE_URL;
  if (!url) return 'unconfigured';

  let sql: postgres.Sql | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    sql = postgres(url, { max: 1, connect_timeout: 3, idle_timeout: 1 });
    await Promise.race([
      sql`select 1`,
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('db health check timeout')), DB_CHECK_TIMEOUT_MS);
      })
    ]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    if (timer) clearTimeout(timer);
    if (sql) await sql.end({ timeout: 1 }).catch(() => undefined);
  }
}

export async function GET() {
  const env = process.env.CTIIP_ENV ?? 'unknown';
  // ビルド時に埋め込まれる想定（CI/デプロイスクリプトが CTIIP_COMMIT_SHA を渡す）。
  const version = process.env.CTIIP_COMMIT_SHA ?? null;
  const db = await checkDatabase();

  // DBに繋がらない場合は異常として 503 を返す（外形監視・デプロイ後のスモークテストで
  // 「アプリは起動しているがDBに到達できない」状態を検知できるようにする）。
  // 'unconfigured' はローカルや設定漏れの可能性があるため 200 のまま db フィールドで示す。
  const healthy = db !== 'error';

  return Response.json(
    {
      status: healthy ? 'ok' : 'degraded',
      env,
      version,
      db,
      time: new Date().toISOString()
    },
    {
      status: healthy ? 200 : 503,
      // 実測（2026-09-10）: 旧実装は Route Handler がビルド時に静的化され、
      // `time` が初回ビルド時刻（2026-09-01T02:45:02.896Z）で凍結したまま返っていた。
      // 外形監視が「常に ok・常に同じ時刻」を見ることになり、DB障害も検知できない。
      // force-dynamic に加えて中間キャッシュ（Cloudflare等）も無効化する。
      headers: { 'Cache-Control': 'no-store, max-age=0' }
    }
  );
}
