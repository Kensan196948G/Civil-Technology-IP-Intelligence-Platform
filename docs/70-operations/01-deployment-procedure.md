# 🚀 デプロイ手順

> 🔒 本番デプロイは承認事項。本書は手順を定義する。

## 0-A. 現行構成（自社ホスト Node.js + Cloudflare Tunnel）のデプロイ手順【2026-09-10 追記】

> **背景（Deep Debug 2026-09-10 で特定）**: ADR-0007（2026-08-29 採択）で本番・MVP は
> **自社ホスト上の Next.js（Node.js）＋ Cloudflare Tunnel** に移行したが、その後
> 「`origin/main` にマージされたコードを本番へ反映する手順」がリポジトリ内に存在しなかった。
> `.github/workflows/deploy-production.yml` は Cloudflare Pages（`next-on-pages`）経路のままで、
> 現行構成とは不整合（拡張計画書 D-5）。結果として本番稼働中のチェックアウトは
> **コミット `2bf88d1`（2026-08-29）に固定されたまま 47 コミット取り残され**、
> さらに git 未コミットの手動修正が本番にのみ存在する状態だった。
> 以降の節（§1〜§5）は **目標アーキテクチャ（Cloudflare Workers / Neon）向け** の記述であり、
> **現行構成のデプロイには §0-A を使う**。

### 対象

| 環境 | ホスト名 | 実行 | Tunnel |
|---|---|---|---|
| 本番 | **`ctip.mirai-dx-platform.com`**（i は1つ。`ctiip.` は DNS 未作成で解決不可） | `ctip-web.service`（`next start -p 18940`） | `ctip-web-cloudflared.service` |
| MVP | `ctiip-mvp.mirai-dx-platform.com` | `ctiip-mvp-web.service`（`next start -p 3001`、専用チェックアウト） | `ctiip-mvp-cloudflared.service` |

> **デプロイ先は本番と MVP で別チェックアウト**（2026-09-10 に分離）。
> 同一 `.next` を共有すると、片方をビルドした時点で他方の実行中プロセスと不整合になり
> 静的チャンクが 404/500 になる（実測済み）。
>
> - 本番: `/home/kensan/Projects/Mirai-Admin-Platform/Civil-Technology-IP-Intelligence-Platform`
> - MVP : `/home/kensan/Projects/Mirai-Admin-Platform/ctiip-mvp-deploy`

- デプロイ先チェックアウト:
  - 本番: `/home/kensan/Projects/Mirai-Admin-Platform/Civil-Technology-IP-Intelligence-Platform`
    （`ctip-web.service` の `WorkingDirectory`。**systemd の system unit が固定しているため、
    別チェックアウトへ移すには unit の変更（要 root）が必要**）
  - MVP : `/home/kensan/Projects/Mirai-Admin-Platform/ctiip-mvp-deploy`
- 接続情報: `<deploy-dir>/apps/web/.env.local`（git 管理外）
  - 本番 → `civil_tech_ip_intelligence`
  - MVP  → `civil_tech_ip_intelligence_mvp`（**2026-09-10 に分離済み**）

### 手順

```bash
DEPLOY_DIR=/home/kensan/Projects/Mirai-Admin-Platform/Civil-Technology-IP-Intelligence-Platform
cd "$DEPLOY_DIR"

# ① 取得と対象コミット確定（main にマージ済みのコミットのみ）
git fetch --prune origin
TARGET_SHA=$(git rev-parse origin/main)
git merge-base --is-ancestor "$TARGET_SHA" origin/main   # 常に真（記録用）

# ② ローカル変更の退避（稼働中チェックアウトに手動修正が残っている場合がある）
git diff HEAD > "$HOME/ctiip-deploy-$(date +%Y%m%dT%H%M%S).patch"

# ③ 反映
git checkout --detach "$TARGET_SHA"
pnpm install --frozen-lockfile

# ④ マイグレーション（ddl.sql は全て IF NOT EXISTS の加算のみ）
set -a; . apps/web/.env.local; set +a
pnpm --filter @ctiip/web db:migrate

# ⑤ ビルド（動作中コミットを /api/health から確認できるよう埋め込む）
CTIIP_COMMIT_SHA="$TARGET_SHA" pnpm --filter @ctiip/web build

# ⑥ 再起動
systemctl restart ctip-web.service            # 本番
# systemctl --user restart ctiip-mvp-web.service   # MVP

# ⑦ スモークテスト（version が対象コミットと一致することまで確認する）
curl -fsS https://ctip.mirai-dx-platform.com/api/health
```

