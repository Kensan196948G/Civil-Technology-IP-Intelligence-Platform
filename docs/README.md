# 📚 ドキュメント索引 — Civil Technology & IP Intelligence Platform

土木技術・知財インテリジェンスプラットフォーム（略称 **CTIIP**）の開発関連ドキュメント一式です。

| 項目 | 値 |
|---|---|
| 🏷️ プロダクト略称 | `CTIIP` |
| 📦 リポジトリ | `Civil-Technology-IP-Intelligence-Platform` |
| 🌐 本番URL | `https://ctiip.mirai-dx-platform.com` |
| 🧪 MVP URL | `https://ctiip-mvp.mirai-dx-platform.com` |
| ☁️ 基盤 | GitHub / Cloudflare / Neon |
| 📅 本版 | v0.1（設計原案・実装着手前） |
| 📝 最終更新 | 2026-09-04 |

---

## 📌 読む順序

初めての方は次の順に読んでください。

```text
00-overview/01-project-charter.md      ← 何を作るのか
   ↓
10-requirements/01-requirements-definition.md  ← 要件定義書（本体）
   ↓
20-architecture/01-system-architecture.md      ← どう作るのか
   ↓
30-design/01-detailed-design.md                ← 詳細設計仕様書（本体）
   ↓
50-development/01-development-guide.md         ← 開発を始める
```

---

## 🗂️ ディレクトリ構成

### 00-overview — 全体像

| ファイル | 内容 |
|---|---|
| [01-project-charter.md](00-overview/01-project-charter.md) | プロジェクト憲章。目的、スコープ、体制、成功基準 |
| [02-glossary.md](00-overview/02-glossary.md) | 用語集。日本語・英語・略号の対応 |
| [03-scope-boundary.md](00-overview/03-scope-boundary.md) | 責任境界。Construction-LegalOps-DX との分担 |

### 10-requirements — 要件定義

| ファイル | 内容 |
|---|---|
| [01-requirements-definition.md](10-requirements/01-requirements-definition.md) | **要件定義書（本体）** |
| [02-functional-requirements.md](10-requirements/02-functional-requirements.md) | 機能要件一覧 `FR-Mxx-nnn` |
| [03-non-functional-requirements.md](10-requirements/03-non-functional-requirements.md) | 非機能要件 `NFR-x-nnn` |
| [04-use-cases.md](10-requirements/04-use-cases.md) | ユースケース `UC-nn` |
| [05-rbac-matrix.md](10-requirements/05-rbac-matrix.md) | ロール×機能の権限マトリクス |

### 20-architecture — アーキテクチャ

| ファイル | 内容 |
|---|---|
| [01-system-architecture.md](20-architecture/01-system-architecture.md) | システム構成図、コンポーネント責務 |
| [02-technology-stack.md](20-architecture/02-technology-stack.md) | 技術選定と選定理由 |
| [03-data-flow.md](20-architecture/03-data-flow.md) | データフロー、取り込み経路 |
| [04-ai-agent-architecture.md](20-architecture/04-ai-agent-architecture.md) | AIエージェント構成と実行基盤 |
| [adr/](20-architecture/adr/) | アーキテクチャ決定記録（ADR） |

### 30-design — 詳細設計

| ファイル | 内容 |
|---|---|
| [01-detailed-design.md](30-design/01-detailed-design.md) | **詳細設計仕様書（本体）** |
| [02-database-design.md](30-design/02-database-design.md) | DB設計、DDL、インデックス |
| [03-api-specification.md](30-design/03-api-specification.md) | REST API 仕様 |
| [04-screen-design.md](30-design/04-screen-design.md) | 画面一覧、遷移、共通UI |
| [05-batch-and-jobs.md](30-design/05-batch-and-jobs.md) | バッチ・ジョブ・キュー設計 |
| [06-search-and-rag-design.md](30-design/06-search-and-rag-design.md) | 検索・RAG・埋め込み設計 |

### 40-infrastructure — インフラ

