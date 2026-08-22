# 🏛️ システムアーキテクチャ

| 項目 | 値 |
|---|---|
| 版 | v0.1 |
| 実行基盤 | Cloudflare（Workers / Workflows / Queues / R2 / KV / Access） |
| データベース | Neon（PostgreSQL + pgvector + pg_trgm） |
| ソース・CI/CD | GitHub（Actions） |
| 本番URL | `https://ctiip.mirai-dx-platform.com` |

---

## 1. 全体構成

```text
                        ┌───────────────────────────┐
   利用者（社内）  ───→ │ Cloudflare Access (SSO/MFA)│
                        └─────────────┬─────────────┘
                                      │ JWT
                        ┌─────────────▼─────────────┐
                        │  ctiip.mirai-dx-platform.com│
                        │  web  : Next.js on Workers  │
                        └─────────────┬─────────────┘
                                      │ internal fetch / service binding
                        ┌─────────────▼─────────────┐
                        │  api  : Hono on Workers     │
                        │  - 認証/認可  - RBAC/RLS     │
                        │  - 検索  - CRUD  - ジョブ起票 │
                        └───┬────────┬────────┬──────┘
                            │        │        │
              ┌─────────────▼──┐  ┌──▼─────┐ ┌▼───────────────┐
              │ Neon PostgreSQL│  │   R2   │ │ Queues          │
              │ + pgvector     │  │ 文書/  │ │ ingest / ai     │
              │ + pg_trgm      │  │ 帳票   │ └───┬─────────────┘
              └────────────────┘  └────────┘     │
                            ▲                    │
                            │        ┌───────────▼──────────────┐
                            │        │ workers (consumers)       │
                            │        │  - ingest-worker          │
                            └────────┤  - ai-worker              │
                                     │  - report-worker          │
                                     └───────────┬──────────────┘
                                                 │
                                     ┌───────────▼──────────────┐
                                     │ Cloudflare Workflows      │
                                     │  agent-orchestrator       │
                                     │  (M21 の多段実行)          │
                                     └───────────┬──────────────┘
                                                 │
        ┌────────────────────────────────────────┼─────────────────────┐
        ▼                    ▼                   ▼                     ▼
  Anthropic API        Workers AI          外部データ源         Construction-
  (Claude / 推論)      (埋め込み)          JPO/WIPO/NETIS/論文   LegalOps-DX
```

## 2. コンポーネント責務

| コンポーネント | 実体 | 責務 |
|---|---|---|
| **web** | Next.js (App Router) on Cloudflare Workers | 画面描画、SSR、セッション、UIの権限制御 |
| **api** | Hono on Cloudflare Workers | REST API、認可、検索、CRUD、ジョブ起票。**60秒を超える処理を持たない** |
| **ingest-worker** | Queue Consumer | 外部データの取得・正規化・保存・埋め込み生成 |
| **ai-worker** | Queue Consumer | 単発のAI処理（要約、分類、Claim分解、模擬審査） |
| **report-worker** | Queue Consumer | 帳票生成（PDF/DOCX/XLSX）と R2 保存 |
| **agent-orchestrator** | Cloudflare Workflows | M21 の多段エージェント連鎖。永続実行・再試行・中断再開 |
| **Neon** | PostgreSQL 16+ | 業務データ、全文（trgm）、ベクトル（pgvector）、監査ログ |
| **R2** | Object Storage | 原文PDF、図面、添付、生成帳票 |
| **KV** | Workers KV | 設定、分類マスタのキャッシュ、Rate Limit カウンタ |
| **Access** | Cloudflare Zero Trust | SSO / MFA / デバイス条件 |

## 3. リクエスト経路

### 3.1 同期（検索・参照）

```text
Browser → Access(認証) → web(Worker) → api(Worker) → Neon
                                          ↓
                                    結果を整形して返す（p95 ≤ 2s 目標）
```

### 3.2 非同期（AI処理・帳票）