### 一度だけ必要な事前準備（DB作成直後）

`vector`(pgvector) は PostgreSQL の **trusted extension ではない** ため、スーパーユーザー権限が
必要になる。アプリの接続ロール（`ctip_app`）では導入できない。

```bash
# スーパーユーザーで実行（DB作成直後に1回だけ）
psql "$SUPERUSER_DATABASE_URL" -v ON_ERROR_STOP=1 -f apps/web/src/lib/db/extensions.sql
# または  DATABASE_URL=<superuser> pnpm --filter @ctiip/web db:bootstrap
```

> **2026-09-10 以前の状態**: この事前準備が手順化されていなかったため `db:migrate` は必ず
> `permission denied to create extension "vector"` で失敗していた。しかも postgres.js は
> `ddl.sql` 全体を1つの simple query として送るため PostgreSQL 側で暗黙の単一トランザクションになり、
> **先行して成功した `CREATE TABLE` まで全てロールバック**されていた。
> 結果、本番DBは **63テーブル中34テーブルしか持たず**（29テーブル欠落）、
> `pg_trgm` / `vector` 拡張も未導入のまま稼働していた。
> 現在は `db:migrate` が事前に拡張の有無を検査し、不足時は「何をすればよいか」を示して
> 即座に失敗する（DBは変更しない）。

### ロールバック

```bash
cd "$DEPLOY_DIR"
git checkout --detach <直前のコミット>
pnpm install --frozen-lockfile
CTIIP_COMMIT_SHA=<直前のコミット> pnpm --filter @ctiip/web build
systemctl restart ctip-web.service
curl -fsS https://ctip.mirai-dx-platform.com/api/health   # version 一致を確認
```

- マイグレーションは加算のみのため、**原則としてスキーマは戻さない**。
- ロールバック後の自動再デプロイを無制限に繰り返さない。原因が特定できるまで再デプロイしない。

### 既知の未決事項

- `.github/workflows/deploy-production.yml` は Cloudflare Pages 経路のままで、実行しても
  `pnpm cf:build`（`next-on-pages`）の時点で失敗する。**現行構成のデプロイ経路ではない**（D-5）。
  上記手順の CI 自動化は未実施（要決定）。
- local・MVP・本番が同一 DB `civil_tech_ip_intelligence` を共有している（§1 の #12 MUST に違反）。
  実データ投入前に分離が必要。

## 0. 事前に揃える情報

本番デプロイには、会社側から提供を受ける情報が多数必要である。
**[必要な会社情報の一覧](../90-project/04-required-company-information.md)** のチェックリストがすべて埋まっていることを、
本手順に着手する前に確認すること。

## 1. 前提確認（本番デプロイ前）

| # | 確認項目 | 確認方法 |
|---|---|---|
| 1 | 対象アカウント・環境・DB・ドメインを一意に特定できている | 設定値の突合 |
| 2 | デプロイ対象の commit hash | タグと `git rev-parse` |
| 3 | タグが `main` の祖先である | `git merge-base --is-ancestor` |
| 4 | CI・テスト・セキュリティ検査が成功している | Actions の結果 |
| 5 | マイグレーションとロールバックを検証済み | preview / mvp の結果 |
| 6 | バックアップまたは復旧地点がある | Neon PITR / 論理バックアップ |
| 7 | シークレットの混入がない | 秘密スキャンの結果 |
| 8 | 本番と検証環境が分離されている | 設定値の確認 |
| 9 | 既存利用者・データへの影響を評価済み | PR の影響範囲欄 |
| 10 | 🔒 承認を得ている | GitHub Environments の承認記録 |
| 11 | 会社情報チェックリストの 🔴 必須項目がすべて揃っている | [必要な会社情報の一覧](../90-project/04-required-company-information.md) §13.1 |
| 12 | **MVP 環境が本番DBを参照していない** | 接続先設定の目視確認 |

## 2. 手順

```text
① タグ作成
   git tag -a v0.1.0 -m "..."
   git push origin v0.1.0

② GitHub Actions deploy-production.yml が起動
   → environment: production の承認待ちで停止

③ 🔒 承認（Required reviewers）

④ マイグレーション適用（加算のみ・後方互換のみ）

⑤ Worker デプロイ（web / api / consumers / orchestrator / cron）

⑥ スモークテスト（§3）

⑦ 監視の確認（エラー率・応答時間・ジョブ滞留）

⑧ リリースノート作成
```

