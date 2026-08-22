# 土木技術・知財インテリジェンスプラットフォーム

**Civil Technology & IP Intelligence Platform（略称：CTIIP）**

> 現場のこまりごとに、世界の技術で答える。
> 特許・論文・NETIS・工法をひとつの場所に集め、AIが調べ、**人が決める**ためのしくみです。

| | |
|---|---|
| 🧪 お試し・プロトタイプ | **https://ctiip-mvp.mirai-dx-platform.com** ← まずはこちら（表示されるデータはサンプルです） |
| 🌐 本番 | **https://ctiip.mirai-dx-platform.com** ← 実際の業務で使う環境 |
| 📅 状態 | 設計中（v0.1）。まだ稼働していません |

---

## 📌 1. これは何のシステムですか

ひとことで言うと、

> **「世界のどこかにすでにある答え」を探して、うちの現場で使えるか見きわめるしくみ**です。

土木の現場では、毎日いろいろな困りごとが起きます。
軟弱地盤、狭い作業ヤード、逼迫する工期、人手不足。

その多くは、**世界のどこかで誰かがすでに解決していて**、
特許や論文、NETIS（国が登録した新技術）という形で公開されています。

でも、それを探すのは大変です。数が多すぎるし、文章が難しいからです。

**そこをAIに任せて、人は「使うかどうか」を決めることに集中しよう** —— というのがこのシステムです。

---

## 📌 2. 何ができるのですか

### 🔍 さがす

特許・論文・NETIS・自社の技術台帳を、**ひとつの検索窓**からまとめて探せます。
「港湾のケーソン据付を自動化したい」のように、**普通の日本語で書いて構いません**。
AIが検索の条件を組み立てます（組み立てた条件は画面に出るので、直せます）。

### 📖 わかる

特許の文章は独特で読みにくいものです。
このシステムは、**難しい文章をやさしい日本語に言い換え**、
どんな部品からできている技術なのかを分解して見せます。

### ⚖️ くらべる

他社の特許と自社のアイデアを、**部品ごとに一つずつ突き合わせ**て、
「同じ」「似ている」「違う」を表にします。

### 💡 考える

たくさんの特許を地図のように俯瞰して、**まだ誰もいない場所（ホワイトスペース）**を探します。
そこから新しい研究テーマや発明のタネが生まれます。

### 🏗️ つかう

現場の条件（地盤、海の状況、作業ヤードの広さ、工期、コスト、安全）を見て、
**「この現場で本当に使えるか」を点数と内訳**で示します。

---

## 📌 3. どんな流れで使うのですか

```text
① 現場で困りごとが起きる
        ↓
② システムに書き込む（スマホでOK・1分で終わります）
        ↓
③ AIが世界中の技術から候補を探してくる
        ↓
④ 現場条件に合うか点数が出る
        ↓
⑤ 安全・品質・環境の担当が「使ってよいか」を判断する
        ↓
⑥ 現場で使う
```

発明が生まれたときは、こちらの流れです。

```text
① 現場の工夫を書き込む
        ↓
② AIが整理して、似た特許がないか調べる
        ↓
③ AIが「出願したら、たぶんここを指摘される」を先に洗い出す
        ↓
④ 技術部門・知財部門が確認する
        ↓
⑤ 経営が出願するか決める
```

---

## 📌 4. 誰が使うのですか

| 部署 | このシステムで何をするか |
|---|---|
| 🏛️ **01 経営・統治・委員会** | 技術と知財の全体像を見て、投資・出願・維持を決める |
| 💼 **02 営業・案件形成** | 技術提案に使える自社技術・NETIS技術をすぐ見つける |
| 🚧 **03 施工・調達・作業所** | 現場の困りごとを書き込み、使える技術を受け取る／現場の工夫を発明として登録する |
| 🔬 **04 技術・研究開発** | 先行技術を調べ、発明を評価し、研究テーマを立てる（**このシステムの主管部署**） |
| 🦺 **05 安全・品質・環境** | 新技術を現場に入れてよいかを**判断する（止める権限を持つ）** |
| 🗂️ **06 管理本部・経営企画** | 権限・監査・費用を管理する（**システムの持ち主**） |
| 🏢 **07 支店・営業支店・営業所** | 地域の案件で使える技術を探し、地域のニーズを本社へ届ける |
| 🚢 **08 船舶事業部** | 作業船・船上装置の改良を技術情報と発明として蓄える |

---

## 📌 5. 大事な約束

このシステムには、**絶対に守ると決めたルール**が4つあります。

### ① AIは決めません

AIが出すのは「候補」「根拠」「リスクの目安」までです。
**出願するか、現場に入れるか、契約するかを決めるのは必ず人**です。
AIから直接「決定」に進む道は、システムの作りとして存在しません。

### ② 「似ている度」は、権利侵害の判断ではありません

