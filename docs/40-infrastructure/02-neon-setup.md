# 🐘 Neon 構成

## 1. プロジェクト構成

| 項目 | 値 |
|---|---|
| プロジェクト名 | `ctiip` |
| リージョン | ⚠️ **要決定** — Cloudflare のトラフィック元と近い地域を選ぶ。日本国内利用が中心のため東京圏を第一候補とする |
| PostgreSQL | 16 以上 |
| 接続 | Pooler 経由（サーバーレス実行のため必須） |

## 2. ブランチ運用

Neon のブランチ機能を、環境と PR 検証に用いる。

```text
main（本番）
 ├─ mvp          常設。結合・受入テスト用
 ├─ dev              常設。開発者共有
 └─ pr-{番号}        PR ごとに自動作成・自動削除
```

| ブランチ | 用途 | データ | 寿命 |
|---|---|---|---|
| `main` | 本番 | 本番データ | 恒久 |
| `mvp` | MVP・受入 | **ダミーデータ中心**（公開情報は少量可） | 恒久 |
| `dev` | 開発 | 合成データ | 恒久 |
| `pr-{n}` | PR検証 | `dev` からの分岐 | PR クローズで削除 |

**MUST**: 本番データを `mvp` / `dev` へそのままコピーしない。
MVP 環境は利用部署へ広く見せるため、**C2 以上の実データを置かない**。ダミーデータで代替する。
公開情報（C1）のみ、少量に限り投入してよい。

⚠️ **要決定** — ダミーデータ生成スクリプトの仕様。Phase 1 で作成する。
匿名化ではなく **合成（ダミー生成）** を原則とする。匿名化は現場名・技術名から実案件が推測される危険が残るため。

## 3. 拡張

```sql
CREATE EXTENSION IF NOT EXISTS vector;     -- 意味検索
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- 日本語字句検索（ADR-0003）
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- UUID・ハッシュ
CREATE EXTENSION IF NOT EXISTS unaccent;   -- 正規化補助
```

⚠️ 各拡張が対象プロジェクトで利用可能であることを、Phase 1 の最初に**実際に確認する**。
利用できない拡張があれば ADR-0003 の再評価を直ちに行う。

## 4. ロールと権限

| ロール | 用途 | 権限 |
|---|---|---|
| `ctiip_owner` | マイグレーション実行 | DDL 含む全権 |
| `ctiip_app` | アプリケーション | DML のみ。`audit_logs` は INSERT/SELECT のみ |
| `ctiip_readonly` | 分析・調査 | SELECT のみ |

```sql
-- 監査ログの追記専用を DB レベルで強制する
REVOKE UPDATE, DELETE ON audit_logs FROM ctiip_app;
GRANT INSERT, SELECT ON audit_logs TO ctiip_app;
```

**MUST**: アプリは `ctiip_app` で接続する。`ctiip_owner` の接続文字列を Worker に持たせない。

## 5. 接続設定

```text
DATABASE_URL          = postgresql://ctiip_app:***@<pooler-host>/ctiip?sslmode=require
DATABASE_URL_DIRECT   = postgresql://ctiip_owner:***@<direct-host>/ctiip?sslmode=require   # マイグレーション用
```

| 項目 | 方針 |
|---|---|
| Pooler | アプリからの接続は必ず Pooler 経由 |
| 直結 | マイグレーションのみ直結を使う（CI から実行） |
| SSL | `sslmode=require` を必須 |
| タイムアウト | ステートメントタイムアウトを設定（⚠️ 値は要決定） |
| 保持 | Worker はコネクションを保持しない |

## 6. バックアップ・復旧

| 項目 | 方針 |
|---|---|
| PITR | Neon の Point-in-Time Recovery を利用。保持期間は ⚠️ 要決定 |
| 論理バックアップ | 日次で `pg_dump` を取得し、R2 の `ctiip-backup` へ保管 |
| 復旧手順 | [../70-operations/03-backup-and-restore.md](../70-operations/03-backup-and-restore.md) |
| 訓練 | 半期ごとに復旧訓練を実施し、RTO を実測する |

## 7. 性能・容量

| 項目 | 方針 |
|---|---|
| プラン | ⚠️ **要決定** — Phase 1 の実測（容量・接続数・CPU）後に確定 |
| 自動停止 | 本番では無効化する（コールドスタートを避ける）。dev は有効でよい |
| 監視 | 容量、接続数、遅いクエリ、索引サイズ |
| 索引サイズ | trgm 索引が大きくなりやすい。Phase 1 で実測し、対象列を絞る判断を行う |

## 8. マイグレーション運用

```text
PR 作成
  → GitHub Actions が Neon ブランチ pr-{n} を作成
  → マイグレーションを適用
  → テスト実行
  → ロールバック手順も適用して検証
PR マージ
  → mvp へ適用 → 受入
  → 本番へ適用（デプロイ手順に組み込む）
PR クローズ
  → Neon ブランチを削除
```

**原則**（[DB設計 §6](../30-design/02-database-design.md)）

- 加算のみ・後方互換のみ
- 列削除・型変更は複数リリースに分割する
- データ削除を伴う変更は 🔒 承認必要

## 9. 注意事項

| 項目 | 内容 |
|---|---|
| リージョンとレイテンシ | Worker はエッジで動くが DB は単一リージョン。往復回数の多い実装を避ける（N+1 を作らない） |
| 接続数 | サーバーレスでは接続が急増しうる。必ず Pooler を使う |
| 長時間トランザクション | 避ける。バッチは小さく分割してコミットする |
| ベクトル索引の再構築 | 大量投入後に索引を作る方が速い場合がある。初期取り込み時の手順を用意する |
| ブランチのコスト | PR ブランチを放置しない。クローズ時に必ず削除する |