## 3. スモークテスト

```bash
BASE=https://ctiip.mirai-dx-platform.com

# 1. ヘルスチェック
curl -fsS $BASE/healthz

# 2. 認証が効いている（未認証で 302 または 403）
curl -sI $BASE/ | head -n 1

# 3. バージョン確認
curl -fsS $BASE/api/v1/version   # commit hash が期待どおりか
```

| # | 項目 | 期待 |
|---|---|---|
| 1 | ヘルスチェック | 200（`db` が `ok`、`version` が対象コミットと一致） |
| 2 | 未認証アクセス | リダイレクトまたは拒否 |
| 3 | バージョン | デプロイした commit hash と一致 |
| 4 | ログイン | 認証を経て画面が表示される |
| 5 | 横断検索 | 結果が返る |
| 6 | 特許詳細 | 表示され、根拠リンクが機能する |
| 7 | 非同期ジョブ | 起票され、完了する |
| 8 | 権限 | 権限のないモジュールが表示されない |
| 9 | 監査ログ | 上記操作が記録されている |
| 10 | エラー率 | 平常水準 |

> ⚠️ **現行実装との対応（2026-09-10）**: 上記 `$BASE=/healthz`・`/api/v1/version` は
> **目標アーキテクチャ（Cloudflare Workers）向けの記述**で、現行実装には存在しない。
> 現行のヘルスチェックは **`GET /api/health`** で、`{ status, env, version, db, time }` を返す
> （`version` はビルド時に埋め込んだ commit hash。`db` は `select 1` による疎通結果で、
> 失敗時は 503 + `status:"degraded"`）。現行構成の手順は §0-A を参照。


**MUST**: 4〜9 は実際に画面から確認する。API の 200 応答だけで完了としない。

## 4. ロールバック

### 4.1 判断基準

次のいずれかで直ちにロールバックする。

| # | 状況 |
|---|---|
| 1 | 認証・認可が正しく機能していない |
| 2 | 機密情報が権限のない利用者に見えている |
| 3 | データ破損の兆候がある |
| 4 | エラー率が閾値を大きく超えている |
| 5 | 主要機能が使用不能 |

### 4.2 手順

```text
① 直前バージョンの commit hash を特定
② Worker をロールバック
     wrangler rollback --name ctiip-api-prod
     （または直前タグから再デプロイ）
③ マイグレーションの扱い
     加算のみのため、原則としてスキーマは戻さない
     戻す必要がある場合は事前検証済みのロールバックSQLを適用
④ スモークテスト
⑤ 監視で回復を確認
⑥ 影響範囲・原因・再開条件を報告
```

**MUST**:
- ロールバック後の自動再デプロイを無制限に繰り返さない
- 原因が特定できるまで再デプロイしない

## 5. マイグレーションの安全な進め方

破壊的変更は複数リリースに分割する。

```text
リリース1: 新しい列を追加（NULL 許容）
リリース2: 新旧両方へ書き込むコードをデプロイ
リリース3: 既存データを移行
リリース4: 読み取りを新列へ切り替え
リリース5: 旧列への書き込みを停止
リリース6: 🔒 承認のうえ旧列を削除
```

**MUST**: 1回のリリースで「列追加 → 移行 → 旧列削除」を行わない。

## 6. 緊急デプロイ

セキュリティ上の重大な問題など、通常手順を短縮する場合。

| # | 手順 |
|---|---|
| 1 | 影響範囲と緊急性を記録する |
| 2 | 🔒 承認を得る（口頭でも記録を残す） |
| 3 | 最小限の修正のみを含める |
| 4 | CI の必須チェックは**省略しない** |
| 5 | デプロイ後、通常より広くスモークテストを行う |
| 6 | 事後に経緯・原因・再発防止を文書化する |

**MUST**: 緊急であっても、テストと承認を飛ばさない。

## 7. デプロイ後の記録

| 項目 | 記録先 |
|---|---|
| バージョン・commit hash | リリースノート |
| デプロイ日時・実施者・承認者 | リリースノート |
| マイグレーション内容 | リリースノート |
| スモークテスト結果 | リリースノート |
| 既知の問題 | Issue |
