# ⏱️ バッチ・ジョブ設計

## 1. ジョブ種別

| 種別 | 実行基盤 | 契機 | 冪等性 |
|---|---|---|---|
| データ取り込み | Queues + ingest-worker | Cron（日次） | `(source, source_id, version)` |
| 埋め込み生成 | Queues + ingest-worker | 取り込み後・再生成要求 | `(source_type, source_id, chunk_seq, embed_model)` |
| 単発AI処理 | Queues + ai-worker | 利用者操作 | `Idempotency-Key` |
| エージェント連鎖 | Cloudflare Workflows | 利用者操作 | `run_id` |
| 帳票生成 | Queues + report-worker | 利用者操作 | `report_id` |
| ウォッチ検知 | Cron + Queues | Cron（日次／週次） | `(watch_id, source, change_kind)` |
| 集計（Landscape・ダッシュボード） | Cron | Cron（夜間） | 再実行で上書き |
| データ品質チェック | Cron | Cron（週次） | 再実行で上書き |
| バックアップ | Cron | Cron（日次） | 日付キー |

## 2. Cron スケジュール（案）

⚠️ 時刻は JST。⚠️ **要決定** — 外部データ源の更新時刻に合わせて調整する。

| ジョブ | 頻度 | 時刻 | 想定所要 |
|---|---|---|---|
| 特許取り込み | 日次 | 01:00 | ⚠️ 実測後に確定 |
| 論文取り込み | 日次 | 02:00 | 〃 |
| NETIS 取り込み | 週次（月） | 03:00 | 〃 |
| 埋め込み再生成（差分） | 日次 | 04:00 | 〃 |
| Landscape 集計 | 日次 | 05:00 | 〃 |
| ダッシュボード集計 | 日次 | 05:30 | 〃 |
| ウォッチ検知（日次分） | 日次 | 06:00 | 〃 |
| ウォッチ検知（週次分） | 週次（月） | 06:30 | 〃 |
| データ品質チェック | 週次（日） | 07:00 | 〃 |
| 論理バックアップ | 日次 | 23:00 | 〃 |
| 権限棚卸しリマインド | 月次（1日） | 09:00 | — |
| LegalOps 権利状態同期（I-04） | 日次 | 07:30 | 〃 |

**MUST**: 業務時間（8:00-20:00）に重いバッチを重ねない。

## 3. キュー構成

| キュー | 用途 | 並列度 | 再試行 | DLQ |
|---|---|---|---|---|
| `ctiip-ingest` | 外部データ取り込み | ⚠️ 要決定 | 5回・指数バックオフ | `ctiip-ingest-dlq` |
| `ctiip-embed` | 埋め込み生成 | ⚠️ 要決定 | 3回 | `ctiip-embed-dlq` |
| `ctiip-ai` | 単発AI処理 | ⚠️ 要決定 | 2回 | `ctiip-ai-dlq` |
| `ctiip-report` | 帳票生成 | 低 | 2回 | `ctiip-report-dlq` |
| `ctiip-notify` | 通知送信 | 低 | 3回 | `ctiip-notify-dlq` |

**DLQ の運用**: DLQ に入ったメッセージは `dq_issues` に起票し、担当者へ通知する。放置を検知するため件数を監視する。

## 4. 取り込みジョブの詳細

```text
ingest-scheduler（Cron Worker）
  ① ingest_runs から前回の cursor を取得
  ② 取得対象を決定（差分）
  ③ Queue へ分割投入（1メッセージ = 最大 N 件。N は ⚠️ 要決定）
  ④ ingest_runs を started で作成

ingest-worker（Queue Consumer）
  各メッセージについて:
  ① 取得（HTTP。レート制限を尊重し、429 は待機して再試行）
  ② 生データを R2 へ保存  raw/{source}/{yyyy-mm-dd}/{batch}.json
  ③ スキーマ検証。失敗 → dq_issues（kind='anomaly'）
  ④ 正規化（日付・国コード・IPC/CPC・人名・企業名）
  ⑤ 名寄せ候補 → entity_aliases（確定はしない）
  ⑥ UPSERT（source, source_id で一意）
  ⑦ 本文をチャンク化 → ctiip-embed へ投入
  ⑧ ingest_runs のカウンタを更新

  失敗時: 5回まで再試行 → DLQ → dq_issues 起票 → 通知
```

