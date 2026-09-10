-- 拡張機能のブートストラップ（スーパーユーザー権限が必要）
--
-- Deep Debug (2026-09-10) で特定した根本原因への対応。
--
-- なぜ ddl.sql と分離しているか:
--   `vector`（pgvector）は PostgreSQL の "trusted extension" **ではない**ため、
--   `CREATE EXTENSION vector` にはスーパーユーザー権限が必要になる。
--   一方、アプリが本番で接続するロール（例 `ctip_app`）はスーパーユーザーではない。
--   そのため ddl.sql を1回のクエリとして流す従来の `pnpm db:migrate` は、
--   必ず `permission denied to create extension "vector"` で失敗していた。
--   （postgres.js は ddl.sql 全体を1つの simple query として送るため、
--     PostgreSQL 側では暗黙の単一トランザクションになり、
--     途中で失敗すると **先行して成功した文も含めて全てロールバック**される。
--     結果として「マイグレーションは失敗したがテーブルは0件のまま」という
--     原因の分かりにくい状態になっていた。）
--
-- 使い方（DB作成直後に1回だけ。スーパーユーザーで実行する）:
--   psql "$SUPERUSER_DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/src/lib/db/extensions.sql
--   または  pnpm --filter @ctiip/web db:bootstrap
--
-- 以降の `pnpm db:migrate`（アプリロールで実行）は、この拡張が既に存在する前提で
-- テーブル・索引のみを追加する。ddl.sql 側の `CREATE EXTENSION IF NOT EXISTS` は
-- 既に存在すれば no-op になるため、両方に記述があっても安全である。
--
-- ロールバック: 拡張自体を削除する場合は
--   DROP EXTENSION IF EXISTS vector; / DROP EXTENSION IF EXISTS pg_trgm;
-- ただし embedding 列・GIN 索引が依存しているため、先にそれらを削除すること。

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
