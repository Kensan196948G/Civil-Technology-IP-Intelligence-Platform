# 🔑 シークレット管理

> **原則**: シークレットをリポジトリ・ログ・PR本文・Issue・チャットへ書かない。値を画面に表示しない。

## 1. 対象

| シークレット | 用途 | 保管先 |
|---|---|---|
| `DATABASE_URL` | Neon 接続（アプリ用ロール） | Worker Secrets |
| `DATABASE_URL_DIRECT` | マイグレーション（owner ロール） | GitHub Environments Secrets |
| `ANTHROPIC_API_KEY` | 言語モデル | Worker Secrets |
| `INTERNAL_TOKEN` | Worker 間呼び出し | Worker Secrets |
| `LEGALOPS_WEBHOOK_SECRET` | 外部連携の署名検証 | Worker Secrets |
| `EXTERNAL_SOURCE_KEYS` | 外部データ源のAPIキー | Worker Secrets |
| `CLOUDFLARE_API_TOKEN` | CI からのデプロイ | GitHub Environments Secrets |
| `NEON_API_KEY` | CI からのブランチ作成 | GitHub Environments Secrets |

⚠️ 実際の値は本書に記載しない。**変数名のみを管理する**。

### 1.1 ワークフロー別の必要シークレット

実装済みのワークフローが実際に参照しているものは以下のとおり。未設定だとジョブが
失敗する（E2E のみ、未設定時は skip される）。

| ワークフロー | シークレット | 保管先 | 未設定時の挙動 |
|---|---|---|---|
| `.github/workflows/deploy-production.yml` | `CLOUDFLARE_API_TOKEN` | Environment `production` | デプロイ失敗 |
| 〃 | `CLOUDFLARE_ACCOUNT_ID` | Environment `production` | デプロイ失敗 |
| 〃 | `DATABASE_URL_PROD` | Environment `production` | マイグレーション失敗 |
| 〃 | `CTIIP_DEMO_COOKIE_SECRET` | Environment `production` | ビルド失敗 |
| `.github/workflows/ci.yml`（e2e） | `DATABASE_URL_MVP` | Repository Secrets | E2E を skip |
| 〃 | `CTIIP_SEED_ALLOWED_HOST` | Repository Secrets | E2E を skip |
| 〃 | `CTIIP_SEED_ALLOWED_DB` | Repository Secrets | E2E を skip |
| 〃 | `CTIIP_DEMO_COOKIE_SECRET` | Repository Secrets | E2E を skip |

**MUST**: Environment `production` には **Required reviewers** を設定する。
これがないと、タグを打っただけで承認なく本番へ出てしまう。

**注意**: E2E 用の `DATABASE_URL_MVP` は毎回データを洗い替える（`TRUNCATE`）ため、
**必ずE2E専用のNeonデータベース**を指すこと。本番・共有DBを指してはならない。
`CTIIP_SEED_ALLOWED_HOST` / `CTIIP_SEED_ALLOWED_DB` はその事故を防ぐための
ホスト名・DB名の完全一致による許可リストである。

## 2. 保管の原則

| 場所 | 用途 | 可否 |
|---|---|---|
| Cloudflare Worker Secrets | 実行時のシークレット | ○ |
| GitHub Environments Secrets | CI/CD 用 | ○ |
| `.dev.vars`（ローカル） | ローカル開発 | ○（`.gitignore` 必須） |
| `wrangler.jsonc` の `vars` | 非機密の設定のみ | ✕（シークレット禁止） |
| `.env.example` | 変数名と安全な例のみ | ○ |
| リポジトリ内のファイル | — | ✕ |
| ログ・エラーメッセージ | — | ✕ |
| PR本文・Issue・コミットメッセージ | — | ✕ |

## 3. 投入手順

```bash
# Cloudflare Worker へ（🔒 本番は承認後に実行）
wrangler secret put DATABASE_URL --name ctiip-api-prod
wrangler secret put ANTHROPIC_API_KEY --name ctiip-ai-prod

# 一覧（値は表示されない）
wrangler secret list --name ctiip-api-prod
```

GitHub 側は `Settings → Environments → {production|mvp} → Secrets` から登録する。
**production 環境には Required reviewers を設定**し、承認なしにデプロイできないようにする。

## 4. `.env.example`

```bash
# .env.example — 変数名と安全な例のみ。実値を書かない
APP_ENV=development
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-xxxxxxxx
INTERNAL_TOKEN=replace-with-random-64-chars
ACCESS_TEAM_DOMAIN=example.cloudflareaccess.com
ACCESS_AUD=replace-with-access-application-aud
```

## 5. ローテーション

| シークレット | 頻度 | 手順 |
|---|---|---|
| APIキー類 | ⚠️ 要決定（暫定 年1回） | 新旧併用期間を設けて切り替える |
| `INTERNAL_TOKEN` | ⚠️ 要決定（暫定 年1回） | 新旧併用 → 旧を無効化 |
| DB パスワード | 要員異動時・年1回 | Neon 側でロール更新 → Secrets 更新 → デプロイ |
| 漏えい疑いがある場合 | 即時 | 無効化 → 再発行 → 影響調査 → 報告 |

🔒 本番シークレットの追加・変更・削除・ローテーションは**承認事項**。

## 6. 漏えい防止

| 対策 | 実装 |
|---|---|
| 秘密検出 | CI で秘密スキャンを実行し、検出時はマージをブロック |
| `.gitignore` | `.env*`, `.dev.vars`, `*.pem`, `*.key` を除外 |
| ログ | シークレットをマスクするロガーを使う。エラー本文をそのまま出さない |
| PR | シークレットらしき文字列を含む PR を自動検出する |
| レビュー | シークレットを含む変更は必ず指摘する |

## 7. 漏えい時の対応

```text
① 検知（秘密スキャン・監査ログ・外部通報）
② 直ちに該当シークレットを無効化する
③ 新しい値を発行し、Secrets を更新してデプロイ
④ 影響範囲を調査（監査ログでアクセス痕跡を確認）
⑤ 履歴からの除去を検討（ただし公開済みは漏えいしたものとして扱う）
⑥ 報告（システムオーナー → 経営）
⑦ 再発防止策を記録
```

**MUST**: 「値を表示しない」原則により、調査時もシークレットの値そのものを画面・報告書に出さない。
識別子（変数名・作成日・最終使用日）のみを扱う。
