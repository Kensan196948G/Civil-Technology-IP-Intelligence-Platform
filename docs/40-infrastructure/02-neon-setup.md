# 🐘 DB構成 — ローカル PostgreSQL（Neon から移行済み）

> 主DBは **自社ホスト上のローカル PostgreSQL 16** です（2026-08-29 移行、[ADR-0007](../20-architecture/adr/ADR-0007-local-postgresql.md)）。
> 本ファイルは旧「Neon 構成」を現行構成へ書き換えたものです。Neon（PITR・Pooler・ブランチ）は**廃止**。
> 移行前の Neon 前提の記述は他文書（README・環境定義・CI/CD 等）に残っていますが、本ファイルと ADR-0007 が優先します。

## 1. 現行構成

| 項目 | 値 |
|---|---|
| DB エンジン | PostgreSQL 16（Ubuntu 24.04 のホスト上。`/var/lib/postgresql/16/main`） |
| 接続先 | `127.0.0.1:5432` |
| データベース名 | `civil_tech_ip_intelligence` |
| アプリ用ロール | `ctip_app`（DML のみ。`audit_logs` は INSERT/SELECT のみ） |
| マイグレーション実行 | ローカルで `pnpm db:migrate`（スーパーユーザー権限で実行 or 所有者ロールを別途用意） |
| 公開 | Cloudflare Tunnel（`ctiip` → `127.0.0.1:18940`、`ctiip-mvp` → `127.0.0.1:3001`） |

**実行サービスの実体（systemd）**

| サービス | 内容 |
|---|---|
| `ctip-web.service` | 本番（`ctiip.mirai-dx-platform.com`）。Next.js `next start -p 18940`。`EnvironmentFile=.env.local` |
| `ctiip-mvp-adhoc.service` | MVP（`ctiip-mvp.mirai-dx-platform.com`）。`next start -p 3001` |
| `ctip-web-cloudflared.service` | Cloudflare Tunnel（`ctip-web`） |

## 2. セットアップ手順（新規ホスト／新規DB）

```bash
# PostgreSQL 16 に DB とロールを作成
sudo -u postgres psql <<'SQL'
CREATE ROLE ctip_app LOGIN PASSWORD '<アプリ用パスワード>';
CREATE DATABASE civil_tech_ip_intelligence OWNER ctip_app;
SQL

# マイグレーション（DDL 適用。初回のみ）
cd apps/web
pnpm db:migrate          # DATABASE_URL は ctip_app の接続文字列を設定

# ダミーデータ投入（既存データを洗い替えるため明示フラグ + 許可リスト必須）
CTIIP_ALLOW_SEED_TRUNCATE=true \
CTIIP_SEED_ALLOWED_HOST=127.0.0.1 \
CTIIP_SEED_ALLOWED_DB=civil_tech_ip_intelligence \
pnpm db:seed
```

`.env.local`（コミットしない）:

```text
DATABASE_URL=postgresql://ctip_app:***@127.0.0.1:5432/civil_tech_ip_intelligence
CTIIP_DEMO_COOKIE_SECRET=<ランダム64文字>
CTIIP_COOKIE_SECURE=true    # Tunnel 配下の HTTPS 運用の場合
```

## 3. ロールと権限

| ロール | 用途 | 権限 |
|---|---|---|
| `ctip_app` | アプリケーション | DML のみ。`audit_logs` は INSERT/SELECT のみ |

```sql
-- 監査ログの追記専用を DB レベルで強制する（存在すれば）
REVOKE UPDATE, DELETE ON audit_logs FROM ctip_app;
GRANT INSERT, SELECT ON audit_logs TO ctip_app;
```

## 4. 拡張

現行の `civil_tech_ip_intelligence` に作成済みの拡張: `pgcrypto`, `plpgsql`。

検索高度化（ADR-0003 の pg_trgm / pgvector）や正規化補助（unaccent）は、実装フェーズで追加する:

```sql
CREATE EXTENSION IF NOT EXISTS vector;     -- 意味検索（未導入）
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- 日本語字句検索（未導入）
CREATE EXTENSION IF NOT EXISTS unaccent;   -- 正規化補助（未導入）
```

## 5. マイグレーション運用

```text
PR 作成 → レビュー → main へマージ
        → ローカル（/ デプロイ先ホスト）で pnpm db:migrate を適用
```

**原則**（[DB設計 §6](../30-design/02-database-design.md)）

- 加算のみ・後方互換のみ
- 列削除・型変更は複数リリースに分割する
- データ削除を伴う変更は 🔒 承認必要
- DB は単一ホストのため、適用前にローカルで `pg_dump` を取得する

## 6. バックアップ・復旧

| 項目 | 方針 |
|---|---|
| 論理バックアップ | 日次で `pg_dump` を取得し、ローカル/外部ストレージへ保管（⚠️ 保管先・保持期間は要決定） |
| 復旧手順 | [../70-operations/03-backup-and-restore.md](../70-operations/03-backup-and-restore.md)（移行前記述を含むため要読替） |
| RPO / RTO | ⚠️ **要決定** — Neon PITR は利用できないため目標値を再設定する |

## 7. 注意事項

| 項目 | 内容 |
|---|---|
| 単一障害点 | DB がホスト上にあるため、ホスト障害＝サービス停止。可用性要件は本番設計フェーズで再定義 |
| 接続 | 同一ホストのため Pooler 不要。コネクションは通常どおり管理する |
| 認証情報 | `ctip_app` のパスワードは `.env.local`（systemd `EnvironmentFile`）で管理し、リポジトリ・CI に置かない |
| ベクトル索引 | 拡張追加後に構築。初期取り込み時の手順を用意する |