AIが「他社特許と72%似ています」と言っても、
それは**「専門家が見るべき場所を絞るための目印」**であって、
**権利を侵害しているという判断ではありません**。
画面にはこの注記が常に出ていて、消すことはできません。

### ③ 答えには必ず「出どころ」が付きます

AIの回答は、どの特許の、どの請求項の、どの一文に基づいているのかを
**必ずたどれる**ようになっています。根拠のない回答は保存されません。

### ④ 契約や法律の判断は、このシステムではやりません

正式な法務審査、NDA、交渉、契約は、
別のシステム **`Construction-LegalOps-DX`** の担当です。
このシステムは「法務に相談する準備」までを受け持ちます。

---

## 📌 6. 2つのURLの違い

| | 🧪 MVP環境 | 🌐 本番環境 |
|---|---|---|
| URL | `ctiip-mvp.mirai-dx-platform.com` | `ctiip.mirai-dx-platform.com` |
| 何のため | 動きを見て、意見をもらうため | 実際の業務で使うため |
| データ | **サンプル（ダミー）が中心** | 本物のデータ |
| 気をつけること | **ここの数字で業務判断をしないでください** | 未公開の発明を扱うので、取り扱い注意 |
| 画面 | 「MVP環境 — サンプルデータ」の帯が常に出ます | 帯は出ません |

どちらも会社のIDでログインします（多要素認証が必要です）。

---

## 📌 7. よくある質問

**Q. 特許の知識がなくても使えますか**
使えます。難しい文章はAIがやさしく言い換えます。
ただし、**AIの説明だけで判断せず、迷ったら技術・知財部門に相談してください**。

**Q. 現場から入力するのは面倒ではありませんか**
必須の入力は「現場」と「困りごと（普通の文章）」だけです。写真も添付できます。
分類や整理はAI側が行います。**1分で終わることを設計目標にしています**。

**Q. 自分の書いた発明のアイデアは、他の人に見られませんか**
見られません。出願前の発明は最高レベルの機密として扱い、
**関係者以外には「存在すること自体」が見えない**ようにしています。

**Q. AIが間違えることはありませんか**
あります。だからこそ、すべての回答に根拠が付き、最後は人が決める作りにしています。
おかしいと思ったら、根拠の原文を開いて確かめてください。

**Q. 出てきた資料を社外に出してもよいですか**
機密の区分によって制限があります。
社外に出す資料は、**必ず技術部門の確認を経てください**。
AIの出力をそのままお客様向けの資料に貼ることは禁止しています。

---

## 📌 8. 資料はどこにありますか

| 知りたいこと | 資料 |
|---|---|
| 全体像をやさしく | [`platform-overview.html`](platform-overview.html)（図で説明） |
| 導入の企画・部署別の役割 | [`platform-proposal.html`](platform-proposal.html)（企画書） |
| 詳しい仕様・開発資料 | [`docs/`](docs/README.md)（索引つき） |
| 用語がわからない | [用語集](docs/00-overview/02-glossary.md) |
| 会社から提供が必要な情報 | [必要な会社情報の一覧](docs/90-project/04-required-company-information.md) |

---
---

# 🖥️ ここから先：ITシステム部門向け

> ここから下は技術情報です。運用・開発を担当される方が対象です。

## 🔧 9. アーキテクチャ概要

```text
利用者 → Cloudflare Access (SSO/MFA)
          ↓ JWT
        ctiip[-mvp].mirai-dx-platform.com
          ↓
        ctiip-web   (Next.js App Router on Cloudflare Workers)
          ↓ Service Binding
        ctiip-api   (Hono on Workers)  ※60秒超の処理を持たない
          ├→ Neon PostgreSQL 16+ (pgvector / pg_trgm)
          ├→ R2 (原文PDF・図面・帳票)
          ├→ Workers KV (設定・Rate Limit)
          └→ Queues → ingest / embed / ai / report / notify (Consumer Workers)
                        ↓
                      Cloudflare Workflows (agent-orchestrator / M21 の12段連鎖)
                        ↓
              Anthropic Claude API ／ Workers AI (埋め込み) ／ 外部データ源
```

詳細 → [システムアーキテクチャ](docs/20-architecture/01-system-architecture.md)

## 🔧 10. 技術スタック

| 層 | 採用 |
|---|---|
| 言語 / モノレポ | TypeScript / pnpm workspaces + Turborepo |
| フロント | Next.js（App Router）→ Cloudflare Workers（OpenNext アダプタ） |
| API | Hono on Workers、Zod による入出力検証、OpenAPI 3.1 自動生成 |
| ORM / DB | Drizzle ORM / Neon PostgreSQL（Pooler 経由） |
| 検索 | `pg_trgm`（字句）＋ `pgvector` HNSW（意味）を **RRF** で融合 |
| 非同期 | Cloudflare Queues（単発）／ Cloudflare Workflows（多段・永続） |
| ストレージ | R2（docs / reports / raw / backup）、Workers KV |
| 認証 | Cloudflare Access（SSO + MFA）→ アプリで JWT 検証 → RBAC + 行レベル制御 |
| AI | Anthropic Claude API（推論）／ Workers AI（埋め込み） |
| CI/CD | GitHub Actions + GitHub Environments（production は Required reviewers） |
| テスト | Vitest / Playwright |