**チャンク分割の方針**

| 対象 | 分割単位 |
|---|---|
| 特許請求項 | 請求項1件＝1チャンク（境界が意味を持つため分割しない） |
| 特許明細書 | 章・段落単位。⚠️ 最大長は埋め込みモデル確定後に決定 |
| 論文 | 要旨は1チャンク。本文は節単位 |
| NETIS | 項目単位 |
| 技術台帳 | 項目単位（概要・原理・適用条件…） |

**MUST**: チャンクには必ず `char_start` / `char_end` を保持する（Provenance のため）。

## 5. AIジョブの詳細

```text
ai-worker
  ① ai_runs を running へ
  ② 対象データを取得し、権限・機密区分を再判定
     （起票時と実行時で権限が変わっている可能性がある）
  ③ AI送信ポリシーを適用 → ai_policy_checks へ記録
     C4 かつ個別承認なし → status='failed', error='policy_denied'
  ④ RAG: 根拠候補を検索（権限内のチャンクのみ）
  ⑤ モデル呼び出し（タイムアウト・再試行あり）
  ⑥ 出力を Zod で検証。失敗 → 1回だけ再試行 → 失敗なら status='failed'
  ⑦ ai_citations を作成（原文からの機械的な切り出し）
     0件 → status='invalid'
  ⑧ ai_runs を succeeded へ。token_usage / duration_ms を記録
  ⑨ 完了通知（画面・SSE）
```

## 6. エージェント連鎖（Workflows）

```text
step 1  search      ┐
step 2  patent      ├ 並列実行可
step 3  research    │
step 4  civil       ┘
step 5  claim       ← 1..4 の結果に依存
step 6  examiner
step 7  competitor
step 8  landscape
step 9  rnd
step 10 licensing
step 11 legal
step 12 report      → status='draft' で保存（確定しない）
```

| 項目 | 設計 |
|---|---|
| 再試行 | step 単位。3回まで。超過したら該当 step を failed とし、後続は条件付き実行 |
| 中断 | 次 step 開始前に中止要求を確認。部分結果を保存して cancelled |
| コスト上限 | run 単位のトークン上限。超過で停止しアラート |
| step 上限 | 無限ループ防止のため最大 step 数を設定 |
| 権限 | **step ごとに毎回再判定する**（長時間実行のため権限が変わりうる） |

## 7. 監視項目

| 指標 | 閾値（⚠️ 要決定） | 対応 |
|---|---|---|
| キュー滞留数 | 一定数超過 | 並列度の見直し、優先度の低いジョブ停止 |
| DLQ 件数 | 1件以上 | 調査。原因を `dq_issues` に記録 |
| ジョブ失敗率 | 一定率超過 | 原因分析。外部APIの障害を疑う |
| 取り込み件数の急変 | 前日比の大幅変動 | 取得元の仕様変更を疑う |
| AI トークン消費 | 月次予算比 | 上限に近づいたら通知、超過で停止 |
| バッチ超過時間 | 業務時間に食い込む | 分割・並列度の調整 |

## 8. 再実行の手順

| 状況 | 手順 |
|---|---|
| 取り込み失敗（一部） | DLQ から再投入。`(source, source_id)` で冪等なので重複しない |
| 取り込み失敗（全体） | `ingest_runs` の cursor を戻して再実行 |
| 埋め込みモデル変更 | 全チャンクの再生成ジョブを投入。`embed_model` 列で新旧を区別し、切替は一括で行う |
| AI実行の失敗 | 画面から再実行。`ai_runs` は新規レコードとして作成し、旧レコードを残す |
| 帳票生成の失敗 | 同一 `report_id` で再実行（上書き） |

**MUST**: 失敗した `ai_runs` を削除しない。失敗の記録も監査対象である。
