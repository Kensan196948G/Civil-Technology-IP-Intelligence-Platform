# ☁️ Cloudflare 構成

> 🔒 本書は手順を定義する。**本番のリソース作成・DNS変更・シークレット投入は実行していない**。実行前に承認を得ること。

## 1. 使用サービス

| サービス | 用途 | 環境ごとに分離 |
|---|---|---|
| Workers | web / api / 各 Consumer | ○ |
| Workers Static Assets | 画面の静的資産 | ○ |
| Workflows | エージェント連鎖（M21） | ○ |
| Queues | 取り込み・AI・帳票・通知 | ○ |
| R2 | 原文PDF・図面・添付・帳票 | ○ |
| Workers KV | 設定・マスタキャッシュ・Rate Limit | ○ |
| Cron Triggers | 定期バッチ | ○ |
| Zero Trust (Access) | SSO / MFA | 本番・検証で別ポリシー |
| Workers AI | 埋め込み生成 | 共有可 |
| DNS | `mirai-dx-platform.com` の管理 | 共有 |

## 2. Worker 一覧

| Worker 名 | 種別 | 役割 | トリガ |
|---|---|---|---|
| `ctiip-web` | Fetch | 画面（Next.js） | HTTP |
| `ctiip-api` | Fetch | REST API | HTTP（web からは Service Binding） |
| `ctiip-ingest` | Queue Consumer | 外部データ取り込み | `ctiip-ingest` |
| `ctiip-embed` | Queue Consumer | 埋め込み生成 | `ctiip-embed` |
| `ctiip-ai` | Queue Consumer | 単発AI処理 | `ctiip-ai` |
| `ctiip-report` | Queue Consumer | 帳票生成 | `ctiip-report` |
| `ctiip-notify` | Queue Consumer | 通知送信 | `ctiip-notify` |
| `ctiip-orchestrator` | Workflow | エージェント連鎖 | API から起動 |
| `ctiip-cron` | Scheduled | 定期ジョブの起票 | Cron Triggers |

環境ごとに名前を分ける: `ctiip-api-mvp` / `ctiip-api-prod` など。

## 3. バインディング

```jsonc
// wrangler.jsonc（api の例。値は環境ごとに差し替える）
{
  "name": "ctiip-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-08-01",     // ⚠️ 実装時の最新日付に更新する
  "compatibility_flags": ["nodejs_compat"],
  "observability": { "enabled": true },
  "queues": {
    "producers": [
      { "queue": "ctiip-ingest", "binding": "Q_INGEST" },
      { "queue": "ctiip-ai",     "binding": "Q_AI" },
      { "queue": "ctiip-report", "binding": "Q_REPORT" },
      { "queue": "ctiip-notify", "binding": "Q_NOTIFY" }
    ]
  },
  "r2_buckets": [
    { "binding": "R2_DOCS",    "bucket_name": "ctiip-docs" },
    { "binding": "R2_REPORTS", "bucket_name": "ctiip-reports" }
  ],
  "kv_namespaces": [
    { "binding": "KV_CONFIG", "id": "<id>" }
  ],
  "ai": { "binding": "AI" },
  "vars": {
    "APP_ENV": "production",
    "ACCESS_TEAM_DOMAIN": "<team>.cloudflareaccess.com",
    "ACCESS_AUD": "<aud-tag>"
  }
  // シークレットは vars に書かない。wrangler secret put で投入する
}
```

**MUST**: `DATABASE_URL`、AIプロバイダのAPIキー、内部トークンは **Secrets** として投入する。
`vars` や `wrangler.jsonc` に平文で書かない。

## 4. R2 バケット

| バケット | 用途 | 保持 |
|---|---|---|
| `ctiip-docs` | 原文PDF、図面、発明届の添付、現場写真 | 恒久 |
| `ctiip-reports` | 生成帳票 | ⚠️ 要決定（暫定 1年） |
| `ctiip-raw` | 取り込み時の生データ（再処理用） | ⚠️ 要決定（暫定 90日） |
| `ctiip-backup` | 論理バックアップ | ⚠️ 要決定（監査要件と整合） |

**キー設計**

```text
docs/{source_type}/{id}/{filename}
raw/{source}/{yyyy-mm-dd}/{batch}.json
reports/{report_id}.{ext}
backup/{yyyy-mm-dd}/dump.sql.gz
```