詳細 → [技術選定](docs/20-architecture/02-technology-stack.md)

## 🔧 11. リポジトリ構成（計画）

```text
apps/       web (Next.js) / api (Hono)
workers/    ingest / embed / ai / report / notify / cron / orchestrator
packages/   db (Drizzle) / core (権限・分類・スコア) / ai (プロンプト・Provenance)
            search (trgm+vector+RRF) / ui (注記内蔵コンポーネント) / config
docs/       設計・運用ドキュメント一式
```

**依存の向き**: `apps` `workers` → `packages`。`packages/core` は DB・HTTP に依存しない（純粋関数）。

## 🔧 12. 環境

| 環境 | URL | Worker | Neon ブランチ | データ |
|---|---|---|---|---|
| local | `localhost:3000` | — | 個人ブランチ | ダミー |
| preview | Workers preview URL | `ctiip-*-pr{n}` | `pr-{n}` | ダミー |
| **MVP** | `ctiip-mvp.mirai-dx-platform.com` | `ctiip-*-mvp` | `mvp` | **ダミー中心**（C2以上の実データ禁止） |
| **本番** | `ctiip.mirai-dx-platform.com` | `ctiip-*-prod` | `main` | 実データ（ダミーは段階的にゼロ） |

昇格は `preview → MVP → 本番` の一方向。**MVP を経ずに本番へ出さない。**

詳細 → [環境定義](docs/40-infrastructure/04-environments.md) / [DNS](docs/40-infrastructure/03-dns-and-domain.md)

## 🔧 13. ローカル環境構築

```bash
git clone <repo-url> && cd Civil-Technology-IP-Intelligence-Platform
nvm use && corepack enable && pnpm install
cp .env.example .env.local && cp .dev.vars.example .dev.vars   # 実値は管理者から受領
pnpm db:migrate && pnpm db:seed
pnpm dev            # web:3000 / api:8787
```

ローカルは Access を経由しないため擬似認証を使う（`DEV_AUTH_ENABLED`）。
**本番ビルドに擬似認証を含めないこと**（CI で検証）。

詳細 → [ローカル環境構築](docs/50-development/05-local-setup.md)

## 🔧 14. 実装上の必須ルール（違反は CI で落ちます）

| # | ルール | 根拠 |
|---|---|---|
| 1 | 権限条件は **SQL の WHERE 句に含める**。取得後のアプリ側フィルタ禁止 | 件数・ファセットから機密が漏れる |
| 2 | 行レベル権限がない場合は **404**（403 ではない） | C3/C4 は「存在も見せない」 |
| 3 | AI 実行は必ず `ai_runs` + `ai_citations` を作る。0件なら `invalid` | [ADR-0006](docs/20-architecture/adr/ADR-0006-provenance-first.md) |
| 4 | 引用文は **原文から機械的に切り出す**。AI に生成させない | 存在しない文の引用を防ぐ |
| 5 | 60秒を超えうる処理を同期APIで実装しない | [ADR-0004](docs/20-architecture/adr/ADR-0004-async-ai-execution.md) |
| 6 | 類似度・スコアの注記は prop で無効化できない構造にする | FR-M06-020 / FR-M13-005 |
| 7 | ワークフローの AI ステップ直後に人ステップを必ず置く | 「AIは決めない」の担保 |
| 8 | `audit_logs` を UPDATE / DELETE しない（DB権限で剥奪済み） | 追記専用 |
| 9 | マイグレーションは加算のみ・後方互換のみ | 破壊的変更は複数リリースに分割 |
| 10 | シークレットをコード・ログ・PR に含めない | [シークレット管理](docs/40-infrastructure/05-secrets-management.md) |

詳細 → [コーディング規約](docs/50-development/02-coding-standards.md) / [詳細設計](docs/30-design/01-detailed-design.md)

## 🔧 15. CI/CD

```text
PR        → lint / typecheck / test / build / secret-scan / dep-audit
             + Neon ブランチ作成 → マイグレーション & ロールバック検証
             + preview デプロイ → E2E / 権限テスト / Provenance テスト
main      → MVP へ自動デプロイ
tag v*    → 🔒 Required reviewers 承認 → 本番マイグレーション → デプロイ → スモークテスト
PR close  → Neon ブランチ・preview Worker を自動削除
```

