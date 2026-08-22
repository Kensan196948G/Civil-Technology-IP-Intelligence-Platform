# 📖 用語集

## 1. プロダクト・システム

| 用語 | 英語／略号 | 説明 |
|---|---|---|
| 土木技術・知財インテリジェンスプラットフォーム | CTIIP | 本システム。技術・知財情報の正本 |
| 建設法務DX | `Construction-LegalOps-DX` | 正式な法務・契約プロセスの正本。本システムの下流 |
| 旧特許調査システム | `Civil-Research-Patent-Scout` | 移管元の既存システム。移管後アーカイブ |

## 2. 知財

| 用語 | 英語 | 説明 |
|---|---|---|
| 請求項 | Claim | 特許の権利範囲を定義する文。本システムの解析対象の中核 |
| 独立請求項 | Independent Claim | 他の請求項を引用しない請求項 |
| 従属請求項 | Dependent Claim | 他の請求項を引用して限定を加える請求項 |
| 構成要件 | Claim Element | 請求項を分解した個々の技術的構成。本システムでは「部品」と表現することがある |
| クレームチャート | Claim Chart | 請求項の構成要件と対象技術を対比した表 |
| 先行技術 | Prior Art | 出願前に公開されていた技術情報 |
| 新規性 | Novelty | 先行技術と同一でないこと |
| 進歩性 | Inventive Step | 先行技術から容易に想到できないこと |
| 記載要件 | Description Requirements | 明細書・請求項の記載が法定要件を満たすこと |
| 特許ファミリー | Patent Family | 同一発明について各国へ出願された特許群 |
| IPC / CPC | — | 国際特許分類／共通特許分類 |
| 開放特許 | Open Patent | ライセンス提供の意思が示されている特許 |
| 職務発明 | Employee Invention | 従業者が職務上行った発明。規程で権利帰属と報奨を定める |

## 3. 土木・建設

| 用語 | 英語／略号 | 説明 |
|---|---|---|
| NETIS | New Technology Information System | 国土交通省の新技術情報提供システム |
| 工種 | Work Type | 港湾、河川、道路、橋梁、トンネル等の工事種別分類 |
| 工法 | Construction Method | 施工の方式・手順 |
| 現場適用性スコア | Field Applicability Score | 現場条件下での技術適用可能性を数値化した独自指標 |
| ケーソン | Caisson | 港湾構造物に用いる大型コンクリート函 |
| 浚渫 | Dredging | 水底の土砂を掘削・除去する工事 |
| BIM/CIM | — | 建設情報モデリング |
| ICT施工 | — | 情報通信技術を活用した施工 |

## 4. 技術（実装）

| 用語 | 説明 |
|---|---|
| Cloudflare Workers | エッジ実行環境。本システムの Web / API の実行基盤 |
| Cloudflare Workflows | 永続的な多段処理の実行基盤。AIエージェント連鎖に使用 |
| Cloudflare Queues | 非同期ジョブキュー。データ取り込みとAIジョブに使用 |
| Cloudflare R2 | オブジェクトストレージ。PDF・図面・レポート成果物 |
| Cloudflare Access | ゼロトラスト認証。SSO / MFA を担う |
| Neon | サーバーレス PostgreSQL。主データベース |
| Neon Branch | DBのブランチ機能。PRごとの検証用DBに使用 |
| pgvector | PostgreSQL のベクトル検索拡張 |
| pg_trgm | PostgreSQL のトライグラム検索拡張。日本語字句検索に使用 |
| RRF | Reciprocal Rank Fusion。字句検索と意味検索の結果を融合する手法 |
| RAG | Retrieval-Augmented Generation。検索結果を根拠にAIが回答する方式 |
| Provenance | 来歴。AI回答の根拠を出典まで遡れる状態 |
| RBAC | Role-Based Access Control。役割ベースのアクセス制御 |
| RLS | Row Level Security。行単位のアクセス制御 |

## 5. 本ドキュメント固有の表記

| 表記 | 意味 |
|---|---|
| ⚠️ **要決定** | 未確定。決定者と期限を併記する |
| 🔒 **承認必要** | 実行前にユーザーの明示承認が必要 |
| `Mnn` | モジュールID |
| `FR-Mnn-nnn` | 機能要件ID |
| `NFR-x-nnn` | 非機能要件ID |
