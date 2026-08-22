# 🔧 技術選定

⚠️ 各ライブラリの正確なバージョンは実装着手時に確定する。本書は選定と理由を定める。

---

## 1. 一覧

| 層 | 採用 | 理由 |
|---|---|---|
| 言語 | TypeScript | フロント／API／Worker を単一言語で統一し、型を共有する |
| モノレポ | pnpm workspaces + Turborepo | 複数 Worker とパッケージの依存管理・キャッシュビルド |
| フロント | Next.js（App Router） | SSR、ルーティング、React Server Components |
| フロント配信 | Cloudflare Workers（OpenNext アダプタ） | Cloudflare 一本化。エッジ配信 |
| UI | Tailwind CSS + 自社デザイントークン | 実装速度と一貫性。ダーク／ライト対応 |
| 図表 | 軽量チャートライブラリ（⚠️ 選定要） | Landscape / ダッシュボードの可視化 |
| API | Hono（Cloudflare Workers） | Workers 向けに軽量・高速。OpenAPI 生成に対応 |
| バリデーション | Zod | API入出力とDBスキーマの型整合 |
| ORM | Drizzle ORM | Workers との相性、SQL に近い記述、マイグレーション管理 |
| DB | Neon PostgreSQL | サーバーレス、ブランチ機能、PITR |
| ベクトル検索 | pgvector（Neon拡張） | DBを分けずに意味検索を実現。トランザクション整合 |
| 字句検索 | pg_trgm（Neon拡張） | 日本語形態素解析拡張が無い制約下での現実解（[ADR-0003](adr/ADR-0003-japanese-search.md)） |
| 非同期 | Cloudflare Queues | 取り込み・AI・帳票の分離 |
| 多段実行 | Cloudflare Workflows | エージェント連鎖の永続実行・再試行・中断再開 |
| オブジェクト | Cloudflare R2 | 原文PDF・図面・帳票。エグレス無料 |
| KV | Workers KV | 設定・マスタキャッシュ・Rate Limit |
| 認証 | Cloudflare Access（Zero Trust） | SSO / MFA を基盤側で担保。アプリに認証実装を持ち込まない |
| 言語モデル | Anthropic Claude API | 日本語の長文（特許明細書）処理と根拠追跡に適する |
| 埋め込み | Workers AI（多言語対応モデル） | 日本語対応。Cloudflare 内で完結しレイテンシとコストを抑制 |
| 帳票 | サーバサイド生成（PDF/DOCX/XLSX） | ⚠️ ライブラリ選定要。Workers 実行制約を考慮 |
| テスト | Vitest / Playwright | 単体・結合／E2E |
| CI/CD | GitHub Actions | 品質ゲートとデプロイの自動化 |
| IaC | Wrangler 設定 + Terraform（一部） | ⚠️ Terraform 適用範囲は要決定 |
| 監視 | Cloudflare Analytics / Workers Logs + 外部監視 | ⚠️ 外部監視サービスは要決定 |

## 2. モノレポ構成（計画）

```text
Civil-Technology-IP-Intelligence-Platform/
├─ apps/
│  ├─ web/                 Next.js（画面）
│  └─ api/                 Hono（REST API）
├─ workers/
│  ├─ ingest/              外部データ取り込み Consumer
│  ├─ ai/                  AI処理 Consumer
│  ├─ report/              帳票生成 Consumer
│  └─ orchestrator/        Cloudflare Workflows（M21）
├─ packages/
│  ├─ db/                  Drizzle スキーマ・マイグレーション・クエリ
│  ├─ core/                ドメインロジック（分類・スコア算出・権限判定）
│  ├─ ai/                  プロンプト、モデル抽象、Provenance 付与
│  ├─ search/              ハイブリッド検索（trgm + vector + RRF）
│  ├─ ui/                  共通UIコンポーネント
│  └─ config/              環境設定・型・定数
├─ docs/                   本ドキュメント群
├─ .github/workflows/      CI/CD
└─ turbo.json / pnpm-workspace.yaml
```

## 3. 採用しなかった選択肢と理由

| 候補 | 不採用の理由 |
|---|---|
| 専用ベクトルDB（外部SaaS） | データが二重管理になり、権限とトランザクション整合が壊れる。C3/C4 の管理範囲が広がる |
| Elasticsearch / OpenSearch | 日本語検索には最適だが、運用対象が増える。Phase 3 以降に再評価する（[ADR-0003](adr/ADR-0003-japanese-search.md) の再評価条件） |
| コンテナ（ECS/Cloud Run 等） | Cloudflare 一本化の方針と、常時稼働コストを避けるため |
| アプリ内での独自認証実装 | MFA・SSO を自前実装するリスク。Access に委ねる |
| 同期APIでのAI処理 | Workers の実行時間制約。UX上も長時間の同期待ちは不適 |
| RDBを使わない全文検索専用構成 | 監査・権限・トランザクションの要件を満たせない |

## 4. 制約に基づく設計上の注意

| 制約 | 対応 |
|---|---|
| Worker のCPU時間上限 | 重い処理は Queue / Workflows へ。1リクエスト1目的 |
| Worker のメモリ上限 | 大きなPDFはストリーム処理し、R2 経由で受け渡す |
| DB接続数 | Neon Pooler を使用。コネクションを保持しない |
| エッジ ↔ DB のレイテンシ | DBリージョンを固定。読み取りの多い画面はキャッシュを併用 |
| AI のトークン上限 | 明細書は章単位に分割して処理し、結果を統合する |
| AI のコスト | ジョブ単位でトークン量を記録し、上限を設定する |
