# 🔌 API 仕様

| 項目 | 値 |
|---|---|
| 方式 | REST / JSON |
| ベースURL | `https://ctiip.mirai-dx-platform.com/api/v1` |
| 認証 | Cloudflare Access JWT（`CF-Access-JWT-Assertion`）。内部呼び出しは Service Binding + 内部トークン |
| 仕様書 | OpenAPI 3.1 を `apps/api` から自動生成し、`/api/v1/openapi.json` で配信 |
| 文字コード | UTF-8 |
| 時刻 | ISO 8601（UTC、`Z` 付き） |

---

## 1. 共通仕様

### 1.1 ヘッダ

| ヘッダ | 用途 |
|---|---|
| `CF-Access-JWT-Assertion` | 認証（Access が付与） |
| `X-Correlation-Id` | 相関ID。未指定ならサーバが発行し、応答に返す |
| `Idempotency-Key` | POST の冪等性（ジョブ起票に使用） |
| `X-Ctiip-Internal-Token` | Worker 間呼び出し |

### 1.2 一覧応答

```json
{
  "items": [],
  "page": { "cursor": "eyJ...", "has_more": true, "total": 1234 }
}
```

カーソルページングを標準とする。`total` は概算でよい（大規模結果で正確な件数を取らない）。

### 1.3 エラー応答

```json
{
  "error": {
    "code": "CLASSIFICATION_FORBIDDEN",
    "message": "この情報を参照する権限がありません。",
    "correlation_id": "01J8...",
    "details": [{ "field": "site_id", "reason": "not_found" }]
  }
}
```