**高リスク変更**（DNS、本番シークレット、認証・認可モデル、破壊的マイグレーション、
外部公開範囲・保持期間・監査方式）は自動マージ対象外。専用PRに分離して明示承認を得る。

詳細 → [CI/CDパイプライン](docs/50-development/04-cicd-pipeline.md) / [品質ゲート](docs/60-quality/03-quality-gates.md)

## 🔧 16. 既知の技術的制約

| 制約 | 対応 | 参照 |
|---|---|---|
| **Neon に日本語形態素解析拡張（PGroonga / pg_bigm）が無い** | `pg_trgm` + `pgvector` の RRF ハイブリッド。Phase 1 で検索品質を実測し、達成できなければ外部検索エンジンを再検討 | [ADR-0003](docs/20-architecture/adr/ADR-0003-japanese-search.md) |
| Workers の CPU 時間・サブリクエスト上限 | 重い処理は Queues / Workflows へ分離 | [ADR-0004](docs/20-architecture/adr/ADR-0004-async-ai-execution.md) |
| 埋め込みの次元数がテーブル定義に固定される | Phase 1 でモデルを比較評価し、本格取り込み前に確定 | [検索・RAG設計](docs/30-design/06-search-and-rag-design.md) |
| サーバーレスの接続数 | Neon Pooler 必須。コネクションを保持しない | [Neon構成](docs/40-infrastructure/02-neon-setup.md) |
| 特許明細書が LLM のトークン上限を超える | 章単位に分割して処理し結果を統合 | [AIエージェント構成](docs/20-architecture/04-ai-agent-architecture.md) |
| エッジ実行と DB リージョンのレイテンシ | リージョン固定。N+1 を作らない | 同上 |

## 🔧 17. 運用

| 作業 | 参照 |
|---|---|
| デプロイ・ロールバック | [デプロイ手順](docs/70-operations/01-deployment-procedure.md) |
| 監視・アラート | [監視](docs/70-operations/02-monitoring-and-alerting.md) |
| バックアップ・復旧 | [バックアップ](docs/70-operations/03-backup-and-restore.md) |
| 障害対応 | [インシデント対応](docs/70-operations/04-incident-response.md) |
| 日常運用（権限付与・再実行・コスト確認） | [Runbook](docs/70-operations/05-runbook.md) |

**日次で必ず確認する3点**

```sql
-- 1. Provenance 充足率（根拠なしの成功実行は 0 件でなければならない）
SELECT count(*) FROM ai_runs r WHERE r.status='succeeded'
  AND NOT EXISTS (SELECT 1 FROM ai_citations c WHERE c.ai_run_id = r.id);
```
2. DLQ 件数（1件以上で調査）　3. AI トークン消費（月次予算比）

## 🔧 18. 本番稼働に必要な会社側情報

インフラのアカウント、IdP、規程、外部データ源の契約、マスタデータなど、
**社内から提供を受けないと本番を立ち上げられない情報**を一覧化しています。

→ **[必要な会社情報の一覧](docs/90-project/04-required-company-information.md)**

とくに次の3つが揃わないと着手できません。

| 情報 | 依頼先 | 無いとどうなるか |
|---|---|---|
| 外部データ源（特許・論文DB）の契約とAPI | 04 技術・研究開発 | 検索対象が自社データのみになり、価値の大半が失われる |
| IdP 情報（テナント・グループ・シークレット） | 06 管理本部 | 本番を公開できない（認証なしでの公開は行わない） |
| AI利用ポリシー・データ分類基準 | 06 管理本部 | AI機能を本番で使えない。権限設計が確定しない |

## 🔧 19. ドキュメント索引

→ **[docs/README.md](docs/README.md)**（49ファイル・読む順序つき）

| 種別 | 主要文書 |
|---|---|
| 要件 | [要件定義書](docs/10-requirements/01-requirements-definition.md) / [機能要件149件](docs/10-requirements/02-functional-requirements.md) / [非機能要件](docs/10-requirements/03-non-functional-requirements.md) |
| 設計 | [詳細設計仕様書](docs/30-design/01-detailed-design.md) / [DB設計（DDL）](docs/30-design/02-database-design.md) / [API仕様](docs/30-design/03-api-specification.md) |
| 判断 | [ADR 一覧](docs/20-architecture/adr/README.md) |
| 品質 | [テスト計画](docs/60-quality/01-test-plan.md) / [セキュリティ要件](docs/60-quality/04-security-requirements.md) |
| 移行 | [旧Scout 移管計画](docs/80-migration/01-scout-migration-plan.md) |
| 計画 | [ロードマップ](docs/90-project/01-roadmap.md) / [WBS](docs/90-project/02-wbs.md) / [リスク登録簿](docs/90-project/03-risk-register.md) |

---

*本 README は v0.1（設計中）です。実装の進捗に応じて更新します。*
