# 🔄 データフロー

## 1. 取り込み（Ingest）

```text
[Cron Trigger 日次]
      ↓
ingest-scheduler
  ├ 前回取得日時（ingest_runs）を参照
  ├ 差分対象を決定
  └ Queue へ分割投入（1メッセージ = 最大N件）
      ↓
ingest-worker（並列）
  ①取得    HTTP → 生データを R2 (raw/{source}/{date}/) へ保存
  ②検証    スキーマ検証。失敗は dq_issues へ
  ③正規化  日付／国コード／IPC・CPC／人名・企業名
  ④名寄せ  entity_aliases へ候補登録（確定は人が行う）
  ⑤保存    patents / patent_claims / papers / netis_technologies …
  ⑥分割    本文をチャンク化（章・段落単位）
  ⑦埋め込み Workers AI → document_chunks.embedding
  ⑧記録    ingest_runs（件数・エラー・所要時間）
```

**冪等性**: `(source, source_id, version)` を一意キーとし、再実行しても重複しない。
**再試行**: 失敗メッセージは指数バックオフで再試行。上限超過は DLQ へ送り、`dq_issues` に起票する。

## 2. 検索（Search）

```text
利用者の入力
   ↓
[自然文の場合] AI が検索式を生成 → 利用者が確認・編集
   ↓
api /v1/search
   ├─ 字句検索  : pg_trgm（similarity）+ 前方一致・完全一致
   ├─ 意味検索  : pgvector（cosine, HNSW）
   └─ フィルタ  : 種別 / IPC / 工種 / 年代 / 国 / 権限 / 機密区分
   ↓
RRF（Reciprocal Rank Fusion）で融合
   ↓
権限フィルタ（C3/C4 は非参加者に対し件数からも除外）
   ↓
結果 + search_queries へ記録（誰が・いつ・何を）
```

詳細は [../30-design/06-search-and-rag-design.md](../30-design/06-search-and-rag-design.md)。

## 3. AI 実行と Provenance

```text
api POST /v1/ai/runs  →  ai_runs(status=queued) を作成 → 202 { run_id }
   ↓ Queue
ai-worker
   ①対象データの取得（権限・機密区分を再判定）
   ②AI送信ポリシー適用（C4 は既定で送信しない）
   ③検索で根拠候補を収集（RAG）
   ④Claude API 呼び出し（プロンプト・モデルID・パラメータを記録）
   ⑤出力の構造化（Zod で検証）
   ⑥根拠の紐づけ → ai_citations（必須）
   ⑦ai_runs(status=succeeded) 更新。トークン量・所要時間を記録
```

```text
Provenance の連鎖（必ず辿れること）

ai_runs.output
   └→ ai_citations
        ├→ source_type（patent / paper / netis / technology / document）
        ├→ source_id
        ├→ locator（請求項番号 / 段落 / 文字オフセット）
        ├→ quoted_text（該当文）
        ├→ retrieved_at
        └→ source_url
```

**MUST**: `ai_citations` が0件の `ai_runs` は `status=invalid` とし、確定成果物として扱わない。

## 4. ワークフロー（承認）

```text
案件（invention / field_application / license_candidate …）
   ↓
workflow_instances（現在ステータス、担当、期限）
   ↓
workflow_steps（各段の実行記録）
   ├─ AI実行ステップ  → ai_runs へ紐づく
   └─ 人の承認ステップ → approvals（承認者・日時・対象版・コメント）
   ↓
遷移のたびに audit_logs へ記録
```

**MUST**: AI実行ステップの直後に人の確認ステップを必ず置く。定義上スキップできない。

## 5. 帳票生成

```text
api POST /v1/reports  → reports(status=queued) → 202
   ↓ Queue
report-worker
   ①データ収集（権限で再フィルタ）
   ②テンプレート適用
   ③生成日時・生成者・データ取得日・注記を必ず埋め込む
   ④機密区分に応じ透かしを付与
   ⑤R2 へ保存（reports/{tenant}/{id}.{ext}）
   ⑥署名付きURLを発行（有効期限つき）
   ⑦audit_logs（export）へ記録
```

## 6. 外部連携（LegalOps-DX）

```text
CTIIP                                   Construction-LegalOps-DX
──────                                  ────────────────────────
承認済み案件
  → legal_requests(status=sent)
  → I-01 送信（キュー／Webhook）  ────→  受信・法務レビュー
                                              ↓
  ← I-02 結果受信（Webhook）      ←────  判定・条件
  → legal_requests(status=answered)
  → 通知・ワークフロー更新
```

⚠️ **要決定** — 送受信方式（Queue / Webhook / API ポーリング）、認証、再送設計。Phase 4 開始前。

## 7. 監査ログ

```text
すべてのAPI呼び出し
   ↓
audit middleware
   ├─ actor（利用者ID・ロール・IP・UA）
   ├─ action（login / search / view / ai_run / export / download / update / delete / approve / grant）
   ├─ target（種別・ID・機密区分）
   ├─ result（成功・失敗・拒否理由）
   └─ occurred_at
   ↓
audit_logs（追記専用。UPDATE/DELETE を許可しない）
```

**MUST**: 拒否された操作（権限不足）も記録する。攻撃検知と権限設計の見直しに用いる。
