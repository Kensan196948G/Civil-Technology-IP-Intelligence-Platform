# 🧪 環境定義

> **現状（2026-08-29 移行）**: 本番・MVP は Cloudflare Workers ではなく
> **自社ホスト上の Next.js（Node.js）＋ Cloudflare Tunnel** で運用しており、DB は**ローカル PostgreSQL 16**
> （[ADR-0007](../20-architecture/adr/ADR-0007-local-postgresql.md)）です。
> 下表 §1 以降の Workers／Neon ブランチの記述は **目標アーキテクチャ（本番設計）** のもので、
> preview（PR ごとの自動環境）は現行では運用していません。

## 0. 現行の実行構成（2026-09-04）

| 環境 | URL | 実行プロセス | DB（ローカル PostgreSQL） | データ |
|---|---|---|---|---|
| local | `http://localhost:3000` | `pnpm dev` | 開発用 DB（各自） | ダミー |
| **MVP** | `https://ctiip-mvp.mirai-dx-platform.com` 🔒 | `ctiip-mvp-adhoc.service`（`next start -p 3001`） | `civil_tech_ip_intelligence` | **ダミー中心**（C2以上禁止） |
| **本番** | `https://ctiip.mirai-dx-platform.com` 🔒 | `ctip-web.service`（`next start -p 18940`） | `civil_tech_ip_intelligence` | 実データ（初期はダミー併存） |

公開は Cloudflare Tunnel（`ctip-web-cloudflared.service` ほか）による。昇格は `local → MVP → 本番` の一方向。

## 1. 一覧（目標アーキテクチャ）

| 環境 | URL | Worker 名 | Neon ブランチ | データ | 用途 |
|---|---|---|---|---|---|
| local | `http://localhost:3000` | — | 個人ブランチ | ダミーのみ | 開発者ローカル |
| preview | Workers preview URL（PRごと） | `ctiip-*-pr{n}` | `pr-{n}` | ダミーのみ | PR 検証 |
| **MVP** | `https://ctiip-mvp.mirai-dx-platform.com` 🔒 | `ctiip-*-mvp` | `mvp` | **ダミー中心** | プロトタイプ・機能検証・利用者への提示 |
| **本番** | `https://ctiip.mirai-dx-platform.com` 🔒 | `ctiip-*-prod` | `main` | **実データ**（初期はダミー併存、最終的にダミーゼロ） | 本番運用 |

## 2. MVP 環境の位置づけ

MVP 環境は「動くものを早く見せ、要件を確かめる」ための環境である。

| 項目 | 方針 |
|---|---|
| 目的 | プロトタイプの提示、利用部署による操作確認、機能検証、受入テスト |
| データ | **ダミーデータを積極的に使う**。実データが揃っていなくても画面と業務フローを確認できる状態を優先する |
| 実データ | 公開情報（C1：公開特許・論文・NETIS）は少量なら投入可 |
| 禁止 | **社内機密（C2）・未公開発明（C3）・最高機密（C4）の実データを置かない** |
| 認証 | 本番と同じ Cloudflare Access（SSO + MFA）。ダミー環境でも認証は緩めない |
| 位置づけ | 本番へ昇格する前の必須の通過点。ここを経ずに本番へ出さない |

**MUST**: MVP 環境のダミーデータには、画面上で **ダミーであることが分かる表示** を出す
（例：ヘッダに「MVP環境 — 表示されているデータはサンプルです」の常時バナー）。
実データと見分けがつかない状態で意思決定に使われることを防ぐ。

## 3. 本番環境のデータ方針

```text
Phase 1 立ち上げ直後   ダミー多め ＋ 公開データ取り込み開始
        ↓
Phase 1 完了           公開データ（特許・論文・NETIS）が実データに置き換わる
        ↓
Phase 2               社内技術台帳・現場・発明が実データで入り始める
        ↓
Phase 3 以降           ダミーデータ ゼロ
```

| 段階 | ダミーの扱い |
|---|---|
| 立ち上げ期 | 画面確認のためダミーを残してよい。ただし **ダミーである旨のラベルを必ず付ける** |
| 移行期 | ダミーと実データが混在。一覧・検索結果でダミーを識別できること |
| 完成期 | **ダミーをすべて削除する**。削除の完了を受入条件とする |

