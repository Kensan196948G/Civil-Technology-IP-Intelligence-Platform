# 🏗️ 詳細設計仕様書 — CTIIP

| 項目 | 値 |
|---|---|
| 文書名 | 土木技術・知財インテリジェンスプラットフォーム 詳細設計仕様書 |
| 版 | v0.1（原案） |
| 作成日 | 2026-08-22 |
| 上位文書 | [要件定義書](../10-requirements/01-requirements-definition.md) / [システムアーキテクチャ](../20-architecture/01-system-architecture.md) |
| 下位文書 | [DB設計](02-database-design.md) / [API仕様](03-api-specification.md) / [画面設計](04-screen-design.md) / [ジョブ設計](05-batch-and-jobs.md) / [検索・RAG設計](06-search-and-rag-design.md) |

---

## 1. 本書の範囲

CTIIP の内部構造を、実装可能な粒度で定義する。
DDL・API パス・画面遷移・ジョブ定義は各下位文書に分割し、本書はそれらを束ねる設計方針と、
モジュール横断の共通機構（権限判定、Provenance、スコア算出、ワークフロー）を定義する。

---

## 2. レイヤ構成

```text
┌──────────────────────────────────────────────┐
│ apps/web        画面（Next.js）                │
│   - 表示・入力・権限に応じたUI制御              │
├──────────────────────────────────────────────┤
│ apps/api        REST API（Hono）               │
│   - 認証検証 → 認可 → 入力検証 → ユースケース   │
├──────────────────────────────────────────────┤
│ packages/core   ドメインロジック                │
│   - 権限判定 / 分類 / スコア算出 / 遷移規則      │
├──────────────────────────────────────────────┤
│ packages/search ハイブリッド検索                │
│ packages/ai     プロンプト・モデル抽象・引用付与  │
├──────────────────────────────────────────────┤
│ packages/db     Drizzle スキーマ・クエリ         │
├──────────────────────────────────────────────┤
│ Neon PostgreSQL / R2 / KV / Queues / Workflows │
└──────────────────────────────────────────────┘
```

**依存の向き**: 上から下への一方向のみ。`packages/core` は DB・HTTP に依存しない（テスト可能に保つ）。

---

## 3. 共通機構

### 3.1 認可（Authorization）

すべての API 呼び出しは次の順で判定する。省略できるパスを作らない。

```text
① Access JWT 検証        → 利用者を特定（失敗は 401）
② ロール取得             → user_roles
③ 機能権限判定           → RBAC マトリクス（失敗は 403）
④ 行レベル判定           → プロジェクト参加 + 機密区分（失敗は 404 を返す）
⑤ 実行                   
⑥ 監査ログ記録           → 成功・失敗・拒否のすべて
```

**重要**: ④で権限がない場合、**403 ではなく 404 を返す**。
C3/C4 のレコードは「存在すら知らせない」（FR-M25-004、NFR-S-005）。

```ts
// packages/core/authz.ts の契約（擬似コード）
type AccessContext = {
  userId: string
  roles: Role[]
  projectIds: string[]     // 参加プロジェクト
  grants: ResourceGrant[]  // C4 の個別付与
}

function canRead(ctx: AccessContext, res: Resource): 'allow' | 'deny_404' | 'deny_403'
function canWrite(ctx: AccessContext, res: Resource): ...
function canExport(ctx: AccessContext, res: Resource): ...
function canSendToAI(ctx: AccessContext, res: Resource): boolean  // 機密区分で判定
```

**検索での適用**: 検索クエリの WHERE 句に権限条件を必ず含める。
アプリ側で取得後にフィルタする実装を禁止する（件数が漏れるため）。

### 3.2 Provenance（根拠の保持）

すべての AI 実行は次の構造を必ず生成する。

```text
ai_runs（1件）
  ├ model / prompt_version / params / input_hash / token_usage / duration_ms
  └ ai_citations（1件以上・必須）
       ├ source_type   patent | paper | netis | technology | document | invention
       ├ source_id
       ├ locator       { claim_no?, paragraph?, char_start?, char_end? }
       ├ quoted_text   原文からの機械的な切り出し（AIに生成させない）
       ├ source_url
       └ retrieved_at
```

**実装ルール**

| # | ルール |
|---|---|
| 1 | 引用文は検索で取得した原文から機械的に切り出す。AI に文を生成させない |
| 2 | `ai_citations` が0件なら `ai_runs.status = 'invalid'` とし、UI に結果を表示しない |
| 3 | AI 出力の各主張に `citation_ids[]` を持たせ、主張と根拠を1対多で対応させる |
| 4 | モデルまたはプロンプトを変更したら版を上げ、過去実行との比較を可能にする |

### 3.3 AI送信ポリシー

```text
送信対象データ
   ↓
機密区分を判定（C1〜C4）
   ↓
┌─ C1/C2 → 送信可
├─ C3    → ポリシー設定に従う（既定：社内承認済みプロバイダのみ）
└─ C4    → 既定で送信しない。個別承認がある場合のみ
   ↓
送信前に ai_policy_checks へ判定結果を記録
```

