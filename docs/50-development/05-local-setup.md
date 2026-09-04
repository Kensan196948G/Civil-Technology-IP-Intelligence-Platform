# 💻 ローカル環境構築

> DB は **ローカル PostgreSQL 16**（ホスト `127.0.0.1:5432`、[ADR-0007](../20-architecture/adr/ADR-0007-local-postgresql.md)）。
> 旧「Neon dev ブランチ / Wrangler preview」の記述は移行前のものです。

## 1. 前提

| ツール | 用途 | 備考 |
|---|---|---|
| Node.js | 実行 | `.nvmrc` のバージョンに合わせる |
| pnpm | パッケージ管理 | corepack で導入可 |
| PostgreSQL 16 | DB | ホスト上の `127.0.0.1:5432`（他プロジェクトと共用。未導入なら Docker でも可） |
| Git | — | — |
| Cloudflare Tunnel（任意） | 公開 | ローカル開発には不要。公開時にのみ |

## 2. 手順

```bash
# 1. 取得
git clone <repo-url>
cd Civil-Technology-IP-Intelligence-Platform

# 2. Node バージョン
nvm use          # .nvmrc

# 3. 依存
corepack enable
pnpm install

# 4. 環境変数（.env.example を apps/web/.env.local へコピーして設定）
cd apps/web && cp .env.example .env.local
#   → DATABASE_URL をローカル PostgreSQL の接続文字列に変更（実値は管理者から受領）

# 5. DB（schema/ の DDL 適用 → ダミーデータ投入）
pnpm db:migrate
# seed は接続先の許可リスト（ホスト名・DB名の完全一致）が必要
CTIIP_ALLOW_SEED_TRUNCATE=true CTIIP_SEED_ALLOWED_HOST=127.0.0.1 CTIIP_SEED_ALLOWED_DB=<db名> pnpm db:seed

# 6. 起動
pnpm dev          # http://localhost:3000
```

## 3. データベースの選択

| 方式 | 手順 | 向き |
|---|---|---|
| ローカル PostgreSQL（**標準**） | ホストの PostgreSQL 16 に DB を作成し `DATABASE_URL` を設定（[02 DB構成](../40-infrastructure/02-neon-setup.md)） | 開発・MVP・本番共通。**推奨** |
| Docker の PostgreSQL | `docker run -p 5432:5432 postgres:16` 等 | ホストに PG が無い場合の代替 |

> Neon（dev ブランチ等）は **2026-08-29 に廃止**（ADR-0007）。接続しないこと。

⚠️ **本番の接続文字列をローカルに設定しない**。`.env.local` はリポジトリにコミットしない。

## 4. 認証（ローカル）

ローカルでは Cloudflare Access を経由しないため、アプリはデモ認証（`src/lib/auth/demo.ts`）を使う。
ログイン画面でロールを選ぶだけで認証できる（**MVP専用の簡易認証**。本番は Access へ置換するバックログ）。

## 5. 合成データ

`pnpm db:seed` が投入するもの。

| 対象 | 内容 |
|---|---|
| 利用者・ロール | 各ロール1名ずつ |
| 部署 | 01〜08 |
| 特許 | 公開情報から作成した少量サンプル（C1） |
| 技術台帳 | 架空の工法・材料・機械 |
| 現場・課題 | 架空の現場と施工課題 |
| 発明 | 架空の発明届（C3。権限テスト用） |

**MUST**: 実在の未公開情報を合成データに含めない。

## 6. よく使うコマンド

```bash
pnpm dev                       # 開発サーバ（http://localhost:3000）
pnpm test -- --watch           # テスト監視
pnpm db:studio                 # DB 閲覧
pnpm typecheck                 # 型チェック
pnpm lint --fix                # 自動修正
pnpm test:e2e -- --headed      # E2E をブラウザ表示で実行
```

## 7. つまずきやすい点

| 症状 | 原因・対処 |
|---|---|
| `pnpm install` が失敗 | Node のバージョン違い。`.nvmrc` を確認 |
| DB に繋がらない | PostgreSQL が起動しているか（`pg_lsclusters`）。ホスト・ポート・DB 名・ロールの一致を確認 |
| `vector` 型が無いと言われる | 拡張が未作成。`CREATE EXTENSION vector;`（実装フェーズで導入予定） |
| 認証が通らない | `CTIIP_DEMO_COOKIE_SECRET` が未設定/不一致。ログインはデモ認証（ロール選択） |
| seed が拒否される | `CTIIP_ALLOW_SEED_TRUNCATE=true` と接続先の許可リスト（`CTIIP_SEED_ALLOWED_HOST/DB`、完全一致）が必要 |
| ベクトル検索が空を返す | 埋め込みが未生成。`pnpm db:seed` の埋め込み生成が走ったか |
| 日本語検索がヒットしない | `text_norm` が生成されているか。trgm しきい値 |