```text
Browser → api : POST /v1/ai/runs            → 202 Accepted { run_id }
api     → Queues : ジョブ投入
Queue   → ai-worker : 実行（Claude API / Workers AI）
ai-worker → Neon : ai_runs / ai_citations へ結果と根拠を保存
Browser → api : GET /v1/ai/runs/{id}        → 進捗・結果
```

**設計原則**: 画面は結果をポーリングまたは SSE で受け取る。API に長時間処理を持たせない。
理由と代替案は [ADR-0004](adr/ADR-0004-async-ai-execution.md) を参照。

### 3.3 多段エージェント（M21）

```text
api → Workflows.create(agent-orchestrator, params)
      ↓ 各 step は独立に再試行・永続化される
      Search → Patent → Research → Claim → Civil
        → Examiner → Competitor → Landscape → R&D
        → Licensing → Legal → Report
      ↓
      レポート草案を作成し、status=draft で保存（人のレビュー前は確定しない）
```

## 4. データ取り込み経路

```text
Cron Trigger（日次）
   ↓
ingest-scheduler（Worker）: 取得対象の決定、差分判定
   ↓
Queues: ingest キューへ分割投入（1メッセージ = 1バッチ）
   ↓
ingest-worker:
   1. 取得（HTTP）        → 生データを R2 へ退避
   2. 正規化              → 日付・国コード・IPC/CPC
   3. 名寄せ候補生成      → entity_aliases
   4. 本体保存            → patents / papers / netis_*
   5. チャンク分割 + 埋め込み → document_chunks（pgvector）
   6. ingest_runs へ結果記録
```

**MUST**: 全レコードに `source` / `source_url` / `retrieved_at` / `license_note` を保持する。

## 5. 認証・認可

| 層 | 手段 | 内容 |
|---|---|---|
| 入口 | Cloudflare Access | SSO（IdP連携）+ MFA。未認証はアプリへ到達しない |
| アプリ | Access JWT 検証 | `CF-Access-JWT-Assertion` を検証し、利用者を特定 |
| 機能 | RBAC | ロール × モジュール × 操作（[権限マトリクス](../10-requirements/05-rbac-matrix.md)） |
| 行 | プロジェクト権限 + 機密区分 | C3/C4 は参加者以外に「存在も見せない」 |
| API | 内部トークン | web → api、worker → api の呼び出しに使用 |

⚠️ **要決定** — IdP（Entra ID / Google Workspace 等）の選定。Phase 1 開始前。

## 6. 環境

| 環境 | URL | 用途 |
|---|---|---|
| local | `http://localhost:3000` | 開発者ローカル（ダミーデータ） |
| preview | Workers preview URL（PRごと） | PR検証。Neon ブランチDBと対（ダミーデータ） |
| **MVP** | `https://ctiip-mvp.mirai-dx-platform.com` 🔒 | プロトタイプ・機能検証・受入。**ダミーデータ中心** |
| **本番** | `https://ctiip.mirai-dx-platform.com` 🔒 | 本番運用。実データ（ダミーは段階的にゼロへ） |

詳細は [../40-infrastructure/04-environments.md](../40-infrastructure/04-environments.md)。

## 7. 障害時の縮退方針

| 障害 | 縮退動作 |
|---|---|
| AIプロバイダ停止 | AI機能のみエラー表示。検索・台帳参照・ワークフローは継続 |
| Workers AI（埋め込み）停止 | 意味検索を無効化し、字句検索のみで結果を返す（画面に明示） |
| 外部データ源停止 | 取り込みを再試行キューへ。既存データで参照系を継続 |
| Neon 一時停止 | 読み取りレプリカへフォールバック（⚠️ 構成は要決定）。書き込みは再試行 |
| Queue 滞留 | 滞留数をアラート。優先度の低いジョブを停止 |

## 8. 参照

- [技術選定](02-technology-stack.md)
- [データフロー](03-data-flow.md)
- [AIエージェント構成](04-ai-agent-architecture.md)
- [ADR一覧](adr/)
