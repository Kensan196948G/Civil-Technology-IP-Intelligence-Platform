# 🛠️ 開発ガイド

## 1. リポジトリ構成

```text
Civil-Technology-IP-Intelligence-Platform/
├─ apps/
│  ├─ web/                  Next.js（画面）
│  └─ api/                  Hono（REST API）
├─ workers/
│  ├─ ingest/               外部データ取り込み
│  ├─ embed/                埋め込み生成
│  ├─ ai/                   単発AI処理
│  ├─ report/               帳票生成
│  ├─ notify/               通知
│  ├─ cron/                 定期ジョブ起票
│  └─ orchestrator/         エージェント連鎖（Workflows）
├─ packages/
│  ├─ db/                   Drizzle スキーマ・マイグレーション・クエリヘルパ
│  ├─ core/                 ドメインロジック（権限・分類・スコア・遷移規則）
│  ├─ ai/                   プロンプト・モデル抽象・引用付与
│  ├─ search/               ハイブリッド検索
│  ├─ ui/                   共通UIコンポーネント
│  └─ config/               環境設定・定数・型
├─ docs/                    ドキュメント
├─ scripts/                 運用スクリプト
├─ .github/workflows/       CI/CD
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

## 2. 依存の向き

```text
apps/*  ──→ packages/core, packages/db, packages/ai, packages/search, packages/ui
workers/* ─→ packages/core, packages/db, packages/ai, packages/search
packages/core ──→ packages/config のみ
```

**MUST**:
- `packages/core` は DB・HTTP・Cloudflare API に依存しない（純粋関数として単体テストできること）
- 逆向きの依存を作らない。循環依存は CI で検出する

## 3. パッケージの責務

| パッケージ | 責務 | 禁止事項 |
|---|---|---|
| `db` | スキーマ定義、マイグレーション、**権限条件を自動付与するクエリヘルパ** | 業務ロジックを持たない |
| `core` | 権限判定、分類ルール、スコア算出、ワークフロー遷移規則 | 外部I/O |
| `ai` | プロンプト、モデル呼び出し、出力検証、**引用の機械的付与** | 引用文の生成 |
| `search` | 字句・意味検索、RRF、正規化 | 権限判定（`core` に委ねる） |
| `ui` | 表示コンポーネント。注記の内蔵 | データ取得 |
| `config` | 環境変数の型付き読み出し、定数 | ロジック |

## 4. 開発の進め方

```text
Issue 起票（要件IDを紐づける）
   ↓
ブランチ作成  feat/FR-M06-002-claim-decompose
   ↓
実装（テストを先に書くことを推奨）
   ↓
ローカル検証  pnpm lint / typecheck / test / build
   ↓
PR 作成（テンプレートに従う）
   ↓
CI（品質ゲート）＋ レビュー
   ↓
マージ → mvp 自動デプロイ
```

**MUST**: PR には対応する要件ID（`FR-*` / `NFR-*` / `UC-*`）を必ず記載する。
要件と実装のトレーサビリティを保つ。

## 5. よく使うコマンド

```bash
# 依存インストール
pnpm install

# 開発サーバ（web + api）
pnpm dev

# 個別
pnpm --filter @ctiip/web dev
pnpm --filter @ctiip/api dev

# 品質チェック
pnpm lint
pnpm typecheck
pnpm test
pnpm build

# DB
pnpm db:generate      # スキーマからマイグレーション生成
pnpm db:migrate       # 適用
pnpm db:studio        # 閲覧

# デプロイ（CI 経由が原則。手動は例外）
pnpm --filter @ctiip/api deploy:mvp
```

## 6. 実装時のチェックリスト

新しいAPIを追加するとき、次をすべて満たすこと。

| # | 項目 |
|---|---|
| 1 | 認証ミドルウェアを経由している（Access JWT を検証している） |
| 2 | 認可判定を `packages/core` の関数で行っている |
| 3 | DB アクセスが `packages/db` のヘルパ経由で、権限条件が SQL に含まれている |
| 4 | 行レベル権限がない場合に 404 を返している（403 ではない） |
| 5 | 入力を Zod で検証している |
| 6 | 監査ログを記録している（成功・失敗・拒否のすべて） |
| 7 | 60秒を超えうる処理を同期で実行していない |
| 8 | エラーメッセージが日本語で、原因と次の操作を示している |
| 9 | OpenAPI に反映されている |
| 10 | テストがある（正常系・権限拒否・入力エラー） |

AI処理を追加するとき、追加で次を満たすこと。

| # | 項目 |
|---|---|
| 11 | `ai_runs` を作成し、`model` と `prompt_version` を記録している |
| 12 | AI送信ポリシーを適用し、`ai_policy_checks` に記録している |
| 13 | `ai_citations` を作成している（0件なら `invalid`） |
| 14 | 引用文を**原文から機械的に切り出している**（AIに生成させていない） |
| 15 | 出力スキーマに侵害判定に相当するフィールドがない |
| 16 | トークン量と所要時間を記録している |

## 7. トラブルシューティング

| 症状 | 確認 |
|---|---|
| ローカルで認証が通らない | `.dev.vars` の擬似認証設定。本番ビルドでは無効になっていること |
| DB 接続エラー | Pooler のホストを使っているか。`sslmode=require` があるか |
| ベクトル検索が遅い | HNSW 索引が使われているか（`EXPLAIN`）。WHERE で絞りすぎていないか |
| 検索でヒットしない | `text_norm` の正規化が効いているか。trgm しきい値 |
| Worker のデプロイに失敗 | バンドルサイズ、`nodejs_compat`、互換性日付 |
| ジョブが滞留する | キューの並列度、Consumer のエラー率、DLQ |
