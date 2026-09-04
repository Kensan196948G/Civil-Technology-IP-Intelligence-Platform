# ADR-0007 主DBをローカル PostgreSQL に移行する（Neon を廃止）

| 項目 | 値 |
|---|---|
| 状態 | **採択**（実行基盤への適用は 2026-08-29 に実施済み。文書反映 2026-09-04） |
| 対象 | ADR-0001 の「DB = Neon」部分を更新 |
| 関連 | コミット `2bf88d1`（ローカルPostgreSQL対応）、`docs/40-infrastructure/02-neon-setup.md` 改題 |

## 文脈

- 本システムは v0.1 設計で「実行基盤 Cloudflare（Workers/Pages）＋ DB Neon PostgreSQL」を前提としていた（ADR-0001）。
- しかし実際の MVP・本番運用は、**単一の Next.js アプリ（Node.js ランタイム）を自社ホスト上で起動し、
  Cloudflare Tunnel で公開する構成**に移行した（`2bf88d1` で Edge Runtime 依存を排除し、
  `postgres.js`（TCPドライバ）によるローカル PostgreSQL 接続を復元）。
- `ctip.mirai-dx-platform.com`（本番）と `ctiip-mvp.mirai-dx-platform.com`（MVP）はどちらも
  ホスト上の PostgreSQL 16（`127.0.0.1:5432`）へ接続しており、Neon は使用していない。

## 決定

1. **主DBを自社ホスト上のローカル PostgreSQL 16 とする**。
   - 接続先: `postgresql://ctip_app:***@127.0.0.1:5432/civil_tech_ip_intelligence`
   - アプリは `ctip_app`（DML のみ・`audit_logs` は追記専用）で接続する。
2. **Neon（PITR・Pooler・ブランチ）は廃止する**。Neon ブランチによる PR 検証・
   preview デプロイは運用しない。
3. DB ドライバは両対応を維持する: `client.ts` が Neon URL（HTTP ドライバ）と
   それ以外（TCP ドライバ）を自動選択する。将来 Cloudflare 上で動かす場合もコード変更なしで
   Neon HTTP ドライバに切替可能。
4. バックアップ・復旧はローカル PostgreSQL 前提へ読み替える（日次 `pg_dump`。RPO 値は ⚠️ 要決定）。

## 理由

- Neon はサーバーレス構成（Workers 実行）向け。現行は Node.js ランタイムでの自社ホスト運用のため
  サーバーレスDBの便益（自動停止・Pooler）が不要になった。
- 社内ネットワーク・Tunnel 構成で同一ホストの PostgreSQL に接続する方が
  レイテンシ・管理・コストの面で単純。
- 既に同ホストの PostgreSQL 16 で他プロジェクト（PWSM 等）を運用しており、運用ノウハウを共有できる。

## 結果（良い点）

- 外部DB（Neon）への依存と費用を排除。
- ローカルで `pnpm dev` しても同じ構成で動作する。
- `pg_dump`・`psql` など標準ツールで運用できる。

## 結果（悪い点・注意点）

- DB は単一ホスト稼働のため、そのホストが落ちるとアプリも停止する（可用性は Tunnel を含め本番設計の再定義が必要）。
- Neon PITR のような時点復旧は使えない。バックアップ方針（頻度・保管先・RPO/RTO）は未確定（⚠️ 要決定）。
- `next-on-pages`（CF Pages 変換）は非静的ルートに Edge Runtime を要求するため、現行 Node 構成とは両立しない
  （CI の当該検証ステップの扱いは別途要決定＝拡張計画書 D-5）。

## 代替案

| 案 | 内容 | 判断 |
|---|---|---|
| Neon 継続 | Cloudflare Workers 上で動かし続ける | 実行基盤の Node 化と矛盾するため不採用 |
| Docker の PostgreSQL | コンテナで DB を立てる | 同ホストの PostgreSQL 16 で十分なため不採用（任意可） |
| Cloudflare D1 | SQLite 系。本スキーマ（拡張・JSONB・vector）と不整合 | 不採用 |

## 再評価条件

- 複数ホスト・複数リージョンでの本番運用が必要になったとき。
- バックアップ目標（RPO/RTO）をローカル PostgreSQL の運用で満たせないことが判明したとき。

## 既存文書の読替え

本ADRは ADR-0001 の DB 部分を更新する。以下の文書中、Neon を現行運用として記述する箇所は
**移行前（v0.1 設計）の記述**として読み替える。

- `README.md`（技術スタック・環境表・CI/CD 説明）
- `docs/00-overview/01-project-charter.md`・`02-glossary.md`
- `docs/40-infrastructure/02-neon-setup.md`（本ファイル改題: DB構成 — ローカルPostgreSQL移行済み）
- `docs/40-infrastructure/04-environments.md`（preview/Workers 中心の記述は目標アーキテクチャ）
- `docs/50-development/04-cicd-pipeline.md`・`05-local-setup.md`
- `docs/70-operations/01-deployment-procedure.md`・`03-backup-and-restore.md` ほか