**MUST**: 本番のダミーデータには `is_sample = true` に相当する識別を持たせ、
一括削除できるようにする。識別できないダミーを本番へ入れない。

⚠️ **要決定** — ダミー識別の実装方式（列で持つか、専用プロジェクトに隔離するか）。Phase 1 で確定する。

## 4. 環境ごとの差異

| 項目 | local | preview | MVP | 本番 |
|---|---|---|---|---|
| URL | localhost | preview URL | `ctiip-mvp.…` | `ctiip.…` |
| ダミーデータ | 全面 | 全面 | **中心** | 段階的に削減 → ゼロ |
| 実データ（C1 公開） | なし | なし | 少量可 | あり |
| 実データ（C2〜C4） | **禁止** | **禁止** | **禁止** | あり |
| 外部データ源 | モック | モック | 限定的に実接続 | 実接続 |
| AIプロバイダ | 実接続（低コスト） | 実接続（上限付き） | 実接続（上限付き） | 実接続 |
| Cron | 無効 | 無効 | 有効（頻度を落とす） | 有効 |
| Access（SSO/MFA） | 擬似認証 | 有効 | **有効** | 有効 |
| サンプル表示バナー | 表示 | 表示 | **表示** | ダミー残存中のみ表示 |
| ログ | 詳細 | 詳細 | 標準 | 標準（機密を出さない） |
| Neon 自動停止 | 有効 | 有効 | 有効 | **無効** |
| デプロイ | 手動 | PR で自動 | main マージで自動 | タグ + 🔒 手動承認 |

## 5. 本番データの取り扱い

**MUST**: 本番データを下位環境へそのままコピーしない。

| 分類 | MVP への持ち込み |
|---|---|
| C1 公開 | 可（少量） |
| C2 社内 | **不可**。ダミーで代替 |
| C3 機密 | **不可** |
| C4 最高機密 | **不可** |

理由: MVP 環境は利用部署へ広く見せる環境であり、閲覧者の範囲が本番より広くなりやすい。
匿名化しても、現場名・技術名から実案件が推測できる場合がある。
**「MVP には実業務データを置かない」を単純明快な規則とする。**

## 6. 環境変数・シークレット

| 種別 | local | preview / MVP / 本番 |
|---|---|---|
| 通常変数 | `.env.local`（コミットしない） | `wrangler.jsonc` の `vars` |
| シークレット | `.dev.vars`（コミットしない） | `wrangler secret put` / GitHub Environments |

詳細は [05-secrets-management.md](05-secrets-management.md)。

## 7. 命名規則

```text
Worker      : ctiip-{role}-{env}        例 ctiip-api-mvp / ctiip-api-prod
Queue       : ctiip-{purpose}-{env}     例 ctiip-ingest-mvp
R2 バケット : ctiip-{purpose}-{env}     例 ctiip-docs-prod
KV          : ctiip-{purpose}-{env}
Neon ブランチ: main（本番） / mvp / dev / pr-{番号}
```

⚠️ 環境名を含めないリソース名を作らない。取り違えによる本番事故を防ぐ。

## 8. 昇格フロー

```text
feature ブランチ
   ↓ PR 作成
preview（自動デプロイ + Neon pr ブランチ）
   ↓ レビュー・品質ゲート通過 → マージ
MVP（ctiip-mvp.mirai-dx-platform.com へ自動デプロイ）
   ↓ 利用部署による確認・受入テスト
本番（ctiip.mirai-dx-platform.com、タグ作成 + 🔒 手動承認）
```

**MUST**: MVP を経ずに本番へデプロイしない。

## 9. 環境の破棄

| 環境 | 破棄条件 |
|---|---|
| preview | PR クローズ時に Worker と Neon ブランチを自動削除 |
| local | 各自 |
| MVP | 恒久。データは定期的に洗い替え（ダミーの再投入） |
| 本番 | 破棄しない |

**MUST**: preview 環境の削除漏れを週次で確認する（コストと機密の残存を防ぐ）。