ステータスコードの使い分けは [詳細設計 §5](01-detailed-design.md#5-エラー設計) を参照。
**行レベル権限がない場合は 404 を返す**（存在を秘匿する）。

### 1.4 非同期ジョブの契約

長時間処理は次の3本立てとする。

```text
POST   /v1/{resource}                → 202 { id, status: "queued" }
GET    /v1/{resource}/{id}           → { status, progress, result?, citations? }
GET    /v1/{resource}/{id}/events    → text/event-stream（進捗）
DELETE /v1/{resource}/{id}           → 実行中ジョブの中止
```

`status`: `queued` / `running` / `succeeded` / `failed` / `cancelled` / `invalid`

### 1.5 Rate Limit

| 対象 | 制限 |
|---|---|
| 一般API | ⚠️ 要決定（暫定 60 req/min/利用者） |
| 検索 | ⚠️ 要決定（暫定 30 req/min/利用者） |
| AI実行の起票 | ⚠️ 要決定（暫定 10 req/min/利用者、月次トークン上限あり） |
| エクスポート | ⚠️ 要決定（暫定 10 req/hour/利用者） |

超過時は `429` と `Retry-After` を返す。

---

## 2. エンドポイント一覧

### 2.1 検索（M02）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/v1/search` | 横断検索 |
| `POST` | `/v1/search/compose` | 自然文から検索式を生成 |
| `GET` | `/v1/search/queries` | 検索履歴 |
| `POST` | `/v1/search/saved` | 検索条件の保存 |
| `GET` | `/v1/search/saved` | 保存済み検索の一覧 |

```jsonc
// POST /v1/search
{
  "query": "港湾 ケーソン 据付 自動化",
  "mode": "hybrid",                    // hybrid | lexical | semantic
  "types": ["patent","paper","netis","technology"],
  "filters": {
    "ipc": ["E02B"], "work_types": ["port"],
    "countries": ["JP"], "date_from": "2015-01-01"
  },
  "page": { "cursor": null, "limit": 20 }
}
```

```jsonc
// 200
{
  "items": [{
    "type": "patent",
    "id": "01J...",
    "title": "ケーソン据付装置および据付方法",
    "snippet": "…<em>ケーソン</em>を…",
    "score": 0.842,
    "score_detail": { "lexical_rank": 3, "semantic_rank": 1, "rrf": 0.0325 },
    "classification": "C1",
    "source": { "name": "JPO", "url": "https://…", "retrieved_at": "2026-08-20T02:11:00Z" }
  }],
  "page": { "cursor": "eyJ...", "has_more": true, "total": 1240 },
  "query_id": "01J..."
}
```

### 2.2 特許・論文・NETIS（M04 / M08 / M09）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/v1/patents` | 一覧・絞り込み |
| `GET` | `/v1/patents/{id}` | 詳細（書誌・法的状態） |
| `GET` | `/v1/patents/{id}/claims` | 請求項（Claim Tree 付き） |
| `GET` | `/v1/patents/{id}/family` | ファミリー |
| `GET` | `/v1/patents/{id}/citations` | 引用・被引用 |
| `GET` | `/v1/patents/{id}/related` | 関連技術・論文・NETIS |
| `POST` | `/v1/patents/{id}/comments` | 社内コメント |
| `PUT` | `/v1/patents/{id}/evaluation` | 社内評価 |
| `GET` | `/v1/papers` `/v1/papers/{id}` | 論文 |
| `GET` | `/v1/netis` `/v1/netis/{id}` | NETIS |

### 2.3 技術台帳（M03 / M12）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/technologies` | 一覧・登録 |
| `GET` `PATCH` `DELETE` | `/v1/technologies/{id}` | 詳細・更新・論理削除 |
| `GET` | `/v1/technologies/{id}/versions` | 版履歴 |
| `GET` | `/v1/technologies/{id}/similar` | 類似技術 |
| `POST` | `/v1/technologies/compare` | 技術比較 |
| `GET` `POST` | `/v1/machines` | 機械・船舶台帳 |
| `POST` | `/v1/classify` | 土木分類の付与（非同期） |
| `PATCH` | `/v1/classifications/{id}` | 分類の人手修正 |

### 2.4 先行技術調査（M05）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/prior-art/studies` | 調査案件 |
| `GET` `PATCH` | `/v1/prior-art/studies/{id}` | 詳細・更新 |
| `POST` | `/v1/prior-art/studies/{id}/execute` | 検索実行（非同期） |
| `POST` | `/v1/prior-art/studies/{id}/rerun` | 差分調査 |
| `GET` `POST` `DELETE` | `/v1/prior-art/studies/{id}/hits` | ヒット文献の管理 |

**MUST**: `execute` 時に `scope` と `query_dsl` を必ず保存する（再現性のため）。

### 2.5 Claim 解析（M06）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/v1/claims/decompose` | 請求項の構成要件分解（非同期） |
| `POST` | `/v1/claims/analyses` | 比較の実行（非同期） |
| `GET` | `/v1/claims/analyses/{id}` | 結果（Claim Chart） |
| `PATCH` | `/v1/claims/analyses/{id}/rows/{rowId}` | 判定の人手修正 |
| `POST` | `/v1/claims/analyses/{id}/export` | 帳票化（透かし強制） |

```jsonc
// GET /v1/claims/analyses/{id} の応答（抜粋）
{
  "id": "01J...",
  "similarity": 0.62,
  "disclaimer": "類似度は権利侵害の判断ではありません。",   // 常時付与。省略不可
  "rows": [{
    "seq": 1, "left_label": "A", "kind": "match",
    "rationale": "同一の据付機構を備える",
    "citations": [{ "source_type":"patent","source_id":"01J...","locator":{"claim_no":1,"char_start":120,"char_end":198},"quoted_text":"…" }]
  }]
}
```

> `disclaimer` はサーバが必ず付与する。クライアントが省略できないよう、スキーマ上 required とする。

### 2.6 AI模擬審査（M07）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/v1/examiner/reviews` | 模擬審査の実行（非同期） |
| `GET` | `/v1/examiner/reviews/{id}` | 結果 |
| `GET` | `/v1/examiner/reviews/{id}/findings` | 指摘一覧 |
| `POST` | `/v1/examiner/reviews/{id}/human-check` | 人間確認事項の完了記録 |

**MUST**: `human-check` が完了するまで、対象案件のワークフローを次段へ進めない（422 を返す）。

### 2.7 現場適用（M13）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/sites` | 現場 |
| `GET` `PUT` | `/v1/sites/{id}/conditions` | 現場条件 |
| `GET` `POST` | `/v1/sites/{id}/issues` | 施工課題（写真添付可） |
| `POST` | `/v1/field/applications` | 適用性評価の実行（非同期） |
| `GET` | `/v1/field/applications/{id}` | スコアと軸別内訳 |
| `POST` | `/v1/field/applications/{id}/adopt` | 導入検討の起票 |

```jsonc
// GET /v1/field/applications/{id}
{
  "score": 74.0,
  "axes": [
    { "axis": "work_type_fit", "value": 1.0, "weight": 3, "basis": "rule", "is_estimated": false },
    { "axis": "marine",        "value": 0.6, "weight": 3, "basis": "rule:波高2.0m<=限界2.5m", "is_estimated": false },
    { "axis": "cost",          "value": 0.5, "weight": 2, "basis": "ai_estimate",  "is_estimated": true }
  ],
  "blockers": [],
  "notice": "本スコアは導入可否の判断を代替しません。安全・品質・環境部門の承認が必要です。"
}
```

> `adopt` は導入決定ではなく「検討の起票」。承認ワークフローを必ず経由する。

### 2.8 発明・知財（M15 / M17）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/inventions` | 発明届 |
| `GET` `PATCH` | `/v1/inventions/{id}` | 詳細・更新 |
| `POST` | `/v1/inventions/{id}/organize` | AIによる整理（非同期） |
| `POST` | `/v1/inventions/{id}/claim-candidates` | Claim候補生成（非同期） |
| `POST` | `/v1/inventions/{id}/submit` | 審査依頼（ワークフローへ） |
| `GET` | `/v1/portfolio/assets` | 知財台帳 |
| `GET` | `/v1/portfolio/assets/{id}/events` `/costs` | 権利イベント・費用 |
| `GET` | `/v1/portfolio/unused` | 未活用特許 |

### 2.9 分析（M10 / M11 / M14 / M16 / M18）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/competitors` | 競合企業 |
| `GET` | `/v1/competitors/{id}/trends` | 出願推移・強弱領域 |
| `POST` | `/v1/landscape/runs` | Landscape 生成（非同期） |
| `GET` | `/v1/landscape/runs/{id}` | マップ・クラスタ・ホワイトスペース |
| `POST` | `/v1/landscape/runs/{id}/to-rnd` | R&D テーマへ起票 |
| `GET` `POST` | `/v1/rnd/themes` `/v1/rnd/needs` | R&D テーマ・技術ニーズ |
| `GET` `POST` | `/v1/licensing/candidates` | ライセンス候補 |
| `POST` | `/v1/licensing/candidates/{id}/evaluate` | 適合評価（非同期） |
| `GET` `POST` | `/v1/legal/requests` | 法務確認事項 |
| `POST` | `/v1/legal/requests/{id}/send` | LegalOps へ送出 |

### 2.10 ナレッジ・エージェント（M20 / M21）

| メソッド | パス | 説明 |
|---|---|---|
| `POST` | `/v1/knowledge/ask` | 自然文問い合わせ（非同期／SSE） |
| `GET` | `/v1/knowledge/sessions/{id}` | 会話履歴 |
| `POST` | `/v1/agents/runs` | エージェント連鎖の起動 |
| `GET` | `/v1/agents/runs/{id}` | 進捗・結果 |
| `GET` | `/v1/agents/runs/{id}/steps` | 各ステップの入出力 |
| `DELETE` | `/v1/agents/runs/{id}` | 中止 |

```jsonc
// GET /v1/agents/runs/{id}
{
  "status": "running",
  "progress": { "done": 6, "total": 12, "current": "examiner" },
  "cost": { "token_input": 412000, "token_output": 38000, "limit": 1000000 },
  "steps": [{ "name":"search","status":"succeeded","duration_ms":8200,"ai_run_id":"01J..." }]
}
```

### 2.11 ワークフロー・帳票（M22 / M23）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/v1/workflows/instances` | 自分の案件・承認待ち |
| `GET` | `/v1/workflows/instances/{id}` | 詳細・履歴 |
| `POST` | `/v1/workflows/instances/{id}/transition` | 遷移（承認・差戻し・保留） |
| `POST` | `/v1/reports` | 帳票生成（非同期） |
| `GET` | `/v1/reports/{id}` | 状態 |
| `GET` | `/v1/reports/{id}/download` | 署名付きURLへリダイレクト |

```jsonc
// POST /v1/workflows/instances/{id}/transition
{ "action": "approve", "comment": "技術的に妥当", "subject_version": 3 }
// 422 の例
{ "error": { "code": "WORKFLOW_SELF_APPROVAL_FORBIDDEN", "message": "起案者はご自身の案件を承認できません。" } }
```

### 2.12 監視・管理（M19 / M24 / M25）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` `POST` | `/v1/watches` | ウォッチ条件 |
| `GET` | `/v1/watches/{id}/hits` | 検知結果 |
| `POST` | `/v1/watches/{id}/hits/{hitId}/read` | 既読 |
| `GET` | `/v1/data/aliases` | 名寄せ候補 |
| `POST` | `/v1/data/aliases/{id}/confirm` | 名寄せの確定（人が行う） |
| `GET` | `/v1/data/issues` | データ品質の課題 |
| `GET` | `/v1/data/ingest-runs` | 取り込み実行履歴 |
| `GET` `POST` `DELETE` | `/v1/admin/users` `/roles` `/grants` | 利用者・権限 |
| `GET` | `/v1/admin/audit-logs` | 監査ログ検索 |
| `GET` | `/v1/admin/policies/ai` | AI送信ポリシー |

### 2.13 ダッシュボード（M01）

| メソッド | パス | 説明 |
|---|---|---|
| `GET` | `/v1/dashboard?view=personal\|department\|executive` | ロール別ウィジェット |
| `GET` | `/v1/dashboard/alerts` | 要対応アラート |

---

## 3. 外部連携（Construction-LegalOps-DX）

| ID | 方向 | 方式 | エンドポイント |
|---|---|---|---|
| I-01 | 送信 | Webhook / Queue | LegalOps 側の受信URL ⚠️ 要決定 |
| I-02 | 受信 | Webhook | `POST /v1/integrations/legalops/reviews` |
| I-03 | 受信 | Webhook | `POST /v1/integrations/legalops/contracts` |
| I-04 | 受信 | 日次バッチ | `POST /v1/integrations/legalops/ip-status` |

**認証**: 相互 TLS または署名付きペイロード（⚠️ 要決定）。
**冪等性**: `external_ref` + `event_id` で重複を排除する。
**再送**: 失敗時は指数バックオフで再送。上限超過は `dq_issues` に起票し、担当者へ通知する。

---

## 4. バージョニング

| 項目 | 方針 |
|---|---|
| パス | `/api/v1`。破壊的変更時のみ `v2` を追加し、`v1` を一定期間並行提供する |
| 非破壊的変更 | 項目の追加は `v1` 内で行う。クライアントは未知の項目を無視すること |
| 廃止 | 廃止予定は応答ヘッダ `Deprecation` と `Sunset` で告知する |
