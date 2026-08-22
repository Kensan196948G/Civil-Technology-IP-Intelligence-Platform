# 💻 ローカル環境構築

## 1. 前提

| ツール | 用途 | 備考 |
|---|---|---|
| Node.js | 実行 | `.nvmrc` のバージョンに合わせる |
| pnpm | パッケージ管理 | corepack で導入可 |
| Wrangler | Cloudflare 開発・デプロイ | `pnpm dlx wrangler` で都度実行も可 |
| Git | — | — |
| Docker（任意） | ローカル PostgreSQL | Neon の dev ブランチを使う場合は不要 |

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

# 4. 環境変数
cp .env.example .env.local
cp .dev.vars.example .dev.vars
#   → DATABASE_URL などを設定（実値は管理者から受領。リポジトリには置かない）

# 5. DB
pnpm db:migrate
pnpm db:seed          # 合成データ投入

# 6. 起動
pnpm dev              # web: http://localhost:3000 / api: http://localhost:8787
```

## 3. データベースの選択

| 方式 | 手順 | 向き |
|---|---|---|
| Neon `dev` ブランチ | `DATABASE_URL` に dev ブランチの Pooler URL を設定 | 手軽。チームで共有 |
| Neon 個人ブランチ | `dev` から自分用ブランチを作成 | 他人に影響しない。**推奨** |
| ローカル PostgreSQL | Docker で 16 + pgvector + pg_trgm を起動 | オフライン作業 |

⚠️ **本番の接続文字列をローカルに設定しない**。

## 4. 認証（ローカル）

ローカルでは Cloudflare Access を経由しないため、擬似認証を使う。

```bash
# .dev.vars
APP_ENV=development
DEV_AUTH_ENABLED=true
DEV_AUTH_USER_EMAIL=you@example.com
DEV_AUTH_ROLES=tech_manager,ip
```

**MUST**:
- `DEV_AUTH_ENABLED` は `APP_ENV=development` のときのみ有効にする
- 本番ビルドに擬似認証のコードパスを含めない（ビルド時に除去、またはガードを二重にする）
- CI で「本番ビルドに擬似認証が含まれていないこと」を検証する

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
pnpm dev                       # 開発サーバ
pnpm dev:worker ingest         # 特定 Worker のローカル実行
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
| DB に繋がらない | Pooler URL か。`sslmode=require` があるか。IP 制限 |
| `vector` 型が無いと言われる | 拡張が未作成。`CREATE EXTENSION vector;` |
| 認証が通らない | `.dev.vars` の擬似認証設定。`APP_ENV` |
| Worker のローカル実行でバインディングが無い | `wrangler.jsonc` の設定と `--local` の指定 |
| ベクトル検索が空を返す | 埋め込みが未生成。`pnpm db:seed` の埋め込み生成が走ったか |
| 日本語検索がヒットしない | `text_norm` が生成されているか。trgm しきい値 |
