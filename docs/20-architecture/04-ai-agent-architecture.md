# 🤖 AIエージェント構成（M21）

## 1. 構成

```text
                     Orchestrator（Cloudflare Workflows）
                              │
   ┌──────────┬───────────────┼───────────────┬──────────┐
   ▼          ▼               ▼               ▼          ▼
 Search     Patent         Research         Claim      Civil
 Agent      Agent          Agent            Agent      Agent
                              │
                              ▼
                        Examiner Agent
                              ▼
                       Competitor Agent
                              ▼
                       Landscape Agent
                              ▼
                          R&D Agent
                              ▼
                       Licensing Agent
                              ▼
                         Legal Agent
                              ▼
                        Report Agent
```

## 2. Agent 定義

| Agent | 入力 | 出力 | 参照モジュール |
|---|---|---|---|
| Search | 依頼文 | 検索式、初期ヒット集合 | M02 |
| Patent | 対象分野 | 関連特許集合、書誌・請求項 | M04 |
| Research | 対象分野 | 関連論文、研究者・機関 | M08 |
| Claim | 特許集合 | 構成要件分解、Claim Chart | M06 |
| Civil | 技術集合 | 工種分類、土木観点の評価 | M12 |
| Examiner | 発明案 + 先行文献 | 新規性・進歩性の一次レビュー、人間確認事項 | M07 |
| Competitor | 分野 + 企業 | 出願推移、強弱領域 | M10 |
| Landscape | 特許集合 | クラスタ、ホワイトスペース | M11 |
| R&D | ホワイトスペース | テーマ候補、優先順位 | M14 |
| Licensing | ニーズ + 特許 | ライセンス候補、Buy/Build/Partner | M16 |
| Legal | 候補 | 法務確認事項チェックリスト | M18 |
| Report | 全出力 | レポート草案（status=draft） | M23 |

## 3. 実行基盤

| 項目 | 方式 |
|---|---|
| 実行 | Cloudflare Workflows。各 Agent = 1 step |
| 状態 | step ごとに入出力を永続化。中断後の再開が可能 |
| 再試行 | step 単位で指数バックオフ。上限超過は該当 step を失敗として記録し、後続を条件付き実行 |
| 並列 | Search / Patent / Research / Civil は並列実行。Claim 以降は依存順 |
| 中断 | 利用者が中止要求 → 次 step 開始前に停止し、部分結果を保存 |
| コスト | step ごとにトークン量を記録。ジョブ単位の上限を超えたら停止 |

## 4. 各 step の共通契約

```text
入力: { run_id, step_name, params, prior_outputs }
   ↓
① 権限・機密区分の再判定（step ごとに毎回行う）
② AI送信ポリシーの適用
③ 根拠候補の検索（RAG）
④ モデル呼び出し（プロンプト・モデルID・温度を記録）
⑤ 出力を Zod で構造検証（失敗なら再試行）
⑥ ai_citations を必ず作成
⑦ agent_steps へ入出力・所要時間・トークン量を保存
   ↓
出力: { status, output, citations[], cost }
```

**MUST**: ②〜⑥のいずれかを欠いた step は成功として扱わない。

## 5. モデル方針

| 用途 | モデル階層 | 理由 |
|---|---|---|
| 分類・抽出・要約（大量・定型） | 小型・高速モデル | コストと速度。件数が多い |
| Claim 分解・比較・模擬審査 | 高性能モデル | 法的文書の解釈。誤りの影響が大きい |
| レポート統合・文章生成 | 中〜高性能モデル | 日本語の質 |
| 埋め込み | 多言語対応の埋め込みモデル | 日本語の意味検索 |

⚠️ **要決定** — 具体的なモデルIDと単価。Phase 1 で確定し、`packages/ai` の設定として外出しする。
**MUST**: 使用したモデルIDを `ai_runs.model` に必ず記録する。モデル差し替え時に過去結果の再現性を判断するため。

## 6. プロンプト管理

| 項目 | 方針 |
|---|---|
| 保管 | `packages/ai/prompts/` にバージョン付きで管理。コードと同じレビューを経る |
| 版管理 | プロンプト変更は版番号を上げ、`ai_runs.prompt_version` に記録する |
| 評価 | 代表ケースの回帰テストを CI で実行（[../60-quality/02-test-specification.md](../60-quality/02-test-specification.md)） |
| 禁止 | 利用者入力をシステム指示として解釈させない（プロンプトインジェクション対策） |

## 7. 安全性の担保

| リスク | 対策 |
|---|---|
| 誤った断定 | 出力スキーマに「確信度」と「人間確認事項」を必須項目として持たせる |
| 根拠のない生成 | `ai_citations` 必須。0件なら invalid |
| 侵害判断への逸脱 | 出力スキーマに侵害判定フィールドを設けない。UI文言を固定 |
| 機密の外部送信 | 送信前にデータ分類を判定。C4 は既定で送信しない |
| 入力によるプロンプト操作 | 利用者入力を明示的にデータとして区切り、指示として扱わない |
| コスト暴走 | ジョブ単位・月次のトークン上限。超過時は停止しアラート |
| 無限ループ | Workflows の step 数上限と、同一 step の再試行上限を設定 |

## 8. 人の関与点（必須）

```text
Agent 連鎖の完了
   ↓
レポート草案（status = draft）
   ↓
【人のレビュー】← ここを飛ばす経路は実装しない
   ↓
確定（status = reviewed）
   ↓
配布・エクスポート可能になる
```