| ファイル | 内容 |
|---|---|
| [01-cloudflare-setup.md](40-infrastructure/01-cloudflare-setup.md) | Workers / R2 / KV / Queues / Access |
| [02-neon-setup.md](40-infrastructure/02-neon-setup.md) | **DB構成（ローカル PostgreSQL 16。Neon から移行済み・[ADR-0007](20-architecture/adr/ADR-0007-local-postgresql.md)）** |
| [03-dns-and-domain.md](40-infrastructure/03-dns-and-domain.md) | `ctiip` / `ctiip-mvp` サブドメインの設定 |
| [04-environments.md](40-infrastructure/04-environments.md) | 環境定義（現行構成と目標アーキテクチャ）とデータ方針 |
| [05-secrets-management.md](40-infrastructure/05-secrets-management.md) | シークレット管理方針 |

### 50-development — 開発

| ファイル | 内容 |
|---|---|
| [01-development-guide.md](50-development/01-development-guide.md) | 開発ガイド、モノレポ構成 |
| [02-coding-standards.md](50-development/02-coding-standards.md) | コーディング規約 |
| [03-branch-and-pr.md](50-development/03-branch-and-pr.md) | ブランチ戦略、PR運用 |
| [04-cicd-pipeline.md](50-development/04-cicd-pipeline.md) | GitHub Actions パイプライン |
| [05-local-setup.md](50-development/05-local-setup.md) | ローカル環境構築手順 |

### 60-quality — 品質

| ファイル | 内容 |
|---|---|
| [01-test-plan.md](60-quality/01-test-plan.md) | テスト計画 |
| [02-test-specification.md](60-quality/02-test-specification.md) | テスト仕様、観点 |
| [03-quality-gates.md](60-quality/03-quality-gates.md) | 品質ゲート、マージ条件 |
| [04-security-requirements.md](60-quality/04-security-requirements.md) | セキュリティ要件 |

### 70-operations — 運用

| ファイル | 内容 |
|---|---|
| [01-deployment-procedure.md](70-operations/01-deployment-procedure.md) | デプロイ手順 |
| [02-monitoring-and-alerting.md](70-operations/02-monitoring-and-alerting.md) | 監視・アラート |
| [03-backup-and-restore.md](70-operations/03-backup-and-restore.md) | バックアップ・復旧 |
| [04-incident-response.md](70-operations/04-incident-response.md) | 障害対応 |
| [05-runbook.md](70-operations/05-runbook.md) | 運用手順書（Runbook） |

### 80-migration — 移行

| ファイル | 内容 |
|---|---|
| [01-scout-migration-plan.md](80-migration/01-scout-migration-plan.md) | Civil-Research-Patent-Scout からの移管計画 |

### 90-project — プロジェクト管理

| ファイル | 内容 |
|---|---|
| [01-roadmap.md](90-project/01-roadmap.md) | ロードマップ |
| [02-wbs.md](90-project/02-wbs.md) | WBS |
| [03-risk-register.md](90-project/03-risk-register.md) | リスク登録簿 |
| [04-required-company-information.md](90-project/04-required-company-information.md) | **本番デプロイ前に会社から必要な情報の一覧** |
| [05-module-expansion-m26-m50.md](90-project/05-module-expansion-m26-m50.md) | **次期拡張モジュール計画（M26〜M50）。追加機能候補の正本** |

---

## 🔖 ドキュメント記法の約束

| 記法 | 意味 |
|---|---|
| `M01`〜`M25` | モジュールID（機能ブロック）。拡張候補 `M26`〜`M50` は [90-project/05](90-project/05-module-expansion-m26-m50.md) で定義 |
| `FR-M07-003` | 機能要件ID（モジュール別連番） |
| `NFR-P-001` | 非機能要件ID（P=性能, A=可用性, S=セキュリティ, O=運用, C=互換, U=ユーザビリティ） |
| `UC-05` | ユースケースID |
| `ADR-0003` | アーキテクチャ決定記録 |
| ⚠️ **要決定** | 未確定事項。決定者と期限を併記する |
| 🔒 **承認必要** | 実行前にユーザー承認が必要な作業（DNS・本番シークレット等） |

---

## ⚠️ 本ドキュメント群の位置づけ

- 本版は **設計原案 v0.1** であり、実装・インフラ構築は未実施です
- 数値目標・費用・SLA は **⚠️ 要決定** として空欄にしています。計測または見積の後に確定します
- 公開DNS変更、本番シークレット投入、custom domain の追加は 🔒 **承認必要** です。手順のみ記載し、実行はしていません
