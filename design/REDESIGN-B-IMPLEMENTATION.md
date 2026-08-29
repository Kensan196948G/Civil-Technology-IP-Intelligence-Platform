# WebUI リデザイン実装メモ — デザインB（AI対話型）

`Civil Technology Platform redesign.zip` のうち **採用案B（AI対話型 / design-B-copilot.dc.html）** を
`apps/web`（Next.js App Router）へ実装しました。

## 実装方針

- デザインBの「共通シェル（サイドバー + ヘッダー + MVPバッジ）+ 12画面 + 右ドロワー」を再現。
- 従来のDB連携画面（横断検索・承認一覧・ダッシュボード件数）は**実データ描画を維持**しつつ新デザインに刷新。
- デザインBのデモ画面（Copilot・現場適用スコア・調査案件・発明・ウォッチ・レポート・監査・システム管理・全モジュール）は
  プロトタイプどおりのダミーデータで描画（画面上部の「MVP環境・ダミーデータ」バッジで明示）。
- 詳細ページ（/patents/*, /claims/*, /field/by-tech/* など）は従来コンテンツのまま新シェルを継承。

## 変更ファイル

### 共通シェル
| ファイル | 内容 |
|---|---|
| `apps/web/src/app/globals.css` | デザインシステム全面書き換え（IBM Plex Sans JP/Mono、#EEF1F5基調、オレンジ #E08A2B アクセント、カード/チップ/タグ/ドロワー等）。旧クラス名（.card/.btn/.notice/table.plain等）は互換維持 |
| `apps/web/src/lib/nav.ts` | PRIMARY_NAV / TASK_NAV / RECENT_CONVOS / ROUTE_META / resolveRouteMeta() を追加（NAV_SECTIONSは従来メニューの真実として維持） |
| `apps/web/src/components/Sidebar.tsx` | デザインB形式：ロゴ・メニュー検索(⌘K)・主要3メニュー・「会話から始まる仕事」8タスク・最近の会話・全モジュール・ユーザーフッター |
| `apps/web/src/components/AppShell.tsx` | 62pxヘッダー（ルート別タイトル/サブタイトル + MVPバッジ）+ サイドバー + メイン。`.main` クラス維持 |

### 共有コンポーネント（新規）
| ファイル | 内容 |
|---|---|
| `apps/web/src/components/ui.tsx` | Tag / Chip / Note / Progress / ScoreRing / Panel / Kv / KpiCard / DemoBadge |
| `apps/web/src/components/demo.ts` | デザインBのデモデータ（CONVOS/AGENTS/AXES/INVEST/INVENT/APPROVE/WATCH/REPORT/AUDIT/ADMIN） |
| `apps/web/src/components/modules-data.ts` | 全モジュール20分類データ（設計ファイルから抽出） |
| `apps/web/src/components/DetailDrawer.tsx` | 右側470pxドロワー（メタ/本文/出どころ/注記/アクション） |

### 画面
| ルート | 実装 |
|---|---|
| `/ai-assistant` | **Copilotホーム**（プロンプト入力・会話カード・候補スコア・出どころ・専門Agent・自律調査ジョブ・最近のAI実行） |
| `/dashboard` | デザインBダッシュボード（KPI 5枚 + **実DB件数** + 対応案件 + AI実行と根拠 + 今週のウォッチ） |
| `/search` | 横断検索（**実DB検索を維持**、AI検索条件表示・チップ型タブ・新結果行） |
| `/field` | 現場適用性評価（スコアリング78点・8軸内訳・現場条件・原文ドロワー） |
| `/investigations` | 調査案件（ステータスチップ・進捗バー・根拠件数・ドロワー） |
| `/inventions` | 発明・出願（C4機密注記・機密区分・AI模擬審査のテーブル） |
| `/approvals` | 承認・レビュー（**実DB案件を維持**・フィルタチップ・案件リンク） |
| `/watch` | ウォッチ・アラート（週次ダイジェスト・重要度タグ） |
| `/reports` | レポート（種別チップ・一覧テーブル・社外禁止注記） |
| `/audit` | セキュリティ・監査（追記専用注記・操作/結果タグ） |
| `/admin` | システム管理（新規：ユーザー・ロール / システム状態 / Runbook / 設定）※RBAC（executive/sysadmin）は従来どおり |
| `/modules` | 全モジュール20分類（新規：実装済み=青チップで遷移可 / 未実装=灰） |

## デザイン原則（デザインBより継承・固定）

- 「AIは決めません。スコア・類似度は目印」の注記は消せない
- 回答には必ず根拠（出典）が付く。根拠0件のAI実行は保存されない
- ワークフローのAIステップ直後には必ず人の確認ステップが入る
- C4（出願前発明）は存在自体を表示しない（404）、監査ログは追記専用

## 検証

- `pnpm --filter @ctiip/web typecheck` / `lint` / `build` 通過
- Playwright e2e（`e2e/mvp-flows.spec.ts`）で既存フロー（ログイン→ダッシュボード件数、横断検索、現場適用スコア、承認ワークフロー、RBAC、エラーバウンダリ）の回帰を確認