**アクセス**: 公開バケットにしない。ダウンロードは API が発行する**署名付きURL（有効期限つき）**経由に限定する。

## 5. Queues

| キュー | 最大リトライ | DLQ |
|---|---|---|
| `ctiip-ingest` | 5 | `ctiip-ingest-dlq` |
| `ctiip-embed` | 3 | `ctiip-embed-dlq` |
| `ctiip-ai` | 2 | `ctiip-ai-dlq` |
| `ctiip-report` | 2 | `ctiip-report-dlq` |
| `ctiip-notify` | 3 | `ctiip-notify-dlq` |

⚠️ バッチサイズ・待機時間・並列度は Phase 1 の実測後に確定する。

## 6. Cloudflare Access（認証）

| 設定 | 内容 |
|---|---|
| 保護対象 | `ctiip.mirai-dx-platform.com/*`、`ctiip-mvp.mirai-dx-platform.com/*` |
| IdP | ⚠️ **要決定**（Entra ID / Google Workspace 等） |
| MFA | 必須 |
| ポリシー | 社内ドメインのメールアドレス、かつ指定グループに所属 |
| セッション | ⚠️ 要決定（暫定 8時間） |
| 除外パス | `/api/v1/integrations/legalops/*`（別途 署名検証）、`/healthz` |

**アプリ側の必須実装**

1. `CF-Access-JWT-Assertion` の **署名・`aud`・`iss`・有効期限を毎回検証する**
2. 検証はミドルウェアで一元化する
3. ヘッダの存在だけを信頼しない（Access を経由しない到達経路があれば認証を素通りしてしまう）

## 7. Cron Triggers

```jsonc
// ctiip-cron の wrangler 設定（時刻は UTC）
{
  "triggers": {
    "crons": [
      "0 16 * * *",   // JST 01:00 特許取り込み
      "0 17 * * *",   // JST 02:00 論文取り込み
      "0 18 * * 0",   // JST 03:00(月) NETIS 取り込み
      "0 19 * * *",   // JST 04:00 埋め込み差分
      "0 20 * * *",   // JST 05:00 Landscape 集計
      "0 21 * * *",   // JST 06:00 ウォッチ検知
      "0 14 * * *"    // JST 23:00 論理バックアップ
    ]
  }
}
```

⚠️ Cron は UTC で指定する。JST との対応を誤らないこと。日本の夏時間は無いため固定 +9 時間。

## 8. セキュリティ設定

| 項目 | 設定 |
|---|---|
| WAF | 既定のマネージドルールを有効化。⚠️ 例外は都度承認 |
| Bot 対策 | 有効 |
| Rate Limiting | API パスに対して設定（[API仕様 §1.5](../30-design/03-api-specification.md)） |
| TLS | 最小バージョン 1.2。HSTS 有効 |
| セキュリティヘッダ | CSP / X-Content-Type-Options / Referrer-Policy を web で付与 |
| ログ | Workers Logs を有効化。機密本文を出力しない |

## 9. 構築手順（Phase 1）

> 🔒 各手順の実行前に承認を得る。特に 5・6・9 は本番影響がある。

```text
1. Cloudflare アカウントとアクセス権の確認
2. R2 バケット作成（docs / reports / raw / backup）× 環境
3. KV Namespace 作成 × 環境
4. Queues 作成（本キュー + DLQ）× 環境
5. 🔒 DNS レコード追加（ctiip / ctiip-mvp）→ 40-infrastructure/03-dns-and-domain.md
6. 🔒 Zero Trust Access アプリケーションとポリシー作成
7. Worker を mvp へデプロイし、疎通確認
8. Cron Triggers を mvp で有効化し、動作確認
9. 🔒 本番シークレット投入 → 本番デプロイ → スモークテスト
```

## 10. 制約と注意

| 項目 | 内容 |
|---|---|
| 実行時間 | Worker のCPU時間に上限がある。長時間処理は Queues / Workflows へ |
| メモリ | 大きなファイルはストリーム処理する。全読み込みしない |
| サブリクエスト数 | 1リクエストあたりの外部呼び出し回数に上限がある。ループでのAPI連打を避ける |
| Node 互換 | 一部の Node.js API は利用できない。`nodejs_compat` で足りない場合は代替実装を用意する |
| DB接続 | Neon Pooler を経由。コネクションを保持しない |
| 環境変数 | シークレットと通常変数を混同しない |
