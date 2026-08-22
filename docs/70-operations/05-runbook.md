# 📕 運用手順書（Runbook）

日常運用でよく行う作業の手順集。

---

## 1. 利用者の追加

```text
① 人事情報で在籍・所属を確認
② IdP 側で対象グループへ追加（Access のポリシー対象になる）
③ CTIIP でロールを付与        POST /v1/admin/users, /v1/admin/roles
④ 必要ならプロジェクトへ追加  POST /v1/admin/projects/{id}/members
⑤ 監査ログに記録されていることを確認
⑥ 本人へ利用開始を連絡（初回ガイドを案内）
```

**MUST**: 既定は最小権限。C3/C4 の付与は必要性を確認し、期限を設ける。

## 2. 利用者の削除・異動

```text
① IdP 側でグループから除外（アクセスが即座に止まる）
② CTIIP のロール・プロジェクト参加を剥奪
③ 個別付与（resource_grants）を失効させる
④ 担当中の案件を引き継ぐ（workflow_instances の assignee を変更）
⑤ 監査ログを確認
```

**MUST**: 退職・異動の当日に実施する。放置しない。

## 3. 権限棚卸し（半期）

```text
① 全利用者のロール・プロジェクト参加・個別付与を一覧出力
② 所属長へ確認を依頼
③ 不要な権限を剥奪
④ 期限切れの個別付与を失効
⑤ 実施記録を残す（監査対応）
```

## 4. 取り込みジョブの再実行

```text
【一部失敗】
① DLQ の内容を確認   GET /v1/data/ingest-runs
② 原因が一時的なら再投入
③ 恒久的なら取り込みアダプタを修正してから再投入

【全体やり直し】
① ingest_runs の cursor を戻す
② スケジューラを手動実行
③ 冪等性により重複は発生しない（source, source_id で UPSERT）
```

## 5. 埋め込みモデルの切り替え

> ⚠️ 影響が大きい。事前に mvp で検証すること。

```text
① 新モデルで検索品質を評価（[検索設計 §8](../30-design/06-search-and-rag-design.md)）
② 次元数が変わる場合、列定義の変更が必要 → マイグレーション計画を作る
③ 新 embed_model で全チャンクの再生成ジョブを投入
④ 生成完了を確認（件数の突合）
⑤ 検索の参照先を新モデルへ切り替え
⑥ 検索品質を再測定
⑦ 旧埋め込みを削除（🔒 承認後）
```

## 6. 名寄せの確定

```text
① 候補を確認   GET /v1/data/aliases?status=unconfirmed
② 内容を精査（同一企業か、別法人か）
③ 確定        POST /v1/data/aliases/{id}/confirm
④ 影響する集計（競合分析・Landscape）を再計算
```

**MUST**: 名寄せは人が確定する。AI の候補をそのまま自動確定しない。

## 7. AI コストの確認と制御

```text
【日次】
① トークン消費を確認（ダッシュボード）
② 予算比で警告水準に達していないか

【超過の兆候】
③ 消費の多いジョブ種別・利用者を特定  ai_runs の集計
④ 原因を確認（大量実行、意図しない繰り返し、上限設定の漏れ）
⑤ 必要なら一時的に上限を引き下げる
⑥ システムオーナーへ報告
```

```sql
-- 直近7日のジョブ種別別トークン消費
SELECT kind, count(*), sum(token_input) AS in_tok, sum(token_output) AS out_tok
FROM ai_runs
WHERE created_at > now() - interval '7 days'
GROUP BY kind ORDER BY in_tok DESC;
```

## 8. Provenance 充足率の確認（日次）

```sql
SELECT
  count(*) FILTER (WHERE status='succeeded') AS succeeded,
  count(*) FILTER (
    WHERE status='succeeded'
      AND NOT EXISTS (SELECT 1 FROM ai_citations c WHERE c.ai_run_id = ai_runs.id)
  ) AS without_citation
FROM ai_runs
WHERE created_at > now() - interval '1 day';
```

**`without_citation` が 0 でない場合は不具合**。直ちに調査し、該当実行を `invalid` にする。

## 9. 検索品質の定点測定（月次）

```text
① 正解セットで検索を実行
② Recall@20 / Precision@10 / MRR を算出
③ 前回からの変化を確認
④ 悪化していれば原因を調査（データ増加、モデル、重み、しきい値）
⑤ 結果を記録し、ADR-0003 の再評価条件に該当しないか確認
```

## 10. preview 環境の残存確認（週次）

```text
① クローズ済み PR の Neon ブランチが残っていないか
② preview Worker が残っていないか
③ 残っていれば削除（コストと機密の残存を防ぐ）
```

## 11. 監査ログの提供

```text
① 依頼内容を確認（期間・対象・目的）
② GET /v1/admin/audit-logs で抽出
③ 改変不可の形式で出力
④ 提供記録を残す（監査ログの提供自体も監査対象）
```

**MUST**: 監査ログの抽出・提供も `audit_logs` に記録する。

## 12. 定期作業カレンダー

| 頻度 | 作業 |
|---|---|
| 日次 | エラー率・DLQ・Provenance 充足率・AI コストの確認 |
| 週次 | データ品質・性能推移・preview 残存・利用率・バックアップ検証 |
| 月次 | コスト集計・容量確認・検索品質の定点測定・アラート見直し |
| 半期 | 権限棚卸し・復旧訓練・監視項目とドキュメントの見直し |
| 随時 | 利用者の追加・削除、名寄せ確定、障害対応 |