⚠️ **要決定** — ポリシーの具体値。Phase 0 で管理本部・法務が決定する。

### 3.4 Field Applicability Score（現場適用性スコア）

**設計方針**: 単一の数値を返すだけの実装にしない。必ず軸別の内訳と算出根拠を返す。

```text
入力
  現場条件 site_conditions（地盤・地形・河川・海象・気象・作業ヤード・周辺環境）
  施工課題 site_issues（自然文＋分類）
  候補技術 technology / patent / netis

処理
  ① 各評価軸について 適合度 a_i ∈ [0,1] を算出
     - 規則ベース（適用条件との突合）を優先
     - 規則で判定できない軸のみAIが推定（推定である旨を保持）
  ② 軸の重み w_i を現場種別ごとのプロファイルから取得
  ③ score = Σ(w_i × a_i) / Σ(w_i) × 100
  ④ 阻害要因（a_i = 0 の軸）があれば、スコアに関わらず「要確認」フラグを立てる

出力
  { score, axes: [{ axis, value, weight, basis, is_estimated }], blockers: [...] }
```

| 評価軸 | 判定方法 |
|---|---|
| 工種適合性 | 規則（工種分類の一致） |
| 地盤・地形・河川・海象・気象 | 規則（技術の適用条件と現場条件の突合） |
| 作業ヤード・周辺環境 | 規則 + AI推定 |
| 必要設備・建機・人員 | 規則（保有機械台帳との突合） |
| 工期・コスト | AI推定（推定であることを明示） |
| 品質・安全・環境・CO₂ | 規則 + AI推定。**低評価は blocker になりうる** |
| 省人化・生産性 | AI推定 |
| 導入難易度 | 規則（必要資格・実績件数） |

**MUST**（FR-M13-007）: 本スコアは導入可否の判断を代替しない。
スコア表示画面から直接「導入決定」へ遷移する動線を実装しない。安全・品質・環境部門の承認ステップを必ず挟む。

⚠️ **要決定** — 重みプロファイルの初期値。Phase 2 で現場部門と合意し、マスタとして外出しする。

### 3.5 Claim 類似度

```text
① 双方の請求項を構成要件へ分解（AI）
② 要件ごとに対応候補を求める（埋め込みの近さ）
③ 各対応について 一致 / 類似 / 相違 を判定（AI + 規則）
④ 類似度 = 一致要件数 / 対象請求項の全要件数
```

**MUST**（FR-M06-020）: 出力スキーマに侵害判定に相当するフィールドを**設けない**。
UI コンポーネント側で注記を固定表示し、開発者が任意に外せない構造とする。

```tsx
// 注記はコンポーネントに内蔵し、prop で消せないようにする
<ClaimSimilarity value={0.62} />   // 内部で常に注記を描画する
```

### 3.6 ワークフロー

```text
workflow_definitions（種別ごとの遷移定義。DBに保持し、コード直書きしない）
   ↓
workflow_instances（案件1件 = 1インスタンス）
   ↓
workflow_steps（各段の実行記録）
   ├ type = 'ai'    → ai_runs へ紐づく
   └ type = 'human' → approvals へ紐づく
```

**遷移の不変条件（実装で強制する）**

| # | 不変条件 |
|---|---|
| 1 | `type='ai'` のステップの直後に `type='human'` のステップが存在すること（定義の検証時にチェック） |
| 2 | 起案者が自分の案件を承認できない（自己承認の禁止） |
| 3 | 現場導入の遷移には安全・品質・環境ロールの承認が必須 |
| 4 | 差戻しは必ず理由を伴う |
| 5 | すべての遷移を `audit_logs` に記録する |

---

## 4. モジュール別 設計要点

| モジュール | 主テーブル | 主API | 特記事項 |
|---|---|---|---|
| M01 Dashboard | 各集計ビュー | `GET /v1/dashboard` | ロール別のウィジェット構成をサーバで決定。集計はマテリアライズドビュー |
| M02 Search | `search_queries` | `POST /v1/search` | 権限条件を SQL に含める。[検索設計](06-search-and-rag-design.md) |
| M03 Technology | `technologies` ほか | `/v1/technologies` | 版管理（`technology_versions`）。台帳の変更履歴を保持 |
| M04 Patent | `patents`, `patent_claims` | `/v1/patents` | 請求項は構造化保存。原文PDFは R2 |
| M05 Prior Art | `prior_art_studies` | `/v1/prior-art/studies` | 検索式・範囲・実施者・日時を保存し再現可能に |
| M06 Claim | `claim_analyses`, `claim_charts` | `/v1/claims/analyses` | 非同期。注記の強制表示 |
| M07 Examiner | `examiner_reviews`, `examiner_findings` | `/v1/examiner/reviews` | 非同期。人間確認事項の完了までロック |
| M08 Research | `papers` | `/v1/papers` | — |
| M09 NETIS | `netis_technologies` | `/v1/netis` | 関連付けは `entity_links` で汎用化 |
| M10 Competitor | `competitors`, 集計ビュー | `/v1/competitors` | 「推定」フィールドは明示的に分離 |
| M11 Landscape | 集計ビュー, `landscape_runs` | `/v1/landscape` | 重い集計は事前計算。夜間バッチ |
| M12 Civil | `civil_classifications` | `/v1/classify` | 多重分類。確信度を保持。人の修正を学習データへ |
| M13 Field | `sites`, `field_applications` | `/v1/field/applications` | スコアは軸別内訳必須 |
| M14 R&D | `rnd_themes`, `tech_needs` | `/v1/rnd` | Landscape から起票できる |
| M15 Invention | `inventions` | `/v1/inventions` | 既定で C3。参加者以外に不可視 |
| M16 Licensing | `license_candidates` | `/v1/licensing` | — |
| M17 Portfolio | `ip_assets`, `ip_events`, `ip_costs` | `/v1/portfolio` | 権利状態は LegalOps と同期（I-04） |
| M18 Legal | `legal_requests` | `/v1/legal/requests` | 出力は「準備資料」。判断フィールドを持たない |
| M19 Watch | `watches`, `watch_hits` | `/v1/watches` | Cron + 差分検知 |
| M20 RAG | `document_chunks` | `POST /v1/knowledge/ask` | 権限内のチャンクのみ検索対象 |
| M21 Agents | `agent_runs`, `agent_steps` | `/v1/agents/runs` | Workflows。step ごとに権限再判定 |
| M22 Workflow | `workflow_*`, `approvals` | `/v1/workflows` | 遷移定義はDB |
| M23 Reporting | `reports` | `/v1/reports` | 非同期。透かし・注記の強制 |
| M24 Data Mgmt | `entity_aliases`, `dq_issues`, `ingest_runs` | `/v1/data` | 名寄せは候補提示 + 人が確定 |
| M25 Admin | `users`, `roles`, `audit_logs` | `/v1/admin` | 監査ログは追記専用 |

---

## 5. エラー設計

| HTTP | 用途 | 備考 |
|---|---|---|
| 400 | 入力検証エラー | Zod の検証結果をフィールド単位で返す |
| 401 | 未認証 | Access JWT 不正・期限切れ |
| 403 | 機能権限なし | 存在は知られてよいリソース |
| 404 | 存在しない、**または行レベル権限なし** | C3/C4 の秘匿。403 と区別させない |
| 409 | 状態競合 | ワークフローの遷移不整合、楽観ロック |
| 422 | 業務規則違反 | 自己承認の禁止、必須ステップの欠落 |
| 429 | Rate Limit 超過 | `Retry-After` を返す |
| 500 | 内部エラー | 詳細を利用者に出さない。相関IDのみ返す |
| 503 | 依存先障害 | AIプロバイダ停止など。縮退中である旨を返す |

**エラー本文**

```json
{
  "error": {
    "code": "WORKFLOW_SELF_APPROVAL_FORBIDDEN",
    "message": "起案者はご自身の案件を承認できません。別の承認者を指定してください。",
    "correlation_id": "01J...",
    "details": []
  }
}
```

**MUST**（NFR-U-007）: `message` は日本語で、原因と次の操作を示す。謝罪文や曖昧な表現を使わない。

---

## 6. ログ設計

| 種別 | 出力先 | 保持 | 内容 |
|---|---|---|---|
| アプリログ | Workers Logs | 90日 | 相関ID、経路、所要時間、エラー |
| 監査ログ | `audit_logs`（DB） | ⚠️ 要決定 | 誰が・いつ・何に・何をしたか・結果 |
| ジョブログ | `ai_runs` / `agent_steps` / `ingest_runs` | 恒久 | 入出力・トークン量・所要時間 |
| データ品質 | `dq_issues` | 恒久 | 検出内容・対応状況 |

**相関ID**: 1リクエストに1つ発行し、API・ジョブ・AI実行のすべてに伝播させる。

**MUST**: ログに機密データ本文・シークレット・個人情報を出力しない。IDと種別のみ記録する。

---

## 7. 実装上の禁止事項

| # | 禁止 | 理由 |
|---|---|---|
| 1 | 権限判定をアプリ側の後段フィルタで行う | 件数が漏れる。SQL の WHERE に含める |
| 2 | AI に引用文を生成させる | 存在しない文を引用する危険 |
| 3 | `ai_citations` を伴わない AI 出力を確定表示する | 設計上の絶対条件に反する |
| 4 | ワークフローの遷移定義をコードに直書きする | 変更のたびにデプロイが必要になる |
| 5 | 同期APIで60秒超の処理を行う | 実行時間制約に抵触 |
| 6 | 類似度の注記を prop で無効化できるUIにする | 注記の除去を防げない |
| 7 | 監査ログを UPDATE / DELETE する | 追記専用の原則に反する |
| 8 | シークレットをコード・ログ・PR本文に含める | 情報漏えい |
